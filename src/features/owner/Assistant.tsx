import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ownerWrite, useOwnerQuery, segment, type Academy, type Batch, type Payment } from './api'
import { ActionForm, field, ItemsSelect, optional, Panel, PaymentMode, readable, rupees, TextField } from './ui'

type VoiceResult = {
  intent: 'ADD_MEMBER' | 'RECORD_PAYMENT' | 'PENDING_FEES' | 'UNKNOWN'
  slots: { memberQuery?: string; amount?: string; mobile?: string; paymentMode?: string }
  candidates: { memberId: string; name: string; mobile?: string }[]
  summary?: { feeMonth: string; outstanding: string; collected: string; unpaidFeeCount: number }
  warnings: string[]
}
type SpeechSession = {
  lang: string; onresult: ((event: { results: { transcript: string }[][] }) => void) | null
  onerror: (() => void) | null; onend: (() => void) | null; start: () => void; abort: () => void
}
const speechWindow = window as Window & { SpeechRecognition?: new () => SpeechSession; webkitSpeechRecognition?: new () => SpeechSession }

export function Assistant({ academy }: { academy: Academy }) {
  const [transcript, setTranscript] = useState('')
  const [language, setLanguage] = useState('en-IN')
  const [listening, setListening] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [result, setResult] = useState<VoiceResult>()
  const [receipt, setReceipt] = useState('')
  const recognition = useRef<SpeechSession | null>(null)
  const batches = useOwnerQuery<Batch[]>('/batches', { academyId: academy.id })
  useEffect(() => () => recognition.current?.abort(), [])
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  const listen = () => {
    if (!Recognition || listening) return
    setSpeechError('')
    const session = new Recognition()
    session.lang = language
    session.onresult = event => { setTranscript(event.results[0][0].transcript); setResult(undefined) }
    session.onerror = () => setSpeechError('Voice input is unavailable. Type the command to continue.')
    session.onend = () => setListening(false)
    try { recognition.current = session; session.start(); setListening(true) }
    catch { setSpeechError('Could not start voice input. Type the command to continue.') }
  }
  return <>
    <Panel title="Voice and typed assistant">
      <div className="owner-actions">
        {Recognition && <><label>Voice language<select value={language} onChange={event => setLanguage(event.target.value)}><option value="en-IN">English (India)</option><option value="ta-IN">Tamil</option></select></label>
          <button className="owner-secondary" disabled={listening} onClick={listen}>{listening ? 'Listening…' : 'Use microphone'}</button></>}
      </div>
      {speechError && <p role="alert">{speechError}</p>}
      <ActionForm label="Preview command" refresh={false} perform={async () => {
        const value = await ownerWrite<VoiceResult>('/voice/parse', { academyId: academy.id, transcript: transcript.trim() })
        setResult(value); setReceipt('')
      }}>
        <label>Command<textarea required value={transcript} onChange={event => { setTranscript(event.target.value); setResult(undefined) }} placeholder="Show pending fees" /></label>
      </ActionForm>
    </Panel>
    {result && <Panel title={readable(result.intent)}>
      {result.warnings?.map((warning, i) => <p key={i}>{warning}</p>)}
      {result.summary && <p>{result.summary.feeMonth} · Outstanding {rupees(result.summary.outstanding)} · Collected {rupees(result.summary.collected)} · {result.summary.unpaidFeeCount} unpaid fees</p>}
      {result.intent === 'UNKNOWN' && <p>Try asking for pending fees, adding a member, or recording a payment.</p>}
      {result.intent === 'ADD_MEMBER' && <ActionForm label="Confirm add member" confirm="Create this member with the details shown?" perform={async data => {
        const batchId = optional(data, 'batchId')
        const startDate = optional(data, 'startDate')
        const monthlyFee = optional(data, 'monthlyFee')
        if (batchId && (!startDate || !monthlyFee)) throw new Error('Enter the enrollment date and fee for this batch.')
        await ownerWrite('/members', { academyId: academy.id, name: field(data, 'member'), mobile: optional(data, 'mobile'), ...(batchId ? { batchId, startDate, monthlyFee } : {}) })
        setResult(undefined)
      }}>
        <div className="owner-fields"><TextField name="member" label="Member name" initial={result.slots.memberQuery} required /><TextField name="mobile" label="Mobile" initial={result.slots.mobile} />
          <ItemsSelect label="Batch" name="batchId" items={batches.data?.filter(batch => batch.status === 'ACTIVE') ?? []} required={false} />
          <TextField name="startDate" label="Start date" type="date" /><TextField name="monthlyFee" label="Monthly fee (₹)" type="number" /></div>
      </ActionForm>}
      {result.intent === 'RECORD_PAYMENT' && result.candidates.length > 0 && <ActionForm label="Confirm record payment" confirm="Record money already received from the selected member?" perform={async data => {
        const payment = await ownerWrite<Payment>('/payments', { memberId: field(data, 'memberId'), amount: field(data, 'amount'), paymentMode: field(data, 'paymentMode'), allocationMode: 'AUTO' })
        setReceipt(payment.id); setResult(undefined)
      }}>
        <div className="owner-fields">
          <ItemsSelect label="Member" name="memberId" items={result.candidates.map(item => ({ id: item.memberId, name: item.name + (item.mobile ? ' · ' + item.mobile : '') }))} defaultValue={result.candidates.length === 1 ? result.candidates[0].memberId : undefined} />
          <TextField name="amount" label="Amount received (₹)" type="number" initial={result.slots.amount} required />
          <PaymentMode initial={result.slots.paymentMode} />
        </div>
      </ActionForm>}
    </Panel>}
    {receipt && <Panel title="Payment recorded"><Link to={'/owner/receipts/' + segment(receipt)}>Open receipt</Link></Panel>}
  </>
}
