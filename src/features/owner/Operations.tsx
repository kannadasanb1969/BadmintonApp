import { useState } from 'react'
import { ownerWrite, segment, useOwnerQuery, type Academy, type Availability, type Batch, type Booking, type Court } from './api'
import { ActionForm, field, ItemsSelect, optional, Panel, PaymentMode, QueryState, readable, rupees, TextField, today } from './ui'
import { Link } from 'react-router-dom'

export const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export function Weekdays({ selected }: { selected?: number[] }) {
  return <div className="owner-weekdays">{weekdays.map((day, index) => <label key={day}>
    <input type="checkbox" name="weekdays" value={index} defaultChecked={selected?.includes(index) ?? true} />{day}
  </label>)}</div>
}

function BatchForm({ academy, courts, batch }: { academy: Academy; courts: Court[]; batch?: Batch }) {
  return <ActionForm label={batch ? 'Save batch' : 'Create batch'} reset={!batch} perform={data => {
    const daysOfWeek = data.getAll('weekdays').map(Number)
    if (!daysOfWeek.length) throw new Error('Choose at least one weekday.')
    const payload = {
      courtId: field(data, 'courtId'), type: field(data, 'type'), name: field(data, 'name'),
      startTime: field(data, 'startTime'), endTime: field(data, 'endTime'), feePerPerson: field(data, 'feePerPerson'),
      daysOfWeek, effectiveFrom: optional(data, 'effectiveFrom') ?? null, effectiveTo: optional(data, 'effectiveTo') ?? null,
    }
    return batch ? ownerWrite('/batches/' + segment(batch.id), { ...payload, status: field(data, 'status') }, 'PATCH')
      : ownerWrite('/batches', { ...payload, academyId: academy.id })
  }}>
    <div className="owner-fields">
      <TextField name="name" label="Batch name" initial={batch?.name} required />
      <ItemsSelect name="courtId" label="Court" items={courts} defaultValue={batch?.courtId} />
      <label>Batch type<select name="type" defaultValue={batch?.type ?? 'REGULAR'}><option value="REGULAR">Regular</option><option value="COACHING">Coaching</option></select></label>
      <TextField name="startTime" label="Start time (IST)" type="time" initial={batch?.startTime} required />
      <TextField name="endTime" label="End time (IST)" type="time" initial={batch?.endTime} required />
      <TextField name="feePerPerson" label="Monthly fee per person (₹)" type="number" initial={batch?.feePerPerson} required />
      <TextField name="effectiveFrom" label="Effective from" type="date" initial={batch?.effectiveFrom} />
      <TextField name="effectiveTo" label="Effective to" type="date" initial={batch?.effectiveTo} />
      {batch && <label>Status<select name="status" defaultValue={batch.status}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>}
    </div>
    <Weekdays selected={batch?.daysOfWeek} />
  </ActionForm>
}

function FeeRates({ id }: { id: string }) {
  const path = '/batches/' + segment(id) + '/fee-rates'
  const fees = useOwnerQuery<{ rates: { id: string; feeAmount: string; effectiveFrom: string }[] }>(path)
  return <div className="owner-flow">
    <QueryState query={fees} />
    {fees.data?.rates.map(rate => <p key={rate.id}>{rate.effectiveFrom} · {rupees(rate.feeAmount)}</p>)}
    <ActionForm label="Set fee rate" perform={data => ownerWrite(path, { feeAmount: field(data, 'feeAmount'), effectiveFrom: field(data, 'effectiveFrom') })}>
      <div className="owner-fields"><TextField name="feeAmount" label="Monthly fee (₹)" type="number" required /><TextField name="effectiveFrom" label="Effective from" type="date" initial={today().slice(0, 7) + '-01'} required /></div>
    </ActionForm>
  </div>
}

export function Batches({ academy }: { academy: Academy }) {
  const courts = useOwnerQuery<Court[]>('/academies/' + segment(academy.id) + '/courts')
  const batches = useOwnerQuery<Batch[]>('/batches', { academyId: academy.id })
  const [active, setActive] = useState('')
  return <>
    <QueryState query={courts} /><QueryState query={batches} />
    {Boolean(courts.data?.length) && <Panel title="Create a batch"><BatchForm academy={academy} courts={courts.data ?? []} /></Panel>}
    {courts.data?.length === 0 && <p>Add a court before creating batches.</p>}
    {batches.data?.map(batch => <Panel key={batch.id} title={batch.name}>
      <p>{readable(batch.type)} · {batch.startTime}–{batch.endTime} IST · {rupees(batch.feePerPerson)}/month</p>
      <details><summary>Edit batch</summary><BatchForm academy={academy} batch={batch} courts={courts.data ?? []} /></details>
      <button className="owner-secondary" onClick={() => setActive(active === batch.id ? '' : batch.id)}>{active === batch.id ? 'Hide fee schedule' : 'Fee schedule'}</button>
      {active === batch.id && <FeeRates id={batch.id} />}
    </Panel>)}
  </>
}

