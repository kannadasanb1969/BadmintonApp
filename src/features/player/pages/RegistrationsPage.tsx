import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { fixtureService } from '@/features/fixtures/services/fixtureService'
import { Fixture } from '@/features/fixtures/types/fixture.types'

import { Registration } from '@/features/registrations/types/registration.types'
import { Tournament } from '@/features/tournaments/types/tournament.types'

const PlayerRegistrationsPage = () => {
  const { profile, hasProfile } = usePlayerProfileStore()

  const { getPlayerRegistrations } = useRegistrationStore()

  const {
    tournaments: allTournaments,
    loading: tournamentLoading,
    fetchTournaments,
  } = useTournamentStore()

  const navigate = useNavigate()

  const [registrations, setRegistrations] = useState<Registration[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [loadingFixtures, setLoadingFixtures] = useState(true)

  useEffect(() => {
    if (hasProfile && profile) {
      setLoading(true)

      const playerRegistrations = getPlayerRegistrations(profile.id)

      setRegistrations(playerRegistrations)
      setLoading(false)
    } else {
      setRegistrations([])
      setLoading(false)
    }
  }, [hasProfile, profile, getPlayerRegistrations])

  useEffect(() => {
    if (allTournaments.length === 0 && !tournamentLoading) {
      void fetchTournaments()
    }
  }, [allTournaments.length, tournamentLoading, fetchTournaments])

  useEffect(() => {
    let cancelled = false
    void fixtureService.getFixtures()
      .then((items) => { if (!cancelled) setFixtures(items) })
      .catch(() => { if (!cancelled) setFixtures([]) })
      .finally(() => { if (!cancelled) setLoadingFixtures(false) })
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="text-center py-8">
        Loading registrations...
      </div>
    )
  }

  if (!hasProfile || !profile) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">
          My Registrations
        </h1>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-center">
          <p className="text-yellow-700">
            Please complete your player profile to view your registrations.
          </p>
        </div>

        <div className="text-center mt-6">
          <button
            type="button"
            onClick={() => navigate('/player/profile')}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Complete Profile
          </button>
        </div>
      </div>
    )
  }

  if (registrations.length === 0) {
    return (
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-r from-slate-950 to-emerald-900 p-6 text-white"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">My match pass</p><h1 className="mt-2 text-3xl font-black">My registrations</h1></section>
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm"><div className="text-4xl">🏸</div><p className="mt-4 text-lg font-bold text-slate-800">No tournaments yet</p><p className="mt-2 text-sm text-slate-500">Your confirmed tournament entries will appear here.</p><div className="mt-5"><button
              type="button"
              onClick={() => navigate('/player/tournaments')}
              className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-600"
            >
              Browse Tournaments
            </button></div>
        </div>
      </div>
    )
  }

  const tournamentMap = new Map<string, Tournament>()

  allTournaments.forEach((tournament) => {
    tournamentMap.set(tournament.id, tournament)
  })

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 to-emerald-900 p-6 text-white sm:p-8"><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-300">My match pass</p><div className="mt-2 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black">My registrations</h1><p className="mt-2 text-sm text-slate-300">Your upcoming tournaments and team entries.</p></div><span className="rounded-full border border-emerald-300/30 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-200">{registrations.filter(item => item.status === 'REGISTERED').length} Active</span></div></section>

      <div className="space-y-4">
        {registrations.map((registration) => {
          const tournament = tournamentMap.get(registration.tournamentId)
          const fixture = fixtures.find((item) => item.tournamentId === registration.tournamentId && item.categoryId === registration.categoryId)
          const fixtureAvailable = registration.status === 'REGISTERED' && fixture?.status === 'PUBLISHED'

          return (
            <article key={registration.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400" />
              <div className="p-5"><div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-start">
                <div>
                  {tournament ? (
                    <>
                      <div className="mb-3 flex flex-wrap gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${registration.status === 'REGISTERED' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>{registration.status === 'REGISTERED' ? 'CONFIRMED' : 'CANCELLED'}</span><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700">{registration.eventType}</span></div><h3 className="text-xl font-bold text-slate-900">
                        {tournament.name}
                      </h3>
                      <p className="mt-2 text-sm font-medium text-slate-600">📅 {new Date(tournament.tournamentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })} · 📍 {tournament.venueName}</p>
                    </>
                  ) : (
                    <h3 className="text-lg font-semibold">
                      Tournament: {registration.tournamentId}
                    </h3>
                  )}

                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Category</p><p className="mt-1 font-bold text-slate-700">{registration.categoryName}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entry pass</p><p className="mt-1 font-bold text-slate-700">{registration.registrationCode}</p></div></div>

                  {registration.status === 'CANCELLED' &&
                    registration.cancelledAt && (
                      <p className="text-sm text-red-600 mt-1">
                        Cancelled:{' '}
                        {new Date(
                          registration.cancelledAt
                        ).toLocaleDateString()}
                      </p>
                    )}
                </div>

                <div className="flex shrink-0 flex-col gap-2 sm:min-w-40">
                  {registration.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      onClick={() =>
                        navigate(
                          `/player/tournaments/${registration.tournamentId}`
                        )
                      }
                      className="w-full rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-600"
                    >
                      View Tournament
                    </button>
                  )}
                  {registration.status !== 'CANCELLED' && (
                    <button
                      type="button"
                      disabled={!fixtureAvailable || loadingFixtures}
                      title={fixtureAvailable ? 'View published fixture' : 'Fixture not available yet'}
                      onClick={() => fixtureAvailable && navigate(`/player/fixtures?tournamentId=${registration.tournamentId}&categoryId=${registration.categoryId}`)}
                      className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      {loadingFixtures ? 'Checking fixture...' : fixtureAvailable ? 'View Fixtures' : 'Fixture not available yet'}
                    </button>
                  )}
                </div>
              </div></div>
            </article>
          )
        })}
      </div>
    </div>
  )
}

export default PlayerRegistrationsPage
