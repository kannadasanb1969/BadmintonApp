import { Registration } from '@/features/registrations/types/registration.types'
import { PlayerProfile } from '@/features/player/types/player.types'
import { GuestPlayer } from '@/features/player/types/guest.player.types'
import { PartnerStatus } from '@/features/teams/types/team.types'
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useGuestPlayerStore } from '@/features/player/store/guestPlayerStore'

type WorkerRegistration = { id: string; registrationCode: string; tournamentId: string; categoryId: string; playerId: string; eventType: 'SINGLES' | 'DOUBLES'; status: Registration['status']; registeredAt: string; cancelledAt?: string; teamId?: string | null; partnerId?: string | null; partnerType?: 'PLAYER' | 'GUEST' | null }
type Partner = PlayerProfile | GuestPlayer

const partnerType = (partner: Partner): 'PLAYER' | 'GUEST' => 'guestCode' in partner ? 'GUEST' : 'PLAYER'

const enrich = async (registration: WorkerRegistration): Promise<Registration> => {
  const tournament = await tournamentService.getTournamentById(registration.tournamentId)
  const player = usePlayerDirectoryStore.getState().getProfileById(registration.playerId)
  const partner = registration.partnerId ? (registration.partnerType === 'GUEST'
    ? useGuestPlayerStore.getState().getGuestById(registration.partnerId)
    : usePlayerDirectoryStore.getState().getProfileById(registration.partnerId)) : undefined
  const category = tournament?.categories.find(item => item.id === registration.categoryId)
  const { partnerType: _workerPartnerType, teamId: _teamId, ...base } = registration
  return {
    ...base,
    tournamentCode: tournament?.tournamentCode ?? '', categoryName: category?.name ?? '',
    playerCode: player?.playerCode ?? '', playerName: player?.fullName ?? '',
    status: registration.status,
    ...(partner ? { partnerId: partner.id, partnerCode: 'guestCode' in partner ? partner.guestCode : partner.playerCode, partnerName: partner.fullName, partnerType: 'guestCode' in partner ? 'GUEST' : 'FULL' } : {}),
  }
}

const cache = (registration: Registration) => useRegistrationStore.getState().upsertRegistration(registration)
const actorPayload = (player: PlayerProfile) => ({ ...(player.userId ? { userId: player.userId } : {}) })

export const registrationService = {
  registerPlayer: async (tournamentId: string, categoryId: string, player: PlayerProfile): Promise<Registration> => {
    if (isExplicitMockApiMode) throw new Error('Use the Worker API for registration')
    const created = (await apiClient.post<WorkerRegistration>('/api/registrations', { tournamentId, categoryId, playerId: player.id, ...actorPayload(player) })).data
    const registration = await enrich(created); cache(registration); return registration
  },
  registerDoublesTeam: async (tournamentId: string, categoryId: string, player: PlayerProfile, partner: Partner, status: PartnerStatus): Promise<Registration> => {
    if (status !== 'ACCEPTED') throw new Error('Partner has not accepted the invitation')
    if (isExplicitMockApiMode) throw new Error('Use the Worker API for registration')
    const created = (await apiClient.post<WorkerRegistration>('/api/registrations', { tournamentId, categoryId, playerId: player.id, partner: { id: partner.id, type: partnerType(partner) }, ...actorPayload(player) })).data
    const registration = await enrich(created); cache(registration); return registration
  },
  getPlayerRegistrations: async (playerId: string): Promise<Registration[]> => {
    if (isExplicitMockApiMode) return useRegistrationStore.getState().getPlayerRegistrations(playerId)
    const rows = (await apiClient.get<WorkerRegistration[]>(`/api/registrations/player/${playerId}`)).data
    const registrations = await Promise.all((Array.isArray(rows) ? rows : []).map(enrich))
    useRegistrationStore.getState().replaceRegistrations(registrations); return registrations
  },
  getTournamentRegistrations: async (tournamentId: string): Promise<Registration[]> => {
    if (isExplicitMockApiMode) return useRegistrationStore.getState().getTournamentRegistrations(tournamentId)
    const rows = (await apiClient.get<WorkerRegistration[]>(`/api/registrations/tournament/${tournamentId}`)).data
    const registrations = await Promise.all((Array.isArray(rows) ? rows : []).map(enrich))
    useRegistrationStore.getState().replaceRegistrations(registrations); return registrations
  },
  isPlayerRegistered: async (playerId: string, tournamentId: string, categoryId: string) => (await registrationService.getPlayerRegistrations(playerId)).some(item => item.tournamentId === tournamentId && item.categoryId === categoryId && item.status === 'REGISTERED'),
  cancelRegistration: async (registrationId: string): Promise<void> => {
    if (isExplicitMockApiMode) { useRegistrationStore.getState().cancelRegistration(registrationId); return }
    const profile = usePlayerDirectoryStore.getState().getProfileById(useRegistrationStore.getState().registrations.find(item => item.id === registrationId)?.playerId ?? '')
    const row = (await apiClient.post<WorkerRegistration>(`/api/registrations/${registrationId}/cancel`, profile ? actorPayload(profile) : {})).data
    cache(await enrich(row))
  },
  createRegistration: async (data: Omit<Registration, 'id' | 'registrationCode'>): Promise<Registration> => {
    const player = usePlayerDirectoryStore.getState().getProfileById(data.playerId)
    if (!player) throw new Error('Player not found')
    return data.partnerId ? registrationService.registerDoublesTeam(data.tournamentId, data.categoryId, player, (data.partnerType === 'GUEST' ? useGuestPlayerStore.getState().getGuestById(data.partnerId) : usePlayerDirectoryStore.getState().getProfileById(data.partnerId))!, 'ACCEPTED') : registrationService.registerPlayer(data.tournamentId, data.categoryId, player)
  },
}
