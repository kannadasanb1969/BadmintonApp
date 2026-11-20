import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ownerWrite, segment, useOwnerQuery, type Academy, type Billing, type Fee, type Invoice, type Mandate, type Order, type Payment, type Plan } from './api'
import { ActionForm, Panel, QueryState, readable, rupees, today } from './ui'

type Summary = { expectedCollection: string; collected: string; outstanding: string }
type Dashboard = { operations: { activeCourts: number; activeBatches: number; activeMembers: number }; financial: Summary; recentPayments: Payment[] }
function SummaryCards({ summary }: { summary: Summary }) {
  return <div className="owner-metrics">
    <div><span>Expected</span><strong>{rupees(summary.expectedCollection)}</strong></div>
    <div><span>Collected</span><strong>{rupees(summary.collected)}</strong></div>
    <div><span>Outstanding</span><strong>{rupees(summary.outstanding)}</strong></div>
  </div>
}
export function OwnerDashboard({ academy }: { academy: Academy }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const data = useOwnerQuery<Dashboard>('/dashboard', { academyId: academy.id, feeMonth: month })
  return <>
    <Panel title={academy.name}>
      <p>{[academy.area, academy.city].filter(Boolean).join(', ')}</p>
      <label>Reporting month<input type="month" value={month} onChange={event => { if (event.target.value) setMonth(event.target.value) }} /></label>
      <QueryState query={data} />
      {data.data && <div className="owner-metrics">
        <div><span>Active courts</span><strong>{data.data.operations.activeCourts}</strong></div>
        <div><span>Active batches</span><strong>{data.data.operations.activeBatches}</strong></div>
        <div><span>Active members</span><strong>{data.data.operations.activeMembers}</strong></div>
      </div>}
    </Panel>
    {data.data && <>
      <Panel title="Monthly collections"><SummaryCards summary={data.data.financial} /><Link className="owner-secondary" to="/owner/fees">Manage fees</Link></Panel>
      <Panel title="Recent payments">{data.data.recentPayments.length === 0 && <p>No recent payments.</p>}
        {data.data.recentPayments.map(payment => <div className="owner-list-row" key={payment.id}>
          <p>{payment.memberName} · {payment.paymentDate} · {rupees(payment.amount)}</p>
          <Link className="owner-secondary" to={'/owner/receipts/' + segment(payment.id)}>View receipt</Link>
        </div>)}
      </Panel>
    </>}
  </>
}

export function Fees({ academy, report = false }: { academy: Academy; report?: boolean }) {
  const [month, setMonth] = useState(today().slice(0, 7))
  const [status, setStatus] = useState(report ? 'OUTSTANDING' : 'ALL')
  const [batchId, setBatchId] = useState('')
  const batches = useOwnerQuery<{ id: string; name: string }[]>('/batches', { academyId: academy.id })
  const fees = useOwnerQuery<{ summary: Summary; items: Fee[] }>('/monthly-fees', {
    academyId: academy.id, feeMonth: month, ...(batchId ? { batchId } : {}),
    ...(status === 'OUTSTANDING' ? { outstanding: 'true' } : status !== 'ALL' ? { status } : {}),
  })
  return <Panel title={report ? `Fee report · ${academy.name}` : 'Monthly fees'}>
    <div className="owner-fields owner-no-print">
      <label>Fee month<input type="month" value={month} onChange={event => { if (event.target.value) setMonth(event.target.value) }} /></label>
      <label>Fee status<select value={status} onChange={event => setStatus(event.target.value)}>{['ALL', 'OUTSTANDING', 'PENDING', 'PARTIALLY_PAID', 'PAID', 'ON_LEAVE'].map(item => <option value={item} key={item}>{readable(item)}</option>)}</select></label>
      <label>Batch<select value={batchId} onChange={event => setBatchId(event.target.value)}><option value="">All batches</option>{batches.data?.map(batch => <option value={batch.id} key={batch.id}>{batch.name}</option>)}</select></label>
    </div>
    {!report && <ActionForm label="Generate monthly fees" confirm={`Generate the academy’s fees for ${month}?`} perform={() => ownerWrite('/monthly-fees/generate', { academyId: academy.id, feeMonth: month })} />}
    <QueryState query={fees} />
    {fees.data && <>
      <p>Month: {month}</p><SummaryCards summary={fees.data.summary} />
      {fees.data.items.length > 0 ? <div className="owner-table-wrap"><table><thead><tr><th>Member</th><th>Batch</th><th>Status</th><th>Fee</th><th>Paid</th><th>Balance</th></tr></thead>
        <tbody>{fees.data.items.map(fee => <tr key={fee.id}><td><Link to={'/owner/members/' + segment(fee.memberId)}>{fee.memberName}</Link></td><td>{fee.batchName}</td><td>{readable(fee.status)}</td><td>{rupees(fee.applicableFee)}</td><td>{rupees(fee.paidAmount)}</td><td>{rupees(fee.balance)}</td></tr>)}</tbody>
      </table></div> : <p>No fees match this view.</p>}
      {report && <button className="owner-primary owner-no-print" onClick={() => window.print()}>Print or save PDF</button>}
    </>}
  </Panel>
}

