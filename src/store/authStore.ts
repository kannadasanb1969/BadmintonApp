import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthState, Role } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useNotificationStore } from '@/features/notifications/services/notificationStore'

interface AuthStore extends AuthState {
  login: (user: User, accessToken?: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      login: (user: User, accessToken?: string) => set((state) => ({
        user,
        isAuthenticated: true,
        // A hard-refresh revalidation supplies only the user record. Keep the
        // existing persisted token in that case.
        ...(accessToken ? { accessToken } : state.accessToken ? { accessToken: state.accessToken } : {}),
      })),
      logout: () => {
        set({ user: null, isAuthenticated: false, accessToken: null })
        usePlayerProfileStore.getState().clearProfile()
        useNotificationStore.getState().clearAllNotifications()
      }
    }),
    {
      name: 'badminton-auth'
    }
  )
)
