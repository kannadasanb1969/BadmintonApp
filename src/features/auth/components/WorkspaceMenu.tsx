import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import apiClient from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import type { PlayerProfile } from '@/features/player/types/player.types'
import type { Role, User } from '@/types/auth.types'

const routes: Record<Role, string> = { PLAYER: '/player/dashboard', ORGANIZER: '/organizer/dashboard', ADMIN: '/admin/dashboard' }
const labels: Record<Role, string> = { PLAYER: 'Player', ORGANIZER: 'Organizer', ADMIN: 'Admin' }
const choices: Record<Role, Role[]> = { PLAYER: ['ORGANIZER', 'ADMIN'], ORGANIZER: ['PLAYER'], ADMIN: ['PLAYER'] }

export function WorkspaceMenu() {
  const user = useAuthStore(state => state.user)
  const navigate = useNavigate()
  const inFlight = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!user) return null
  const change = async (workspace: Role) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    const revision = useAuthStore.getState().sessionRevision
    try {
      const { data } = await apiClient.post<{ user: User; accessToken: string; refreshToken: string; playerProfile?: PlayerProfile }>('/api/auth/select-workspace', { workspace })
      const state = useAuthStore.getState()
      if (state.sessionRevision !== revision) return
      if (data.user?.role !== workspace || !data.accessToken || !data.refreshToken) throw new Error('The API did not return a valid workspace session.')
      state.login(data.user, data.accessToken, data.refreshToken)
      if (data.playerProfile) usePlayerProfileStore.getState().createProfile(data.playerProfile)
      if (state.refreshToken) void apiClient.post('/api/auth/logout', { refreshToken: state.refreshToken }).catch(() => undefined)
      navigate(routes[workspace], { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to switch workspace.')
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  return <details className="rounded-xl bg-white p-3 text-emerald-950">
    <summary className="cursor-pointer font-semibold">Switch workspace</summary>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {choices[user.role].map(role => <button type="button" key={role} className="rounded border border-emerald-700 px-2 py-1" disabled={busy} onClick={() => void change(role)}>{labels[role]}</button>)}
      <Link className="rounded border border-emerald-700 px-2 py-1" to="/owner">Owner</Link>
    </div>
    {error && <p className="mt-2 text-sm text-red-700" role="alert">{error}</p>}
  </details>
}
