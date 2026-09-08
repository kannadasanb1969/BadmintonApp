import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { createDoublesFixtureDemo } from '@/features/tournaments/services/demoTournamentService'

const OrganizerDashboard = () => {
  const user = useAuthStore(state => state.user)
  const tournaments = useTournamentStore(state => state.tournaments)
  const tournamentData = tournaments as unknown as
    | typeof tournaments
    | { tournaments?: typeof tournaments }
  const tournamentList = Array.isArray(tournamentData)
    ? tournamentData
    : Array.isArray(tournamentData?.tournaments)
      ? tournamentData.tournaments
      : []
  const navigate = useNavigate()

  // Get tournaments for the current organizer
  const organizerTournaments = useMemo(() => {
    console.log('Organizer dashboard data:', tournaments)
    console.log('Is array:', Array.isArray(tournaments))

    if (!user) {
      return []
    }

    return tournamentList.filter(
      tournament => tournament.organizerId === user.id
    )
  }, [tournaments, tournamentList, user])

  // Calculate stats
  const totalTournaments = organizerTournaments.length
  const draftTournaments = organizerTournaments.filter(t => t.status === 'DRAFT').length
  const pendingApprovalTournaments = organizerTournaments.filter(t => t.status === 'PENDING_ADMIN_APPROVAL').length
  const publishedTournaments = organizerTournaments.filter(t => t.status === 'PUBLISHED').length

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-slate-950 to-emerald-900 p-6 text-white sm:flex-row sm:items-end sm:justify-between sm:p-8"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">Match control center</p><h1 className="mt-2 text-3xl font-black">Run a smooth tournament.</h1><p className="mt-2 text-sm text-slate-300">Create events, fill draws, and keep every court moving.</p></div><Link to="/organizer/tournaments/new" className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-white">+ Create tournament</Link></section>
      <button type="button" onClick={async () => { if (!user) return; const id = await createDoublesFixtureDemo(user); navigate(`/organizer/tournaments/${id}`) }} className="rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800 hover:bg-emerald-100">Create 16-team doubles test tournament</button>
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm transition hover:shadow-md">
          <h2 className="text-xl font-semibold mb-4">Tournaments</h2>
          <p className="text-gray-600 mb-4">
            Manage your badminton tournaments. Create new tournaments, view existing ones, and submit them for approval.
          </p>
          <Link
            to="/organizer/tournaments"
            className="inline-block rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600"
          >
            Manage Tournaments
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200 p-6 bg-white shadow-sm transition hover:shadow-md">
          <h2 className="text-xl font-semibold mb-4">Quick Stats</h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Tournaments</span>
              <span className="rounded-lg bg-slate-100 px-3 py-1 text-lg font-bold">{totalTournaments}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Draft Tournaments</span>
              <span className="rounded-lg bg-amber-50 px-3 py-1 text-lg font-bold text-amber-700">{draftTournaments}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Pending Approval</span>
              <span className="rounded-lg bg-blue-50 px-3 py-1 text-lg font-bold text-blue-700">{pendingApprovalTournaments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default OrganizerDashboard
