import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { useDoublesRegistrationDraftStore } from '@/features/teams/store/doublesRegistrationDraftStore'

import { evaluatePlayerEligibility } from '@/features/eligibility/utils/eligibilityUtils'
import { EligibilityResult } from '@/features/eligibility/types/eligibility.types'

import { PlayerProfile } from '@/features/player/types/player.types'
import { TournamentCategory } from '@/features/tournaments/types/tournament.types'

import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'

const ExistingPartnerSearchPage = () => {
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
    profiles: allProfiles,
    searchProfiles,
  } = usePlayerDirectoryStore()

  const {
    registrations,
    getTournamentRegistrations,
  } = useRegistrationStore()

  const {
    teams: allTeams,
  } = useTeamStore()

  const {
    partnerId,
    partnerCode,
    partnerName,
    partnerType,
    partnerStatus,
    setPartner,
    setEligibility
  } = useDoublesRegistrationDraftStore()

  const [searchQuery, setSearchQuery] = useState<string>('')
  const [searchResults, setSearchResults] = useState<PlayerProfile[]>([])
  const [selectedPartner, setSelectedPartner] = useState<PlayerProfile | null>(null)
  const [checkingPartnerEligibility, setCheckingPartnerEligibility] = useState<boolean>(false)
  const [partnerEligibilityResult, setPartnerEligibilityResult] = useState<EligibilityResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingCategoryPhase, setLoadingCategoryPhase] = useState(true)

  useEffect(() => {
    if (tournamentId) {
      void useTournamentStore.getState().fetchTournamentById(tournamentId).finally(() => setLoadingCategoryPhase(false))
    }
  }, [tournamentId])

  useEffect(() => {
    if (searchQuery) {
      const results = searchProfiles(searchQuery)
      // Filter out current player (since searchProfiles already returns only active profiles)
      const filtered = results.filter(
        profile => profile.id !== currentProfile?.id
      )
      setSearchResults(filtered)
    } else {
      // When searchQuery is empty, show all active profiles except current player
      const filtered = allProfiles.filter(
        profile =>
          profile.profileStatus === 'ACTIVE' &&
          profile.id !== currentProfile?.id
      )
      setSearchResults(filtered)
    }
  }, [searchQuery, allProfiles, searchProfiles, currentProfile?.id])

  const handleSelectPartner = async (partner: PlayerProfile) => {
    setSelectedPartner(partner)
    setError(null)
    setCheckingPartnerEligibility(true)

    try {
      if (!tournamentId || !categoryId || !tournament || !currentProfile) {
        setError('Missing required data')
        return
      }

      const category = tournament.categories.find(c => c.id === categoryId)
      if (!category) {
        setError('Category not found')
        return
      }

      const registrationStore = useRegistrationStore.getState()
      const tournamentRegistrations = registrationStore.getTournamentRegistrations(tournament.id)
      const currentRegistrations = tournamentRegistrations.filter(
        (reg) =>
          reg.categoryId === categoryId &&
          reg.status === 'REGISTERED'
      ).length

      const partnerEligibility = evaluatePlayerEligibility(
        partner,
        tournament,
        category,
        currentRegistrations
      )
      setPartnerEligibilityResult(partnerEligibility)

      // Store partner in draft store
      setPartner(partner, 'FULL', 'PENDING_CONFIRMATION')
      // We'll update the eligibility in the draft store in the confirmation page
      // For now, we'll just store the partner and leave eligibility to be checked in the confirmation page.

      // Navigate to confirmation page
      navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/confirm`)
    } catch (err) {
      setError('Failed to check partner eligibility. Please try again.')
    } finally {
      setCheckingPartnerEligibility(false)
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

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Search for a Partner
        </h2>
        <p className="text-sm text-gray-600">
          Category: {category.name}
        </p>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
          {error}
        </div>
      ) : null}

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, player code, or ID"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {checkingPartnerEligibility ? (
        <p className="text-center text-sm text-gray-500">
          Checking partner eligibility...
        </p>
      ) : partnerEligibilityResult ? (
        partnerEligibilityResult.eligible ? (
          <>
            <p className="text-sm font-medium text-green-600">
              Partner is eligible
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-red-600">
              Partner is not eligible
            </p>
            <ul className="list-disc list-inside mt-1 text-sm text-red-500 space-y-1">
              {partnerEligibilityResult.reasons.map(
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
        <p className="text-center text-sm text-gray-500">
          Partner eligibility unknown
        </p>
      )}

      <div className="mt-4">
        {selectedPartner ? (
          <>
            <h3 className="text-lg font-semibold mb-2">
              Selected Partner
            </h3>
            <div className="border rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0 h-12 w-12 bg-gray-200 rounded flex-items-center justify-center text-gray-500">
                  {selectedPartner.fullName.charAt(0)}
                </div>
                <div>
                  <p className="font-medium text-gray-800">
                    {selectedPartner.fullName}
                  </p>
                  <p className="text-sm text-gray-500">
                    Player Code: {selectedPartner.playerCode}
                  </p>
                  <p className="text-sm text-gray-500">
                    Location: {selectedPartner.location}
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleSelectPartner(selectedPartner)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Confirm Partner
            </button>
          </>
        ) : (
          <p className="text-center text-sm text-gray-500">
            No partner selected
          </p>
        )}
      </div>

      <div className="mt-4">
        <h3 className="text-lg font-semibold mb-2">
          Search Results ({searchResults.length})
        </h3>
        {searchResults.length > 0 ? (
          <div className="space-y-2">
            {searchResults.map((partner) => (
              <div
                key={partner.id}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => setSelectedPartner(partner)}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 h-12 w-12 bg-gray-200 rounded flex-items-center justify-center text-gray-500">
                    {partner.fullName.charAt(0)}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">
                      {partner.fullName}
                    </p>
                    <p className="text-sm text-gray-500">
                      Player Code: {partner.playerCode}
                    </p>
                    <p className="text-sm text-gray-500">
                      Location: {partner.location}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            No registered players found.
          </p>
        )}
      </div>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/partner`)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Partner Choice
        </button>
      </div>
    </div>
  )
}

export default ExistingPartnerSearchPage