export function Receipt({ id, booking = false }: { id: string; booking?: boolean }) {
  const path = booking ? '/booking-payments/' + segment(id) + '/receipt' : '/payments/' + segment(id)
  const receipt = useOwnerQuery<Payment & { academy?: { name: string }; member?: { name: string }; academyName?: string; customerName?: string; courtName?: string; bookingDate?: string }>(path)
  const value = receipt.data
  return <Panel title="Payment receipt">
    <QueryState query={receipt} />
    {value && <>
      <h3>{value.academy?.name ?? value.academyName}</h3><p>Receipt {value.receiptNumber}</p>
      <p>{value.member?.name ?? value.customerName}</p>
      {value.courtName && <p>{value.courtName} · {value.bookingDate}</p>}
      <p>{value.paymentDate} · {readable(value.paymentMode)}</p><p><strong>{rupees(value.amount)}</strong></p>
      {value.allocations?.map((allocation, index) => <p key={index}>{allocation.feeMonth} · {rupees(allocation.amount)}</p>)}
      <button className="owner-primary owner-no-print" onClick={() => window.print()}>Print or save PDF</button>
    </>}
  </Panel>
}

function checkoutLink(value?: string) {
  if (!value || value.length > 2048) return null
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && ['rzp.io', 'razorpay.com'].includes(url.hostname) && !url.username && !url.password && !url.port && !url.hash ? url.href : null
  } catch { return null }
}

