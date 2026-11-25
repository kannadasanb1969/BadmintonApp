import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { requestOtp, verifyOtpLogin } from '@/features/auth/services/authService'
import { Role } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { getPlayerProfileForUser } from '@/features/player/services/playerProfileService'
import { AppIcon, type AppIconName } from '@/components/mobile/MobileAppShell'

type Workspace = Role | 'OWNER'

const roles: Array<{ value: Exclude<Workspace, 'ADMIN'>; label: string; detail: string; icon: AppIconName }> = [
  { value: 'PLAYER', label: 'Player', detail: 'Join tournaments · Play matches', icon: 'user' },
  { value: 'ORGANIZER', label: 'Organizer', detail: 'Create tournaments · Manage events', icon: 'people' },
  { value: 'OWNER', label: 'Owner', detail: 'Manage your academy', icon: 'courts' },
]

type Props = { adminMode: boolean; onToggleAdmin: () => void }

const LoginForm = ({ adminMode, onToggleAdmin }: Props) => {
  const [mobile, setMobile] = useState('')
  const [role, setRole] = useState<Workspace>('PLAYER')
  const [otp, setOtp] = useState('')
  const [otpRequested, setOtpRequested] = useState(false)
  const [developmentHint, setDevelopmentHint] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [requestStatus, setRequestStatus] = useState('Sending OTP…')
  const { login, sessionMessage } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    setRole(adminMode ? 'ADMIN' : 'PLAYER')
    setOtp(''); setOtpRequested(false); setDevelopmentHint(null); setError(null)
  }, [adminMode])

  const resetOtp = () => { setOtp(''); setOtpRequested(false); setDevelopmentHint(null) }
  const validMobile = () => /^[6-9]\d{9}$/.test(mobile)
  const validate = () => {
    if (!mobile) { setError('Enter your mobile number to continue.'); return false }
    if (!validMobile()) { setError('Enter a valid 10-digit mobile number.'); return false }
    return true
  }
  const request = async () => {
    setError(null); if (!validate()) return
    setLoading(true)
    try { const response = await requestOtp(mobile, setRequestStatus); setOtpRequested(true); setOtp(''); setDevelopmentHint(import.meta.env.DEV && response.developmentOtp ? `Development OTP: ${response.developmentOtp}` : null) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to request OTP') }
    finally { setLoading(false) }
  }
  const verify = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null)
    if (!validate()) return
    if (!/^\d{5}$/.test(otp)) { setError('Enter the five-digit OTP.'); return }
    setLoading(true)
    try {
      const auth = await verifyOtpLogin(mobile, otp, role === 'OWNER' ? undefined : role)
      login(auth.user, auth.accessToken, auth.refreshToken)
      if (role === 'OWNER') {
        navigate('/owner')
        return
      }
      if (auth.user.role === 'PLAYER') {
        const revision = useAuthStore.getState().sessionRevision
        const profile = auth.playerProfile ?? await getPlayerProfileForUser(auth.user).catch(() => null)
        if (useAuthStore.getState().sessionRevision !== revision) return
        if (profile) usePlayerProfileStore.getState().createProfile(profile)
      }
      navigate(auth.user.role === 'PLAYER' ? '/player/dashboard' : auth.user.role === 'ORGANIZER' ? '/organizer/dashboard' : '/admin/dashboard')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Login failed') }
    finally { setLoading(false) }
  }

  return <form onSubmit={otpRequested ? verify : event => { event.preventDefault(); void request() }} className="app-login-form">
    {!adminMode && <fieldset>
      <legend className="sr-only">Workspace</legend>
      <div className="app-login-roles">
        {roles.map(item => <label key={item.value} data-role={item.value} className="app-login-role">
          <input type="radio" name="workspace" className="sr-only" disabled={loading} value={item.value} checked={role === item.value}
            onChange={() => { setRole(item.value); resetOtp(); setError(null) }} />
          <span className="app-login-role-card">
            <span className="app-login-icon"><AppIcon name={item.icon} /></span>
            <strong>{item.label}</strong><small>{item.detail}</small>
          </span>
        </label>)}
      </div>
    </fieldset>}
    {role === 'OWNER' && !adminMode && <p className="app-login-notice">After verification, you’ll go to the Owner workspace to manage your badminton academy.</p>}
    <div>
      <label htmlFor="mobile">Enter your WhatsApp number</label>
      <div className="app-login-phone">
        <strong>+91</strong>
        <input id="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" disabled={loading} value={mobile}
          onChange={event => {
            setMobile(event.target.value.replace(/^\s*(?:\+91|0091)(?=[\s-]*\d)/, '').replace(/\D/g, '').slice(0, 10))
            resetOtp()
          }} placeholder="10-digit WhatsApp number" />
      </div>
    </div>
    {otpRequested && <div className="app-login-otp">
      <label htmlFor="otp">Enter the five-digit OTP</label>
      <input id="otp" type="text" disabled={loading} inputMode="numeric" autoComplete="one-time-code" value={otp}
        onChange={event => setOtp(event.target.value.replace(/\D/g, '').slice(0, 5))} maxLength={5} placeholder="•••••" />
      {developmentHint && <p>{developmentHint}</p>}
    </div>}
    <button type="submit" disabled={loading} aria-busy={loading} className="app-login-submit">
      {otpRequested ? (loading ? 'Verifying…' : 'Verify OTP') : (loading ? requestStatus : 'Send OTP via WhatsApp')}
    </button>
    {otpRequested && <button type="button" onClick={() => void request()} disabled={loading} className="app-login-link">Resend OTP</button>}
    {(error || sessionMessage) && <p role="alert" className="app-login-error">{error || sessionMessage}</p>}
    <button type="button" onClick={onToggleAdmin} disabled={loading} className="app-login-link">
      {adminMode ? 'Back to regular sign in' : 'Admin sign in'}
    </button>
  </form>
}

export default LoginForm
