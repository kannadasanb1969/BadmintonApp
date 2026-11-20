import { useEffect, useRef, useState } from 'react'
import { isExplicitMockApiMode } from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '../services/notificationStore'
import { notificationApiService } from '../services/notificationApiService'
import { notificationRoute } from '../services/notificationRoutes'

const preferenceKey = 'smash-karo-browser-alerts'
const changed = 'smash-karo-browser-alerts-changed'
const supported = () => typeof Notification !== 'undefined' && Boolean(navigator.serviceWorker)
const enabled = () => {
  try { return supported() && Notification.permission === 'granted' && localStorage.getItem(preferenceKey) === 'on' }
  catch { return false }
}

export function BrowserNotificationButton() {
  const [on, setOn] = useState(enabled)
  const [error, setError] = useState('')
  if (!supported()) return null
  const toggle = async () => {
    setError('')
    try {
      if (!on) {
        if (await Notification.requestPermission() !== 'granted') throw new Error('Enable notification permission in your browser to use alerts.')
        await navigator.serviceWorker.register('/notification-worker.js')
      }
      localStorage.setItem(preferenceKey, on ? 'off' : 'on')
      setOn(!on)
      window.dispatchEvent(new Event(changed))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to enable browser alerts.') }
  }
  return <div>
    <button className="rounded border border-emerald-700 px-2 py-1 text-sm text-emerald-900" onClick={() => void toggle()}>{on ? 'Turn off browser alerts' : 'Enable browser alerts'}</button>
    <p className="text-xs text-slate-500">Alerts while this web app is open.</p>
    {error && <p role="alert">{error}</p>}
  </div>
}

export function BrowserNotificationSync() {
  const userId = useAuthStore(state => state.user?.id)
  const notifications = useNotificationStore(state => state.notifications)
  const [on, setOn] = useState(enabled)
  const [readyUser, setReadyUser] = useState<string>()
  const previous = useRef<{ userId?: string; ids: Set<string> }>({ ids: new Set() })
  useEffect(() => {
    const handler = () => setOn(enabled())
    window.addEventListener(changed, handler)
    return () => window.removeEventListener(changed, handler)
  }, [])
  useEffect(() => {
    if (!userId || isExplicitMockApiMode) return
    let pending = false
    let active = true
    const refresh = async () => {
      if (pending) return
      pending = true
      try {
        await notificationApiService.refresh(userId)
        if (active) setReadyUser(userId)
      } catch { /* next poll can recover */ }
      finally { pending = false }
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 30000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [userId])
  useEffect(() => {
    if (!on || !userId || readyUser !== userId) {
      previous.current = { ids: new Set() }
      return
    }
    if (previous.current.userId !== userId) {
      previous.current = { userId, ids: new Set(notifications.map(item => item.id)) }
      return
    }
    const state = previous.current
    for (const item of notifications) {
      if (state.ids.has(item.id) || item.recipientId !== userId) continue
      state.ids.add(item.id)
      if (!item.isRead) void navigator.serviceWorker.getRegistration('/').then(registration => registration?.showNotification(item.title, {
        body: item.message, tag: item.id, data: { destination: notificationRoute(item.link) },
      })).catch(() => undefined)
    }
  }, [notifications, on, userId, readyUser])
  return null
}
