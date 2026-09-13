import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { requestOtp, verifyOtpLogin } from '@/features/auth/services/authService'
import { Role } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { getPlayerProfileForUser } from '@/features/player/services/playerProfileService'
import playerImage from '@/assets/playerlog.png'
import organizerImage from '@/assets/orglog.png'

const roles: Array<{ value: Extract<Role, 'PLAYER' | 'ORGANIZER'>; label: string; detail: string; image: string }> = [
  { value: 'PLAYER', label: 'Player', detail: 'Join and compete', image: playerImage },
  { value: 'ORGANIZER', label: 'Organizer', detail: 'Run tournaments', image: organizerImage },
]

type Props = { adminMode: boolean; onBackToNormal: () => void }

const LoginForm = ({ adminMode, onBackToNormal }: Props) => {
  const [mobile, setMobile] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [developmentHint, setDevelopmentHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { login, sessionMessage } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    setRole(adminMode ? 'ADMIN' : null)
    setOtp(''); setOtpRequested(false); setDevelopmentHint(null); setError(null)
  }, [adminMode])

  const resetOtp = () => { setOtp(''); setOtpRequested(false); setDevelopmentHint(null) }
  const validMobile = () => /^[6-9]\d{9}$/.test(mobile)
  const validate = () => {
    if (!mobile) { setError('Enter your mobile number to continue.'); return false }
    if (!validMobile()) { setError('Enter a valid 10-digit mobile number.'); return false }
    if (!role) { setError('Choose how you want to enter the court.'); return false }
    return true
  }
  const request = async () => {
    setError(null); if (!validate()) return
    setLoading(true)
    try { const response = await requestOtp(mobile); setOtpRequested(true); setOtp(''); setDevelopmentHint(import.meta.env.DEV && response.developmentOtp ? `Development OTP: ${response.developmentOtp}` : null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request OTP') }
    finally { setLoading(false) }
  }
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null)
    if (!validate() || !role) return
    if (!/^\d{5}$/.test(otp)) { setError('Enter the five-digit OTP.'); return }
    setLoading(true)
    try {
      const auth = await verifyOtpLogin(mobile, otp, role)
      login(auth.user, auth.accessToken)
      if (auth.user.role === 'PLAYER') { const profile = auth.playerProfile ?? await getPlayerProfileForUser(auth.user); if (profile) usePlayerProfileStore.getState().createProfile(profile); else usePlayerProfileStore.getState().clearProfile() } else usePlayerProfileStore.getState().clearProfile()
      navigate(auth.user.role === 'PLAYER' ? '/player/dashboard' : auth.user.role === 'ORGANIZER' ? '/organizer/dashboard' : '/admin/dashboard')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Login failed') }
    finally { setLoading(false) }
  }

  return <div className={`reference-login-form-wrap ${adminMode ? 'reference-admin-mode' : ''}`}><form onSubmit={verify} className="reference-login-form">
    {adminMode && <button type="button" className="reference-admin-back" onClick={onBackToNormal}>← Back to Player / Organizer Login</button>}
    <div className="reference-field-group"><label htmlFor="mobile">Mobile Number</label><div className="reference-mobile-field"><strong>+91</strong><span className="reference-chevron">⌄</span><input id="mobile" type="tel" inputMode="numeric" autoComplete="tel" value={mobile} onChange={(event) => { setMobile(event.target.value.replace(/\D/g, '')); resetOtp() }} maxLength={10} placeholder="Enter your mobile number" /></div></div>
    {!adminMode && <div className="reference-role-group"><p>I'm here as a</p><div className="reference-role-list">{roles.map((item) => <label key={item.value} className="group relative cursor-pointer"><input type="radio" value={item.value} checked={role === item.value} onChange={() => { setRole(item.value); resetOtp(); setError(null) }} className="peer sr-only" /><span className="reference-role-card"><img src={item.image} alt="" /><span className="reference-role-copy"><i className="reference-radio" /><span><strong>{item.label}</strong><small>{item.detail}</small></span></span><b className="reference-role-arrow">›</b></span></label>)}</div></div>}
    {otpRequested && <div className="reference-otp-panel"><label htmlFor="otp">{adminMode ? 'Admin Verification' : 'Enter five-digit OTP'}</label><input id="otp" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} placeholder="•••••" />{developmentHint && <p>{developmentHint}</p>}</div>}
    {!otpRequested ? <button type="button" onClick={request} disabled={loading} className="reference-request-button">{loading ? (adminMode ? 'Requesting Admin OTP...' : 'Requesting...') : (adminMode ? 'Request Admin OTP  →' : 'Request OTP  →')}</button> : <div className="space-y-3"><button type="submit" disabled={loading} className="reference-request-button">{loading ? 'Verifying...' : 'Verify OTP  →'}</button><button type="button" onClick={request} disabled={loading} className="reference-resend">Resend OTP</button></div>}
    {(error || sessionMessage) && <p role="alert" className="reference-login-error">{error || sessionMessage}</p>}
  </form></div>
}

export default LoginForm
