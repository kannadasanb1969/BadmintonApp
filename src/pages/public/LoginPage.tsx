import LoginForm from '@/features/auth/components/LoginForm'
import loginBackdrop from '@/assets/logincock.png'
import adminIcon from '@/assets/admin.png'
import smashPointLogo from '@/assets/mlogo.png'
import { useState } from 'react'

const LoginPage = () => {
  const [adminMode, setAdminMode] = useState(false)
  return (
    <main className="reference-login" style={{ backgroundImage: `url(${loginBackdrop})` }}>
      <div className="reference-login-overlay" />
      <div className="reference-login-shell">
        <header className="reference-login-header">
          <div className="reference-logo"><img src={smashPointLogo} alt="SmashPoint" /></div>
          {!adminMode && <button type="button" className="reference-admin" onClick={() => setAdminMode(true)}><img src={adminIcon} alt="" />Admin <b>›</b></button>}
        </header>
        <section className="reference-login-intro">{adminMode ? <><p className="reference-admin-kicker">✦ Secure administration</p><h1>Admin <strong>Login</strong></h1><h2>Access the administration panel</h2><p>Use your registered admin number to continue.</p></> : <><h1>Welcome <strong>Back</strong></h1><h2>Step onto the court</h2><p>Use your number and select your match-day role.</p></>}</section>
        <LoginForm adminMode={adminMode} onBackToNormal={() => setAdminMode(false)} />
      </div>
    </main>
  )
}

export default LoginPage