function BillingActions({ billing, plans }: { billing: Billing; plans: Plan[] }) {
  const navigate = useNavigate()
  const [tier, setTier] = useState(String(billing.tier ?? plans[0]?.tier ?? ''))
  const [quote, setQuote] = useState<{ payableNow?: string; amount?: string; amountDue?: string; amountPaise?: number }>()
  const keys = useRef(new Map<string, string>())
  const idempotencyKey = (operation: string) => {
    const current = keys.current.get(operation)
    if (current) return current
    const next = crypto.randomUUID()
    keys.current.set(operation, next)
    return next
  }
  const mandate = useOwnerQuery<{ available: boolean; mandate: Mandate }>('/subscription/autopay', undefined, Boolean(billing.autoPayAvailable))
  const mandateState = mandate.data?.mandate
  const liveMandate = Boolean(mandateState?.id && !['CANCELLED', 'COMPLETED', 'EXPIRED'].includes(mandateState.status ?? ''))
  const payLink = checkoutLink(mandateState?.checkoutUrl)
  const currentTier = billing.tier ?? 0
  const startOrder = async (operation: string, selected?: number) => {
    const key = operation + ':' + (selected ?? '')
    const result = await ownerWrite<Order>('/subscription/' + operation, { ...(selected ? { tier: selected } : {}), idempotencyKey: idempotencyKey(key) })
    keys.current.delete(key)
    navigate('/owner/subscription/orders/' + segment(result.orderId))
  }
  return <>
    {billing.trialAvailable && <ActionForm label="Start trial" confirm="Start the academy subscription trial?" perform={() => ownerWrite('/subscription/trial')} />}
    <label>Membership plan<select value={tier} onChange={event => { setTier(event.target.value); setQuote(undefined) }}>
      {plans.map(plan => <option key={plan.tier} value={plan.tier}>{plan.memberCapacity} members · {rupees(plan.price)}/month</option>)}
    </select></label>
    {tier && billing.paymentsAvailable && !liveMandate && <div className="owner-actions">
      {(!currentTier || ['NONE', 'TRIAL', 'TRIAL_ENDED', 'EXPIRED'].includes(billing.state)) && <ActionForm label="Subscribe" perform={() => startOrder('checkout', Number(tier))} />}
      {currentTier > 0 && ['ACTIVE', 'GRACE'].includes(billing.state) && <>
        <ActionForm label="Renew current plan" perform={() => startOrder('renewal-checkout')} />
        {Number(tier) > currentTier && <ActionForm label="Review upgrade" refresh={false} perform={async () => setQuote(await ownerWrite('/subscription/upgrade-quote', { tier: Number(tier) }))} />}
        {Number(tier) < currentTier && <ActionForm label="Schedule downgrade" confirm="Schedule this downgrade for the next billing period?" perform={() => ownerWrite('/subscription/downgrade', { tier: Number(tier) })} />}
      </>}
    </div>}
    {quote && <><p>Review the prorated upgrade in Razorpay before paying.{quote.payableNow || quote.amount || quote.amountDue ? ' Due now: ' + rupees(quote.payableNow ?? quote.amount ?? quote.amountDue) : quote.amountPaise ? ' Due now: ' + rupees(quote.amountPaise / 100) : ''}</p>
      <ActionForm label="Continue to upgrade checkout" perform={() => startOrder('upgrade-checkout', Number(tier))} /></>}
    {billing.pendingChange?.kind === 'DOWNGRADE' && <ActionForm label="Cancel downgrade" confirm="Remove the scheduled downgrade?" perform={() => ownerWrite('/subscription/downgrade/cancel')} />}
    {billing.autoPayAvailable && <div className="owner-flow">
      <h3>AutoPay</h3><QueryState query={mandate} />
      {mandateState?.status && <p>Mandate: {readable(mandateState.status)}{mandateState.nextDebitAt ? ' · Next debit ' + mandateState.nextDebitAt : ''}</p>}
      {payLink && <a className="owner-primary" href={payLink} target="_blank" rel="noopener noreferrer">Open Razorpay mandate</a>}
      <div className="owner-actions">
        {mandate.data?.available && !liveMandate && plans.find(plan => plan.tier === Number(tier))?.autoPayAvailable && <ActionForm label="Set up AutoPay" confirm="Create a Razorpay mandate for the selected monthly plan?" perform={async () => {
          const key = 'mandate:' + tier
          await ownerWrite('/subscription/autopay', { tier: Number(tier), idempotencyKey: idempotencyKey(key) })
          keys.current.delete(key)
        }} />}
        {mandateState?.id && <ActionForm label="Check payment status" perform={() => ownerWrite('/subscription/autopay/refresh')} />}
        {liveMandate && mandateState?.id && <ActionForm label="Cancel future debits" confirm="Stop future AutoPay debits? Already paid access remains available." perform={() => ownerWrite('/subscription/autopay/' + segment(mandateState.id!) + '/cancel')} />}
      </div>
    </div>}
  </>
}

