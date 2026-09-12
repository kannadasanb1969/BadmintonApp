import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthState, Role } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useNotificationStore } from '@/features/notifications/services/notificationStore'
import { isAccessTokenExpired } from '@/features/auth/utils/accessToken'

interface AuthStore extends AuthState {
  sessionMessage: string | null
  login: (user: User, accessToken?: string) => void
  logout: () => void
  expireSession: () => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      sessionMessage: null,
      login: (user: User, accessToken?: string) => set((state) => ({
        user,
        isAuthenticated: true,
        sessionMessage: null,
        // A hard-refresh revalidation supplies only the user record. Keep the
        // existing persisted token in that case.
        ...(accessToken ? { accessToken } : state.accessToken ? { accessToken: state.accessToken } : {}),
      })),
      logout: () => {
        set({ user: null, isAuthenticated: false, accessToken: null, sessionMessage: null })
        usePlayerProfileStore.getState().clearProfile()
        useNotificationStore.getState().clearAllNotifications()
      },
      expireSession: () => {
        set({ user: null, isAuthenticated: false, accessToken: null, sessionMessage: 'Your session expired. Please log in again.' })
        usePlayerProfileStore.getState().clearProfile()
        useNotificationStore.getState().clearAllNotifications()
      }
    }),
    {
      name: 'badminton-auth',
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AuthStore>
        if (!state.isAuthenticated) return { ...state, sessionMessage: null }
        if (!state.accessToken || isAccessTokenExpired(state.accessToken)) {
          return { ...state, user: null, isAuthenticated: false, accessToken: null, sessionMessage: 'Your session expired. Please log in again.' }
        }
        return { ...state, sessionMessage: null }
      },
    }
  )
)
