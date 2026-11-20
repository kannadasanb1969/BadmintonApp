import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ownerWrite, segment, useOwnerQuery, type Academy, type Batch, type Fee, type Member, type Membership, type Payment } from './api'
import { ActionForm, field, ItemsSelect, optional, Panel, PaymentMode, QueryState, readable, rupees, TextField, today } from './ui'

type MembershipInfo = Membership & { monthlyFee?: string; batchName?: string }
type Details = Member & { activeMemberships: MembershipInfo[]; history: MembershipInfo[]; inactiveMemberships?: MembershipInfo[] }

function EnrollmentFields({ batches, required = false }: { batches: Batch[]; required?: boolean }) {
  return <>
    <ItemsSelect name="batchId" label="Batch" items={batches.filter(batch => batch.status === 'ACTIVE')} required={required} />
    <TextField name="startDate" label="Start date" type="date" initial={today()} required={required} />
    <TextField name="monthlyFee" label="Monthly fee (₹)" type="number" required={required} />
  </>
}

export function Members({ academy }: { academy: Academy }) {
  const members = useOwnerQuery<Member[]>('/members', { academyId: academy.id })
  const batches = useOwnerQuery<Batch[]>('/batches', { academyId: academy.id })
  const [filter, setFilter] = useState('')
  const { hash } = useLocation()
  useEffect(() => {
    if (hash === '#add-member') document.getElementById('add-member')?.focus()
  }, [hash])
  const filtered = members.data?.filter(member => (member.name + ' ' + (member.mobile ?? '')).toLowerCase().includes(filter.toLowerCase().trim()))
  return <>
    <div id="add-member" tabIndex={-1}><Panel title="Add member"><ActionForm label="Add member" reset perform={data => {
      const batchId = optional(data, 'batchId')
      const startDate = optional(data, 'startDate')
      const monthlyFee = optional(data, 'monthlyFee')
      if (batchId && (!startDate || monthlyFee === undefined)) throw new Error('Enter a start date and monthly fee for the selected batch.')
      return ownerWrite('/members', { academyId: academy.id, name: field(data, 'name'), mobile: optional(data, 'mobile'), ...(batchId ? { batchId, startDate, monthlyFee } : {}) })
    }}>
      <div className="owner-fields"><TextField name="name" label="Member name" required /><TextField name="mobile" label="Mobile" type="tel" /><EnrollmentFields batches={batches.data ?? []} /></div>
    </ActionForm></Panel></div>
    <Panel title="Members">
      <label>Search members<input type="search" value={filter} onChange={event => setFilter(event.target.value)} /></label>
      <QueryState query={members} />
      {filtered?.length === 0 && <p>No matching members.</p>}
      {filtered?.map(member => <div className="owner-list-row" key={member.id}>
        <div><strong>{member.name}</strong><p>{member.mobile ?? 'No mobile'} · {readable(member.status)}</p></div>
        <Link className="owner-secondary" to={'/owner/members/' + segment(member.id)}>Manage member</Link>
      </div>)}
    </Panel>
  </>
}

function MembershipCard({ membership, batches }: { membership: MembershipInfo; batches: Batch[] }) {
  const [showLeave, setShowLeave] = useState(false)
  const path = '/memberships/' + segment(membership.id)
  const leave = useOwnerQuery<{ feeMonth: string }[]>(path + '/leaves', undefined, showLeave)
  const active = membership.status === 'ACTIVE'
  return <Panel title={membership.batch?.name ?? membership.batchName ?? batches.find(batch => batch.id === membership.batchId)?.name ?? 'Membership'}>
    <p>{readable(membership.status)} · Started {membership.startDate}{membership.endDate ? ' · Ended ' + membership.endDate : ''}</p>
    <details><summary>{active ? 'Move to another batch' : 'Reactivate membership'}</summary>
      <ActionForm label={active ? 'Move membership' : 'Reactivate membership'} confirm={active ? 'Move this membership to the selected batch?' : undefined}
        perform={data => ownerWrite(path + (active ? '/move' : '/reactivate'), {
          batchId: field(data, 'batchId'), effectiveDate: field(data, 'effectiveDate'), monthlyFee: optional(data, 'monthlyFee'),
          ...(active && data.has('timingOnly') ? { timingOnly: true } : {}),
        })}>
        <div className="owner-fields"><ItemsSelect name="batchId" label="New batch" items={batches.filter(batch => batch.status === 'ACTIVE')} />
          <TextField name="effectiveDate" label="Effective date" type="date" initial={today()} required />
          <TextField name="monthlyFee" label="Monthly fee (₹)" type="number" required={!active} /></div>
        {active && <label><input type="checkbox" name="timingOnly" /> Change timing only</label>}
      </ActionForm>
    </details>
    {active && <>
      <details><summary>End membership</summary><ActionForm label="End membership" confirm="End this membership on the selected date?" perform={data => ownerWrite(path + '/end', {
        effectiveDate: field(data, 'effectiveDate'), reason: field(data, 'reason'),
      })}>
        <div className="owner-fields"><TextField name="effectiveDate" label="Effective date" type="date" initial={today()} required />
          <label>Reason<select name="reason"><option value="INACTIVE">Inactive</option><option value="REMOVED">Removed</option></select></label></div>
      </ActionForm></details>
      <button className="owner-secondary" onClick={() => setShowLeave(value => !value)}>{showLeave ? 'Hide leave' : 'Manage leave'}</button>
      {showLeave && <><QueryState query={leave} />
        {leave.data?.map(item => <div className="owner-list-row" key={item.feeMonth}><p>{item.feeMonth}</p>
          <ActionForm label="Remove leave" confirm="Remove leave for this month?" perform={() => ownerWrite(path + '/leaves/' + segment(item.feeMonth), undefined, 'DELETE')} />
        </div>)}
        <ActionForm label="Add leave" perform={data => ownerWrite(path + '/leaves', { feeMonth: field(data, 'feeMonth') })}>
          <TextField name="feeMonth" type="month" label="Leave month" initial={today().slice(0, 7)} required />
        </ActionForm>
      </>}
    </>}
  </Panel>
}

