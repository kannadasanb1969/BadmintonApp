import { useState } from 'react'
import { ownerWrite, segment, useOwnerQuery, type Academy } from './api'
import { Weekdays } from './Operations'
import { ActionForm, field, Panel, QueryState, readable, rupees, TextField, today } from './ui'

type MemberReminder = { memberId: string; memberName: string; total: string; status: string }
type Preview = { eligible: boolean; message: string | null; recipient: string | null; reason: string | null; config: { modeLabel: string } }
type ReminderHistory = { id: string; memberName: string; status: string; reminderDate: string; failureMessage?: string; totalOutstanding?: string }
function personalWhatsApp(recipient: string | null, message: string | null) {
  const digits = recipient?.replace(/\D/g, '')
  if (!digits || !message || !/^[1-9]\d{9,14}$/.test(digits)) return null
  return 'https://wa.me/' + (digits.length === 10 ? '91' + digits : digits) + '?text=' + encodeURIComponent(message)
}

export function Reminders({ academy }: { academy: Academy }) {
  const [scope, setScope] = useState('MONTH')
  const [month, setMonth] = useState(today().slice(0, 7))
  const [preview, setPreview] = useState<{ member: MemberReminder; value: Preview }>()
  const [sendResult, setSendResult] = useState('')
  const params = { academyId: academy.id, scope, ...(scope === 'MONTH' ? { feeMonth: month } : {}) }
  const eligible = useOwnerQuery<{ members: MemberReminder[]; config: { modeLabel: string; ready: boolean }; summary: { eligibleMembers: number } }>('/reminders/eligible', params)
  const history = useOwnerQuery<{ items: ReminderHistory[] }>('/reminders', { academyId: academy.id })
  const changeScope = (value: string) => { setScope(value); setPreview(undefined); setSendResult('') }
  const whatsapp = preview && preview.value.reason !== 'NO_WHATSAPP_CONSENT' ? personalWhatsApp(preview.value.recipient, preview.value.message) : null
  return <>
    <Panel title="Fee reminders">
      <div className="owner-fields">
        <label>Scope<select value={scope} onChange={event => changeScope(event.target.value)}><option value="MONTH">One month</option><option value="ALL_OUTSTANDING">All outstanding</option></select></label>
        {scope === 'MONTH' && <label>Fee month<input type="month" value={month} onChange={event => { if (event.target.value) { setMonth(event.target.value); setPreview(undefined); setSendResult('') } }} /></label>}
      </div>
      <QueryState query={eligible} />
      {eligible.data && <>
        <p>{eligible.data.config.modeLabel} · {eligible.data.summary.eligibleMembers} eligible</p>
        {eligible.data.members.map(member => <div className="owner-list-row" key={member.memberId}>
          <div><strong>{member.memberName}</strong><p>{rupees(member.total)} · {readable(member.status)}</p></div>
          <ActionForm label={`Preview for ${member.memberName}`} refresh={false} perform={async () => {
            const value = await ownerWrite<Preview>('/reminders/preview', { ...params, memberId: member.memberId })
            setPreview({ member, value }); setSendResult('')
          }} />
        </div>)}
        {eligible.data.config.ready && eligible.data.summary.eligibleMembers > 0 &&
          <ActionForm label="Send eligible reminders" confirm={`Send reminders for this scope to ${eligible.data.summary.eligibleMembers} eligible members?`} perform={async () => {
            const result = await ownerWrite<{ sentCount?: number; failedCount?: number }>('/reminders/send-bulk', params)
            setSendResult([result.sentCount === undefined ? 'Bulk reminder run recorded.' : result.sentCount + ' accepted', result.failedCount === undefined ? '' : result.failedCount + ' failed'].filter(Boolean).join(' · '))
          }} />}
      </>}
      {sendResult && <p role="status">{sendResult}</p>}
    </Panel>
    {preview && <Panel title={'Reminder for ' + preview.member.memberName}>
      <p>{preview.value.config.modeLabel}</p>
      {preview.value.message && <p className="whitespace-pre-wrap">{preview.value.message}</p>}
      {preview.value.reason && <p>{readable(preview.value.reason)}</p>}
      {whatsapp && <a className="owner-secondary" href={whatsapp} target="_blank" rel="noopener noreferrer">Open in WhatsApp</a>}
      {preview.value.eligible && eligible.data?.config.ready && <ActionForm label="Send reminder" confirm={`Send this reminder to ${preview.member.memberName}?`} perform={async () => {
        await ownerWrite('/reminders/send', { ...params, memberId: preview.member.memberId }); setPreview(undefined)
      }} />}
    </Panel>}
    <Panel title="Reminder history"><QueryState query={history} />
      {history.data?.items.length === 0 && <p>No reminders recorded.</p>}
      {history.data?.items.map(item => <div className="owner-list-row" key={item.id}>
        <p>{item.reminderDate} · {item.memberName} · {readable(item.status)}{item.failureMessage ? ' · ' + item.failureMessage : ''}</p>
      </div>)}
    </Panel>
  </>
}

