import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/globals.css'

// Clear stale caches from the pre-Worker mock architecture once. Auth and the
// unsaved doubles-registration draft remain valid local session/UI state.
const legacyCacheCleanupKey = 'badminton-worker-cache-cleanup-v1'
if (window.localStorage.getItem(legacyCacheCleanupKey) !== 'done') {
  ['badminton-tournaments', 'badminton-registrations', 'badminton-fixtures', 'badminton-results', 'badminton-teams', 'badminton-player-profile', 'badminton-player-directory', 'badminton-guest-players', 'badminton-medal-history', 'badminton-notifications'].forEach((key) => window.localStorage.removeItem(key))
  window.localStorage.setItem(legacyCacheCleanupKey, 'done')
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
