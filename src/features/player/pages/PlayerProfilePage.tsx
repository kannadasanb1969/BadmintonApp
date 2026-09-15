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
import profileBackground from '@/assets/playinfo.png'
import playerCardArtwork from '@/assets/playercard.png'
import defaultProfilePhoto from '@/assets/dp.png'
import goldBadge from '@/assets/gold.png'
import silverBadge from '@/assets/silver.png'

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

  return <div className="relative isolate mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-[#031317] pb-5 text-slate-100 shadow-2xl" style={{ backgroundImage: `linear-gradient(180deg, rgb(2 15 18 / .66), rgb(2 14 17 / .94)), url(${profileBackground})`, backgroundPosition: 'center top', backgroundSize: 'cover' }}>
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_8%,rgb(180_255_35_/_0.18),transparent_24rem)]" />
    <section className="relative mx-3 mt-3 overflow-hidden rounded-[1.65rem] border border-lime-300/70 bg-[#06181b]/90 p-4 shadow-[0_0_32px_rgb(168_255_45_/_0.09)] sm:mx-5 sm:p-6">
      <div className="absolute -right-20 -top-20 h-52 w-52 rounded-full border border-lime-200/20" />
      <div className="relative flex items-center gap-4 sm:gap-6">
        <img src={profile.profilePhoto || defaultProfilePhoto} alt={`${profile.fullName} profile`} className="h-24 w-24 shrink-0 rounded-full border-2 border-lime-300 object-cover shadow-[0_0_0_5px_rgb(8_30_32_/_0.8)] sm:h-32 sm:w-32" />
        <div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[.28em] text-[#62e6d4] sm:text-xs">SmashPoint player</p><h1 className="mt-1 truncate text-2xl font-black tracking-tight text-white sm:text-4xl">{profile.fullName}</h1><div className="mt-2 flex flex-wrap gap-2"><span className="rounded-full bg-[#112b36] px-3 py-1 text-xs font-bold text-slate-200">{profile.playerCode}</span><span className="rounded-full border border-emerald-400/60 px-3 py-1 text-xs font-bold text-emerald-300">✓ Verified Player</span></div><p className="mt-3 truncate text-sm text-slate-300">📍 {profile.location || 'Location not added'}</p><p className="text-sm text-slate-300">Play · Connect · Compete</p></div>
      </div>
      <button type="button" onClick={() => navigate('/player/profile/edit')} className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-lime-300 py-3 text-sm font-black text-[#07170f] transition hover:bg-lime-200">✎ <span>Edit Profile</span></button>
    </section>

    <section className="mx-3 mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-sky-300/35 bg-[#061820]/90 sm:mx-5 sm:grid-cols-4">{stats.map((stat, index) => <div key={stat.label} className={`p-4 ${index < 2 ? 'border-b' : ''} ${index % 2 === 0 ? 'border-r' : ''} border-sky-200/15 sm:border-b-0 sm:border-r last:border-r-0`}><p className="truncate text-lg font-black text-white sm:text-xl">{stat.value}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-[.18em] text-slate-400">{stat.label}</p></div>)}</section>

    <div className="mx-3 mt-3 space-y-3 sm:mx-5 sm:mt-5 sm:grid sm:grid-cols-[1.3fr_.7fr] sm:gap-3 sm:space-y-0">
      <div className="space-y-3">
        <section className="rounded-2xl border border-sky-300/25 bg-[#04151a]/90 p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.24em] text-[#62e6d4]">About me</p><button type="button" onClick={() => navigate('/player/profile/edit')} className="rounded-full border border-sky-200/50 px-3 py-1 text-xs font-bold text-slate-200">✎ Edit</button></div><p className="mt-4 text-sm leading-6 text-slate-300">Tell other players about your badminton journey.</p><div className="mt-3 rounded-xl border border-sky-300/15 bg-[#0a2028]/70 p-3 text-sm text-slate-300">{events.length ? events.map((event) => <span key={event} className="mr-2 inline-flex rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-200">🏸 {event === 'SINGLES' ? 'Singles' : 'Doubles'}</span>) : 'Preferred events will appear after your first entry.'}</div></section>
        <section className="rounded-2xl border border-sky-300/25 bg-[#04151a]/90 p-4 sm:p-5"><div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[.24em] text-[#62e6d4]">🏆 Tournament history</p><span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-slate-200">{registrations.length}</span></div><div className="mt-3 space-y-2">{loading ? <p className="text-sm text-slate-400">Loading history...</p> : registrations.length === 0 ? <p className="text-sm text-slate-400">Your tournament entries will appear here.</p> : registrations.slice(0, 5).map((registration) => { const tournament = tournamentById.get(registration.tournamentId); const medal = medals.find((item) => item.tournamentId === registration.tournamentId && item.categoryId === registration.categoryId); return <article key={registration.id} className="flex items-center justify-between gap-3 rounded-xl border border-sky-200/10 bg-[#0a2028]/75 p-3"><div className="min-w-0"><p className="truncate font-bold text-white">{tournament?.name ?? registration.tournamentCode}</p><p className="mt-1 text-xs text-slate-400">{registration.categoryName} · {registration.eventType}</p></div><span className="shrink-0 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-bold text-emerald-200">{medal ? (medal.position === 'WINNER' ? 'Winner' : 'Runner Up') : registration.status}</span></article> })}</div></section>
      </div>
      <div className="space-y-3"><section className="rounded-2xl border border-sky-300/25 bg-[#04151a]/90 p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-[.24em] text-[#62e6d4]">🏅 Achievements</p><div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-xl border border-amber-200/10 bg-amber-300/10 p-3 text-center"><img src={goldBadge} alt="Gold medal" className="mx-auto h-14 w-14 rounded-full object-cover" /><p className="text-2xl font-black text-amber-200">{gold}</p><p className="text-[10px] font-bold uppercase text-amber-100/70">Gold medals</p></div><div className="rounded-xl border border-slate-200/10 bg-slate-200/10 p-3 text-center"><img src={silverBadge} alt="Silver medal" className="mx-auto h-14 w-14 rounded-full object-cover" /><p className="text-2xl font-black text-slate-100">{silver}</p><p className="text-[10px] font-bold uppercase text-slate-300">Silver medals</p></div></div>{recentMedals.length > 0 && <div className="mt-4 space-y-2">{recentMedals.map((medal) => <div key={medal.id} className="rounded-xl border border-slate-800 p-3"><p className="font-bold text-white">{medal.position === 'WINNER' ? '🏆 Winner' : '🥈 Runner Up'}</p><p className="mt-1 truncate text-sm text-slate-300">{medal.tournamentName}</p><p className="mt-1 text-xs text-slate-500">{medal.categoryName} · {new Date(medal.achievedAt).toLocaleDateString()}</p></div>)}</div>}</section>
        <section className="overflow-hidden rounded-2xl border border-lime-300/25 bg-[#061b1d]/95 p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-[.24em] text-[#62e6d4]">▣ Player card</p><div className="relative mt-3 overflow-hidden rounded-xl border border-sky-200/30 bg-[#06171d]"><img src={playerCardArtwork} alt="SmashPoint player card artwork" className="h-40 w-full object-cover opacity-35" /><div className="absolute inset-0 bg-gradient-to-r from-[#06171d] via-[#06171d]/75 to-transparent" /><div className="absolute inset-0 flex flex-col justify-center p-4"><p className="text-sm font-black italic text-white">SMASH<span className="text-lime-300">POINT</span></p><p className="mt-3 text-xl font-black text-white">{profile.fullName}</p><p className="text-sm font-bold text-slate-300">{profile.playerCode}</p><p className="mt-2 text-xs text-slate-400">{profile.location || 'SmashPoint Player'} · Play · Connect · Compete</p></div></div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={download} className="rounded-full bg-lime-300 px-3 py-3 text-xs font-black text-slate-950 transition hover:bg-lime-200">↓ &nbsp; Download Card</button><button type="button" onClick={() => void share()} className="rounded-full border border-slate-300/70 px-3 py-3 text-xs font-black text-white transition hover:bg-white/10">♧ &nbsp; Share</button></div></section></div>
    </div>
  </div>
}

export default PlayerProfilePage
