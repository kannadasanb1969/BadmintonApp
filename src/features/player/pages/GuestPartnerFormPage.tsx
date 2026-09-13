import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useGuestPlayerStore } from '@/features/player/store/guestPlayerStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { useDoublesRegistrationDraftStore } from '@/features/teams/store/doublesRegistrationDraftStore'

import { registrationService } from '@/features/registrations/services/registrationService'
import { teamService } from '@/features/teams/services/teamService'
import { guestPlayerService } from '@/features/player/services/guestPlayerService'

import { evaluatePlayerEligibility } from '@/features/eligibility/utils/eligibilityUtils'
import { EligibilityResult } from '@/features/eligibility/types/eligibility.types'

import { GuestPlayer } from '@/features/player/types/guest.player.types'
import { PlayerProfile } from '@/features/player/types/player.types'
import { TournamentCategory } from '@/features/tournaments/types/tournament.types'
import { formatDateDisplay } from '@/features/tournaments/utils/tournamentHelpers'

const GuestPartnerFormPage = () => {
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

  // Zustand hooks must be called at the top level, not inside event handlers
  const setTournamentAndCategory = useDoublesRegistrationDraftStore(
    state => state.setTournamentAndCategory
  )
  const setCurrentPlayer = useDoublesRegistrationDraftStore(
    state => state.setCurrentPlayer
  )
  const setPartner = useDoublesRegistrationDraftStore(
    state => state.setPartner
  )

  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<boolean>(false)
  const [name, setName] = useState<string>('')
  const [mobile, setMobile] = useState<string>('')
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | 'OTHER' | ''>('')
  const [loadingCategoryPhase, setLoadingCategoryPhase] = useState(true)

  useEffect(() => {
    // Validate that we have the required data in the route
    if (!tournamentId || !categoryId) {
      navigate('/player')
      return
    }

    // Always fetch the route's tournament so category registrationPhase is current.
    if (tournamentId && categoryId) {
      const fetchTournament = async () => {
        const tournamentStore = useTournamentStore.getState()
        try {
          await tournamentStore.fetchTournamentById(tournamentId)
        } finally {
          setLoadingCategoryPhase(false)
        }
      }
      fetchTournament()
    }
  }, [tournamentId, categoryId, navigate])

  useEffect(() => {
    // Redirect if not logged in
    if (!hasProfile || !currentProfile) {
      navigate('/player/profile')
      return
    }
  }, [hasProfile, currentProfile, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    setSuccess(false)

    try {
      if (!name.trim() || !mobile.trim()) {
        throw new Error('Name and mobile number are required')
      }
      if (!gender) {
        throw new Error('Gender is required')
      }

      // Create guest player with default values for missing fields
      const currentYear = new Date().getFullYear();
      const guestData = {
        fullName: name.trim(),
        mobile: mobile.trim(),
        gender,
        dob: '2002-01-01',
        age: 24,
        location: '',
        playingSince: currentYear,
        experienceYears: 0,
        regularPlayer: false,
        courtAcademy: null,
      };
      const guestPlayer = await guestPlayerService.createGuest(guestData)

      // Update draft store
      const tournamentStore = useTournamentStore.getState()
      const tournament = tournamentStore.tournament
      if (!tournament) {
        throw new Error('Tournament not found')
      }

      setTournamentAndCategory(tournamentId, categoryId)
      setCurrentPlayer(currentProfile.id)
      setPartner(guestPlayer, 'GUEST', 'ACCEPTED')

      setSuccess(true)
      // Navigate to confirmation page after a short delay
      setTimeout(() => {
        navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/confirm`)
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
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-center">
          <p className="text-yellow-700">
            Please complete your player profile to continue.
          </p>
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

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-2 rounded mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-2 rounded mb-4">
          Guest partner saved! Redirecting to confirmation...
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-semibold mb-3">
          Add Guest Partner
        </h2>
        <p className="text-sm text-gray-600">
          Please provide the guest partner's name and mobile number.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter full name"
          />
        </div>
        <div>
          <label htmlFor="guest-gender" className="block text-sm font-medium text-gray-700 mb-2">
            Gender <span aria-hidden="true">*</span>
          </label>
          <select
            id="guest-gender"
            value={gender}
            onChange={(e) => setGender(e.target.value as 'MALE' | 'FEMALE' | 'OTHER' | '')}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">Select gender</option>
            <option value="MALE">Male</option>
            <option value="FEMALE">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mobile Number
          </label>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter mobile number"
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Guest Partner'}
        </button>
      </form>

      <div className="mt-6">
        <button
          type="button"
          onClick={() => navigate(`/player/tournaments/${tournamentId}/doubles/${categoryId}/partner`)}
          className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Back to Partner Selection
        </button>
      </div>
    </div>
  )
}

export default GuestPartnerFormPage
