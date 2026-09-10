import { useAuthStore } from '@/store/authStore'
import { useNavigate } from 'react-router-dom'
import shuttlecockImage from '@/assets/shuttlecock.png'

const HomePage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const handleGoToDashboard = () => {
    if (!user) {
      navigate('/login')
      return
    }
    switch (user.role) {
      case 'PLAYER':
        navigate('/player/dashboard')
        break
      case 'ORGANIZER':
        navigate('/organizer/dashboard')
        break
      case 'ADMIN':
        navigate('/admin/dashboard')
        break
    }
  }

  if (!user) {
    return (
      <main className="home-page">
        <img className="home-page-background" src={shuttlecockImage} alt="Badminton shuttlecock on a court" />
        <div className="home-page-overlay" />
        <section className="home-content" aria-labelledby="home-title">
          <button className="home-skip" type="button" onClick={handleGoToDashboard}>Skip</button>
          <header className="home-brand" aria-label="SmashPoint">
            <strong>SMASH</strong>
            <span>POINT</span>
            <b aria-hidden="true">➤</b>
            <small>PLAY&nbsp; · &nbsp;CONNECT&nbsp; · &nbsp;COMPETE</small>
          </header>
          <div className="home-copy">
            <p className="home-kicker">THE COMMUNITY FOR EVERY GAME</p>
            <h1 id="home-title">More<br /><em>Badminton</em><br /><strong>Together</strong></h1>
            <p className="home-description">Find tournaments, meet players and be part of a bigger badminton community.</p>
          </div>
          <div className="home-features" aria-label="SmashPoint features">
            <div className="home-feature"><span aria-hidden="true">♕</span><p><strong>Discover Tournaments</strong><small>Local to national events</small></p></div>
            <div className="home-feature"><span aria-hidden="true">✣</span><p><strong>Find Players</strong><small>Singles, Doubles, Mixed</small></p></div>
            <div className="home-feature"><span aria-hidden="true">⌘</span><p><strong>Join a Community</strong><small>Play. Improve. Belong.</small></p></div>
          </div>
          <div className="home-slides" aria-label="Onboarding slide 1 of 4"><span className="is-active" /><span /><span /><span /></div>
          <button onClick={handleGoToDashboard} className="home-cta">
            <span>Get Started</span>
            <span aria-hidden="true">→</span>
          </button>
          <p className="home-sign-in">Already have an account? <button onClick={handleGoToDashboard}>Sign in</button></p>
        </section>
      </main>
    )
  }

  return (
    <div className="home-page home-page-authenticated">
      <main className="home-hero home-hero-authenticated">
        <div className="home-hero-content">
          <header className="home-brand" aria-label="SmashPoint">
            <strong>SMASH</strong>
            <span>POINT<i /></span>
          </header>
          <section className="home-copy">
            <p className="home-kicker">Welcome back</p>
            <h1>{user.displayName || user.mobile}</h1>
            <p className="home-description">You are logged in as a {user.role.toLowerCase()}.</p>
          </section>
          <button onClick={handleGoToDashboard} className="home-cta">
            <span>Go to Dashboard</span>
            <span aria-hidden="true">→</span>
          </button>
        </div>
      </main>
    </div>
  )
}

export default HomePage
