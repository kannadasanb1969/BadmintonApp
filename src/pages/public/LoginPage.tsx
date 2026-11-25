import { useState } from 'react'
import LoginForm from '@/features/auth/components/LoginForm'
import loginBackdrop from '@/assets/mobile-court.webp'

const LoginPage = () => {
  const [adminMode, setAdminMode] = useState(false)
  return (
    <main className="app-login" style={{ backgroundImage: `linear-gradient(rgba(244,250,246,.93), rgba(244,250,246,.97)), url(${loginBackdrop})` }}>
      <div className="app-login-shell">
        <header>
          <h1>{adminMode ? 'Admin sign in' : <>Welcome to<br />SmashPoint</>}</h1>
          <p>{adminMode ? 'Use your registered admin number to continue.' : 'Choose how you want to continue'}</p>
        </header>
        <LoginForm adminMode={adminMode} onToggleAdmin={() => setAdminMode(value => !value)} />
      </div>
    </main>
  )
}

export default LoginPage
