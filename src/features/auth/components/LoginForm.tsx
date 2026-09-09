import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { requestOtp, verifyOtpLogin } from '@/features/auth/services/authService'
import { Role } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { getPlayerProfileForUser } from '@/features/player/services/playerProfileService'

const roles: { value: Role; label: string; detail: string; icon: string }[] = [
  { value: 'PLAYER', label: 'Player', detail: 'Join and compete', icon: '🏸' },
  { value: 'ORGANIZER', label: 'Organizer', detail: 'Run tournaments', icon: '🎯' },
  { value: 'ADMIN', label: 'Admin', detail: 'Manage platform', icon: '🛡️' },
]

const LoginForm = () => {
  const [mobile, setMobile] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [developmentHint, setDevelopmentHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login } = useAuthStore()
  const navigate = useNavigate()

  const validateIdentity = () => {
    if (!mobile) { setError('Enter your mobile number to continue.'); return false }
    if (!/^[6-9]\d{9}$/.test(mobile)) { setError('Enter a valid 10-digit mobile number.'); return false }
    if (!role) { setError('Choose how you want to enter the court.'); return false }
    return true
  }

  const resetOtp = () => {
    setOtp('')
    setOtpRequested(false)
    setDevelopmentHint(null)
  }

  const handleRequestOtp = async () => {
    setError(null)
    if (!validateIdentity()) return
    setLoading(true)
    try {
      const response = await requestOtp(mobile)
      setOtpRequested(true)
      setOtp('')
      setDevelopmentHint(import.meta.env.DEV && response.developmentOtp ? `Development OTP: ${response.developmentOtp}` : null)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unable to request OTP')
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!validateIdentity() || !role) return
    if (!/^\d{5}$/.test(otp)) return setError('Enter the five-digit OTP.')
    setLoading(true)
    try {
      const auth = await verifyOtpLogin(mobile, otp, role)
      login(auth.user)
      if (auth.user.role === 'PLAYER') {
        const profile = auth.playerProfile ?? await getPlayerProfileForUser(auth.user)
        if (profile) usePlayerProfileStore.getState().createProfile(profile)
        else usePlayerProfileStore.getState().clearProfile()
      } else usePlayerProfileStore.getState().clearProfile()
      setOtp('')
      navigate(auth.user.role === 'PLAYER' ? '/player/dashboard' : auth.user.role === 'ORGANIZER' ? '/organizer/dashboard' : '/admin/dashboard')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-600">Welcome back</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Step onto the court</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">Use your number and select your match-day role.</p>
      <form onSubmit={handleVerify} className="mt-8 space-y-6">
        <div>
          <label htmlFor="mobile" className="mb-2 block text-sm font-bold text-slate-700">Mobile number</label>
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-50 transition focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
            <span className="border-r border-slate-200 px-4 text-sm font-bold text-slate-500">+91</span>
            <input id="mobile" type="tel" inputMode="numeric" autoComplete="tel" value={mobile} onChange={(event) => { setMobile(event.target.value.replace(/\D/g, '')); resetOtp() }} maxLength={10} className="w-full border-0 bg-transparent px-4 py-3.5 text-base font-semibold text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-400" placeholder="98765 43210" />
          </div>
        </div>
        <div>
          <label className="mb-3 block text-sm font-bold text-slate-700">I’m here as a</label>
          <div className="grid gap-2 sm:grid-cols-3">
            {roles.map((item) => <label key={item.value} className="group relative cursor-pointer">
              <input type="radio" value={item.value} checked={role === item.value} onChange={() => { setRole(item.value); resetOtp() }} className="peer sr-only" />
              <span className="flex min-h-28 flex-col justify-between rounded-xl border border-slate-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:ring-2 peer-checked:ring-emerald-500"><span className="text-xl">{item.icon}</span><span><strong className="block text-sm text-slate-800">{item.label}</strong><small className="mt-0.5 block text-xs text-slate-500">{item.detail}</small></span></span>
            </label>)}
          </div>
        </div>
        {otpRequested && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <label htmlFor="otp" className="mb-2 block text-sm font-bold text-emerald-900">Enter five-digit OTP</label>
          <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="•••••" />
          {developmentHint && <p className="mt-2 text-xs font-semibold text-emerald-700">{developmentHint}</p>}
        </div>}
        {!otpRequested ? <button type="button" onClick={handleRequestOtp} disabled={loading} className="w-full rounded-xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:translate-y-0 disabled:opacity-60">{loading ? 'Requesting OTP...' : 'Request OTP  →'}</button> : <div className="space-y-3"><button type="submit" disabled={loading} className="w-full rounded-xl bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5 hover:bg-emerald-600 disabled:translate-y-0 disabled:opacity-60">{loading ? 'Verifying OTP...' : 'Verify & enter the court  →'}</button><button type="button" onClick={handleRequestOtp} disabled={loading} className="w-full text-sm font-bold text-emerald-700 hover:text-emerald-800 disabled:opacity-60">Resend OTP</button></div>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </form>
    </div>
  )
}

export default LoginForm
