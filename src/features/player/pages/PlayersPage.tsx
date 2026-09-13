import { useEffect, useMemo, useState } from 'react'

import { refreshPlayerDirectory } from '@/features/player/services/playerProfileService'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'

const PlayersPage = () => {
  const profiles = usePlayerDirectoryStore((state) => state.profiles)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void refreshPlayerDirectory()
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'Unable to load players')
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  const players = useMemo(() => {
    const search = query.trim().toLowerCase()
    return profiles.filter((player) => player.profileStatus === 'ACTIVE' &&
      (!search || player.fullName.toLowerCase().includes(search) || player.playerCode.toLowerCase().includes(search)))
  }, [profiles, query])

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-gradient-to-r from-slate-950 to-emerald-900 p-6 text-white sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Badminton community</p>
        <h1 className="mt-2 text-3xl font-black">Players</h1>
        <p className="mt-2 text-sm text-slate-300">Find players registered with SmashPoint.</p>
      </section>

      <label className="block">
        <span className="sr-only">Search players</span>
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by player name or code"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
        />
      </label>

      {loading ? <div className="rounded-2xl bg-white p-8 text-center text-slate-600 shadow-sm">Loading players...</div>
        : error ? <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div>
          : players.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">No players found.</div>
            : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{players.map((player) => (
              <article key={player.id} className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                {player.profilePhoto ? <img src={player.profilePhoto} alt="" className="h-12 w-12 rounded-full object-cover" /> : <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-black text-emerald-700">{player.fullName.slice(0, 1).toUpperCase()}</div>}
                <div className="min-w-0">
                  <h2 className="truncate font-bold text-slate-900">{player.fullName}</h2>
                  <p className="text-sm font-semibold text-emerald-700">{player.playerCode}</p>
                  {(player.location || player.playingSince) && <p className="mt-1 truncate text-xs text-slate-500">{[player.location, player.playingSince ? `Playing since ${player.playingSince}` : null].filter(Boolean).join(' · ')}</p>}
                </div>
              </article>
            ))}</div>}
    </div>
  )
}

export default PlayersPage
