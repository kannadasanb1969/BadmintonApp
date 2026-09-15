import { Link } from 'react-router-dom'
import { FriendlyMatchList } from '../components/FriendlyMatchList'

export const FriendlyHomePage = () => <section className="mobile-app-shell -mx-4 px-4 py-6 sm:mx-0 sm:px-6"><div className="mx-auto max-w-6xl">
  <div className="player-feature-hero flex flex-col gap-5 rounded-3xl p-6 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-lime-300">FRIENDLY PLAY</p><h1 className="mt-2 text-3xl font-black">Friendly Matches</h1><p className="mt-2 max-w-2xl text-slate-300">Create a match for your group or discover an open friendly nearby.</p></div><Link to="/player/friendly-matches/create" className="mobile-primary-button shrink-0">+ Create Friendly Match</Link></div>
  <section className="mt-7"><div className="mb-4 flex items-center gap-3"><span aria-hidden="true" className="h-8 w-1 rounded-full bg-emerald-500" /><h2 className="text-xl font-black text-slate-900">Available Friendly Matches</h2></div><FriendlyMatchList /></section>
</div>
</section>
