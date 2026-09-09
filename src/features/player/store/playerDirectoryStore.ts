import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PlayerProfile } from '@/features/player/types/player.types'

const normalizeMobile = (mobile: string): string => {
  const digits = mobile.replace(/\D/g, '')
  if (digits.length > 10) {
    return digits.slice(-10)
  }
  return digits
}

interface PlayerDirectoryState {
  profiles: PlayerProfile[]
  replaceProfiles: (profiles: PlayerProfile[]) => void
  upsertProfile: (profile: PlayerProfile) => void
  searchProfiles: (query: string) => PlayerProfile[]
  getProfileById: (id: string) => PlayerProfile | undefined
  getProfileByMobileExact: (mobile: string) => PlayerProfile | undefined
}

export const usePlayerDirectoryStore = create<PlayerDirectoryState>()(
  persist(
    (set, get) => ({
      profiles: [],
      replaceProfiles: (profiles) => set({ profiles: Array.isArray(profiles) ? profiles : [] }),
      upsertProfile: (profile) => {
        set((state) => {
          const existingIndex = state.profiles.findIndex((p) => p.id === profile.id)
          if (existingIndex >= 0) {
            const newProfiles = [...state.profiles]
            newProfiles[existingIndex] = profile
            return { profiles: newProfiles }
          } else {
            return { profiles: [...state.profiles, profile] }
          }
        })
      },
      searchProfiles: (query) => {
        const { profiles } = get()
        if (!query) return []
        const lowerQuery = query.toLowerCase()
        return profiles.filter(
          (profile) =>
            profile.profileStatus === 'ACTIVE' &&
            (profile.fullName.toLowerCase().includes(lowerQuery) ||
              profile.playerCode.toLowerCase().includes(lowerQuery) ||
              profile.mobile.toLowerCase().includes(lowerQuery))
        )
      },
      getProfileById: (id) => {
        return get().profiles.find((p) => p.id === id)
      },
      getProfileByMobileExact: (mobile) => {
        const normalizedQuery = normalizeMobile(mobile)
        return get().profiles.find(
          (p) =>
            p.profileStatus === 'ACTIVE' && normalizeMobile(p.mobile) === normalizedQuery
        )
      },
    }),
    {
      name: 'badminton-player-directory', partialize: () => ({}), skipHydration: true
    }
  )
)
