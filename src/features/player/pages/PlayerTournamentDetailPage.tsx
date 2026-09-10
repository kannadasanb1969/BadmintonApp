import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'
import { registrationService } from '@/features/registrations/services/registrationService'

import { evaluatePlayerEligibility } from '@/features/eligibility/utils/eligibilityUtils'
import { EligibilityResult } from '@/features/eligibility/types/eligibility.types'
import { eligibilityService } from '@/features/eligibility/services/eligibilityService'
import { Fixture, FixtureMatch } from '@/features/fixtures/types/fixture.types'
import { MedalHistory } from '@/features/medals/types/medalHistory.types'
import { medalHistoryService } from '@/features/medals/services/medalHistoryService'

import {
  formatDateDisplay,
  formatTimeDisplay,
} from '@/features/tournaments/utils/tournamentHelpers'

const PlayerTournamentDetailPage = () => {
  const { tournamentId } = useParams<{ tournamentId: string }>()
  const navigate = useNavigate()

  const {
    tournament,
    loading,
    error,
    fetchTournamentById,
  } = useTournamentStore()

  const { profile, hasProfile } = usePlayerProfileStore()


  const [medalHistory, setMedalHistory] = useState<MedalHistory[]>([])
  const [medalHistoryLoading, setMedalHistoryLoading] =
    useState<boolean>(false)
  const [medalHistoryError, setMedalHistoryError] =
    useState<string | null>(null)

  const {
    registrations,
    getPlayerRegistrations,
    getTournamentRegistrations,
  } = useRegistrationStore()

  const [eligibilityResults, setEligibilityResults] = useState<
    Map<string, EligibilityResult>
  >(new Map())

  const [checkingEligibility, setCheckingEligibility] =
    useState<boolean>(false)
  const [loadingRegistrations, setLoadingRegistrations] =
    useState<boolean>(false)

  const [registrationStatus, setRegistrationStatus] = useState<
    Record<string, { success: boolean; message: string }>
  >({})

  const [fixtures, setFixtures] = useState<Map<string, Fixture>>(new Map())
  const [fixtureLoading, setFixtureLoading] = useState<boolean>(false)
  const [fixtureError, setFixtureError] = useState<string | null>(null)

  useEffect(() => {
    if (tournamentId) {
      void fetchTournamentById(tournamentId)
    }
  }, [tournamentId, fetchTournamentById])

  useEffect(() => {
    if (!hasProfile || !profile) {
      setLoadingRegistrations(false)
      return
    }

    let isCancelled = false
    setLoadingRegistrations(true)

    void registrationService.getPlayerRegistrations(profile.id)
      .catch(() => {
        // Eligibility remains the authoritative fallback if this refresh fails.
      })
      .finally(() => {
        if (!isCancelled) setLoadingRegistrations(false)
      })

    return () => {
      isCancelled = true
    }
  }, [hasProfile, profile])

  useEffect(() => {
    if (!hasProfile || !profile) {
      setMedalHistory([])
      return
    }

    const loadMedalHistory = async () => {
      setMedalHistoryLoading(true)
      setMedalHistoryError(null)

      try {
        const playerMedals = await medalHistoryService.getPlayerMedals(profile.id)

        setMedalHistory(playerMedals)
      } catch (err: unknown) {
        setMedalHistoryError(
          err instanceof Error
            ? err.message
            : 'Failed to load medal history'
        )
      } finally {
        setMedalHistoryLoading(false)
      }
    }

    void loadMedalHistory()
  }, [hasProfile, profile])

  const playerRegistrations = useMemo(() => {
    if (!hasProfile || !profile || !tournamentId) {
      return []
    }

    return getPlayerRegistrations(profile.id).filter(
      (registration) =>
        registration.tournamentId === tournamentId &&
        registration.status === 'REGISTERED'
    )
  }, [
    hasProfile,
    profile,
    tournamentId,
    registrations,
    getPlayerRegistrations,
  ])

  useEffect(() => {
    if (
      !tournament ||
      !profile ||
      !hasProfile ||
      !tournamentId ||
      tournament.status !== 'PUBLISHED'
    ) {
      setEligibilityResults(new Map())
      return
    }

    let isCancelled = false

    const checkEligibility = async () => {
      setCheckingEligibility(true)

      try {
        const eligibilityMap = new Map<string, EligibilityResult>()

        const tournamentRegistrations =
          getTournamentRegistrations(tournament.id)

        for (const category of tournament.categories ?? []) {
          const currentRegistrations = tournamentRegistrations.filter(
            (registration) =>
              registration.categoryId === category.id &&
              registration.status === 'REGISTERED'
          ).length

          const eligibilityResult = await eligibilityService.check({
            tournamentId: tournament.id,
            categoryId: category.id,
            playerId: profile.id,
          })

          eligibilityMap.set(category.id, eligibilityResult)
        }

        if (!isCancelled) {
          setEligibilityResults(eligibilityMap)
        }
      } finally {
        if (!isCancelled) {
          setCheckingEligibility(false)
        }
      }
    }

    void checkEligibility()

    return () => {
      isCancelled = true
    }
  }, [
    tournament,
    profile,
    hasProfile,
    tournamentId,
    registrations,
    getTournamentRegistrations,
    medalHistory,
  ])

  useEffect(() => {
    if (
      !tournamentId ||
      !tournament ||
      tournament.status !== 'PUBLISHED'
    ) {
      return
    }

    let isCancelled = false

    const loadFixtures = async () => {
      setFixtureLoading(true)
      setFixtureError(null)

      try {
        const fixtureStore = useFixtureStore.getState()
        const fixtureMap = new Map<string, Fixture>()

        for (const category of tournament.categories ?? []) {
          const fixture =
            fixtureStore.getFixtureByTournamentCategory(
              tournamentId,
              category.id
            )

          if (fixture) {
            fixtureMap.set(category.id, fixture)
          }
        }

        if (!isCancelled) {
          setFixtures(fixtureMap)
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setFixtureError(
            err instanceof Error
              ? err.message
              : 'Failed to load fixtures'
          )
        }
      } finally {
        if (!isCancelled) {
          setFixtureLoading(false)
        }
      }
    }

    void loadFixtures()

    return () => {
      isCancelled = true
    }
  }, [tournamentId, tournament])

  const canScoreMatchPlayer = (match: FixtureMatch): boolean => {
    return match.status === 'LIVE' || match.status === 'COMPLETED'
  }

  const handleRegister = async (categoryId: string) => {
    if (!hasProfile || !profile) {
      setRegistrationStatus((previous) => ({
        ...previous,
        [categoryId]: {
          success: false,
          message: 'Please complete your profile first',
        },
      }))

      return
    }

    if (!tournament || !tournamentId) {
      setRegistrationStatus((previous) => ({
        ...previous,
        [categoryId]: {
          success: false,
          message: 'Tournament not found',
        },
      }))

      return
    }

    const category = tournament.categories?.find(
      (item) => item.id === categoryId
    )

    if (!category) {
      setRegistrationStatus((previous) => ({
        ...previous,
        [categoryId]: {
          success: false,
          message: 'Category not found',
        },
      }))

      return
    }

    if (category.registrationPhase === 'CLOSED') {
      setRegistrationStatus((previous) => ({ ...previous, [categoryId]: { success: false, message: 'Registration Closed' } }))
      return
    }

    const alreadyRegistered = playerRegistrations.some(
      (registration) =>
        registration.categoryId === categoryId &&
        registration.status === 'REGISTERED'
    )

    if (alreadyRegistered) {
      setRegistrationStatus((previous) => ({
        ...previous,
        [categoryId]: {
          success: true,
          message: 'You are already participating in this category',
        },
      }))

      return
    }

    try {
      const registration =
        await registrationService.registerPlayer(
          tournamentId,
          categoryId,
          profile
        )

      setRegistrationStatus((previous) => ({
        ...previous,
        [categoryId]: {
          success: true,
          message: `Registration successful! Your registration code is: ${registration.registrationCode}`,
        },
      }))

      navigate('/player/registrations')
    } catch (errorValue: unknown) {
      const message =
        errorValue instanceof Error
          ? errorValue.message
          : 'Registration failed'

      setRegistrationStatus((previous) => ({
        ...previous,
        [categoryId]: {
          success: false,
          message,
        },
      }))
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        Loading tournament details...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error loading tournament: {error}
      </div>
    )
  }

  if (!tournament) {
    return (
      <div className="text-center py-8">
        Tournament not found
      </div>
    )
  }

  if (tournament.status !== 'PUBLISHED') {
    return (
      <div className="p-4">
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-center">
          <p className="text-yellow-700">
            Tournament not available
          </p>
        </div>
      </div>
    )
  }

  if (!hasProfile || !profile) {
    return (
      <div className="player-tournament-page px-4 py-6 sm:px-6">
        <div className="player-tournament-empty mx-auto max-w-2xl">
        <h1 className="text-2xl font-bold mb-4">
          {tournament.name}
        </h1>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
          <p className="text-yellow-700">
            Please complete your player profile to view eligibility
            and register for tournaments.
          </p>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => navigate('/player/profile')}
            className="px-6 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Complete Profile
          </button>
        </div>
        </div>
      </div>
    )
  }

  const rules = Array.isArray(tournament.generalRules)
    ? tournament.generalRules
    : String(tournament.generalRules ?? '')
        .split('\n')
        .map((rule) => rule.trim())
        .filter(Boolean)

  return (
    <div className="player-tournament-page px-4 py-5 sm:px-6 sm:py-8">
      <main className="mx-auto max-w-6xl">
      <section className="player-tournament-hero mb-5">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="player-tournament-kicker">🏸 Tournament centre</p>
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            {tournament.name}
          </h1>

          <p className="mt-2 text-sm text-blue-100 sm:text-base">
            📍 {tournament.venueName} <span className="mx-1 opacity-60">•</span>{' '}
            {formatDateDisplay(tournament.tournamentDate)}
          </p>
        </div>

        {playerRegistrations.length > 0 && (
          <button
            type="button"
            onClick={() => navigate('/player/registrations')}
            className="player-tournament-action"
          >
            ✓ My Registrations
          </button>
        )}
        </div>
      </section>

      <section className="player-tournament-info mb-6">
        <div className="player-section-heading"><span>🎯</span><div><p>Match briefing</p><h2>Tournament information</h2></div></div>
        <div className="player-info-grid">

        <p><strong>Entry code</strong><span>{tournament.tournamentCode}</span></p>

        <p><strong>Match date</strong><span>{formatDateDisplay(tournament.tournamentDate)}</span></p>

        <p><strong>Report by</strong><span>{formatTimeDisplay(tournament.reportingTime)}</span></p>

        <p><strong>Registration closes</strong><span>
          {formatDateDisplay(
            tournament.registrationCloseDate
          )}{' '}
          at{' '}
          {formatTimeDisplay(
            tournament.registrationCloseTime
          )}</span></p>

        <p><strong>Venue</strong><span>{tournament.venueName}</span></p>

        <p><strong>Address</strong><span>{tournament.venueAddress}</span></p>

        <p><strong>Draw format</strong><span>{tournament.format}</span></p>

        <p><strong>Entry status</strong><span className="player-published">● {tournament.status}</span></p>

        {tournament.mapLink && (
          <p><strong>Venue map</strong>
            <a
              href={tournament.mapLink}
              target="_blank"
              rel="noreferrer"
              className="player-map-link"
            >
              View Location
            </a>
          </p>
        )}

        {tournament.description && (
          <p className="player-info-wide"><strong>About this tournament</strong><span>{tournament.description}</span></p>
        )}

        {tournament.prizes && (
          <p><strong>Prize pool</strong><span>{tournament.prizes}</span></p>
        )}

        {tournament.shuttle && (
          <p><strong>Shuttle</strong><span>{tournament.shuttle}</span></p>
        )}

        {tournament.scoringFormat && (
          <p><strong>Scoring</strong><span>{tournament.scoringFormat}</span></p>
        )}
        </div>
        </section>

      {rules.length > 0 && (
          <section className="player-rules-card mb-6">
            <div className="player-section-heading"><span>📋</span><div><p>Know before you play</p><h2>Player notes</h2></div></div>

            <ul>
              {rules.map(
                (rule, index) => (
                  <li key={`${rule}-${index}`}>
                    {rule}
                  </li>
                )
              )}
            </ul>
          </section>
        )}

      {fixtureLoading && (
        <div className="mb-4 text-sm text-gray-500">
          Loading fixtures...
        </div>
      )}

      {fixtureError && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {fixtureError}
        </div>
      )}

      {tournament.categories &&
      tournament.categories.length > 0 ? (
        <>
          <div className="player-section-title"><div><p>Choose your draw</p><h2>Event categories</h2></div><span>{tournament.categories.length} event{tournament.categories.length === 1 ? '' : 's'}</span></div>

          <div className="grid gap-4 lg:grid-cols-2">
            {tournament.categories.map((category, index) => {
              const eligibility =
                eligibilityResults.get(category.id)

              const isRegistered =
                playerRegistrations.some(
                  (registration) =>
                    registration.categoryId === category.id &&
                    registration.status === 'REGISTERED'
                )
              const hasActiveRegistration = isRegistered || Boolean(
                eligibility?.reasons.some((reason) => reason.code === 'ALREADY_REGISTERED')
              )

              const regStatus =
                registrationStatus[category.id]

              const fixture = fixtures.get(category.id)

              return (
                <div
                  key={`${category.id}-${index}`}
                  className="player-category-card"
                >
                  <div className="mb-3">
                    <div className="flex items-start justify-between gap-3"><div><p className="player-category-label">🏸 {category.eventType}</p><h3 className="text-xl font-bold">
                      {category.name}
                    </h3></div><span className="player-category-count">{category.maxTeams ?? '∞'} slots</span></div>

                    {(category.minAge !== undefined ||
                      category.maxAge !== undefined) && (
                      <p className="text-sm text-gray-500">
                        Age:{' '}
                        {category.minAge ??
                          'No minimum'}{' '}
                        -{' '}
                        {category.maxAge ??
                          'No maximum'}
                      </p>
                    )}

                    {category.maxTeams !== undefined && (
                      <p className="text-sm text-gray-500">
                        Max Entries:{' '}
                        {category.maxTeams}
                      </p>
                    )}

                    <p className="text-sm text-gray-500">
                      Medalists Allowed:{' '}
                      {category.medalistsAllowed
                        ? 'Yes'
                        : 'No'}
                    </p>

                    <p className="text-sm text-gray-500">
                      Open Players Allowed:{' '}
                      {category.openPlayersAllowed
                        ? 'Yes'
                        : 'No'}
                    </p>

                    <p className="text-sm text-gray-500">
                      Beginner Only:{' '}
                      {category.beginnerOnly
                        ? 'Yes'
                        : 'No'}
                    </p>

                    <p className="text-sm text-gray-500">
                      Pure Beginner Only:{' '}
                      {category.pureBeginnerOnly
                        ? 'Yes'
                        : 'No'}
                    </p>

                    {category.additionalRuleNotes && (
                      <p className="text-sm text-gray-500 italic mt-1">
                        {category.additionalRuleNotes}
                      </p>
                    )}
                  </div>

                  {fixture && (
                    <div className="mt-4 p-3 bg-gray-50 rounded">
                      <h4 className="text-lg font-semibold mb-2">
                        {fixture.status === 'PUBLISHED'
                          ? 'Match Results'
                          : 'Fixture'}
                      </h4>

                      <div className="space-y-2">
                        {fixture.matches.map((match) => (
                          <div
                            key={match.id}
                            className="border p-3 rounded bg-white"
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-medium text-gray-700">
                                Match:
                              </span>

                              <span className="text-sm">
                                {match.matchCode}
                              </span>
                            </div>

                            <div className="flex justify-between items-start mt-1">
                              <span className="font-medium text-gray-700">
                                Status:
                              </span>

                              <span
                                className={`px-2 py-1 text-xs rounded-full ${
                                  match.status === 'SCHEDULED'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : ''
                                } ${
                                  match.status === 'LIVE'
                                    ? 'bg-blue-100 text-blue-800'
                                    : ''
                                } ${
                                  match.status === 'COMPLETED'
                                    ? 'bg-green-100 text-green-800'
                                    : ''
                                } ${
                                  match.status === 'CANCELLED'
                                    ? 'bg-gray-100 text-gray-800'
                                    : ''
                                }`}
                              >
                                {match.status}
                              </span>
                            </div>

                            <div className="flex justify-between items-start mt-1 gap-3">
                              <span className="font-medium text-gray-700">
                                Participant 1:
                              </span>

                              <span className="text-sm flex-1 truncate text-right">
                                {match.participant1 ? (
                                  <>
                                    {match.participant1.name}

                                    {match.participant1.code && (
                                      <span className="ml-1 text-xs text-gray-500">
                                        (
                                        {
                                          match
                                            .participant1
                                            .code
                                        }
                                        )
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="italic text-gray-500">
                                    BYE
                                  </span>
                                )}
                              </span>
                            </div>

                            {canScoreMatchPlayer(match) && (
                              <div className="flex justify-between items-start mt-1">
                                <span className="font-medium text-gray-700">
                                  P1 Score:
                                </span>

                                <span className="text-sm font-mono">
                                  {match.participant1Score}
                                </span>
                              </div>
                            )}

                            <div className="flex justify-between items-start mt-1 gap-3">
                              <span className="font-medium text-gray-700">
                                Participant 2:
                              </span>

                              <span className="text-sm flex-1 truncate text-right">
                                {match.participant2 ? (
                                  <>
                                    {match.participant2.name}

                                    {match.participant2.code && (
                                      <span className="ml-1 text-xs text-gray-500">
                                        (
                                        {
                                          match
                                            .participant2
                                            .code
                                        }
                                        )
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="italic text-gray-500">
                                    BYE
                                  </span>
                                )}
                              </span>
                            </div>

                            {canScoreMatchPlayer(match) && (
                              <div className="flex justify-between items-start mt-1">
                                <span className="font-medium text-gray-700">
                                  P2 Score:
                                </span>

                                <span className="text-sm font-mono">
                                  {match.participant2Score}
                                </span>
                              </div>
                            )}

                            {match.winnerId && (
                              <div className="flex justify-between items-start mt-2">
                                <span className="font-medium text-gray-700">
                                  Winner:
                                </span>

                                <span className="text-sm font-semibold text-green-600">
                                  {match.participant1?.id ===
                                  match.winnerId
                                    ? match.participant1
                                        ?.name
                                    : match.participant2
                                        ?.name}
                                </span>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="player-eligibility-panel">
                    {hasActiveRegistration ? (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                        <p className="player-registered">✓ Already Registered</p>
                        <p className="text-sm text-emerald-800">You are already participating in this category.</p>
                        <button type="button" onClick={() => navigate('/player/registrations')} className="mt-3 text-sm font-bold text-emerald-700 hover:text-emerald-900">View My Entry</button>
                      </div>
                    ) : loadingRegistrations ? (
                      <p className="text-sm text-gray-500">Checking your registration...</p>
                    ) : (
                      <>
                    {category.registrationPhase === 'CLOSED' && <p className="player-ineligible">Registration Closed</p>}
                    {eligibility ? (
                      eligibility.eligible ? (
                        <>
                          <p className="player-eligible">
                            ✓ You are eligible to play
                          </p>

                          {!regStatus && (
                            <>
                              {category.eventType ===
                                'SINGLES' &&
                                category.registrationPhase === 'OPEN' &&
                                !isRegistered && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleRegister(
                                        category.id
                                      )
                                    }
                                    className="player-register-button"
                                  >
                                    Register
                                  </button>
                                )}

                              {category.eventType ===
                                'DOUBLES' &&
                                category.registrationPhase === 'OPEN' &&
                                !isRegistered && (
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.preventDefault()
                                      event.stopPropagation()

                                      if (!tournamentId) {
                                        return
                                      }

                                      // Validate that we have a valid category object with ID
                                      if (!category || !category.id || String(category.id).trim() === '') {
                                        return
                                      }

                                      const partnerPath =
                                        `/player/tournaments/${tournamentId}/doubles/${category.id}/partner`

                                      navigate(partnerPath)
                                    }}
                                    className="player-register-button w-full"
                                  >
                                    Select Doubles Partner
                                  </button>
                                )}

                            </>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="player-ineligible">
                            ✕ Not eligible for this event
                          </p>

                          <ul className="mt-2 space-y-1 text-sm text-red-600">
                            {eligibility.reasons.map(
                              (reason, index) => (
                                <li
                                  key={`${reason.code}-${index}`}
                                >
                                  {reason.message}
                                </li>
                              )
                            )}
                          </ul>
                        </>
                      )
                    ) : (
                      <p className="text-sm text-gray-500">
                        {checkingEligibility
                          ? 'Checking eligibility...'
                          : 'Eligibility unavailable'}
                      </p>
                    )}
                      </>
                    )}

                    {regStatus && (
                      <div className="mt-2">
                        {regStatus.success ? (
                          <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded">
                            {regStatus.message}
                          </div>
                        ) : (
                          <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded">
                            {regStatus.message}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </>
      ) : (
        <p className="text-center py-8">
          No categories available for this tournament.
        </p>
      )}

      <section className="mt-8">
        <div className="player-section-title"><div><p>Your track record</p><h2>Achievements & medals</h2></div><span>🏆</span></div>

        {medalHistoryLoading && (
          <p className="text-sm text-gray-500">
            Loading medal history...
          </p>
        )}

        {medalHistoryError && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {medalHistoryError}
          </div>
        )}

        {!medalHistoryLoading &&
          !medalHistoryError &&
          medalHistory.length === 0 && (
            <p className="player-empty-medals">
              🏸 Your next podium finish will appear here.
            </p>
          )}

        {!medalHistoryLoading &&
          medalHistory.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2">
              {medalHistory.map((medal) => (
                <div
                  key={medal.id}
                  className="player-medal-card"
                >
                  <h3 className="font-semibold">
                    {medal.tournamentName}
                  </h3>

                  <p className="text-sm text-gray-600">
                    {medal.categoryName}
                  </p>

                  <p className="mt-2 text-sm">
                    <strong>Position:</strong>{' '}
                    {medal.position}
                  </p>

                  <p className="text-sm">
                    <strong>Medal:</strong>{' '}
                    {medal.medalType}
                  </p>

                  <p className="text-sm text-gray-500">
                    {new Date(
                      medal.achievedAt
                    ).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          )}
      </section>
      </main>
    </div>
  )
}

export default PlayerTournamentDetailPage
