import { useEffect, useRef, useState } from 'react'
import apiClient, { isExplicitMockApiMode, webApiBaseUrl, webApiPath } from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '../services/notificationStore'
import { notificationApiService } from '../services/notificationApiService'
import { notificationRoute } from '../services/notificationRoutes'

const preferenceKey = 'smash-karo-browser-alerts'
const pushKey = 'smash-karo-web-push'
const publicKey = import.meta.env.VITE_WEB_VAPID_PUBLIC_KEY as string | undefined
const webPushEnabled = Boolean(webApiBaseUrl && publicKey) && !isExplicitMockApiMode
const pushPath = webApiPath + '/push/subscriptions'
const pushConfig = { baseURL: webApiBaseUrl }

function savedPush(): { userId: string; id: string } | null {
  try { return JSON.parse(localStorage.getItem(pushKey) ?? 'null') } catch { return null }
}

const changed = 'smash-karo-browser-alerts-changed'
const supported = () => typeof Notification !== 'undefined' && Boolean(navigator.serviceWorker)
const enabled = () => {
  try { return supported() && Notification.permission === 'granted' && localStorage.getItem(preferenceKey) === 'on' }
  catch { return false }
}

export function BrowserNotificationButton() {
  const userId = useAuthStore(state => state.user?.id)
  const [on, setOn] = useState(() => webPushEnabled ? savedPush()?.userId === userId && Boolean(userId) : enabled())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  if (!supported() || webPushEnabled && !('PushManager' in window)) return null
  const toggle = async () => {
    setError('')
    setBusy(true)
    try {
      if (!on && await Notification.requestPermission() !== 'granted') {
        throw new Error('Enable notification permission in your browser to use alerts.')
      }
      if (webPushEnabled && userId && publicKey) {
        await navigator.serviceWorker.register('/notification-worker.js')
        const registration = await navigator.serviceWorker.ready
        if (useAuthStore.getState().user?.id !== userId) return
        let browserSubscription = await registration.pushManager.getSubscription()
        const saved = savedPush()
        if (on) {
          if (saved?.userId === userId) {
            await apiClient.delete(pushPath + '/' + encodeURIComponent(saved.id), pushConfig)
          }
          await browserSubscription?.unsubscribe()
          localStorage.removeItem(pushKey)
        } else {
          if (saved?.userId !== userId && browserSubscription) {
            await browserSubscription.unsubscribe()
            browserSubscription = null
          }
          browserSubscription ??= await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: publicKey })
          const { data } = await apiClient.post<{ subscriptionId: string }>(pushPath, browserSubscription.toJSON(), pushConfig)
          if (useAuthStore.getState().user?.id !== userId) {
            await browserSubscription.unsubscribe()
            return
          }
          localStorage.setItem(pushKey, JSON.stringify({ userId, id: data.subscriptionId }))
        }
      } else if (!on) {
        await navigator.serviceWorker.register('/notification-worker.js')
      }
      localStorage.setItem(preferenceKey, on ? 'off' : 'on')
      setOn(!on)
      window.dispatchEvent(new Event(changed))
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to update browser alerts.') }
    finally { setBusy(false) }
  }
  return <div>
    <button className="rounded border border-emerald-700 px-2 py-1 text-sm text-emerald-900" disabled={busy} onClick={() => void toggle()}>{on ? 'Turn off browser alerts' : 'Enable browser alerts'}</button>
    <p className="text-xs text-slate-500">{webPushEnabled ? 'Receive alerts when this tab is closed.' : 'Alerts while this web app is open.'}</p>
    {error && <p role="alert">{error}</p>}
  </div>
}

export function BrowserNotificationSync() {
  const userId = useAuthStore(state => state.user?.id)
  const hasHydrated = useAuthStore(state => state.hasHydrated)
  useEffect(() => {
    if (!webPushEnabled || !hasHydrated) return
    const saved = savedPush()
    if (!saved || saved.userId === userId) return
    localStorage.removeItem(pushKey)
    localStorage.removeItem(preferenceKey)
    void navigator.serviceWorker?.getRegistration('/').then(async registration => {
      const subscription = await registration?.pushManager.getSubscription()
      await subscription?.unsubscribe()
      for (const notification of await registration?.getNotifications() ?? []) notification.close()
    }).catch(() => undefined)
  }, [hasHydrated, userId])
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
    if (webPushEnabled || !on || !userId || readyUser !== userId) {
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