export function Subscription() {
  const billing = useOwnerQuery<Billing>('/subscription')
  const plans = useOwnerQuery<{ tiers: Plan[] }>('/subscription/plans')
  const orders = useOwnerQuery<{ items: Order[] }>('/subscription/payments')
  const invoices = useOwnerQuery<{ items: Invoice[] }>('/subscription/invoices')
  return <>
    <Panel title="Subscription">
      <QueryState query={billing} /><QueryState query={plans} />
      {billing.data && <><p>{readable(billing.data.state)} · {billing.data.membersUsed} members{billing.data.memberCapacity ? ' / ' + billing.data.memberCapacity : ''}</p>
        {billing.data.billing?.paidThrough && <p>Paid through {billing.data.billing.paidThrough}</p>}
        {billing.data.pendingChange && <p>{readable(billing.data.pendingChange.kind)} · {readable(billing.data.pendingChange.status)}</p>}
        {plans.data && <BillingActions billing={billing.data} plans={plans.data.tiers} />}
      </>}
    </Panel>
    <Panel title="Subscription payment history"><QueryState query={orders} />
      {orders.data?.items.map(order => <div className="owner-list-row" key={order.orderId}><p>{rupees(order.amount)} · {readable(order.status)}</p>
        <Link className="owner-secondary" to={'/owner/subscription/orders/' + segment(order.orderId)}>View order</Link></div>)}
    </Panel>
    <Panel title="Invoices"><QueryState query={invoices} />
      {invoices.data?.items.map(invoice => <div className="owner-list-row" key={invoice.id}><p>{invoice.invoiceNumber} · {rupees(invoice.total)}</p>
        <Link className="owner-secondary" to={'/owner/subscription/invoices/' + segment(invoice.id)}>View invoice</Link></div>)}
    </Panel>
  </>
}

export function SubscriptionOrder({ id }: { id: string }) {
  const order = useOwnerQuery<Order>('/subscription/orders/' + segment(id))
  const billing = useOwnerQuery<Billing>('/subscription')
  const data = order.data
  const open = data && ['CREATED', 'PENDING'].includes(data.status)
  const providerMatches = (billing.data?.paymentMode === 'TEST' && data?.provider === 'razorpay-test') || (billing.data?.paymentMode === 'LIVE' && data?.provider === 'razorpay-live')
  const link = open && providerMatches ? checkoutLink(data.checkoutReference) : null
  return <Panel title="Subscription order">
    <QueryState query={order} />
    {data && <>
      <p>Order {data.orderId}</p><p>{rupees(data.amount)} · {readable(data.status)}</p>
      {link && <a className="owner-primary" href={link} target="_blank" rel="noopener noreferrer">{data.provider === 'razorpay-test' ? 'Open Razorpay test checkout' : 'Open Razorpay checkout'}</a>}
      {open && billing.data?.paymentMode === 'MOCK' && data.provider === 'mock' && <ActionForm label="Run test payment" perform={form => ownerWrite('/subscription/mock/simulate', { orderId: id, scenario: form.get('scenario') })}>
        <p>Test gateway. No real money is charged.</p>
        <label>Test result<select name="scenario">{['SUCCESS', 'FAILURE', 'PENDING', 'CANCELLATION', 'RETRY_THEN_SUCCESS', 'DUPLICATE_SUCCESS'].map(item => <option value={item} key={item}>{readable(item)}</option>)}</select></label>
      </ActionForm>}
      {open && <button className="owner-secondary" onClick={() => void order.refetch()}>Check payment status</button>}
      <Link to="/owner/subscription">Back to subscription</Link>
    </>}
  </Panel>
}

export function SubscriptionInvoice({ id }: { id: string }) {
  const invoices = useOwnerQuery<{ items: Invoice[] }>('/subscription/invoices')
  const item = invoices.data?.items.find(invoice => invoice.id === id)
  return <Panel title="Subscription invoice">
    <QueryState query={invoices} />
    {invoices.data && !item && <p>Invoice unavailable.</p>}
    {item && <><p>{item.invoiceNumber}</p><p>Issued {item.issuedAt?.slice(0, 10)}</p><p>Billing period {item.details?.periodStart} – {item.details?.periodEnd}</p>
      <p>Total <strong>{rupees(item.total)}</strong></p><button className="owner-primary owner-no-print" onClick={() => window.print()}>Print or save PDF</button></>}
  </Panel>
}