export function Calendar({ academy }: { academy: Academy }) {
  const courts = useOwnerQuery<Court[]>('/academies/' + segment(academy.id) + '/courts')
  const [courtId, setCourtId] = useState('')
  const [date, setDate] = useState(today)
  const selected = courtId || courts.data?.[0]?.id || ''
  const path = selected ? '/courts/' + segment(selected) + '/availability' : ''
  const day = useOwnerQuery<Availability>(path, { date }, Boolean(date))
  const month = useOwnerQuery<{ days: { date: string; status: string; totalSlots: number; filledSlots: number }[] }>(path && path + '-month', { month: date.slice(0, 7) }, Boolean(date))
  return <>
    <Panel title="Court availability">
      <QueryState query={courts} />
      <div className="owner-fields">
        {Boolean(courts.data?.length) && <label>Court<select value={selected} onChange={event => setCourtId(event.target.value)}>
          {courts.data?.map(court => <option value={court.id} key={court.id}>{court.name}</option>)}</select></label>}
        <label>Date (IST)<input type="date" value={date} onChange={event => { if (event.target.value) setDate(event.target.value) }} /></label>
      </div>
      <QueryState query={month} />
      {month.data && <div className="owner-calendar">{month.data.days.map(item => <button type="button" key={item.date} aria-pressed={item.date === date} className="owner-secondary" onClick={() => setDate(item.date)}>
        {item.date.slice(-2)}<small>{readable(item.status)}</small>
      </button>)}</div>}
      <QueryState query={day} />
      {day.data && <p>Available windows: {day.data.available.map(slot => slot.startTime + '–' + slot.endTime).join(', ') || 'None'}</p>}
    </Panel>
    {day.data && <Panel title="Bookings and blocks">
      {day.data.unavailable.length === 0 && <p>No bookings or blocks for this day.</p>}
      {day.data.unavailable.map((block, i) => <div className="owner-list-row" key={block.blockId ?? block.batchId ?? i}>
        <p>{block.startTime}–{block.endTime} · {block.label ?? readable(block.type)}</p>
        {block.blockId && <ActionForm label="Remove block" confirm="Remove this court block?" perform={() => ownerWrite('/court-blocks/' + segment(block.blockId!), undefined, 'DELETE')} />}
        {block.batchId && <ActionForm label="Release this day" confirm="Make this batch slot available for this day?" perform={data => ownerWrite('/batches/' + segment(block.batchId!) + '/releases', { date, reason: optional(data, 'reason') })}>
          <TextField name="reason" label="Reason for release" />
        </ActionForm>}
      </div>)}
      {day.data.releasedBatches?.map(batch => <div className="owner-list-row" key={batch.batchId}>
        <p>{batch.label} · {batch.startTime}–{batch.endTime} · Released</p>
        <ActionForm label="Restore batch" confirm="Restore this batch slot?" perform={() => ownerWrite('/batches/' + segment(batch.batchId) + '/releases/' + date, undefined, 'DELETE')} />
      </div>)}
    </Panel>}
    {selected && <Panel title="Block a court slot"><ActionForm label="Block slot" reset perform={data => ownerWrite('/court-blocks', {
      courtId: selected, date, startTime: field(data, 'startTime'), endTime: field(data, 'endTime'), reason: optional(data, 'reason'),
    })}>
      <div className="owner-fields"><TextField name="startTime" label="Start time" type="time" required /><TextField name="endTime" label="End time" type="time" required /><TextField name="reason" label="Reason" /></div>
    </ActionForm></Panel>}
  </>
}

