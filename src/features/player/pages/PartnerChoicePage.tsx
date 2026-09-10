// After verifying the fix for doubles partner routing, ensuring navigation preserves categoryId
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useDoublesRegistrationDraftStore } from '@/features/teams/store/doublesRegistrationDraftStore'

import { EligibilityResult } from '@/features/eligibility/types/eligibility.types'
import { eligibilityService } from '@/features/eligibility/services/eligibilityService'

import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'

const PartnerChoicePage = () => {
  const { tournamentId, categoryId } = useParams<{ tournamentId: string; categoryId: string }>()
  const navigate = useNavigate()

  const {
    tournament,
    loading,
    error,
  } = useTournamentStore()

  const { profile, hasProfile } = usePlayerProfileStore()

  const { registrations } = useRegistrationStore()

  const {
    setTournamentAndCategory,
    setCurrentPlayer,
    setEligibility
  } = useDoublesRegistrationDraftStore()

  const [eligibilityResult, setEligibilityResult] = useState<EligibilityResult | null>(null)
  const [checkingEligibility, setCheckingEligibility] = useState<boolean>(true)

  useEffect(() => {
    if (tournamentId && categoryId && hasProfile && profile) {
      // Set tournament and category in draft store
      setTournamentAndCategory(tournamentId, categoryId)
      // Set current player in draft store
      setCurrentPlayer(profile.id)
      void fetchTournamentAndCheckEligibility()
    }
  }, [tournamentId, categoryId, hasProfile, profile, setTournamentAndCategory, setCurrentPlayer])

  const fetchTournamentAndCheckEligibility = async () => {
    if (!tournamentId || !categoryId) return

    setCheckingEligibility(true)
    // Always refresh this route's category. A persisted tournament can have an
    // older registrationPhase after a manual close/reopen or a hard refresh.
    const tournamentStore = useTournamentStore.getState()
    await tournamentStore.fetchTournamentById(tournamentId)

    const { tournament } = tournamentStore
    if (!tournament) {
      setCheckingEligibility(false)
      return
    }

    const { profile, hasProfile } = usePlayerProfileStore.getState()
    if (!hasProfile || !profile) {
      setCheckingEligibility(false)
      return
    }

    try {
      const category = tournament.categories.find((item) => item.id === categoryId)
      if (!category) return

      // The category phase returned by the Worker is authoritative. Do not use
      // a cached tournament date to turn an OPEN category into a closed one.
      if (category.registrationPhase === 'CLOSED') {
        const closed: EligibilityResult = {
          eligible: false,
          reasons: [{ code: 'REGISTRATION_CLOSED', message: 'Registration Closed' }],
        }
        setEligibilityResult(closed)
        setEligibility(false, null)
        return
      }

      const eligibility = await eligibilityService.check({
        tournamentId,
        categoryId,
        playerId: profile.id,
      })
      const playerOnlyReasons = (eligibility.reasons ?? []).filter(
        (reason) => String(reason.code) !== 'PARTNER_REQUIRED' && !/(?:doubles )?partner is required/i.test(reason.message)
      )
      const playerEligible = eligibility.eligible || playerOnlyReasons.length === 0
      setEligibilityResult({ ...eligibility, eligible: playerEligible, reasons: playerOnlyReasons })
      // Store current player eligibility in draft store
      setEligibility(playerEligible, null) // partner eligibility unknown yet
    } catch (error) {
      setEligibilityResult({
        eligible: false,
        reasons: [{
          code: 'PROFILE_INCOMPLETE',
          message: error instanceof Error ? error.message : 'Unable to check eligibility. Please try again.',
        }],
      })
      setEligibility(false, null)
    } finally {
      setCheckingEligibility(false)
    }
  }

  if (loading || !tournament) {
    return (
      <div className="text-center py-8">
        Loading...
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Error: {error}
      </div>
    )
  }

  if (!hasProfile || !profile) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">
          {tournament.name}
        </h1>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-center">
          <p className="text-yellow-700">
            Please complete your player profile to continue.
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

  const category = tournament.categories.find(c => c.id === categoryId)
  if (!category) {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">
          {tournament.name}
        </h1>
        <p className="text-red-500">
          Category not found
        </p>
      </div>
    )
  }

  if (category.eventType !== 'DOUBLES') {
    return (
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-4">
          {tournament.name}
        </h1>
        <p className="text-red-500">
          Invalid category type for doubles registration
        </p>
      </div>
    )
  }

  const alreadyRegistered = registrations.some(
    (registration) =>
      registration.tournamentId === tournamentId &&
      registration.categoryId === categoryId &&
      registration.status === 'REGISTERED' &&
      registration.playerId === profile.id
  )

  return (
    <div className="p-4">
      <div className="flex justify-between items-start mb-4">
        <button
          type="button"
          onClick={() => navigate(`/player/tournaments/${tournamentId}`)}
          className="text-sm text-blue-600 hover:text-blue-800"
        >
          Back to Tournament
        </button>
        <div className="text-sm text-gray-500">
          Tournament → Category → Partner → Confirm Team
        </div>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          {tournament.name}
        </h1>
        <p className="text-sm text-gray-600">
          {formatDateDisplay(tournament.tournamentDate)} • {tournament.venueName}
        </p>
      </div>

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Choose Your Doubles Partner
        </h2>
        <p className="text-sm text-gray-600">
          Category: {category.name}
        </p>
      </div>

      {checkingEligibility ? (
        <div className="text-center py-8">
          Checking eligibility...
        </div>
      ) : category.registrationPhase === 'CLOSED' ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          Registration Closed
        </div>
      ) : alreadyRegistered ? (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-700">
          You are already registered for this category.
        </div>
      ) : eligibilityResult ? (
        eligibilityResult.eligible ? (
          <>
            <p className="text-sm font-medium text-green-600 mb-4">
              You are eligible for this category.
            </p>

            <div className="space-y-4">
              <button
                type="button"
                onClick={() => {
                  navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/partner/search`)
                }}
                className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 shadow-md"
              >
                Choose Existing Player
              </button>

              <button
                type="button"
                onClick={() => {
                  navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/guest`)
                }}
                className="w-full px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 shadow-md"
              >
                Add Guest Player
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-red-600 mb-4">
              Not Eligible
            </p>

            <ul className="list-disc list-inside mt-2 text-sm text-red-500 space-y-1">
              {eligibilityResult.reasons.map(
                (reason, index) => (
                  <li key={`${reason.code}-${index}`}>
                    {reason.message}
                  </li>
                )
              )}
            </ul>
          </>
        )
      ) : (
        <div className="text-center py-8">
          Eligibility unknown
        </div>
      )}
    </div>
  )
}

export default PartnerChoicePage
