import { Tournament, TournamentCategory, TournamentFormValues } from '@/features/tournaments/types/tournament.types'
import { User } from '@/types/auth.types'
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useAuthStore } from '@/store/authStore'
import { notificationService } from '@/features/notifications/services/notificationService'

type WorkerCategory = Omit<TournamentCategory, 'genderEligibility'> & { gender?: 'MALE' | 'FEMALE' | 'ANY' | 'MIXED'; genderEligibility?: TournamentCategory['genderEligibility'] }
type WorkerTournament = Omit<Tournament, 'tournamentDate' | 'registrationCloseDate' | 'venueName' | 'venueAddress' | 'format' | 'categories'> & {
  startDate?: string; registrationEndDate?: string | null; venue?: string | null; location?: string | null
  fixtureFormat?: string; categories?: WorkerCategory[]
}

const toGenderEligibility = (value?: WorkerCategory['gender'] | TournamentCategory['genderEligibility']): TournamentCategory['genderEligibility'] | undefined => {
  if (value === 'MALE') return 'MEN_ONLY'
  if (value === 'FEMALE') return 'WOMEN_ONLY'
  if (value === 'ANY' || value === 'MIXED') return 'OPEN'
  return value
}

const toFormat = (value?: string): Tournament['format'] => {
  if (value === 'GROUP_KNOCKOUT') return 'LEAGUE_KNOCKOUT'
  return value === 'LEAGUE' || value === 'LEAGUE_KNOCKOUT' ? value : 'KNOCKOUT'
}

const fromWorkerTournament = (value: WorkerTournament): Tournament => ({
  ...value,
  description: value.description ?? '',
  tournamentDate: value.startDate ?? '',
  registrationCloseDate: value.registrationEndDate ?? '',
  venueName: value.venue ?? '',
  venueAddress: value.location ?? '',
  format: toFormat(value.fixtureFormat),
  categories: (Array.isArray(value.categories) ? value.categories : []).map((category) => ({
    ...category,
    genderEligibility: toGenderEligibility(category.genderEligibility ?? category.gender),
  })),
  generalRules: Array.isArray(value.generalRules) ? value.generalRules : [],
}) as Tournament

const cacheTournament = (tournament: Tournament) => {
  useTournamentStore.setState((state) => ({
    tournament: state.tournament?.id === tournament.id ? tournament : state.tournament,
    tournaments: [...state.tournaments.filter((item) => item.id !== tournament.id), tournament],
  }))
}

const workerPayload = (data: Partial<TournamentFormValues>, organizerId?: string) => ({
  ...(organizerId ? { organizerId } : {}),
  ...data,
  categories: data.categories?.map((category) => ({
    ...category,
    genderEligibility: category.genderEligibility === 'MEN_ONLY' ? 'MALE' : category.genderEligibility === 'WOMEN_ONLY' ? 'FEMALE' : 'ANY',
  })),
  generalRules: data.generalRules,
  format: data.format === 'LEAGUE_KNOCKOUT' ? 'GROUP_KNOCKOUT' : data.format,
})

const currentActor = (role: 'ORGANIZER' | 'ADMIN') => {
  const user = useAuthStore.getState().user
  if (!user || user.role !== role) throw new Error(`${role} authentication is required`)
  return user
}

