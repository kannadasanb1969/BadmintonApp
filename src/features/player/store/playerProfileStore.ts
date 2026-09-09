import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { PlayerProfile } from '@/features/player/types/player.types'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'

interface PlayerProfileState {
  profile: PlayerProfile | null
  hasProfile: boolean
  createProfile: (profile: PlayerProfile) => void
  updateProfile: (profile: PlayerProfile) => void
  clearProfile: () => void
}

export const usePlayerProfileStore = create<PlayerProfileState>()(
  persist(
    (set, get) => ({
      profile: null,
      hasProfile: false,
      createProfile: (profile) => {
        set({ profile, hasProfile: true })
        // Upsert into player directory
        usePlayerDirectoryStore.getState().upsertProfile(profile)
      },
      updateProfile: (profile) => {
        set({ profile })
        // Upsert into player directory
        usePlayerDirectoryStore.getState().upsertProfile(profile)
      },
      clearProfile: () => set({ profile: null, hasProfile: false })
    }),
    {
      name: 'badminton-player-profile', partialize: () => ({}), skipHydration: true
    }
  )
)
