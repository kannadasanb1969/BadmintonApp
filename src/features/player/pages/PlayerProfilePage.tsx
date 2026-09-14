import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import PlayerProfileForm from '@/features/player/components/PlayerProfileForm'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { medalHistoryService } from '@/features/medals/services/medalHistoryService'
import { MedalHistory } from '@/features/medals/types/medalHistory.types'
import { registrationService } from '@/features/registrations/services/registrationService'
import { Registration } from '@/features/registrations/types/registration.types'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { Tournament } from '@/features/tournaments/types/tournament.types'

const initials = (name: string) => name.split(' ').map((part) => part[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()

const PlayerProfilePage = () => {
  const { profile, hasProfile } = usePlayerProfileStore()
  const navigate = useNavigate()
  const location = useLocation()
  const isEditRoute = location.pathname === '/player/profile/edit'
  const [medals, setMedals] = useState<MedalHistory[]>([])
  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    setLoading(true)
    void Promise.all([medalHistoryService.getPlayerMedals(profile.id), registrationService.getPlayerRegistrations(profile.id), tournamentService.getTournaments()])
      .then(([playerMedals, playerRegistrations, tournamentList]) => { if (!cancelled) { setMedals(playerMedals); setRegistrations(playerRegistrations); setTournaments(tournamentList) } })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [profile?.id])

  if (!hasProfile && isEditRoute) return <Navigate to="/player/profile" replace />
  if (!hasProfile) return <PlayerProfileForm onProfileCreated={() => navigate('/player/profile', { replace: true })} />
  if (isEditRoute) return <PlayerProfileForm profile={profile} onProfileCreated={() => navigate('/player/profile', { replace: true })} />

  const gold = medals.filter((medal) => medal.medalType === 'GOLD').length
  const silver = medals.filter((medal) => medal.medalType === 'SILVER').length
  const events = Array.from(new Set(registrations.filter((item) => item.status === 'REGISTERED').map((item) => item.eventType)))
  const tournamentById = new Map(tournaments.map((item) => [item.id, item]))
  const recentMedals = [...medals].sort((a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()).slice(0, 3)
  const stats = [{ value: profile.age, label: 'Age' }, { value: profile.location || '—', label: 'Location' }, { value: `${profile.experienceYears} yrs`, label: 'Experience' }, { value: profile.regularPlayer ? 'Yes' : 'No', label: 'Regular player' }]

  const share = async () => {
    const data = { title: `${profile.fullName} · SmashPoint`, text: `${profile.fullName} (${profile.playerCode}) · Play • Connect • Compete`, url: window.location.href }
    if (navigator.share) await navigator.share(data)
    else await navigator.clipboard?.writeText(data.url)
  }
  const download = () => {
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([`SMASHPOINT PLAYER CARD\n${profile.fullName}\n${profile.playerCode}\n${profile.location || 'Location not shared'}\nPlay • Connect • Compete`], { type: 'text/plain' }))
    link.download = `smashpoint-${profile.playerCode}.txt`; link.click(); URL.revokeObjectURL(link.href)
  }

  return <div className="mx-auto max-w-6xl space-y-5 pb-6 text-slate-100">
    <section className="relative overflow-hidden rounded-3xl border border-emerald-300/15 bg-gradient-to-br from-[#071428] via-[#0b1d35] to-[#063d35] p-5 shadow-2xl sm:p-8"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-emerald-300/10" /><div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-4 sm:gap-5">{profile.profilePhoto ? <img src={profile.profilePhoto} alt={`${profile.fullName} profile`} className="h-24 w-24 rounded-3xl border-2 border-emerald-300 object-cover shadow-xl sm:h-28 sm:w-28" /> : <div className="flex h-24 w-24 items-center justify-center rounded-3xl border-2 border-emerald-300 bg-emerald-300 text-2xl font-black text-emerald-950 shadow-xl sm:h-28 sm:w-28">{initials(profile.fullName)}</div>}<div><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-300">SmashPoint player</p><h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">{profile.fullName}</h1><div className="mt-3 flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-3 py-1 text-sm font-bold text-emerald-200">{profile.playerCode}</span><span className="rounded-full border border-emerald-300/25 bg-emerald-400/10 px-3 py-1 text-xs font-bold text-emerald-200">{profile.profileStatus === 'ACTIVE' ? '✓ Verified player' : 'Profile incomplete'}</span></div><p className="mt-3 text-sm text-slate-300">📍 {profile.location || 'Location not added'} · Play • Connect • Compete</p></div></div><button type="button" onClick={() => navigate('/player/profile/edit')} className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-black text-emerald-950 transition hover:bg-white">Edit Profile</button></div></section>

    <section className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-800 bg-[#091a2e] sm:grid-cols-4">{stats.map((stat) => <div key={stat.label} className="border-b border-r border-slate-800 p-4 text-center last:border-r-0 sm:border-b-0"><p className="truncate text-lg font-black text-white">{stat.value}</p><p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p></div>)}</section>

    <div className="grid gap-5 lg:grid-cols-[1.35fr_.65fr]"><div className="space-y-5"><section className="rounded-2xl border border-slate-800 bg-[#0a192b] p-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">About me</p><p className="mt-3 text-sm leading-6 text-slate-300">Tell other players about your badminton journey.</p><div className="mt-4 flex flex-wrap gap-2">{events.length ? events.map((event) => <span key={event} className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">🏸 {event === 'SINGLES' ? 'Singles' : 'Doubles'}</span>) : <span className="text-sm text-slate-500">Preferred events will appear after your first entry.</span>}</div></section>
      <section className="rounded-2xl border border-slate-800 bg-[#0a192b] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Tournament history</p><h2 className="mt-1 text-xl font-black text-white">Your entries</h2></div><span className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-slate-300">{registrations.length}</span></div>{loading ? <p className="mt-5 text-sm text-slate-400">Loading history...</p> : registrations.length === 0 ? <p className="mt-5 text-sm text-slate-400">Your tournament entries will appear here.</p> : <div className="mt-5 space-y-3">{registrations.slice(0, 5).map((registration) => { const tournament = tournamentById.get(registration.tournamentId); const medal = medals.find((item) => item.tournamentId === registration.tournamentId && item.categoryId === registration.categoryId); return <article key={registration.id} className="flex items-center justify-between gap-3 rounded-xl bg-white/[.04] p-4"><div className="min-w-0"><p className="truncate font-bold text-white">{tournament?.name ?? registration.tournamentCode}</p><p className="mt-1 text-xs text-slate-400">{registration.categoryName} · {registration.eventType}</p></div><span className="shrink-0 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-bold text-emerald-200">{medal ? (medal.position === 'WINNER' ? 'Winner' : 'Runner Up') : registration.status}</span></article> })}</div>}</section></div>
      <div className="space-y-5"><section className="rounded-2xl border border-slate-800 bg-[#0a192b] p-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Achievements</p><div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-amber-300/10 p-4 text-center"><p className="text-2xl">🥇</p><p className="mt-1 text-2xl font-black text-amber-200">{gold}</p><p className="text-xs font-bold uppercase text-amber-100/70">Gold medals</p></div><div className="rounded-xl bg-slate-200/10 p-4 text-center"><p className="text-2xl">🥈</p><p className="mt-1 text-2xl font-black text-slate-100">{silver}</p><p className="text-xs font-bold uppercase text-slate-300">Silver medals</p></div></div>{recentMedals.length > 0 && <div className="mt-5 space-y-3">{recentMedals.map((medal) => <div key={medal.id} className="rounded-xl border border-slate-800 p-3"><p className="font-bold text-white">{medal.position === 'WINNER' ? '🏆 Winner' : '🥈 Runner Up'}</p><p className="mt-1 truncate text-sm text-slate-300">{medal.tournamentName}</p><p className="mt-1 text-xs text-slate-500">{medal.categoryName} · {new Date(medal.achievedAt).toLocaleDateString()}</p></div>)}</div>}</section>
      <section className="overflow-hidden rounded-2xl border border-emerald-300/20 bg-gradient-to-br from-[#0d2c31] to-[#081629] p-5"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Player card</p><div className="mt-4 rounded-xl border border-white/10 bg-black/15 p-4"><p className="text-sm font-black text-emerald-300">SMASHPOINT</p><p className="mt-4 text-xl font-black text-white">{profile.fullName}</p><p className="mt-1 text-sm font-bold text-slate-300">{profile.playerCode}</p><p className="mt-5 text-xs text-slate-400">{profile.location || 'SmashPoint Player'} · Play • Connect • Compete</p></div><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={download} className="rounded-xl bg-white px-3 py-2.5 text-xs font-black text-slate-900">Download Card</button><button type="button" onClick={() => void share()} className="rounded-xl border border-emerald-300/40 px-3 py-2.5 text-xs font-black text-emerald-200">Share</button></div></section></div></div>
  </div>
}

export default PlayerProfilePage
