import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import { requestOtp, verifyOtpLogin } from '@/features/auth/services/authService'
import { Role } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { getPlayerProfileForUser } from '@/features/player/services/playerProfileService'
import playerImage from '@/assets/playerlog.png'
import organizerImage from '@/assets/orglog.png'

const roles: { value: Role; label: string; detail: string; image: string }[] = [
  { value: 'PLAYER', label: 'Player', detail: 'Join and compete', image: playerImage },
  { value: 'ORGANIZER', label: 'Organizer', detail: 'Run tournaments', image: organizerImage },
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
      login(auth.user, auth.accessToken)
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
    <div className="reference-login-form-wrap">
      <form onSubmit={handleVerify} className="reference-login-form">
        <div className="reference-field-group">
          <label htmlFor="mobile">Mobile Number</label>
          <div className="reference-mobile-field"><strong>+91</strong><span className="reference-chevron">⌄</span><input id="mobile" type="tel" inputMode="numeric" autoComplete="tel" value={mobile} onChange={(event) => { setMobile(event.target.value.replace(/\D/g, '')); resetOtp() }} maxLength={10} placeholder="Enter your mobile number" /><span className="reference-phone" aria-hidden="true">⌕</span></div>
        </div>
        <div className="reference-role-group">
          <p>I'm here as a</p>
          <div className="reference-role-list">
            {roles.map((item) => <label key={item.value} className="group relative cursor-pointer">
              <input type="radio" value={item.value} checked={role === item.value} onChange={() => { setRole(item.value); resetOtp() }} className="peer sr-only" />
              <span className="reference-role-card"><img src={item.image} alt="" /><span className="reference-role-copy"><i className="reference-radio" /><span><strong>{item.label}</strong><small>{item.detail}</small></span></span><b className="reference-role-arrow">›</b></span>
            </label>)}
          </div>
        </div>
        {otpRequested && <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <label htmlFor="otp" className="mb-2 block text-sm font-bold text-emerald-900">Enter five-digit OTP</label>
          <input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} className="w-full rounded-lg border border-emerald-200 bg-white px-4 py-3 text-center text-xl font-bold tracking-[0.35em] text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" placeholder="•••••" />
          {developmentHint && <p className="mt-2 text-xs font-semibold text-emerald-700">{developmentHint}</p>}
        </div>}
        {!otpRequested ? <button type="button" onClick={handleRequestOtp} disabled={loading} className="reference-request-button">{loading ? 'Requesting OTP...' : 'Request OTP  →'}</button> : <div className="space-y-3"><button type="submit" disabled={loading} className="reference-request-button">{loading ? 'Verifying OTP...' : 'Verify OTP  →'}</button><button type="button" onClick={handleRequestOtp} disabled={loading} className="reference-resend">Resend OTP</button></div>}
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
      </form>
    </div>
  )
}

export default LoginForm
