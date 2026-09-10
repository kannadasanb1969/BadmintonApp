import LoginForm from '@/features/auth/components/LoginForm'
import { useNavigate } from 'react-router-dom'
import loginBackdrop from '@/assets/logincock.png'
import adminIcon from '@/assets/admin.png'
import smashPointLogo from '@/assets/mlogo.png'

const LoginPage = () => {
  const navigate = useNavigate()
  return (
    <main className="reference-login" style={{ backgroundImage: `url(${loginBackdrop})` }}>
      <div className="reference-login-overlay" />
      <div className="reference-login-shell">
        <header className="reference-login-header">
          <div className="reference-logo"><img src={smashPointLogo} alt="SmashPoint" /></div>
          <a className="reference-admin" href="mailto:admin@smashpoint.app?subject=SmashPoint%20login%20help"><img src={adminIcon} alt="" />Admin <b>›</b></a>
        </header>
        <section className="reference-login-intro"><h1>Welcome <strong>Back</strong></h1><h2>Step onto the court</h2><p>Use your number and select your match-day role.</p></section>
        <LoginForm />
      </div>
    </main>
  )
}

export default LoginPage
