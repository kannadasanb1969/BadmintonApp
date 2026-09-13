import { Link } from 'react-router-dom'

export const FriendlyHomePage = () => <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
  <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600">FRIENDLY PLAY</p><h1 className="mt-2 text-3xl font-black text-slate-900">Friendly Matches</h1><p className="mt-2 text-slate-600">Create a match for your group or discover an open friendly nearby.</p>
  <div className="mt-7 grid gap-4 sm:grid-cols-2"><Link to="/player/friendly-matches/create" className="rounded-2xl bg-emerald-700 p-6 text-white shadow-sm"><strong className="text-xl">Create Friendly Match</strong><span className="mt-2 block text-sm text-emerald-100">Choose singles or doubles and set the capacity.</span></Link><Link to="/player/friendly-matches/browse" className="rounded-2xl border border-emerald-200 bg-white p-6 text-emerald-900 shadow-sm"><strong className="text-xl">Browse Friendly Matches</strong><span className="mt-2 block text-sm text-slate-600">Find matches accepting join requests.</span></Link></div>
</section>
