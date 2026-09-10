import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useAuthStore } from '@/store/authStore'

import { TournamentCategory } from '@/features/tournaments/types/tournament.types'
import { Fixture, FixtureMatch } from '@/features/fixtures/types/fixture.types'
import { Team } from '@/features/teams/types/team.types'
import { Registration } from '@/features/registrations/types/registration.types'

import { fixtureService } from '@/features/fixtures/services/fixtureService'
import { matchService } from '@/features/matches/services/matchService'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'
import { isExplicitMockApiMode } from '@/api/apiClient'

const MatchScoringPage = () => {
  const { tournamentId, categoryId, matchId } = useParams<{ tournamentId: string; categoryId: string; matchId: string }>()
  const navigate = useNavigate()
  const authStore = useAuthStore()
  const currentUser = authStore.user

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
  const [match, setMatch] = useState<FixtureMatch | null>(null)
  const [showConfirmation, setShowConfirmation] = useState<boolean>(false)
  const [confirmationType, setConfirmationType] = useState<'complete' | null>(null)

  useEffect(() => {
    // Fetch tournament, category, fixture, and match if not already loaded
    if (tournamentId && categoryId && matchId) {
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
          }
        }

        // Load fixture for this tournament and category
        const fixtures = await fixtureService.getFixtures()
        const existingFixture = fixtures.find((item) => item.tournamentId === tournamentId && item.categoryId === categoryId)
        if (existingFixture) {
          setFixture(existingFixture)
          const existingMatch = await matchService.getMatch(matchId)
          if (existingMatch) {
            setMatch(existingMatch)
          }
        }
      }
      fetchData()
    }
  }, [tournamentId, categoryId, matchId])

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

  if (!fixture) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          Loading fixture details...
        </div>
      </div>
    )
  }

  if (!match) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          Loading match details...
        </div>
      </div>
    )
  }

  // Check if current user is the organizer
  const isOrganizer = currentUser?.role === 'ADMIN' || (currentUser?.id === tournament.organizerId && currentUser?.role === 'ORGANIZER')

  // Helper function to check if match can be started
  const canStartMatch = (match: FixtureMatch): boolean => {
    return (
      fixture?.status === 'PUBLISHED' &&
      match.status === 'SCHEDULED' &&
      match.participant1 !== null &&
      match.participant2 !== null &&
      isOrganizer
    )
  }

  // Helper function to check if match can be scored
  const canScoreMatch = (match: FixtureMatch): boolean => {
    return (
      fixture?.status === 'PUBLISHED' &&
      match.status === 'LIVE' &&
      isOrganizer
    )
  }

  // Helper function to check if score can be undone
  const canUndoScore = (match: FixtureMatch): boolean => {
    return (
      isExplicitMockApiMode &&
      fixture?.status === 'PUBLISHED' &&
      match.status === 'LIVE' &&
      match.scoreHistory &&
      match.scoreHistory.length > 0 &&
      isOrganizer
    )
  }

  // Helper function to check if match can be completed
  const canCompleteMatch = (match: FixtureMatch): boolean => {
    return (
      fixture?.status === 'PUBLISHED' &&
      match.status === 'LIVE' &&
      match.participant1 !== null &&
      match.participant2 !== null &&
      match.participant1Score !== match.participant2Score && // Not tied
      isOrganizer
    )
  }
  const winningPoints = match.winningPoints ?? 21
  const handleWinningPointsChange = (points: 15 | 21 | 30) => {
    if (!isExplicitMockApiMode) return
    const updated = useFixtureStore.getState().setMatchWinningPoints(fixture.id, match.id, points)
    if (updated) setMatch(updated)
  }

  const handleStartMatch = async () => {
    if (!tournament || !canStartMatch(match)) return
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const updatedMatch = await matchService.startMatch(
        currentUser?.id ?? '',
        tournamentId,
        categoryId,
        matchId
      )
      // Update fixture with the started match
      const fixtureStore = useFixtureStore.getState()
      const currentFixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId)
      if (currentFixture) {
        setFixture(currentFixture)
        setMatch(currentFixture.matches.find(m => m.id === matchId))
      }
      setSuccessMessage('Match started successfully')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdateScore = async (
    side: 'PARTICIPANT_1' | 'PARTICIPANT_2',
    delta: 1 | -1
  ) => {
    if (!tournament) return
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const updatedMatch = await matchService.updateScore(
        currentUser?.id ?? '',
        tournamentId,
        categoryId,
        matchId,
        side,
        delta
      )
      // Update fixture with the updated match
      const fixtureStore = useFixtureStore.getState()
      const currentFixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId)
      if (currentFixture) {
        setFixture(currentFixture)
        setMatch(currentFixture.matches.find(m => m.id === matchId))
      }
      // Clear scoring state after successful update
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleUndoScore = async () => {
    if (!tournament) return
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const updatedMatch = await matchService.undoScore(
        currentUser?.id ?? '',
        tournamentId,
        categoryId,
        matchId
      )
      // Update fixture with the updated match
      const fixtureStore = useFixtureStore.getState()
      const currentFixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId)
      if (currentFixture) {
        setFixture(currentFixture)
        setMatch(currentFixture.matches.find(m => m.id === matchId))
      }
      setSuccessMessage('Score undone successfully')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCompleteMatch = async () => {
    if (!tournament) return
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const updatedMatch = await matchService.completeMatch(
        currentUser?.id ?? '',
        tournamentId,
        categoryId,
        matchId
      )
      // Update fixture with the completed match
      const fixtureStore = useFixtureStore.getState()
      const currentFixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId)
      if (currentFixture) {
        setFixture(currentFixture)
        setMatch(currentFixture.matches.find(m => m.id === matchId))
      }
      setSuccessMessage('Match completed successfully')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
      setShowConfirmation(false)
      setConfirmationType(null)
    }
  }

  if (!isOrganizer) {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-center">
          <p className="text-yellow-700">
            Unauthorized: Only the tournament organizer can access this page.
          </p>
        </div>
      </div>
    )
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
        <p className="text-sm text-gray-600">
          Category: {category.name}
        </p>
        <p className="text-sm text-gray-600">
          Match: {match.matchCode}
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
          Match Score
        </h2>
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
        <p className="text-sm text-gray-600">
          Match Status:
          {match ? (
            <span
              className={`px-2 py-1 text-xs rounded-full
                ${match.status === 'SCHEDULED' ? 'bg-yellow-100 text-yellow-800' : ''}
                ${match.status === 'LIVE' ? 'bg-blue-100 text-blue-800' : ''}
                ${match.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : ''}
                ${match.status === 'CANCELLED' ? 'bg-gray-100 text-gray-800' : ''}
              `}
            >
              {match.status}
            </span>
          ) : (
            <span className="text-gray-500">Unknown</span>
          )}
        </p>
      </div>

      <div className="space-y-4">
        {isExplicitMockApiMode && <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5"><div className="flex items-start gap-3"><span className="text-3xl">🎯</span><div><h3 className="text-lg font-black text-slate-900">Total Points (Winning Points)</h3><p className="text-sm text-slate-500">First team to reach the selected score wins.</p></div></div><div className="mt-4 grid grid-cols-3 gap-2">{([15, 21, 30] as const).map(points => <button key={points} type="button" disabled={match.status === 'COMPLETED'} onClick={() => handleWinningPointsChange(points)} className={`rounded-xl px-3 py-3 text-sm font-black transition ${winningPoints === points ? 'bg-blue-600 text-white shadow-lg' : 'border border-slate-200 bg-white text-slate-700 hover:border-blue-400'}`}>{winningPoints === points ? '✓ ' : ''}{points} Points</button>)}</div><p className="mt-3 text-center text-sm text-blue-700">First to reach <strong>{winningPoints}</strong> points wins this match.</p></section>}
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-start">
            <span className="font-medium text-gray-700">Participant 1:</span>
            <span className="text-sm">
              {match.participant1 ? (
                <span>
                  {match.participant1.name} ({match.participant1.code})
                </span>
              ) : (
                <span className="text-italic text-gray-500">BYE</span>
              )}
            </span>
          </div>

          {/* Participant 1 Score Controls */}
          <div className="flex justify-between items-start mt-4">
            {canStartMatch(match) && !match.participant1Score && !match.participant2Score ? (
              // Show start match button if match is scheduled and has participants
              <div className="flex justify-between items-start">
                {isLoading ? (
                  <button
                    onClick={handleStartMatch}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Starting...
                  </button>
                ) : (
                  <button
                    onClick={handleStartMatch}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                  >
                    Start Match
                  </button>
                )}
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <span className="font-medium text-gray-700">P1 Score:</span>
                <div className="flex items-center space-x-2">
                  {canScoreMatch(match) && !isLoading ? (
                    <>
                      <button
                        onClick={() => handleUpdateScore('PARTICIPANT_1', -1)}
                        className="w-8 h-8 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        disabled={match.participant1Score === 0}
                        title="Decrease score"
                        aria-label="Decrease participant 1 score"
                      >
                        -
                      </button>
                    </>
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-xs">
                      -
                    </span>
                  )}
                  <span className="text-sm font-mono">
                    {match.participant1Score}
                  </span>
                  {canScoreMatch(match) && !isLoading ? (
                    <>
                      <button
                        onClick={() => handleUpdateScore('PARTICIPANT_1', 1)}
                        className="w-8 h-8 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        disabled={isExplicitMockApiMode && match.participant1Score >= winningPoints}
                        title="Increase score"
                        aria-label="Increase participant 1 score"
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-xs">
                      +
                    </span>
                  )}
                </div>
                {isLoading && (
                  <span className="text-xs text-blue-500">Updating...</span>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-between items-start mt-4">
            <span className="font-medium text-gray-700">Participant 2:</span>
            <span className="text-sm">
              {match.participant2 ? (
                <span>
                  {match.participant2.name} ({match.participant2.code})
                </span>
              ) : (
                <span className="text-italic text-gray-500">BYE</span>
              )}
            </span>
          </div>

          {/* Participant 2 Score Controls */}
          <div className="flex justify-between items-start mt-4">
            {canScoreMatch(match) && !match.participant1Score && !match.participant2Score ? (
              // Already handled in P1 section, just show scores
              <div className="flex justify-between items-start">
                <span className="font-medium text-gray-700">P2 Score:</span>
                <span className="text-sm">
                  {match.participant2Score}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <span className="font-medium text-gray-700">P2 Score:</span>
                <div className="flex items-center space-x-2">
                  {canScoreMatch(match) && !isLoading ? (
                    <>
                      <button
                        onClick={() => handleUpdateScore('PARTICIPANT_2', -1)}
                        className="w-8 h-8 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                        disabled={match.participant2Score === 0}
                        title="Decrease score"
                        aria-label="Decrease participant 2 score"
                      >
                        -
                      </button>
                    </>
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-xs">
                      -
                    </span>
                  )}
                  <span className="text-sm font-mono">
                    {match.participant2Score}
                  </span>
                  {canScoreMatch(match) && !isLoading ? (
                    <>
                      <button
                        onClick={() => handleUpdateScore('PARTICIPANT_2', 1)}
                        className="w-8 h-8 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
                        disabled={isExplicitMockApiMode && match.participant2Score >= winningPoints}
                        title="Increase score"
                        aria-label="Increase participant 2 score"
                      >
                        +
                      </button>
                    </>
                  ) : (
                    <span className="w-8 h-8 flex items-center justify-center bg-gray-200 rounded text-xs">
                      +
                    </span>
                  )}
                </div>
                {isLoading && (
                  <span className="text-xs text-blue-500">Updating...</span>
                )}
              </div>
            )}

            {/* Undo Score Button */}
            {canUndoScore(match) && !isLoading && (
              <div className="flex justify-between items-start mt-4">
                {isLoading ? (
                  <button
                    onClick={handleUndoScore}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Undoing...
                  </button>
                ) : (
                  <button
                    onClick={handleUndoScore}
                    className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                  >
                    Undo Score
                  </button>
                )}
              </div>
            )}

            {/* Complete Match Button */}
            {canCompleteMatch(match) && !isLoading && !showConfirmation && (
              <div className="flex justify-between items-start mt-4">
                {isLoading ? (
                  <button
                    onClick={() => {
                      setConfirmationType('complete')
                      setShowConfirmation(true)
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Completing...
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setConfirmationType('complete')
                      setShowConfirmation(true)
                    }}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Complete Match
                  </button>
                )}
              </div>
            )}

            {/* Winner Display */}
            {match.winnerId && (
              <div className="flex justify-between items-start mt-4">
                <span className="font-medium text-gray-700">Winner:</span>
                <span className="text-sm font-semibold text-green-600">
                  {match.participant1?.id === match.winnerId ? match.participant1?.name : match.participant2?.name}
                </span>
              </div>
            )}

            {/* Scores Display (when not editing) */}
            {!canScoreMatch(match) && (
              <>
                <div className="flex justify-between items-start mt-4">
                  <span className="font-medium text-gray-700">P1 Score:</span>
                  <span className="text-sm font-mono">{match.participant1Score}</span>
                </div>
                <div className="flex justify-between items-start mt-4">
                  <span className="font-medium text-gray-700">P2 Score:</span>
                  <span className="text-sm font-mono">{match.participant2Score}</span>
                </div>
              </>
            )}
          </div>

          {/* Confirmation Panel */}
          {showConfirmation && confirmationType === 'complete' && (
            <div className="border rounded-lg p-4 mt-4">
              <h3 className="text-lg font-semibold mb-4">
                Confirm Match Completion
              </h3>
              <p className="mb-4">
                Are you sure you want to complete this match? This action cannot be undone.
              </p>
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowConfirmation(false)
                    setConfirmationType(null)
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCompleteMatch}
                  className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                >
                  Confirm
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={() => navigate(`/organizer/tournaments/${tournamentId}/categories/${categoryId}`)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Category Fixture
          </button>
        </div>
      </div>
    </div>
  )
}

export default MatchScoringPage
