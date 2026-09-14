import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useGuestPlayerStore } from '@/features/player/store/guestPlayerStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useDoublesRegistrationDraftStore } from '@/features/teams/store/doublesRegistrationDraftStore'

import { registrationService } from '@/features/registrations/services/registrationService'
import { teamService } from '@/features/teams/services/teamService'
import { guestPlayerService } from '@/features/player/services/guestPlayerService'

import { TournamentCategory } from '@/features/tournaments/types/tournament.types'
import { PlayerProfile } from '@/features/player/types/player.types'
import { GuestPlayer } from '@/features/player/types/guest.player.types'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'

import { evaluatePlayerEligibility } from '@/features/eligibility/utils/eligibilityUtils'
import { EligibilityResult } from '@/features/eligibility/types/eligibility.types'
import { eligibilityService } from '@/features/eligibility/services/eligibilityService'

const DoubleRegistrationConfirmationPage = () => {
  const {
    tournamentId,
    categoryId,
  } = useParams<{ tournamentId: string; categoryId: string }>()
  const navigate = useNavigate()

  const {
    tournament,
    loading: tournamentLoading,
    error: tournamentError,
  } = useTournamentStore()

  const { profile: currentProfile, hasProfile } = usePlayerProfileStore()

  const {
    guests,
    getGuestByMobile,
  } = useGuestPlayerStore()

  const {
    profiles: allProfiles,
  } = usePlayerDirectoryStore()

  const {
    registrations,
    getTournamentRegistrations,
  } = useRegistrationStore()

  const {
    tournamentId: draftTournamentId,
    categoryId: draftCategoryId,
    currentPlayerId,
    partnerId,
    partnerCode,
    partnerName,
    partnerType,
    partnerStatus,
    setEligibility,
    clear: clearDraft
  } = useDoublesRegistrationDraftStore()

  // Store selectors for use in event handlers (must be at top level)
  const tournamentStore = useTournamentStore(state => state)
  const registrationStore = useRegistrationStore(state => state)
  const playerDirectoryStore = usePlayerDirectoryStore(state => state)
  const guestPlayerStore = useGuestPlayerStore(state => state)

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const [showPartnerAcceptButton, setShowPartnerAcceptButton] = useState<boolean>(false)
  const [partnerAccepted, setPartnerAccepted] = useState<boolean>(false)
  const [currentPlayerEligibility, setCurrentPlayerEligibility] = useState<boolean | null>(null)
  const [partnerEligibility, setPartnerEligibility] = useState<boolean | null>(null)
  const [currentPlayerRejectionReasons, setCurrentPlayerRejectionReasons] = useState<string[]>([])
  const [partnerRejectionReasons, setPartnerRejectionReasons] = useState<string[]>([])
  const [loadingCategoryPhase, setLoadingCategoryPhase] = useState(true)

  useEffect(() => {
    // Validate that we have the required data in the draft store
    if (!draftTournamentId || !draftCategoryId || !currentPlayerId) {
      navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/partner`, { replace: true })
      return
    }

    // If the draft store data doesn't match the route, we might have a mismatch.
    // We'll trust the route over the draft store for tournament and category.
    // But we'll use the draft store for partner and player data.
  }, [draftTournamentId, draftCategoryId, currentPlayerId, tournamentId, categoryId, navigate])

  useEffect(() => {
    // Always load the route's current category phase before confirmation.
    if (tournamentId && categoryId) {
      const fetchTournament = async () => {
        try {
          await tournamentStore.fetchTournamentById(tournamentId)
        } finally {
          setLoadingCategoryPhase(false)
        }
      }
      fetchTournament()
    }
  }, [tournamentId, categoryId])

  useEffect(() => {
    // Check current player eligibility when data changes
    if (hasProfile && currentProfile && tournamentId && categoryId && partnerId && partnerType) {
      void checkCurrentPlayerEligibility()
    }
  }, [hasProfile, currentProfile, tournamentId, categoryId, partnerId, partnerType])

  const checkCurrentPlayerEligibility = async () => {
    if (!tournamentId || !categoryId) return

    // Reset eligibility states and clear error at start of check
    setCurrentPlayerEligibility(null)
    setCurrentPlayerRejectionReasons([])
    setError(null)

    try {
      await tournamentStore.fetchTournamentById(tournamentId)

      const tournament = tournamentStore.tournament
      if (!tournament) return

      if (!hasProfile || !currentProfile) return

      const category = tournament.categories.find((item) => item.id === categoryId)
      if (!category) throw new Error('Category not found')

      const eligibility = await eligibilityService.check({
        tournamentId,
        categoryId,
        playerId: currentProfile.id,
        partner: { id: partnerId!, type: partnerType === 'FULL' ? 'PLAYER' : 'GUEST' },
      })
      setCurrentPlayerEligibility(eligibility.eligible)
      setCurrentPlayerRejectionReasons((eligibility.reasons ?? []).map(reason => reason.message))
      // Update eligibility in draft store
      setEligibility(eligibility.eligible, partnerEligibility)
      setError(null)
    } catch (err) {
      setCurrentPlayerEligibility(false)
      setError(err instanceof Error ? err.message : 'Failed to check eligibility. Please try again.')
    }
  }

  const checkPartnerEligibility = async () => {
    if (!partnerId || !tournamentId || !categoryId) return

    // Reset eligibility states and clear error at start of check
    setPartnerEligibility(null)
    setPartnerRejectionReasons([])
    setError(null)

    try {
      await tournamentStore.fetchTournamentById(tournamentId)

      const tournament = tournamentStore.tournament
      if (!tournament) return

      const category = tournament.categories.find(c => c.id === categoryId)
      if (!category) return

      let tournamentRegistrations: any[] = []
      try {
        tournamentRegistrations = registrationStore.getTournamentRegistrations(tournament.id)
      } catch (err) {
        setPartnerEligibility(false)
        setError('Failed to get tournament registrations. Please try again.')
        return
      }

      const currentRegistrations = tournamentRegistrations.filter(
        (reg) =>
          reg.categoryId === categoryId &&
          reg.status === 'REGISTERED'
      ).length

      // We need to get the partner profile (either PlayerProfile or GuestPlayer)
      let partnerProfile: PlayerProfile | GuestPlayer | null = null
      if (partnerType === 'FULL') {
        partnerProfile = playerDirectoryStore.getProfileById(partnerId)
      } else if (partnerType === 'GUEST') {
        const guest = guestPlayerStore.getGuestById(partnerId)
        if (!guest) {
          setPartnerEligibility(false)
          setError('Partner not found')
          return
        }
        // Normalize guest data to match PlayerProfile shape for eligibility evaluation
        partnerProfile = {
          id: guest.id,
          userId: '', // Guest doesn't have auth user ID
          fullName: guest.fullName,
          gender: guest.gender ?? undefined,
          dob: guest.dob,
          age: guest.age,
          mobile: guest.mobile,
          location: guest.location,
          playingSince: guest.playingSince,
          experienceYears: guest.experienceYears,
          regularPlayer: guest.regularPlayer,
          courtAcademy: guest.courtAcademy,
          playerCode: guest.guestCode, // Use guestCode as playerCode for eligibility
          profilePhoto: null, // Guest doesn't have profile photo
          profileStatus: guest.profileStatus,
          createdAt: guest.createdAt,
          updatedAt: guest.updatedAt,
        } as PlayerProfile
      }

      if (!partnerProfile) {
        setPartnerEligibility(false)
        setError('Partner not found')
        return
      }

      const partnerEligibilityResult = partnerType === 'FULL'
        ? await eligibilityService.check({
            tournamentId,
            categoryId,
            playerId: partnerId,
            partner: { id: currentProfile!.id, type: 'PLAYER' },
          })
        : evaluatePlayerEligibility(partnerProfile, tournament, category, currentRegistrations)
      setPartnerEligibility(partnerEligibilityResult.eligible)
      setPartnerRejectionReasons((partnerEligibilityResult.reasons ?? []).map(reason => reason.message))
      // Update eligibility in draft store
      setEligibility(currentPlayerEligibility, partnerEligibilityResult.eligible)
      // Clear error on successful check
      setError(null)
    } catch (err) {
      setPartnerEligibility(false)
      setError(err instanceof Error ? err.message : 'Failed to check partner eligibility. Please try again.')
    }
  }

  // Check partner eligibility when partner data changes
  useEffect(() => {
    if (partnerId && partnerType && partnerStatus !== null) {
      void checkPartnerEligibility()
    }
  }, [partnerId, partnerType, partnerStatus, tournamentId, categoryId])

  // Determine if we should show the partner accept button
  useEffect(() => {
    if (partnerType === 'FULL' && partnerStatus === 'PENDING_CONFIRMATION') {
      setShowPartnerAcceptButton(true)
      setPartnerAccepted(false)
    } else if (partnerType === 'GUEST') {
      setShowPartnerAcceptButton(false)
      setPartnerAccepted(true) // Guest is always accepted
    } else if (partnerType === 'FULL' && partnerStatus === 'ACCEPTED') {
      setShowPartnerAcceptButton(false)
      setPartnerAccepted(true)
    } else {
      setShowPartnerAcceptButton(false)
      setPartnerAccepted(false)
    }
  }, [partnerType, partnerStatus])

  const handleSimulatePartnerAccept = async () => {
    // Update local state to indicate partner has accepted
    // Note: We cannot update partner status in the draft store directly because we don't have a setter for just partner status.
    // Partner eligibility is unaffected by acceptance, so we don't need to update it.
    setPartnerAccepted(true)
  }

  const handleConfirmAndRegister = async () => {
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      // Validate all conditions
      if (!tournamentId || !categoryId) {
        throw new Error('Missing tournament or category')
      }

      const tournament = tournamentStore.tournament
      if (!tournament) {
        throw new Error('Tournament not found')
      }
      if (tournament.status !== 'PUBLISHED') {
        throw new Error('Tournament is not published')
      }

      const category = tournament.categories.find(c => c.id === categoryId)
      if (!category) {
        throw new Error('Category not found')
      }
      if (category.eventType !== 'DOUBLES') {
        throw new Error('Invalid category type for doubles registration')
      }
      if (category.registrationPhase === 'CLOSED') {
        throw new Error('Registration Closed')
      }

      // Check current player eligibility
      if (currentPlayerEligibility === false) {
        throw new Error('You are not eligible for this category')
      }

      // Check partner eligibility
      if (partnerEligibility === false) {
        throw new Error('Partner is not eligible for this category')
      }

      // Check partner status
      if (partnerType === 'FULL' && !partnerAccepted) {
        throw new Error('Partner has not accepted the invitation')
      }

      // Check duplicate registration for current player
      const currentPlayerDuplicate = registrationStore.isAlreadyRegistered(
        currentProfile!.id,
        tournamentId,
        categoryId
      )
      if (currentPlayerDuplicate) {
        throw new Error('You are already registered for this category')
      }

      // Check duplicate registration for partner
      let partnerDuplicate = false
      if (partnerType === 'FULL') {
        const partnerProfile = playerDirectoryStore.getProfileById(partnerId)
        if (partnerProfile) {
          partnerDuplicate = registrationStore.isAlreadyRegistered(
            partnerProfile.id,
            tournamentId,
            categoryId
          )
        }
      } else if (partnerType === 'GUEST') {
        const guest = guestPlayerStore.getGuestById(partnerId)
        if (guest) {
          partnerDuplicate = registrationStore.isAlreadyRegistered(
            guest.id,
            tournamentId,
            categoryId
          )
        }
      }
      if (partnerDuplicate) {
        throw new Error('Partner is already registered for this category')
      }

      // Refresh teams from the Worker before checking duplicate pairs and
      // capacity. The registration endpoint remains authoritative on submit.
      const categoryTeams = await teamService.getCategoryTeams(tournamentId, categoryId)

      // Check if current player is already in another active team for this category.
      const currentPlayerInAnotherTeam = categoryTeams.some(team =>
        (team.player1Id === currentProfile!.id || team.player2Id === currentProfile!.id) &&
        team.status === 'CONFIRMED'
      )
      if (currentPlayerInAnotherTeam) {
        throw new Error('You are already in another team for this category')
      }

      // Check if partner is already in another active team for same tournament/category
      let partnerInAnotherTeam = false
      if (partnerType === 'FULL') {
        const partnerProfile = playerDirectoryStore.getProfileById(partnerId)
        if (partnerProfile) {
          partnerInAnotherTeam = categoryTeams.some(team =>
            (team.player1Id === partnerProfile.id || team.player2Id === partnerProfile.id) &&
            team.status === 'CONFIRMED'
          )
        }
      } else if (partnerType === 'GUEST') {
        const guest = guestPlayerStore.getGuestById(partnerId)
        if (guest) {
          partnerInAnotherTeam = categoryTeams.some(team =>
            (team.player1Id === guest.id || team.player2Id === guest.id) &&
            team.status === 'CONFIRMED'
          )
        }
      }
      if (partnerInAnotherTeam) {
        throw new Error('Partner is already in another team for this category')
      }

      // Check if the pair already exists as a team.
      const teamExists = categoryTeams.some((team) =>
        (team.player1Id === currentProfile!.id && team.player2Id === partnerId) ||
        (team.player1Id === partnerId && team.player2Id === currentProfile!.id)
      )
      if (teamExists) {
        throw new Error('A team with these two players already exists for this category')
      }

      // Check category capacity (for doubles, we count CONFIRMED teams)
      const confirmedTeams = categoryTeams.filter(team => team.status === 'CONFIRMED')
      const maxTeams = typeof category.maxTeams === 'number' && category.maxTeams > 0
        ? category.maxTeams
        : undefined
      if (maxTeams !== undefined && confirmedTeams.length >= maxTeams) {
        throw new Error('Category is full')
      }

      // All checks passed, proceed to create team and registration via service
      const isGuest = partnerType === 'GUEST'
      const partnerStatusValue = 'ACCEPTED' // We only proceed if partner is accepted (guest or simulated accept)

      let partnerProfile: PlayerProfile | GuestPlayer | null = null
      if (partnerType === 'FULL') {
        partnerProfile = playerDirectoryStore.getProfileById(partnerId)
      } else if (partnerType === 'GUEST') {
        const guest = guestPlayerStore.getGuestById(partnerId)
        if (!guest) {
          throw new Error('Partner not found')
        }
        // Normalize guest data to match PlayerProfile shape for registration
        partnerProfile = {
          id: guest.id,
          userId: '', // Guest doesn't have auth user ID
          fullName: guest.fullName,
          gender: guest.gender ?? undefined,
          dob: guest.dob,
          age: guest.age,
          mobile: guest.mobile,
          location: guest.location,
          playingSince: guest.playingSince,
          experienceYears: guest.experienceYears,
          regularPlayer: guest.regularPlayer,
          courtAcademy: guest.courtAcademy,
          playerCode: guest.guestCode, // Use guestCode as playerCode for registration
          profilePhoto: null, // Guest doesn't have profile photo
          profileStatus: guest.profileStatus,
          createdAt: guest.createdAt,
          updatedAt: guest.updatedAt,
        } as PlayerProfile
      }

      if (!partnerProfile) {
        throw new Error('Partner not found')
      }

      const registration = await registrationService.registerDoublesTeam(
        tournamentId,
        categoryId,
        currentProfile!,
        partnerProfile,
        partnerStatusValue
      )

      setSuccess(true)
      // Clear the draft store
      clearDraft()
      // Navigate to registrations page after a short delay
      setTimeout(() => {
        navigate('/player/registrations')
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred')
    } finally {
      setIsLoading(false)
    }
  }

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

  if (loadingCategoryPhase) {
    return <div className="text-center py-8">Loading registration status...</div>
  }

  if (!hasProfile || !currentProfile) {
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

  if (category.registrationPhase === 'CLOSED') {
    return (
      <div className="p-4">
        <p className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">Registration Closed</p>
      </div>
    )
  }

  // Helper functions to render eligibility status
  const renderEligibilityStatus = (eligible: boolean | null, reasons: string[]) => {
    if (eligible === null) {
      return <p className="text-sm text-gray-500">Checking...</p>
    }
    if (eligible === true) {
      return (
        <p className="text-sm font-medium text-green-600">
          Eligible
          {reasons.length > 0 && (
            <>
              <br />
              <span className="text-xs text-red-500">
                ({reasons.join(', ')})
              </span>
            </>
          )}
        </p>
      )
    }
    return (
      <p className="text-sm font-medium text-red-600">
        Not Eligible
        {reasons.length > 0 && (
          <>
            <br />
            <span className="text-xs text-red-500">
              ({reasons.join(', ')})
            </span>
          </>
        )}
      </p>
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
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded mb-4">
          Registration successful! Redirecting to your registrations...
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Confirm Doubles Registration
        </h2>
        <p className="text-sm text-gray-600">
          Category: {category.name}
        </p>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Your Information
        </h3>
        <div className="border rounded-lg p-4">
          <p className="font-medium text-gray-800">
            Name:
          </p>
          <p className="text-sm text-gray-500">
            {currentProfile?.fullName}
          </p>
          <p className="font-medium text-gray-800">
            Player Code:
          </p>
          <p className="text-sm text-gray-500">
            {currentProfile?.playerCode}
          </p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Partner Information
        </h3>
        {partnerId && partnerName && partnerCode ? (
          <div className="border rounded-lg p-4">
            <p className="font-medium text-gray-800">
              Name:
            </p>
            <p className="text-sm text-gray-500">
              {partnerName}
            </p>
            <p className="font-medium text-gray-800">
              {partnerType === 'FULL' ? 'Player Code:' : 'Guest Code:'}
            </p>
            <p className="text-sm text-gray-500">
              {partnerCode}
            </p>
            <p className="font-medium text-gray-800">
              Type:
            </p>
            <p className="text-sm text-gray-500">
              {partnerType === 'FULL' ? 'Full Player' : 'Guest Player'}
            </p>
            {partnerType === 'GUEST' && guestPlayerStore.getGuestById(partnerId)?.gender && (
              <><p className="font-medium text-gray-800">Gender:</p><p className="text-sm text-gray-500">{guestPlayerStore.getGuestById(partnerId)?.gender === 'MALE' ? 'Male' : guestPlayerStore.getGuestById(partnerId)?.gender === 'FEMALE' ? 'Female' : 'Other'}</p></>
            )}
          </div>
        ) : (
          <p className="text-center text-sm text-gray-500">
            Partner information not available
          </p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Eligibility Status
        </h3>
        <div className="space-y-4">
          <div>
            <p className="font-medium text-gray-800">
              You:
            </p>
            {renderEligibilityStatus(currentPlayerEligibility, currentPlayerRejectionReasons)}
          </div>
          <div>
            <p className="font-medium text-gray-800">
              Partner:
            </p>
            {renderEligibilityStatus(partnerEligibility, partnerRejectionReasons)}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">
          Partner Status
        </h3>
        <p className="text-sm text-gray-500">
          {partnerType === 'FULL'
            ? partnerAccepted || partnerStatus === 'ACCEPTED'
              ? 'Partner has accepted'
              : partnerStatus === 'PENDING_CONFIRMATION'
                ? 'Waiting for partner to accept'
                : 'Unknown'
            : 'Guest partner (automatically accepted)'}
          </p>
      </div>

      {showPartnerAcceptButton && !partnerAccepted && currentPlayerEligibility === true && partnerEligibility === true && (
        <div className="mb-6">
          <button
            type="button"
            onClick={handleSimulatePartnerAccept}
            className="w-full px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Simulate Partner Accept
          </button>
        </div>
      )}

      <div className="mt-8">
        <button
          type="button"
          onClick={() => navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/partner`)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Partner Selection
        </button>
        <button
          type="button"
          onClick={handleConfirmAndRegister}
          className="ml-4 px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
          disabled={
            isLoading ||
            success ||
            currentPlayerEligibility !== true ||
            partnerEligibility !== true ||
            (partnerType === 'FULL' && !partnerAccepted)
          }
        >
          {isLoading ? 'Registering...' : success ? 'Registration Complete' : 'Confirm Team & Register'}
        </button>
      </div>
    </div>
  )
}

export default DoubleRegistrationConfirmationPage
