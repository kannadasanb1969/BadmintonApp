import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User, AuthState, Role } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useNotificationStore } from '@/features/notifications/services/notificationStore'
import { isAccessTokenExpired } from '@/features/auth/utils/accessToken'

interface AuthStore extends AuthState {
  hasHydrated: boolean
  sessionMessage: string | null
  login: (user: User, accessToken?: string) => void
  logout: () => void
  expireSession: () => void
  setHasHydrated: (hasHydrated: boolean) => void
}

type PersistedAuthState = Pick<AuthStore, 'user' | 'isAuthenticated' | 'accessToken'> & {
  sessionMessage?: string | null
}

export const useAuthStore = create<AuthStore>()(
  persist<AuthStore, [], [], PersistedAuthState>(
    (set) => ({
      user: null,
      isAuthenticated: false,
      accessToken: null,
      hasHydrated: false,
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
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'badminton-auth',
      version: 1,
      migrate: (persistedState) => {
        const state = persistedState as Partial<AuthStore>
        if (!state.isAuthenticated) {
          return { user: null, isAuthenticated: false, accessToken: null, sessionMessage: null }
        }
        if (!state.user || !state.accessToken || isAccessTokenExpired(state.accessToken)) {
          return { user: null, isAuthenticated: false, accessToken: null, sessionMessage: 'Your session expired. Please log in again.' }
        }
        return { user: state.user, isAuthenticated: true, accessToken: state.accessToken, sessionMessage: null }
      },
      partialize: ({ user, isAuthenticated, accessToken }) => ({
        user,
        isAuthenticated,
        accessToken,
        sessionMessage: null,
      }),
      onRehydrateStorage: () => (state) => {
        if (state?.isAuthenticated && isAccessTokenExpired(state.accessToken)) {
          state.expireSession()
        }
        state?.setHasHydrated(true)
      },
    }
  )
)
