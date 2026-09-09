import { Role } from '@/types/auth.types'

export type ProfileStatus = 'INCOMPLETE' | 'ACTIVE'
export type PlayerGender = 'MALE' | 'FEMALE' | 'OTHER'

export interface PlayerProfile {
  id: string // database/internal ID
  playerCode: string // e.g., PLR000001
  userId: string | null // references auth user ID when linked
  fullName: string
  gender?: PlayerGender
  dob: string // YYYY-MM-DD
  age: number // calculated from dob
  mobile: string // from auth, read-only in profile
  location: string
  playingSince: number // year, e.g., 2018
  experienceYears: number // calculated from playingSince
  regularPlayer: boolean
  courtAcademy: string | null // only if regularPlayer is true
  profilePhoto: string | null // base64 or URL
  profileStatus: ProfileStatus
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

export interface PlayerProfileFormValues {
  fullName: string
  gender?: PlayerGender
  dob: string // YYYY-MM-DD
  location: string
  playingSince: number // year
  regularPlayer: boolean
  courtAcademy: string | null
  profilePhoto: File | string | null // File for upload, string for preview (base64 or URL)
}