export function PaymentForm({ memberId, fees }: { memberId: string; fees: Fee[] }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState('AUTO')
  return <ActionForm label="Record payment" confirm="Record money already received from this member?" perform={async data => {
    const allocations = fees.map(fee => ({ monthlyFeeId: fee.id, amount: optional(data, 'fee-' + fee.id) })).filter(item => item.amount && Number(item.amount) > 0)
    if (mode === 'MANUAL' && !allocations.length) throw new Error('Enter an amount for at least one fee.')
    const payment = await ownerWrite<Payment>('/payments', {
      memberId, amount: field(data, 'amount'), paymentMode: field(data, 'paymentMode'), paymentDate: field(data, 'paymentDate'),
      allocationMode: mode, allocations: mode === 'MANUAL' ? allocations : undefined, reference: optional(data, 'reference'), note: optional(data, 'note'),
    })
    navigate('/owner/receipts/' + segment(payment.id))
  }}>
    <div className="owner-fields"><TextField name="amount" label="Amount received (₹)" type="number" required /><PaymentMode />
      <TextField name="paymentDate" label="Payment date" type="date" initial={today()} required /><TextField name="reference" label="Payment reference" /><TextField name="note" label="Note" />
      <label>Allocate fees<select value={mode} onChange={event => setMode(event.target.value)}><option value="AUTO">Automatically</option><option value="MANUAL">Manually</option></select></label>
    </div>
    {mode === 'MANUAL' && <div className="owner-fields">{fees.map(fee => <TextField key={fee.id} name={'fee-' + fee.id} type="number" label={fee.batchName + ' · Due ' + rupees(fee.balance)} />)}</div>}
  </ActionForm>
}

export function MemberDetails({ academy, id }: { academy: Academy; id: string }) {
  const path = '/members/' + segment(id)
  const member = useOwnerQuery<Details>(path)
  const batches = useOwnerQuery<Batch[]>('/batches', { academyId: academy.id })
  const payments = useOwnerQuery<{ payments: Payment[] }>(path + '/payments')
  const credit = useOwnerQuery<{ availableCredit: string }>(path + '/credit')
  const [month, setMonth] = useState(today().slice(0, 7))
  const fees = useOwnerQuery<{ items: Fee[] }>('/monthly-fees', { academyId: academy.id, memberId: id, feeMonth: month, outstanding: 'true' })
  const due = (fees.data?.items ?? []).filter(item => item.memberId === id)
  const m = member.data
  if (!m) return <QueryState query={member} />
  const allMemberships = [...new Map([...m.activeMemberships, ...(m.inactiveMemberships ?? []), ...m.history].map(item => [item.id, item])).values()]
  return <>
    <Panel title={m.name}><ActionForm label="Save member" perform={data => ownerWrite(path, { name: field(data, 'name'), mobile: optional(data, 'mobile') ?? null, status: field(data, 'status') }, 'PATCH')}>
      <div className="owner-fields"><TextField name="name" label="Member name" initial={m.name} required /><TextField name="mobile" label="Mobile" type="tel" initial={m.mobile} />
        <label>Status<select name="status" defaultValue={m.status}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label></div>
    </ActionForm></Panel>
    <Panel title="Assign to a batch"><ActionForm label="Assign membership" perform={data => ownerWrite(path + '/memberships', { batchId: field(data, 'batchId'), startDate: field(data, 'startDate'), monthlyFee: field(data, 'monthlyFee') })}>
      <div className="owner-fields"><EnrollmentFields batches={batches.data ?? []} required /></div>
    </ActionForm></Panel>
    {allMemberships.map(item => <MembershipCard key={item.id} membership={item} batches={batches.data ?? []} />)}
    <Panel title="Fees and credit">
      <label>Fee month<input type="month" value={month} onChange={event => { if (event.target.value) setMonth(event.target.value) }} /></label>
      <QueryState query={fees} /><QueryState query={credit} />
      {credit.data && <p>Available credit {rupees(credit.data.availableCredit)}</p>}
      {Number(credit.data?.availableCredit) > 0 && <ActionForm label="Apply credit" confirm="Apply the member’s available credit to outstanding fees?" perform={data => {
        const allocations = due.map(fee => ({ monthlyFeeId: fee.id, amount: optional(data, 'credit-' + fee.id) })).filter(item => item.amount && Number(item.amount) > 0)
        return ownerWrite(path + '/apply-credit', { mode: allocations.length ? 'MANUAL' : 'AUTO', ...(allocations.length ? { allocations } : {}) })
      }}>
        <p>Enter amounts to allocate manually, or leave them empty to apply automatically.</p>
        <div className="owner-fields">{due.map(fee => <TextField key={fee.id} name={'credit-' + fee.id} label={fee.batchName + ' · Due ' + rupees(fee.balance)} type="number" />)}</div>
      </ActionForm>}
      <PaymentForm memberId={id} fees={due} />
    </Panel>
    <Panel title="Payment history"><QueryState query={payments} />
      {payments.data?.payments.map(payment => <div className="owner-list-row" key={payment.id}><p>{payment.paymentDate} · {rupees(payment.amount)}</p>
        <Link className="owner-secondary" to={'/owner/receipts/' + segment(payment.id)}>Receipt {payment.receiptNumber}</Link></div>)}
    </Panel>
  </>
}
