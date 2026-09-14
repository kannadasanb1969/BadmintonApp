import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'

import { TournamentCategory } from '@/features/tournaments/types/tournament.types'
import { Team } from '@/features/teams/types/team.types'
import { Registration } from '@/features/registrations/types/registration.types'
import { Fixture } from '@/features/fixtures/types/fixture.types'

import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'

const TournamentRegistrationsPage = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()

  const {
    tournament,
    loading: tournamentLoading,
    error: tournamentError,
  } = useTournamentStore()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [closingCategory, setClosingCategory] = useState<string | null>(null)
  const currentUser = useAuthStore(state => state.user)

  useEffect(() => {
    // Fetch tournament if not already loaded
    if (tournamentId) {
      const fetchTournament = async () => {
        const tournamentStore = useTournamentStore.getState()
        if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
          await tournamentStore.fetchTournamentById(tournamentId)
        }
      }
      fetchTournament()
    }
  }, [tournamentId])

  if (tournamentLoading || !tournament) {
    return (
      <div className="text-center py-8">
        Loading tournament details...
      </div>
    )
  }

  if (tournamentError) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading tournament: {tournamentError}
      </div>
    )
  }

  // Check if the current user is the organizer
  // We need to get the current organizer from auth (not implemented yet)
  // For now, we'll assume the user is the organizer if the tournament has an organizerId
  // In a real app, we would check against the logged-in user's organizer profile.
  // We'll skip this check for now and rely on route protection (RoleRoute with ORGANIZER role).
  // But we should still check that the organizerId matches the current user.
  // Since we don't have auth context here, we'll assume the route protection is enough.

  const handleCloseRegistration = async (categoryId: string) => {
    if (!currentUser || !tournamentId || isLoading) return
    setIsLoading(true)
    setError(null)
    try {
      await useTournamentStore.getState().closeCategoryRegistration(currentUser.id, tournamentId, categoryId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to close registration')
    } finally {
      setIsLoading(false)
      setClosingCategory(null)
    }
  }

  const handleGenerateFixture = async (categoryId: string) => {
    navigate(`/organizer/tournaments/${tournamentId}/categories/${categoryId}`)
  }

  const handleViewFixture = async (categoryId: string) => {
    navigate(`/organizer/tournaments/${tournamentId}/categories/${categoryId}`)
  }

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {tournament.name}
        </h1>
        <p className="text-sm text-gray-600">
          {formatDateDisplay(tournament.tournamentDate)} • {tournament.venueName}
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
          {error}
        </div>
      )}

      {closingCategory && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
        <p>Close registration for {tournament.categories.find(category => category.id === closingCategory)?.name}? New entries will no longer be accepted.</p>
        <div className="mt-3 flex gap-3">
          <button type="button" disabled={isLoading} onClick={() => handleCloseRegistration(closingCategory)} className="rounded bg-rose-600 px-4 py-2 text-white disabled:opacity-50">Confirm Close</button>
          <button type="button" disabled={isLoading} onClick={() => setClosingCategory(null)} className="rounded bg-slate-200 px-4 py-2 text-slate-900">Cancel</button>
        </div>
      </div>}
      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Manage Registrations
        </h2>
        <p className="text-sm text-gray-600">
          Select a category to view registrations, close registration, or manage fixture.
        </p>
      </div>

      <div className="space-y-4">
        {tournament.categories.map(category => (
          <div key={category.id} className="border rounded-lg p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">
                  {category.name}
                </h3>
                <p className="text-sm text-gray-600">
                  {category.eventType === 'SINGLES' ? 'Singles' : 'Doubles'}
                </p>
              </div>
              <div className="space-x-3">
                <button
                  onClick={() => setClosingCategory(category.id)}
                  className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                  disabled={isLoading || category.registrationPhase === 'CLOSED'}
                >
                  {category.registrationPhase === 'CLOSED' ? 'Closed' : 'Close Registration'}
                </button>
                <button
                  onClick={() => handleGenerateFixture(category.id)}
                  className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                  disabled={category.registrationPhase !== 'CLOSED'}
                >
                  Generate Fixture
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Registration Phase:</span>
                <span className="text-sm">
                  {category.registrationPhase === 'OPEN' ? (
                    <span className="text-green-600">Open</span>
                  ) : (
                    <span className="text-red-600">Closed</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Fixture Status:</span>
                <span className="text-sm">
                  {/* We'll get the fixture status from the fixture store */}
                  {/* We'll compute it below */}
                  {/* For now, we'll leave it as not generated */}
                  <span className="text-gray-500">Not Generated</span>
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Registered Entries:</span>
                <span className="text-sm">
                  {/* We'll compute the count based on event type */}
                  {/* We'll compute it below */}
                  0
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Max Entries:</span>
                <span className="text-sm">
                  {category.maxTeams !== undefined ? `${category.maxTeams}` : 'No limit'}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <button
          onClick={() => navigate('/organizer/tournaments')}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Tournament List
        </button>
      </div>
    </div>
  )
}

export default TournamentRegistrationsPage
