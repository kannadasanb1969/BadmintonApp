import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useAuthStore } from '@/store/authStore'
import { registrationService } from '@/features/registrations/services/registrationService'
import { teamService } from '@/features/teams/services/teamService'
import { fixtureService } from '@/features/fixtures/services/fixtureService'

import { TournamentCategory } from '@/features/tournaments/types/tournament.types'
import { Team } from '@/features/teams/types/team.types'
import { Registration } from '@/features/registrations/types/registration.types'
import { Fixture } from '@/features/fixtures/types/fixture.types'

import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'

const CategoryRegistrationsPage = () => {
  const { tournamentId, categoryId } = useParams<{ tournamentId: string; categoryId: string }>()
  const navigate = useNavigate()

  const {
    tournament,
    loading: tournamentLoading,
    error: tournamentError,
  } = useTournamentStore()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [category, setCategory] = useState<TournamentCategory | null>(null)
  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [showConfirmClose, setShowConfirmClose] = useState<boolean>(false)

  // For singles: list of registrations
  const [registrations, setRegistrations] = useState<Registration[]>([])
  // For doubles: list of confirmed teams
  const [teams, setTeams] = useState<Team[]>([])

  useEffect(() => {
    // Fetch tournament and category if not already loaded
    if (tournamentId && categoryId) {
      const fetchData = async () => {
        const tournamentStore = useTournamentStore.getState()
        if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
          await tournamentStore.fetchTournamentById(tournamentId)
        }

        const updatedTournament = useTournamentStore.getState().tournament
        if (updatedTournament) {
          const cat = updatedTournament.categories.find(c => c.id === categoryId)
          if (cat) {
            setCategory(cat)
            if (cat.eventType === 'SINGLES') {
              const regs = (await registrationService.getTournamentRegistrations(tournamentId))
                .filter(reg => reg.categoryId === categoryId && reg.status === 'REGISTERED')
              setRegistrations(regs)
            } else {
              const confirmedTeams = (await teamService.getCategoryTeams(tournamentId, categoryId))
                .filter(team => team.status === 'CONFIRMED')
              setTeams(confirmedTeams)
            }
          }
        }

        // Load fixture for this tournament and category
        const existingFixture = (await fixtureService.getFixtures()).find(item => item.tournamentId === tournamentId && item.categoryId === categoryId)
        if (existingFixture) {
          setFixture(existingFixture)
        }
      }
      fetchData()
    }
  }, [tournamentId, categoryId])

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

  if (!category) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          Loading category details...
        </div>
      </div>
    )
  }

  // Check organizer authorization using the authenticated user
  const authStore = useAuthStore.getState()
  const currentUserId = authStore.user?.id
  if (!tournament || !currentUserId || tournament.organizerId !== currentUserId) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          Access denied: You are not the organizer of this tournament.
        </div>
      </div>
    )
  }

  const handleCloseRegistration = async () => {
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      // Call the store action to close the category registration
      // Use the authenticated user's id as the organizerId
      const authStore = useAuthStore.getState()
      await useTournamentStore.getState().closeCategoryRegistration(
        authStore.user?.id ?? '',
        tournamentId,
        categoryId
      )
      await useTournamentStore.getState().fetchTournamentById(tournamentId)
      setSuccessMessage('Registration closed successfully')
      // Refetch the category to update the UI
      const updatedTournament = useTournamentStore.getState().tournament
      if (updatedTournament) {
        const updatedCat = updatedTournament.categories.find(c => c.id === categoryId)
        if (updatedCat) {
          setCategory(updatedCat)
        }
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
      setShowConfirmClose(false)
    }
  }

  const handleConfirmClose = () => {
    handleCloseRegistration()
  }

  const handleReopen = async () => {
    if (!tournamentId || !categoryId || !currentUserId) return
    setIsLoading(true)
    setErrorMessage(null)
    try {
      await useTournamentStore.getState().reopenCategoryRegistration(currentUserId, tournamentId, categoryId)
      const updated = useTournamentStore.getState().tournament?.categories.find(item => item.id === categoryId)
      if (updated) setCategory(updated)
      setSuccessMessage('Registration is open again.')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not reopen registration')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCancelClose = () => {
    setShowConfirmClose(false)
  }

  const entryCount = category.eventType === 'SINGLES' ? registrations.length : teams.length
  const entryLabel = category.eventType === 'SINGLES' ? 'registered players' : 'registered teams'

  if (category.eventType === 'SINGLES') {
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

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded mb-4">
            {successMessage}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">
            Singles Registrations
          </h2>
          <p className="text-sm text-gray-600">
            Category: {category.name}
          </p>
        </div>

        <div className="mb-4">
          {category.registrationPhase === 'OPEN' ? (
            <>
              {!showConfirmClose && (
                <button
                  onClick={() => setShowConfirmClose(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Close Registration
                </button>
              )}
              {showConfirmClose && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Close registration with {entryCount} {entryLabel}? New registrations will no longer be accepted.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleCancelClose}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmClose}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Confirm Close
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-wrap items-center gap-3"><span className="text-red-600">Registration Closed</span>{!fixture && <button onClick={handleReopen} disabled={isLoading} className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50">Reopen Registration</button>}</div>
          )}
        </div>

        {category.registrationPhase === 'CLOSED' && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Fixture Status:
              {fixture ? (
                fixture.status === 'DRAFT' ? (
                  <span className="text-yellow-600">Draft</span>
                ) : (
                  <span className="text-green-600">Published</span>
                )
              ) : (
                <span className="text-gray-500">Not Generated</span>
              )}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Player Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Player Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Registration Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Registered At
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {registrations.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-center text-sm text-gray-500" colSpan={5}>
                    No registrations found.
                  </td>
                </tr>
              ) : (
                registrations.map(reg => (
                  <tr key={reg.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reg.playerName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reg.playerCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {reg.registrationCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(reg.registeredAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        REGISTERED
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          {category.registrationPhase === 'CLOSED' && (
            <>
              <button
                onClick={() => navigate(`/organizer/tournaments/${tournamentId}/categories/${categoryId}/fixture`)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {fixture ? 'View Fixture' : 'Generate Fixture'}
              </button>
            </>
          )}
          <button
            onClick={() => navigate(`/organizer/tournaments/${tournamentId}/registrations`)}
            className="ml-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Tournament Registrations
          </button>
        </div>
      </div>
    )
  } else if (category.eventType === 'DOUBLES') {
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

        {errorMessage && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded mb-4">
            {successMessage}
          </div>
        )}

        <div className="mb-6">
          <h2 className="text-xl font-semibold mb-3">
            Doubles Confirmed Teams
          </h2>
          <p className="text-sm text-gray-600">
            Category: {category.name}
          </p>
        </div>

        <div className="mb-4">
          {category.registrationPhase === 'OPEN' ? (
            <>
              {!showConfirmClose && (
                <button
                  onClick={() => setShowConfirmClose(true)}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Close Registration
                </button>
              )}
              {showConfirmClose && (
                <div className="mt-4 space-y-3">
                  <p className="text-sm text-gray-600">
                    Close registration with {entryCount} {entryLabel}? New registrations will no longer be accepted.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={handleCancelClose}
                      className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmClose}
                      className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                    >
                      Confirm Close
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <span className="text-red-600">Registration Closed</span>
          )}
        </div>

        {category.registrationPhase === 'CLOSED' && (
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              Fixture Status:
              {fixture ? (
                fixture.status === 'DRAFT' ? (
                  <span className="text-yellow-600">Draft</span>
                ) : (
                  <span className="text-green-600">Published</span>
                )
              ) : (
                <span className="text-gray-500">Not Generated</span>
              )}
            </p>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Team Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Player 1 Name / Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Player 2 Name / Code
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Partner Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Registration Code (if linked)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Team Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {teams.length === 0 ? (
                <tr>
                  <td className="px-6 py-4 text-center text-sm text-gray-500" colSpan={6}>
                    No confirmed teams found.
                  </td>
                </tr>
              ) : (
                teams.map(team => (
                  <tr key={team.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {team.teamCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {team.player1Name} ({team.player1Code})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {team.player2Name} ({team.player2Code})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {team.player2Type === 'GUEST' ? 'Guest' : 'Full Player'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {/* We don't have registration code in team, but we can show if there's a registration linked */}
                      {/* For now, we'll show '-' */}
                      -
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {team.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          {category.registrationPhase === 'CLOSED' && (
            <>
              <button
                onClick={() => navigate(`/organizer/tournaments/${tournamentId}/categories/${categoryId}/fixture`)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                {fixture ? 'View Fixture' : 'Generate Fixture'}
              </button>
            </>
          )}
          <button
            onClick={() => navigate(`/organizer/tournaments/${tournamentId}/registrations`)}
            className="ml-4 px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Tournament Registrations
          </button>
        </div>
      </div>
    )
  }
}

export default CategoryRegistrationsPage
