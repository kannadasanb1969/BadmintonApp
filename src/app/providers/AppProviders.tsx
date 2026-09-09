import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect } from 'react'
import { hydrateAndSyncDomainData } from '@/api/domainDataSync'
import { isExplicitMockApiMode } from '@/api/apiClient'
import { getCurrentUser } from '@/features/auth/services/authService'
import { getPlayerProfileForUser, refreshPlayerDirectory } from '@/features/player/services/playerProfileService'
import { useAuthStore } from '@/store/authStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { registrationService } from '@/features/registrations/services/registrationService'
import { teamService } from '@/features/teams/services/teamService'
import { fixtureService } from '@/features/fixtures/services/fixtureService'
import { resultService } from '@/features/results/services/resultService'
import { medalHistoryService } from '@/features/medals/services/medalHistoryService'
import { notificationApiService } from '@/features/notifications/services/notificationApiService'

const queryClient = new QueryClient()

export function AppProviders({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void hydrateAndSyncDomainData()
    if (isExplicitMockApiMode) return

    void refreshPlayerDirectory()
    void tournamentService.getTournaments()
    void teamService.getTeams()
    void fixtureService.getFixtures()
    void resultService.getResults()
    void medalHistoryService.getMedals()
    const session = useAuthStore.getState()
    if (!session.user || !session.isAuthenticated) return
    void notificationApiService.refresh(session.user.id)

    void getCurrentUser(session.user.id)
      .then(async (user) => {
        useAuthStore.getState().login(user)
        if (user.role !== 'PLAYER') return
        const profile = await getPlayerProfileForUser(user)
        if (profile) {
          usePlayerProfileStore.getState().createProfile(profile)
          await registrationService.getPlayerRegistrations(profile.id)
        }
        else usePlayerProfileStore.getState().clearProfile()
      })
      .catch(() => {
        // Preserve the persisted session on transient network failures. Login and
        // profile mutations still surface the Worker error to the calling UI.
      })
  }, [])
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
