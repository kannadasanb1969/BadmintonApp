import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'
import { useAuthStore } from '@/store/authStore'

import { TournamentCategory } from '@/features/tournaments/types/tournament.types'
import { Fixture, FixtureMatch } from '@/features/fixtures/types/fixture.types'

import { fixtureService } from '@/features/fixtures/services/fixtureService'
import { matchService } from '@/features/matches/services/matchService'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'
import { isExplicitMockApiMode } from '@/api/apiClient'
import { useOptimisticMatchScore } from '@/features/matches/hooks/useOptimisticMatchScore'
import { canIncrementMatchScore, canShowMatchMutation, getCompletionBlockedReason, getMatchCompletionStatus, validWinningPoints } from '@/features/matches/utils/matchLifecycle'
import { useMatchLiveUpdates } from '@/features/matches/hooks/useMatchLiveUpdates'

const MatchScoringPage = () => {
  const { tournamentId, categoryId, matchId } = useParams<{ tournamentId: string; categoryId: string; matchId: string }>()
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
  const { enqueue: enqueueScore, reconcile: reconcileScore } = useOptimisticMatchScore()
  const [selectedWinningPoints, setSelectedWinningPoints] = useState<15 | 21 | 30 | undefined>()

  useMatchLiveUpdates(matchId ? [matchId] : [], {
    refetch: () => matchId ? matchService.getMatch(matchId).then(updated => { if (updated) setMatch(updated) }) : undefined,
    onEvent: event => setMatch(current => current && current.id === event.matchId ? reconcileScore({
      ...current,
      status: event.status,
      participant1Score: event.participant1Score,
      participant2Score: event.participant2Score,
      ...(event.winningPoints ? { winningPoints: event.winningPoints } : {}),
      ...(event.winnerParticipantId !== undefined ? { winnerId: event.winnerParticipantId, winnerParticipantId: event.winnerParticipantId, winnerParticipantName: event.winnerParticipantName, winnerParticipantCode: event.winnerParticipantCode } : {}),
    }) : current),
  })

  useEffect(() => {
    setSelectedWinningPoints(undefined)
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
    return canShowMatchMutation(fixture?.status, match, 'SCHEDULED', isOrganizer)
  }

  // Helper function to check if match can be scored
  const canScoreMatch = (match: FixtureMatch): boolean => {
    return canShowMatchMutation(fixture?.status, match, 'LIVE', isOrganizer)
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
    return canShowMatchMutation(fixture?.status, match, 'LIVE', isOrganizer)
  }
  const existingWinningPoints = validWinningPoints(match.winningPoints)
  const winningPointsForStart = selectedWinningPoints ?? existingWinningPoints
  const completionBlockedReason = getCompletionBlockedReason(match)
  const handleWinningPointsChange = (points: 15 | 21 | 30) => {
    setSelectedWinningPoints(points)
  }

  const handleStartMatch = async () => {
    if (!tournament || !canStartMatch(match) || !winningPointsForStart) return
    setIsLoading(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const updatedMatch = await matchService.startMatch(
        currentUser?.id ?? '',
        tournamentId,
        categoryId,
        matchId,
        winningPointsForStart,
      )
      if (updatedMatch) {
        setMatch(updatedMatch)
        setFixture((current) => current ? {
          ...current,
          matches: current.matches.map((item) => item.id === updatedMatch.id ? updatedMatch : item),
        } : current)
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
    if (!tournament || !match) return
    setErrorMessage(null)
    setSuccessMessage(null)
    enqueueScore(
      match,
      side,
      delta,
      () => matchService.updateScore(currentUser?.id ?? '', tournamentId, categoryId, matchId, side, delta),
      (updatedMatch) => {
        setMatch(updatedMatch)
        setFixture((current) => current ? {
          ...current,
          matches: current.matches.map((item) => item.id === updatedMatch.id ? updatedMatch : item),
        } : current)
      },
      () => setErrorMessage('Score update failed. Please try again.'),
    )
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
    if (!canCompleteMatch(match) || completionBlockedReason || isLoading) return
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
      if (updatedMatch) {
        setMatch(updatedMatch)
        setFixture((current) => current ? {
          ...current,
          matches: current.matches.map((item) => item.id === updatedMatch.id ? updatedMatch : item),
        } : current)
      }
      setSuccessMessage('Match completed successfully')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
      setShowConfirmation(false)
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

  const scoreable = canScoreMatch(match)
  const sides = [
    { side: 'PARTICIPANT_1', participant: match.participant1, score: match.participant1Score },
    { side: 'PARTICIPANT_2', participant: match.participant2, score: match.participant2Score },
  ] as const

  return (
    <section className="organizer-score-page">
      <Link className="organizer-score-back" to={`/organizer/tournaments/${tournamentId}/categories/${categoryId}`}>
        ← Back to Category Fixture
      </Link>
      <header className="organizer-score-hero">
        <span className="organizer-score-status" data-status={match.status}>{match.status}</span>
        <h1>{tournament.name}</h1>
        <p>{category.name} · {match.matchCode}</p>
        <p>{formatDateDisplay(tournament.tournamentDate)} · {tournament.venueName}</p>
      </header>

      {errorMessage && <p className="organizer-score-message" role="alert">{errorMessage}</p>}
      {successMessage && <p className="organizer-score-message" role="status">{successMessage}</p>}

      <section className="organizer-score-board" aria-labelledby="score-heading">
        <div className="organizer-score-heading">
          <h2 id="score-heading">Match Score</h2>
          {existingWinningPoints && <p>Playing to {existingWinningPoints} · Win by 2</p>}
        </div>
        <div className="organizer-score-sides">
          {sides.map(({ side, participant, score }, index) => (
            <article className="organizer-score-side" key={side}>
              <div>
                <p>Participant {index + 1}</p>
                <h3>{participant?.name || 'BYE'}</h3>
                {participant?.code && <small>{participant.code}</small>}
              </div>
              <strong className="organizer-score-value" aria-label={`Participant ${index + 1} score: ${score}`}>
                {String(score).padStart(2, '0')}
              </strong>
              {scoreable && <div className="organizer-score-controls">
                <button type="button" className="organizer-score-secondary" disabled={score <= 0 || isLoading}
                  onClick={() => void handleUpdateScore(side, -1)} aria-label={`Decrease participant ${index + 1} score`}>−</button>
                <button type="button" className="organizer-score-primary" disabled={!canIncrementMatchScore(match) || isLoading}
                  onClick={() => void handleUpdateScore(side, 1)} aria-label={`Increase participant ${index + 1} score`}>+</button>
              </div>}
            </article>
          ))}
        </div>

        {match.status === 'COMPLETED' && <p className="organizer-score-winner">🏆 {match.winnerParticipantName || 'Winner confirmed'}</p>}
        {match.status === 'SCHEDULED' && fixture?.status !== 'PUBLISHED' && <p>Publish the fixture to start the match.</p>}
        {canStartMatch(match) && <section className="organizer-score-actions" aria-label="Winning points">
          <h3>Winning Points</h3>
          <div className="organizer-score-targets">
            {([15, 21, 30] as const).map(points => <button key={points} type="button"
              aria-pressed={winningPointsForStart === points} className="organizer-score-secondary"
              disabled={isLoading} onClick={() => handleWinningPointsChange(points)}>{points} Points</button>)}
          </div>
          <button type="button" className="organizer-score-primary" disabled={!winningPointsForStart || isLoading}
            onClick={() => void handleStartMatch()}>{isLoading ? 'Starting…' : 'Start Match'}</button>
        </section>}
        {canUndoScore(match) && <button type="button" className="organizer-score-secondary" disabled={isLoading}
          onClick={() => void handleUndoScore()}>Undo Score</button>}
        {canCompleteMatch(match) && !showConfirmation && <section className="organizer-score-actions">
          <p>{getMatchCompletionStatus(match)}</p>
          <button type="button" className="organizer-score-primary" disabled={isLoading || Boolean(completionBlockedReason)}
            onClick={() => setShowConfirmation(true)}>Complete Match</button>
        </section>}
        {canCompleteMatch(match) && showConfirmation && <section className="organizer-score-actions" aria-label="Confirm match completion">
          <h3>Confirm Match Completion</h3>
          <p>This records the result and closes scoring for this match.</p>
          <div className="organizer-score-controls">
            <button type="button" className="organizer-score-secondary" disabled={isLoading}
              onClick={() => setShowConfirmation(false)}>Cancel</button>
            <button type="button" className="organizer-score-primary" disabled={isLoading || Boolean(completionBlockedReason)}
              onClick={() => void handleCompleteMatch()}>{isLoading ? 'Completing…' : 'Confirm'}</button>
          </div>
        </section>}
      </section>
    </section>
  )
}

export default MatchScoringPage