export const tournamentService = {
  getTournaments: async (): Promise<Tournament[]> => {
    if (isExplicitMockApiMode) return [...useTournamentStore.getState().tournaments]
    const response = (await apiClient.get<WorkerTournament[]>('/api/tournaments')).data
    const tournaments = (Array.isArray(response) ? response : []).map(fromWorkerTournament)
    useTournamentStore.setState({ tournaments })
    return tournaments
  },

  getTournamentById: async (id: string): Promise<Tournament | null> => {
    if (isExplicitMockApiMode) return useTournamentStore.getState().tournaments.find((item) => item.id === id) ?? null
    const tournament = fromWorkerTournament((await apiClient.get<WorkerTournament>(`/api/tournaments/${id}`)).data)
    cacheTournament(tournament)
    return tournament
  },

  createTournament: async (data: TournamentFormValues, organizer: User): Promise<Tournament> => {
    if (organizer.role !== 'ORGANIZER') throw new Error('Only organizers can create tournaments')
    if (!isExplicitMockApiMode) {
      const tournament = fromWorkerTournament((await apiClient.post<WorkerTournament>('/api/tournaments', workerPayload(data, organizer.id))).data)
      cacheTournament(tournament)
      return tournament
    }
    return useTournamentStore.getState().createTournament(data, organizer)
  },

  updateTournament: async (id: string, data: Partial<TournamentFormValues>): Promise<Tournament> => {
    if (!isExplicitMockApiMode) {
      const actor = currentActor('ORGANIZER')
      const existing = data.categories ? await tournamentService.getTournamentById(id) : null
      const payloadData = existing && data.categories ? {
        ...data,
        // The form intentionally omits database category IDs. Retain them by
        // position so a normal edit updates a category instead of duplicating it.
        categories: data.categories.map((category, index) => ({
          ...existing.categories[index],
          ...category,
          id: existing.categories[index]?.id,
        })),
      } : data
      const tournament = fromWorkerTournament((await apiClient.put<WorkerTournament>(`/api/tournaments/${id}`, workerPayload(payloadData, actor.id))).data)
      cacheTournament(tournament)
      return tournament
    }
    return useTournamentStore.getState().updateTournament(id, data)
  },

  closeCategoryRegistration: async (tournamentId: string, categoryId: string): Promise<Tournament> => {
    if (isExplicitMockApiMode) throw new Error('Use the local tournament store to close registration in mock mode')
    const user = useAuthStore.getState().user
    if (!user || (user.role !== 'ORGANIZER' && user.role !== 'ADMIN')) throw new Error('Organizer or admin authentication is required')
    await apiClient.post(`/api/tournaments/${tournamentId}/categories/${categoryId}/close`, { organizerUserId: user.id })
    return tournamentService.getTournamentById(tournamentId)
  },

  submitTournamentForApproval: async (id: string): Promise<Tournament> => {
    if (!isExplicitMockApiMode) {
      const organizer = currentActor('ORGANIZER')
      await apiClient.post(`/api/tournaments/${id}/submit`, { organizerId: organizer.id })
      // Use the post-transition GET as the source of truth. A workflow route
      // can acknowledge success before returning a fully refreshed record.
      const tournament = await tournamentService.getTournamentById(id)
      if (!tournament) throw new Error('Tournament was not found after submission')
      return tournament
    }
    const tournament = useTournamentStore.getState().submitTournamentForApproval(id)
    await notificationService.notifyTournamentSubmitted(id)
    return tournament
  },

  approveTournament: async (id: string, adminId?: string): Promise<Tournament> => {
    if (!isExplicitMockApiMode) {
      const admin = currentActor('ADMIN')
      const tournament = fromWorkerTournament((await apiClient.post<WorkerTournament>(`/api/tournaments/${id}/approve`, { adminUserId: admin.id })).data)
      cacheTournament(tournament)
      return tournament
    }
    const tournament = useTournamentStore.getState().approveTournament(id, adminId)
    await notificationService.notifyTournamentPublished(id)
    return tournament
  },

  rejectTournament: async (id: string, rejectionReason: string, adminId?: string): Promise<Tournament> => {
    if (!isExplicitMockApiMode) {
      const admin = currentActor('ADMIN')
      const tournament = fromWorkerTournament((await apiClient.post<WorkerTournament>(`/api/tournaments/${id}/reject`, { adminUserId: admin.id, reason: rejectionReason })).data)
      cacheTournament(tournament)
      return tournament
    }
    const tournament = useTournamentStore.getState().rejectTournament(id, rejectionReason, adminId)
    await notificationService.notifyTournamentRejected(id, rejectionReason)
    return tournament
  },

  publishTournament: async (id: string): Promise<Tournament> => {
    if (!isExplicitMockApiMode) {
      const admin = currentActor('ADMIN')
      const tournament = fromWorkerTournament((await apiClient.post<WorkerTournament>(`/api/tournaments/${id}/publish`, { adminUserId: admin.id })).data)
      cacheTournament(tournament)
      return tournament
    }
    const tournament = useTournamentStore.getState().publishTournament(id)
    await notificationService.notifyTournamentPublished(id)
    return tournament
  },

  getTournamentsByOrganizer: async (organizerId: string): Promise<Tournament[]> => {
    const tournaments = await tournamentService.getTournaments()
    return tournaments.filter((item) => item.organizerId === organizerId)
  },

  getAdminReviewTournaments: async (): Promise<Tournament[]> => {
    const tournaments = await tournamentService.getTournaments()
    return tournaments.filter((item) => item.status === 'PENDING_ADMIN_APPROVAL')
  },
}