export function OwnerBookings({ academy }: { academy: Academy }) {
  const courts = useOwnerQuery<Court[]>('/academies/' + segment(academy.id) + '/courts')
  const [view, setView] = useState('upcoming')
  const bookings = useOwnerQuery<(Booking & { academyId?: string })[]>('/bookings', { view })
  const scoped = bookings.data?.filter(item => item.academyId === academy.id || courts.data?.some(court => court.id === item.courtId))
  return <>
    <Panel title="Create a booking">
      <QueryState query={courts} />
      <ActionForm label="Create booking" reset perform={data => ownerWrite('/bookings', Object.fromEntries(
        ['courtId', 'bookingDate', 'startTime', 'endTime', 'customerName', 'customerMobile', 'bookingAmount'].map(name => [name, field(data, name)]),
      ))}>
        <div className="owner-fields">
          <ItemsSelect items={courts.data ?? []} name="courtId" label="Court" />
          <TextField name="bookingDate" label="Date (IST)" type="date" initial={today()} required />
          <TextField name="startTime" label="Start time" type="time" required /><TextField name="endTime" label="End time" type="time" required />
          <TextField name="customerName" label="Customer name" required /><TextField name="customerMobile" label="Mobile" type="tel" />
          <TextField name="bookingAmount" label="Agreed amount (₹)" type="number" required />
        </div>
      </ActionForm>
    </Panel>
    <Panel title="Bookings">
      <label>View<select value={view} onChange={event => setView(event.target.value)}><option value="upcoming">Upcoming</option><option value="history">History</option><option value="cancelled">Cancelled</option></select></label>
      <QueryState query={bookings} />
      {scoped?.length === 0 && <p>No bookings in this view.</p>}
      {scoped?.map(booking => <div className="owner-list-row" key={booking.id}>
        <div><strong>{booking.customerName || 'Booking'}</strong><p>{booking.courtName} · {booking.bookingDate} · {booking.startTime}–{booking.endTime} IST</p><p>{readable(booking.status)} · Balance {rupees(booking.paymentSummary?.balance)}</p></div>
        <Link className="owner-secondary" to={'/owner/bookings/' + segment(booking.id)}>Booking details</Link>
      </div>)}
    </Panel>
  </>
}

export function BookingDetails({ id }: { id: string }) {
  const path = '/bookings/' + segment(id)
  const booking = useOwnerQuery<Booking>(path)
  const payments = useOwnerQuery<{ payments: { id: string; receiptNumber: string; amount: string; paymentDate: string }[] }>(path + '/payments')
  const b = booking.data
  return <>
    <Link className="owner-back-link" to="/owner/bookings">← Bookings</Link>
    <header className="owner-page-heading"><h1>Booking details</h1>
      {b && <span className="owner-status-pill" data-status={b.status}>{readable(b.status)}</span>}
    </header>
    <QueryState query={booking} />
    {b && <>
      <Panel title={b.courtName || 'Court booking'}>
        <p>{b.bookingDate} · {b.startTime.slice(0, 5)}–{b.endTime.slice(0, 5)} IST</p>
        <p><strong>{b.customerName || 'Customer'}</strong>{b.customerMobile && <> · <a href={'tel:' + b.customerMobile}>{b.customerMobile}</a></>}</p>
        <dl className="owner-record-amounts">
          <div><dt>Total</dt><dd>{rupees(b.paymentSummary?.bookingAmount ?? b.bookingAmount)}</dd></div>
          {b.paymentSummary && <><div><dt>Paid</dt><dd>{rupees(b.paymentSummary.totalPaid)}</dd></div>
            <div><dt>Balance</dt><dd>{rupees(b.paymentSummary.balance)}</dd></div></>}
        </dl>
      </Panel>
      {b.status === 'CONFIRMED' && <Panel><details><summary>Cancel booking</summary><ActionForm label="Cancel booking" confirm="Cancel this booking and release the slot?" perform={data => ownerWrite(path + '/cancel', { cancellationReason: optional(data, 'reason') })}>
        <TextField name="reason" label="Cancellation reason" />
      </ActionForm></details></Panel>}
    </>}
    <Panel title="Booking payments">
      <QueryState query={payments} />
      {payments.data?.payments.map(payment => <div className="owner-list-row" key={payment.id}><p>{payment.paymentDate} · {rupees(payment.amount)}</p>
        <Link className="owner-secondary" to={'/owner/booking-receipts/' + segment(payment.id)}>Receipt {payment.receiptNumber}</Link></div>)}
      {b?.status === 'CONFIRMED' && Number(b.paymentSummary?.balance) > 0 && <ActionForm label="Record payment" confirm="Record money already received for this booking?" reset perform={data => ownerWrite(path + '/payments', {
        amount: field(data, 'amount'), paymentMode: field(data, 'paymentMode'), paymentDate: field(data, 'paymentDate'), referenceNumber: optional(data, 'referenceNumber'), note: optional(data, 'note'),
      })}>
        <div className="owner-fields"><TextField name="amount" label="Amount received (₹)" type="number" required /><PaymentMode />
          <TextField name="paymentDate" label="Payment date" type="date" initial={today()} required /><TextField name="referenceNumber" label="Reference number" /><TextField name="note" label="Note" /></div>
      </ActionForm>}
    </Panel>
  </>
}