type AutoMember = { memberId: string; memberName: string; academyId: string; pending: string; decision: string; paused: boolean; consentStatus: string }
type Schedule = { runTime: string; weekdays: number[]; nextRun?: string; timezone?: string }
export function AutoReminders({ academy }: { academy: Academy }) {
  const [filter, setFilter] = useState('all')
  const settings = useOwnerQuery<{ enabled: boolean; schedule: Schedule; provider: { label: string }; templatePreview: string }>('/auto-reminders/settings')
  const dashboard = useOwnerQuery<{ members: AutoMember[] }>('/auto-reminders', { filter })
  const history = useOwnerQuery<{ items: { id: string; memberName: string; date: string; status: string; errorDetail?: string; mode: string }[] }>('/auto-reminders/history', { limit: '30' })
  const current = settings.data
  return <>
    <Panel title="Automatic WhatsApp reminders">
      <QueryState query={settings} />
      {current && <>
        <p>{current.enabled ? 'Enabled' : 'Disabled'} · {current.provider.label}{current.schedule.nextRun ? ' · Next run ' + current.schedule.nextRun : ''}</p>
        <ActionForm label={current.enabled ? 'Disable automatic reminders' : 'Enable automatic reminders'} confirm={current.enabled ? 'Disable scheduled WhatsApp fee reminders?' : 'Enable scheduled WhatsApp fee reminders for eligible members with consent?'}
          perform={() => ownerWrite('/auto-reminders/settings', { enabled: !current.enabled, confirm: true }, 'PATCH')} />
        <ActionForm label="Save reminder schedule" confirm="Update the recurring WhatsApp reminder schedule?" perform={async data => {
          const days = data.getAll('weekdays').map(Number)
          if (!days.length) throw new Error('Select at least one weekday.')
          const runTime = field(data, 'runTime')
          if (days.join() !== [...current.schedule.weekdays].sort((a, b) => a - b).join()) await ownerWrite('/auto-reminders/settings', { weekdays: days, confirm: true }, 'PATCH')
          if (runTime !== current.schedule.runTime) await ownerWrite('/auto-reminders/settings', { runTime, confirm: true }, 'PATCH')
        }}>
          <TextField name="runTime" label="Send time (IST)" type="time" initial={current.schedule.runTime} required />
          <Weekdays selected={current.schedule.weekdays} />
        </ActionForm>
        {current.templatePreview && <details><summary>Template preview</summary><p className="whitespace-pre-wrap">{current.templatePreview}</p></details>}
      </>}
    </Panel>
    <Panel title="Member consent and delivery">
      <label>Filter<select value={filter} onChange={event => setFilter(event.target.value)}>{['all', 'active', 'paused', 'failed'].map(item => <option value={item} key={item}>{readable(item)}</option>)}</select></label>
      <QueryState query={dashboard} />
      {dashboard.data?.members.filter(member => member.academyId === academy.id).map(member => {
        const path = '/auto-reminders/members/' + segment(member.memberId)
        return <details key={member.memberId} className="owner-flow">
          <summary>{member.memberName} · {readable(member.decision)} · {rupees(member.pending)}</summary>
          <p>Consent: {readable(member.consentStatus)}</p>
          <ActionForm label={member.paused ? 'Resume reminders' : 'Pause reminders'} confirm={`${member.paused ? 'Resume' : 'Pause'} automatic reminders for this member?`}
            perform={() => ownerWrite(path + (member.paused ? '/resume' : '/pause'))} />
          <ActionForm label="Save consent" confirm="Record this member’s actual WhatsApp consent choice?" perform={data => ownerWrite(path + '/consent', { status: field(data, 'status'), source: field(data, 'source') })}>
            <div className="owner-fields"><label>Consent status<select name="status" defaultValue={member.consentStatus === 'WITHDRAWN' ? 'WITHDRAWN' : 'CONSENTED'}><option value="CONSENTED">Given</option><option value="WITHDRAWN">Withdrawn</option></select></label>
              <label>Consent source<select name="source">{['VERBAL', 'WRITTEN_FORM', 'WHATSAPP_OPT_IN', 'REGISTRATION_FORM', 'OTHER'].map(item => <option key={item} value={item}>{readable(item)}</option>)}</select></label></div>
          </ActionForm>
        </details>
      })}
    </Panel>
    <Panel title="Automatic reminder history"><QueryState query={history} />
      {history.data?.items.map(item => <div className="owner-list-row" key={item.id}><p>{item.date} · {item.memberName} · {readable(item.status)} · {readable(item.mode)}{item.errorDetail ? ' · ' + item.errorDetail : ''}</p></div>)}
    </Panel>
  </>
}
