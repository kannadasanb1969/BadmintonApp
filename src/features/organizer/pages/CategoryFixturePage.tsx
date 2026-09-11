import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'
import { useAuthStore } from '@/store/authStore'

import { Fixture, FixtureMatch } from '@/features/fixtures/types/fixture.types'
import { Team } from '@/features/teams/types/team.types'
import { Registration } from '@/features/registrations/types/registration.types'

import { fixtureService } from '@/features/fixtures/services/fixtureService'
import { matchService } from '@/features/matches/services/matchService'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'
import { isExplicitMockApiMode } from '@/api/apiClient'
import { registrationService } from '@/features/registrations/services/registrationService'
import { teamService } from '@/features/teams/services/teamService'
import { useOptimisticMatchScore } from '@/features/matches/hooks/useOptimisticMatchScore'

const CategoryFixturePage = () => {
  const { tournamentId, categoryId } = useParams<{ tournamentId: string; categoryId: string }>()
  const navigate = useNavigate()
  const authStore = useAuthStore()
  const currentUser = authStore.user

  const {
    tournament,
    loading: tournamentLoading,
    error: tournamentError,
  } = useTournamentStore()

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [fixture, setFixture] = useState<Fixture | null>(null)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)
  const [isPublishing, setIsPublishing] = useState<boolean>(false)
  const [isReshuffling, setIsReshuffling] = useState<boolean>(false)
  const [isClosingRegistration, setIsClosingRegistration] = useState<boolean>(false)
  const [showCloseConfirmation, setShowCloseConfirmation] = useState<boolean>(false)
  // Scoring state
  const [isStartingMatch, setIsStartingMatch] = useState<string | false>(false) // matchId or false
  const [isUndoingScore, setIsUndoingScore] = useState<string | false>(false) // matchId or false
  const [isCompletingMatch, setIsCompletingMatch] = useState<string | false>(false) // matchId or false
  const [entryCount, setEntryCount] = useState(0)
  const { enqueue: enqueueScore } = useOptimisticMatchScore()
  const [winningPointSelections, setWinningPointSelections] = useState<Record<string, 15 | 21 | 30>>({})

  const refreshCategoryData = async (refreshTournament = true) => {
    if (!tournamentId || !categoryId) return
    const tournamentStore = useTournamentStore.getState()
    if (refreshTournament) await tournamentStore.fetchTournamentById(tournamentId)

    const updatedTournament = useTournamentStore.getState().tournament
    const updatedCategory = updatedTournament?.categories.find(item => item.id === categoryId)
    if (!updatedCategory) return

    const entries = updatedCategory.eventType === 'SINGLES'
      ? (await registrationService.getTournamentRegistrations(tournamentId)).filter(item => item.categoryId === categoryId && item.status === 'REGISTERED')
      : (await teamService.getCategoryTeams(tournamentId, categoryId)).filter(item => item.status === 'CONFIRMED')
    setEntryCount(entries.length)

    const existingFixture = (await fixtureService.getFixtures()).find(item => item.tournamentId === tournamentId && item.categoryId === categoryId)
    setFixture(existingFixture ?? null)
  }

  useEffect(() => {
    void refreshCategoryData().catch((err: unknown) => setError(err instanceof Error ? err.message : 'Failed to load category details'))
  }, [tournamentId, categoryId])

  // Keep the category phase in one canonical place: the current tournament
  // record. A local category copy can otherwise survive a successful close.
  const category = tournament?.categories.find((item) => item.id === categoryId) ?? null

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

  // UI visibility follows the authenticated role and tournament ownership. Backend authorization remains authoritative.
  const canManageFixture = currentUser?.role === 'ADMIN' || (currentUser?.role === 'ORGANIZER' && currentUser.id === tournament.organizerId)
  const finalMatch = fixture?.matches
    .filter(match => match.roundNumber === Math.max(...(fixture?.matches.map(item => item.roundNumber) ?? [0])))
    .find(match => match.status === 'COMPLETED' && match.winnerId)
  const champion = finalMatch ? (finalMatch.participant1?.id === finalMatch.winnerId ? finalMatch.participant1 : finalMatch.participant2) : undefined
  const runnerUp = finalMatch ? (finalMatch.participant1?.id === finalMatch.winnerId ? finalMatch.participant2 : finalMatch.participant1) : undefined
  const registrationPhase = category.registrationPhase ?? 'OPEN'
  const hasRegistrations = entryCount > 0
  const hasEnoughEntries = entryCount >= 2
  const canCloseRegistration = canManageFixture && registrationPhase === 'OPEN' && hasRegistrations && !fixture
  const canGenerateFixture = registrationPhase === 'CLOSED' && hasEnoughEntries
  const generationMessage = !hasRegistrations
    ? 'No registrations available yet.'
    : registrationPhase === 'OPEN'
      ? 'Close registration before generating fixtures.'
      : !hasEnoughEntries
      ? category.eventType === 'SINGLES'
        ? 'At least 2 participants are required to generate fixtures.'
        : 'At least 2 teams are required to generate fixtures.'
      : null
  const fixtureGenerationControl = canManageFixture && !fixture && (
    <div className="mb-4">
      <button onClick={handleGenerateFixture} className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50" disabled={isGenerating || !canGenerateFixture}>
        {isGenerating ? 'Generating...' : 'Generate Fixture'}
      </button>
      {generationMessage && <p className="mt-2 text-sm text-amber-700">{generationMessage}</p>}
    </div>
  )

  const handleCloseRegistration = async () => {
    if (!tournamentId || !categoryId || !currentUser || !canCloseRegistration) return
    setIsClosingRegistration(true)
    setError(null)
    setSuccess(null)
    try {
      await useTournamentStore.getState().closeCategoryRegistration(currentUser.id, tournamentId, categoryId)
      await refreshCategoryData(false)
      setSuccess('Registration closed successfully. You can now generate the fixture when the minimum entries are available.')
    } catch (err) {
      await refreshCategoryData().catch(() => undefined)
      const refreshedCategory = useTournamentStore.getState().tournament?.categories.find(item => item.id === categoryId)
      if (refreshedCategory?.registrationPhase === 'CLOSED') {
        setSuccess('Registration is already closed.')
      } else {
        setError(err instanceof Error ? err.message : 'Unable to close registration')
      }
    } finally {
      setIsClosingRegistration(false)
      setShowCloseConfirmation(false)
    }
  }

  const registrationCloseControl = canManageFixture && registrationPhase === 'OPEN' && !fixture && (
    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
      {!showCloseConfirmation ? (
        <><button type="button" onClick={() => setShowCloseConfirmation(true)} disabled={isClosingRegistration || !canCloseRegistration} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50">{isClosingRegistration ? 'Closing...' : 'Close Registration'}</button>{!hasRegistrations && <p className="mt-2 text-sm text-amber-800">No registrations available yet.</p>}</>
      ) : (
        <div className="space-y-3"><p className="text-sm text-slate-700">Close registration with {entryCount} {category.eventType === 'SINGLES' ? 'registered players' : 'registered teams'}? New registrations will no longer be accepted.</p><div className="flex flex-wrap gap-3"><button type="button" onClick={() => setShowCloseConfirmation(false)} disabled={isClosingRegistration} className="rounded-lg bg-slate-500 px-4 py-2 text-sm font-bold text-white hover:bg-slate-600 disabled:opacity-50">Cancel</button><button type="button" onClick={handleCloseRegistration} disabled={isClosingRegistration} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50">{isClosingRegistration ? 'Closing...' : 'Confirm Close'}</button></div></div>
      )}
    </div>
  )

  async function handleGenerateFixture() {
    if (!tournament || !currentUser || !canManageFixture) return
    setIsGenerating(true)
    setError(null)
    try {
      const newFixture = await fixtureService.generateFixture(
        currentUser.id,
        tournamentId,
        categoryId,
        tournament.format
      )
      const savedFixture = useFixtureStore.getState().saveGeneratedFixture(newFixture)
      setFixture(savedFixture)
      setSuccess('Fixture generated successfully. Review the draw, then publish it for players.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleReshuffleFixture = async () => {
    if (!fixture || !currentUser || !canManageFixture) return
    setIsReshuffling(true)
    setError(null)
    try {
      const updatedFixture = await fixtureService.reshuffleFixture(
        currentUser.id,
        fixture.id
      )
      setFixture(updatedFixture)
      setError('Fixture reshuffled successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsReshuffling(false)
    }
  }

  const handlePublishFixture = async () => {
    if (!fixture || !currentUser || !canManageFixture) return
    setIsPublishing(true)
    setError(null)
    try {
      const updatedFixture = await fixtureService.publishFixture(
        currentUser.id,
        fixture.id
      )
      setFixture(updatedFixture)
      setSuccess('Fixture published successfully. Players can now view the draw.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsPublishing(false)
    }
  }

  const selectedWinningPoints = (match: FixtureMatch): 15 | 21 | 30 | undefined => {
    const value = winningPointSelections[match.id] ?? match.winningPoints
    return value === 15 || value === 21 || value === 30 ? value : undefined
  }

  const handleStartMatch = async (matchId: string) => {
    if (!tournament || !currentUser || !canManageFixture) return
    const currentMatch = fixture?.matches.find((item) => item.id === matchId)
    const winningPoints = currentMatch ? selectedWinningPoints(currentMatch) : undefined
    if (!winningPoints) return
    setIsStartingMatch(matchId)
    setError(null)
    try {
      const updatedMatch = await matchService.startMatch(
        currentUser.id,
        tournamentId,
        categoryId,
        matchId,
        winningPoints,
      )
      if (updatedMatch) setFixture((current) => current ? {
        ...current,
        matches: current.matches.map((item) => item.id === updatedMatch.id ? updatedMatch : item),
      } : current)
      setError('Match started successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsStartingMatch(false)
    }
  }

  const handleSetWinningPoints = (matchId: string, points: 15 | 21 | 30) => {
    setWinningPointSelections((current) => ({ ...current, [matchId]: points }))
  }

  const handleUpdateScore = async (
    matchId: string,
    side: 'PARTICIPANT_1' | 'PARTICIPANT_2',
    delta: 1 | -1
  ) => {
    if (!tournament || !currentUser || !canManageFixture || !fixture) return
    const currentMatch = fixture.matches.find((item) => item.id === matchId)
    if (!currentMatch) return
    setError(null)
    enqueueScore(
      currentMatch,
      side,
      delta,
      () => matchService.updateScore(currentUser.id, tournamentId, categoryId, matchId, side, delta),
      (updatedMatch) => setFixture((current) => current ? {
        ...current,
        matches: current.matches.map((item) => item.id === updatedMatch.id ? updatedMatch : item),
      } : current),
      () => setError('Score update failed. Please try again.'),
    )
  }

  const handleUndoScore = async (matchId: string) => {
    if (!tournament || !currentUser || !canManageFixture) return
    setIsUndoingScore(matchId)
    setError(null)
    try {
      const updatedMatch = await matchService.undoScore(
        currentUser.id,
        tournamentId,
        categoryId,
        matchId
      )
      // Update fixture with the updated match
      const fixtureStore = useFixtureStore.getState()
      const currentFixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId)
      if (currentFixture) {
        setFixture(currentFixture)
      }
      setError('Score undone successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsUndoingScore(false)
    }
  }

  const handleCompleteMatch = async (matchId: string) => {
    if (!tournament || !currentUser || !canManageFixture) return
    setIsCompletingMatch(matchId)
    setError(null)
    try {
      const updatedMatch = await matchService.completeMatch(
        currentUser.id,
        tournamentId,
        categoryId,
        matchId
      )
      if (updatedMatch) setFixture((current) => current ? {
        ...current,
        matches: current.matches.map((item) => item.id === updatedMatch.id ? updatedMatch : item),
      } : current)
      setError('Match completed successfully')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsCompletingMatch(false)
    }
  }

  // Helper function to check if match can be started
  const canStartMatch = (match: FixtureMatch): boolean => {
    return (
      fixture?.status === 'PUBLISHED' &&
      match.status === 'SCHEDULED' &&
      match.participant1 !== null &&
      match.participant2 !== null &&
      canManageFixture
    )
  }

  // Helper function to check if match can be scored
  const canScoreMatch = (match: FixtureMatch): boolean => {
    return (
      fixture?.status === 'PUBLISHED' &&
      match.status === 'LIVE' &&
      canManageFixture
    )
  }

  // Helper function to check if score can be undone
  const canUndoScore = (match: FixtureMatch): boolean => {
    return (
      isExplicitMockApiMode && fixture?.status === 'PUBLISHED' &&
      match.status === 'LIVE' &&
      match.scoreHistory &&
      match.scoreHistory.length > 0 &&
      canManageFixture
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
      canManageFixture
    )
  }

  const participantLabel = (participant: FixtureMatch['participant1']) => {
    if (!participant) return <span className="italic text-gray-500">BYE</span>
    const code = participant.code && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(participant.code) ? participant.code : ''
    return <span className="min-w-0 text-right"><span className="block break-words">{participant.name}</span>{code && <span className="block text-xs text-slate-500">{code}</span>}</span>
  }

  // Helper function to generate round sections for fixture display with scoring controls
  const getRoundSectionsWithScoring = (fixture: Fixture | null) => {
    if (!fixture) return null
    // Get unique round numbers
    const roundNumbers = Array.from(new Set(fixture.matches.map(m => m.roundNumber))).sort((a, b) => a - b)
    // Map over round numbers to create round sections
    return roundNumbers.map(roundNum => {
      const roundMatches = fixture.matches.filter(m => m.roundNumber === roundNum)
      const roundName = roundMatches.length > 0 ? roundMatches[0].roundName : `Round ${roundNum + 1}`
      return (
        <div key={roundNum} className="fixture-round">
          <h3 className="text-xl font-bold mb-3">🏆 {roundName}</h3>
          <div className="space-y-4">
            {roundMatches.map(match => (
              <div key={match.id} className="fixture-match-card border rounded-2xl p-4">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-gray-700">Match Code:</span>
                  <span className="text-sm">{match.matchCode}</span>
                </div>

                {/* Match Status Badge */}
                <div className="flex items-start mt-2">
                  <span className="font-medium text-gray-700">Status:</span>
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
                </div>

                <div className="flex justify-between items-start mt-2">
                  <span className="font-medium text-gray-700">Participant 1:</span>
                  <span className="text-sm">
{participantLabel(match.participant1)}
                  </span>
                </div>

                {/* Participant 1 Score Controls */}
                {canStartMatch(match) && !match.participant1Score && !match.participant2Score ? (
                  // A score target is selected per match and only persisted when it starts.
                  <div className="match-start-panel mt-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Winning points</p><div className="mt-2 grid grid-cols-3 gap-2">{([15, 21, 30] as const).map(points => <button key={points} type="button" onClick={() => handleSetWinningPoints(match.id, points)} className={`rounded-lg px-2 py-2 text-xs font-black ${selectedWinningPoints(match) === points ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'}`}>{selectedWinningPoints(match) === points ? '✓ ' : ''}{points}</button>)}</div>{!selectedWinningPoints(match) && <p className="mt-2 text-xs text-amber-700">Select winning points to start the match.</p>}
                    <div className="mt-3 flex justify-end">
                    {isStartingMatch === match.id ? (
                      <button
                        onClick={() => handleStartMatch(match.id)}
                        disabled={!selectedWinningPoints(match)}
                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Starting...
                      </button>
                    ) : (
                      <button
                        onClick={() => handleStartMatch(match.id)}
                        disabled={!selectedWinningPoints(match)}
                        className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Start Match
                      </button>
                    )}</div>
                  </div>
                ) : (
                  <div className="flex justify-between items-start mt-2">
                    <span className="font-medium text-gray-700">P1 Score:</span>
                    <div className="flex items-center space-x-2">
                      {canScoreMatch(match) ? (
                        <>
                          <button
                            onClick={() => handleUpdateScore(match.id, 'PARTICIPANT_1', -1)}
                            className="w-6 h-6 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                            disabled={match.participant1Score === 0}
                            title="Decrease score"
                            aria-label="Decrease participant 1 score"
                          >
                            -
                          </button>
                        </>
                      ) : canManageFixture ? (
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs">
                          -
                        </span>
                      ) : null}
                      <span className="text-sm font-mono">
                        {match.participant1Score}
                      </span>
                      {canScoreMatch(match) ? (
                        <>
                          <button
                            onClick={() => handleUpdateScore(match.id, 'PARTICIPANT_1', 1)}
                            className="w-6 h-6 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-40"
                            disabled={isExplicitMockApiMode && match.participant1Score >= (match.winningPoints ?? 21)}
                            title="Increase score"
                            aria-label="Increase participant 1 score"
                          >
                            +
                          </button>
                        </>
                      ) : canManageFixture ? (
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs">
                          +
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                {(match.status === 'LIVE' || match.status === 'COMPLETED') && match.winningPoints && (
                  <p className="mt-2 text-xs font-semibold text-blue-700">Playing to {match.winningPoints}</p>
                )}

                <div className="flex justify-between items-start mt-2">
                  <span className="font-medium text-gray-700">Participant 2:</span>
                  <span className="text-sm">
{participantLabel(match.participant2)}
                  </span>
                </div>

                {/* Participant 2 Score Controls */}
                {!canScoreMatch(match) ? (
                  // Scheduled and completed matches remain read-only.
                  <div className="flex justify-between items-start mt-2">
                    <span className="font-medium text-gray-700">P2 Score:</span>
                    <span className="text-sm">
                      {match.participant2Score}
                    </span>
                  </div>
                ) : (
                  <div className="flex justify-between items-start mt-2">
                    <span className="font-medium text-gray-700">P2 Score:</span>
                    <div className="flex items-center space-x-2">
                      {canScoreMatch(match) ? (
                        <>
                          <button
                            onClick={() => handleUpdateScore(match.id, 'PARTICIPANT_2', -1)}
                            className="w-6 h-6 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50"
                            disabled={match.participant2Score === 0}
                            title="Decrease score"
                            aria-label="Decrease participant 2 score"
                          >
                            -
                          </button>
                        </>
                      ) : canManageFixture ? (
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs">
                          -
                        </span>
                      ) : null}
                      <span className="text-sm font-mono">
                        {match.participant2Score}
                      </span>
                      {canScoreMatch(match) ? (
                        <>
                          <button
                            onClick={() => handleUpdateScore(match.id, 'PARTICIPANT_2', 1)}
                            className="w-6 h-6 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-40"
                            disabled={isExplicitMockApiMode && match.participant2Score >= (match.winningPoints ?? 21)}
                            title="Increase score"
                            aria-label="Increase participant 2 score"
                          >
                            +
                          </button>
                        </>
                      ) : canManageFixture ? (
                        <span className="w-6 h-6 flex items-center justify-center bg-gray-200 rounded text-xs">
                          +
                        </span>
                      ) : null}
                    </div>
                  </div>
                )}

                {/* Undo Score Button */}
                {canUndoScore(match) && !isUndoingScore && (
                  <div className="flex justify-between items-start mt-2">
                    {isUndoingScore === match.id ? (
                      <button
                        onClick={() => handleUndoScore(match.id)}
                        className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
                      >
                        Undoing...
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUndoScore(match.id)}
                        className="px-2 py-1 bg-yellow-500 text-white text-xs rounded hover:bg-yellow-600"
                      >
                        Undo Score
                      </button>
                    )}
                  </div>
                )}

                {/* Complete Match Button */}
                {canCompleteMatch(match) && !isCompletingMatch && (
                  <div className="flex justify-between items-start mt-2">
                    {isCompletingMatch === match.id ? (
                      <button
                        onClick={() => handleCompleteMatch(match.id)}
                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                      >
                        Completing...
                      </button>
                    ) : (
                      <button
                        onClick={() => handleCompleteMatch(match.id)}
                        className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                      >
                        Complete Match
                      </button>
                    )}
                  </div>
                )}

                {/* Winner Display */}
                {match.status === 'COMPLETED' && (
                  <div className="flex justify-between items-start mt-2">
                    <span className="font-medium text-gray-700">🏆 Winner:</span>
                    <span className="text-right text-sm font-semibold text-green-600"><span className="block">{match.winnerParticipantName || 'Winner confirmed'}</span>{match.winnerParticipantName && match.winnerParticipantCode && !/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(match.winnerParticipantCode) && <span className="block text-xs font-normal text-slate-500">{match.winnerParticipantCode}</span>}</span>
                  </div>
                )}

                {/* Scores Display (when not editing) */}
                {!canScoreMatch(match) && (
                  <>
                    <div className="flex justify-between items-start mt-2">
                      <span className="font-medium text-gray-700">P1 Score:</span>
                      <span className="text-sm font-mono">{match.participant1Score}</span>
                    </div>
                    <div className="flex justify-between items-start mt-2">
                      <span className="font-medium text-gray-700">P2 Score:</span>
                      <span className="text-sm font-mono">{match.participant2Score}</span>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    })
  }

  if (category.eventType === 'SINGLES') {
    return (
      <div className="fixture-arena p-5 sm:p-8">
        <div className="fixture-hero mb-6">
          <div><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-300">{tournament.name}</p><h1 className="text-3xl font-black">
            Singles Fixture
          </h1></div>
          <p className="text-sm text-gray-600">
            {formatDateDisplay(tournament.tournamentDate)} • {tournament.venueName}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
            {error}
          </div>
        )}
        {success && <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">{success}</div>}

        <div className="fixture-status mb-6">
          <h2 className="text-xl font-semibold mb-3">
            Category: {category.name}
          </h2>
          <p className="text-sm text-gray-600">
          </p>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Registration Phase:
            {registrationPhase === 'OPEN' ? (
              <span className="text-green-600">Open</span>
            ) : (
              <span className="text-red-600">Closed</span>
            )}
          </p>
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
        {registrationCloseControl}
        {champion && runnerUp && <div className="mb-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-200">🏆 Winner</p><p className="mt-1 text-lg font-black text-white">{champion.name}</p></div><div className="rounded-2xl border border-slate-300/30 bg-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-300">🥈 Runner-up</p><p className="mt-1 text-lg font-black text-white">{runnerUp.name}</p></div></div>}

        {fixtureGenerationControl}

        {canManageFixture && fixture && fixture.status === 'DRAFT' && (
          <div className="mb-4 space-x-3">
            <button
              onClick={handleReshuffleFixture}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
              disabled={isReshuffling}
            >
              {isReshuffling ? 'Reshuffling...' : 'Re-Shuffle'}
            </button>
            <button
              onClick={handlePublishFixture}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              disabled={isPublishing}
            >
              {isPublishing ? 'Publishing...' : 'Publish Fixture'}
            </button>
          </div>
        )}

        {fixture && (
          <div className="mt-6 overflow-x-auto">
            <div className="fixture-rounds">
              {getRoundSectionsWithScoring(fixture)}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => navigate(`/organizer/tournaments/${tournamentId}/registrations`)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Tournament Registrations
          </button>
        </div>
      </div>
    )
  } else if (category.eventType === 'DOUBLES') {
    return (
      <div className="fixture-arena p-5 sm:p-8">
        <div className="fixture-hero mb-6">
          <div><p className="text-sm font-bold uppercase tracking-[.2em] text-blue-300">{tournament.name}</p><h1 className="text-3xl font-black">
            Doubles Fixture
          </h1></div>
          <p className="text-sm text-gray-600">
            {formatDateDisplay(tournament.tournamentDate)} • {tournament.venueName}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
            {error}
          </div>
        )}
        {success && <div className="mb-4 rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800">{success}</div>}

        <div className="fixture-status mb-6">
          <h2 className="text-xl font-semibold mb-3">
            Category: {category.name}
          </h2>
          <p className="text-sm text-gray-600">
          </p>
        </div>

        <div className="mb-4">
          <p className="text-sm text-gray-600">
            Registration Phase:
            {registrationPhase === 'OPEN' ? (
              <span className="text-green-600">Open</span>
            ) : (
              <span className="text-red-600">Closed</span>
            )}
          </p>
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
        {registrationCloseControl}
        {champion && runnerUp && <div className="mb-6 grid gap-3 sm:grid-cols-2"><div className="rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-amber-200">🏆 Winner</p><p className="mt-1 text-lg font-black text-white">{champion.name}</p></div><div className="rounded-2xl border border-slate-300/30 bg-white/10 p-4"><p className="text-xs font-bold uppercase tracking-[.16em] text-slate-300">🥈 Runner-up</p><p className="mt-1 text-lg font-black text-white">{runnerUp.name}</p></div></div>}

        {fixtureGenerationControl}

        {canManageFixture && fixture && fixture.status === 'DRAFT' && (
          <div className="mb-4 space-x-3">
            <button
              onClick={handleReshuffleFixture}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
              disabled={isReshuffling}
            >
              {isReshuffling ? 'Reshuffling...' : 'Re-Shuffle'}
            </button>
            <button
              onClick={handlePublishFixture}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
              disabled={isPublishing}
            >
              {isPublishing ? 'Publishing...' : 'Publish Fixture'}
            </button>
          </div>
        )}

        {fixture && (
          <div className="mt-6 overflow-x-auto">
            <div className="fixture-rounds">
              {getRoundSectionsWithScoring(fixture)}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => navigate(`/organizer/tournaments/${tournamentId}/registrations`)}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Back to Tournament Registrations
          </button>
        </div>
      </div>
    )
  }
}

export default CategoryFixturePage
