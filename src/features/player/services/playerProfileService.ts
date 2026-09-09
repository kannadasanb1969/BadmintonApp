import { PlayerProfile, PlayerProfileFormValues } from '@/features/player/types/player.types'
import { User } from '@/types/auth.types'
import { calculateAge, calculateExperience, isPlayerProfileComplete } from '@/features/player/utils/profileHelpers'
import { generateId } from '@/utils/helpers'
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'

// Mock player code generator
let mockPlayerCodeCounter = 1000 // start from 1000 so first is PLR001000

const generateMockPlayerCode = (): string => {
  mockPlayerCodeCounter++
  return `PLR${String(mockPlayerCodeCounter).padStart(6, '0')}`
}

// Mock delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

const getWorkerPlayers = async (): Promise<PlayerProfile[]> => {
  const profiles = (await apiClient.get<PlayerProfile[]>('/api/players')).data
  const list = Array.isArray(profiles) ? profiles : []
  usePlayerDirectoryStore.getState().replaceProfiles(list)
  return list
}

export const refreshPlayerDirectory = async (): Promise<PlayerProfile[]> => {
  if (isExplicitMockApiMode) return usePlayerDirectoryStore.getState().profiles
  return getWorkerPlayers()
}

type PlayerWritePayload = Pick<PlayerProfile,
  'fullName' | 'dob' | 'mobile' | 'location' | 'playingSince' | 'regularPlayer' | 'courtAcademy' | 'profileStatus'
> & { gender: PlayerProfile['gender'] | null; profilePhoto: string | null }

const toPlayerWritePayload = (formValues: PlayerProfileFormValues, mobile: string): PlayerWritePayload => ({
  fullName: formValues.fullName.trim(),
  gender: formValues.gender ?? null,
  dob: formValues.dob,
  mobile,
  location: formValues.location.trim(),
  playingSince: formValues.playingSince,
  regularPlayer: Boolean(formValues.regularPlayer),
  courtAcademy: formValues.regularPlayer ? formValues.courtAcademy?.trim() || null : null,
  profilePhoto: typeof formValues.profilePhoto === 'string' ? formValues.profilePhoto : null,
  profileStatus: 'ACTIVE',
})

export const linkPlayerToUser = async (profile: PlayerProfile, user: User): Promise<PlayerProfile> => {
  if (user.role !== 'PLAYER') throw new Error('Only PLAYER accounts can be linked to player profiles')
  if (profile.userId === user.id) return profile
  if (profile.userId) throw new Error('Player is already linked to another user')
  if (profile.mobile !== user.mobile) throw new Error('Player mobile does not match the authenticated user')
  return (await apiClient.post<PlayerProfile>(`/api/players/${profile.id}/link-user`, { userId: user.id })).data
}

export const getPlayerProfileForUser = async (user: User): Promise<PlayerProfile | null> => {
  const profiles = await refreshPlayerDirectory()
  const linkedProfile = profiles.find((profile) => profile.userId === user.id)
  if (linkedProfile) return linkedProfile

  // Legacy onboarding records can predate User ↔ Player linking. Only an exact
  // mobile match for a PLAYER account is eligible for the explicit link route.
  const matchingUnlinkedProfile = profiles.find(
    (profile) => profile.userId == null && profile.mobile === user.mobile,
  )
  return matchingUnlinkedProfile ? linkPlayerToUser(matchingUnlinkedProfile, user) : null
}

export const getPlayerProfile = async (): Promise<PlayerProfile | null> => {
  if (!isExplicitMockApiMode) {
    throw new Error('Load the player profile with the authenticated user')
  }
  await delay(500)
  // In a real app, this would fetch from backend
  // For now, return null to indicate no profile exists
  return null
}

export const createPlayerProfile = async (formValues: PlayerProfileFormValues, userId: string, mobile: string): Promise<PlayerProfile> => {
  if (!isExplicitMockApiMode) {
    const profile = (await apiClient.post<PlayerProfile>('/api/players', toPlayerWritePayload(formValues, mobile))).data
    const linkedProfile = await linkPlayerToUser(profile, { id: userId, mobile, role: 'PLAYER' })
    usePlayerDirectoryStore.getState().upsertProfile(linkedProfile)
    return linkedProfile
  }
  await delay(800)

  const { fullName, gender, dob, location, playingSince, regularPlayer, courtAcademy } = formValues

  // Calculate derived values
  const age = calculateAge(dob)
  const experienceYears = calculateExperience(playingSince)
  const playerCode = generateMockPlayerCode()

  const profile: PlayerProfile = {
    id: generateId(),
    playerCode,
    userId,
    fullName,
    gender,
    dob,
    age,
    mobile, // from auth state
    location,
    playingSince,
    experienceYears,
    regularPlayer: Boolean(regularPlayer), // ensure boolean
    courtAcademy: regularPlayer ? courtAcademy : null,
    profilePhoto: null, // Not stored in Phase 3
    profileStatus: isPlayerProfileComplete({
      id: '',
      playerCode,
      userId,
      fullName,
      dob,
      age,
      mobile,
      location,
      playingSince,
      experienceYears,
      regularPlayer: Boolean(regularPlayer),
      courtAcademy: regularPlayer ? courtAcademy : null,
      profilePhoto: null,
      profileStatus: 'ACTIVE', // placeholder, will be overwritten
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }) ? 'ACTIVE' : 'INCOMPLETE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  return profile
}

export const updatePlayerProfile = async (formValues: PlayerProfileFormValues, existingProfile: PlayerProfile): Promise<PlayerProfile> => {
  if (!isExplicitMockApiMode) {
    const updatedProfile = (await apiClient.put<PlayerProfile>(
      `/api/players/${existingProfile.id}`,
      toPlayerWritePayload(formValues, existingProfile.mobile),
    )).data
    usePlayerDirectoryStore.getState().upsertProfile(updatedProfile)
    return updatedProfile
  }
  await delay(800)

  const { fullName, gender, dob, location, playingSince, regularPlayer, courtAcademy } = formValues

  // Calculate derived values
  const age = calculateAge(dob)
  const experienceYears = calculateExperience(playingSince)

  // Preserve immutable fields and update mutable ones
  const updatedProfile: PlayerProfile = {
    ...existingProfile, // copy all existing fields
    fullName,
    gender,
    dob,
    age,
    location,
    playingSince,
    experienceYears,
    regularPlayer: Boolean(regularPlayer), // ensure boolean
    courtAcademy: regularPlayer ? courtAcademy : null,
    profilePhoto: null, // Not stored in Phase 3
    profileStatus: isPlayerProfileComplete({
      ...existingProfile,
      fullName,
      dob,
      age,
      location,
      playingSince,
      experienceYears,
      regularPlayer: Boolean(regularPlayer),
      courtAcademy: regularPlayer ? courtAcademy : null,
      profilePhoto: null
    }) ? 'ACTIVE' : 'INCOMPLETE',
    updatedAt: new Date().toISOString()
  }

  return updatedProfile
}
