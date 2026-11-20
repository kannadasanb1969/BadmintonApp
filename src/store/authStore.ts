import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { AuthState, User } from '@/types/auth.types'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useNotificationStore } from '@/features/notifications/services/notificationStore'
import { isAccessTokenExpired } from '@/features/auth/utils/accessToken'
import { queryClient } from '@/api/queryClient'

interface AuthStore extends AuthState {
  refreshToken: string | null
  sessionRevision: number
  hasHydrated: boolean
  sessionMessage: string | null
  login: (user: User, accessToken: string, refreshToken?: string | null) => void
  logout: () => void
  expireSession: () => void
  setHasHydrated: (hasHydrated: boolean) => void
}

type PersistedAuthState = Pick<AuthStore, 'user' | 'isAuthenticated' | 'accessToken' | 'refreshToken'>

const signedOut: PersistedAuthState = {
  user: null,
  isAuthenticated: false,
  accessToken: null,
  refreshToken: null,
}

const clearAccountData = () => {
  usePlayerProfileStore.getState().clearProfile()
  useNotificationStore.getState().clearAllNotifications()
  queryClient.clear()
}

export const useAuthStore = create<AuthStore>()(
  persist<AuthStore, [], [], PersistedAuthState>(
    (set) => ({
      ...signedOut,
      sessionRevision: 0,
      hasHydrated: false,
      sessionMessage: null,
      login: (user, accessToken, refreshToken = null) => {
        clearAccountData()
        set((state) => ({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
          sessionRevision: state.sessionRevision + 1,
          sessionMessage: null,
        }))
      },
      logout: () => {
        set((state) => ({ ...signedOut, sessionRevision: state.sessionRevision + 1, sessionMessage: null }))
        clearAccountData()
      },
      expireSession: () => {
        set((state) => ({
          ...signedOut,
          sessionRevision: state.sessionRevision + 1,
          sessionMessage: 'Your session expired. Please log in again.',
        }))
        clearAccountData()
      },
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
    }),
    {
      name: 'badminton-auth',
      version: 1,
      storage: createJSONStorage(() => {
        const session = sessionStorage
        const legacy = localStorage
        return {
          getItem: (key) => session.getItem(key) ?? legacy.getItem(key),
          setItem: (key, value) => {
            session.setItem(key, value)
            legacy.removeItem(key)
          },
          removeItem: (key) => {
            session.removeItem(key)
            legacy.removeItem(key)
          },
        }
      }),
      merge: (persisted, current) => {
        const state = persisted as Partial<PersistedAuthState> | undefined
        if (!state?.isAuthenticated || !state.user || !state.accessToken) return { ...current, ...signedOut }
        return {
          ...current,
          user: state.user,
          isAuthenticated: true,
          accessToken: state.accessToken,
          refreshToken: state.refreshToken ?? null,
        }
      },
      partialize: ({ user, isAuthenticated, accessToken, refreshToken }) => ({
        user,
        isAuthenticated,
        accessToken,
        refreshToken,
      }),
      onRehydrateStorage: (current) => (state) => {
        if (state?.isAuthenticated && !state.refreshToken && isAccessTokenExpired(state.accessToken)) {
          state.expireSession()
        }
        current.setHasHydrated(true)
      },
    },
  ),
)
