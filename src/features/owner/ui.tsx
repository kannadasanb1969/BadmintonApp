import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ownerKey } from './api'

const dateFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
export const today = () => dateFormat.format(new Date())
export const rupees = (value: unknown) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(value ?? 0))
export const readable = (value: string) => value.toLowerCase().replace(/_/g, ' ').replace(/^./, char => char.toUpperCase())
export const field = (data: FormData, name: string) => String(data.get(name) ?? '').trim()
export const optional = (data: FormData, name: string) => field(data, name) || undefined
export const failure = (error: unknown) => error instanceof Error ? error.message : 'Unable to complete this request.'
export const paymentModes = ['CASH', 'UPI', 'BANK_TRANSFER', 'OTHER']

export function Panel({ title, children }: { title?: string; children: ReactNode }) {
  return <section className="owner-panel">{title && <h2>{title}</h2>}{children}</section>
}
export function QueryState({ query }: { query: { isLoading: boolean; error: unknown; refetch: () => unknown } }) {
  if (query.isLoading) return <p role="status">Loading…</p>
  if (!query.error) return null
  return <p role="alert" className="owner-error">{failure(query.error)} <button className="owner-secondary" onClick={() => void query.refetch()}>Retry</button></p>
}
export function ActionForm({ children, label, perform, confirm, reset = false, refresh = true, className = '' }: {
  children?: ReactNode; label: string; perform: (data: FormData) => Promise<unknown>;
  confirm?: string; reset?: boolean; refresh?: boolean; className?: string
}) {
  const client = useQueryClient()
  const running = useRef(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error?: boolean }>()
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (running.current || (confirm && !window.confirm(confirm))) return
    const form = event.currentTarget
    const data = new FormData(form)
    running.current = true
    setBusy(true)
    setMessage(undefined)
    try {
      await perform(data)
      if (reset) form.reset()
      if (refresh) await client.invalidateQueries({ queryKey: ownerKey })
      setMessage({ text: 'Done.' })
    } catch (error) {
      setMessage({ text: failure(error), error: true })
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  return <form className={`owner-form ${className}`} onSubmit={submit}>
    <fieldset disabled={busy}>{children}<button className="owner-primary" type="submit">{busy ? 'Working…' : label}</button></fieldset>
    {message && <p className={message.error ? 'owner-error' : ''} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </form>
}
export function ItemsSelect({ name, label, items, required = true, defaultValue, onChange }: {
  name: string; label: string; items: { id: string; name: string }[]; required?: boolean; defaultValue?: string; onChange?: (id: string) => void
}) {
  return <label>{label}<select name={name} defaultValue={defaultValue ?? ''} required={required} onChange={event => onChange?.(event.target.value)}>
    <option value="">{required ? 'Select' : 'None'}</option>{items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
  </select></label>
}
export function TextField({ name, label, type = 'text', required = false, initial, maxLength }: {
  name: string; label: string; type?: string; required?: boolean; initial?: string; maxLength?: number
}) {
  return <label>{label}<input name={name} type={type} required={required} defaultValue={initial ?? ''} maxLength={maxLength}
    min={type === 'number' ? '0' : undefined} step={type === 'number' ? '0.01' : undefined} /></label>
}
export function PaymentMode({ initial }: { initial?: string } = {}) {
  return <label>Payment method<select name="paymentMode" required defaultValue={initial ?? 'CASH'}>{paymentModes.map(mode => <option key={mode} value={mode}>{readable(mode)}</option>)}</select></label>
}
