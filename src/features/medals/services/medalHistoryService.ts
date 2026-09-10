import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { MedalHistory } from '@/features/medals/types/medalHistory.types'
import { useMedalHistoryStore } from '@/features/medals/store/medalHistoryStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useGuestPlayerStore } from '@/features/player/store/guestPlayerStore'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { guestPlayerService } from '@/features/player/services/guestPlayerService'
import { refreshPlayerDirectory } from '@/features/player/services/playerProfileService'

type WorkerMedal = Omit<MedalHistory, 'playerId' | 'playerCode' | 'playerName' | 'tournamentCode' | 'tournamentName' | 'categoryName'> & { playerId?: string | null; guestPlayerId?: string | null }

const fromWorker = async (raw: WorkerMedal): Promise<MedalHistory> => {
  const isGuest = raw.playerType === 'GUEST'; const playerId = isGuest ? raw.guestPlayerId ?? '' : raw.playerId ?? ''
  let identity = isGuest ? useGuestPlayerStore.getState().getGuestById(playerId) : usePlayerDirectoryStore.getState().getProfileById(playerId)
  if (!identity && playerId) {
    identity = isGuest ? await guestPlayerService.getGuestById(playerId) : (await refreshPlayerDirectory()).find((player) => player.id === playerId)
  }
  const tournament = await tournamentService.getTournamentById(raw.tournamentId)
  const category = tournament?.categories.find((item) => item.id === raw.categoryId)
  return { ...raw, playerId, playerCode: isGuest ? (identity as { guestCode?: string } | undefined)?.guestCode ?? playerId : (identity as { playerCode?: string } | undefined)?.playerCode ?? playerId, playerName: identity?.fullName ?? playerId, tournamentCode: tournament?.tournamentCode ?? raw.tournamentId, tournamentName: tournament?.name ?? raw.tournamentId, categoryName: category?.name ?? raw.categoryId }
}

const cache = (medals: MedalHistory[]) => useMedalHistoryStore.getState().replaceMedalHistory(medals)
const list = async (path: string) => {
  const data = (await apiClient.get<WorkerMedal[]>(path)).data
  const medals = await Promise.all((Array.isArray(data) ? data : []).map(fromWorker)); cache(medals); return medals
}

export const medalHistoryService = {
  getMedals: async (): Promise<MedalHistory[]> => isExplicitMockApiMode ? useMedalHistoryStore.getState().medalHistory : list('/api/medals'),
  getMedal: async (id: string): Promise<MedalHistory | undefined> => {
    if (isExplicitMockApiMode) return useMedalHistoryStore.getState().medalHistory.find((item) => item.id === id)
    const medal = await fromWorker((await apiClient.get<WorkerMedal>(`/api/medals/${id}`)).data)
    cache([...useMedalHistoryStore.getState().medalHistory.filter((item) => item.id !== id), medal]); return medal
  },
  getPlayerMedals: async (id: string): Promise<MedalHistory[]> => isExplicitMockApiMode ? useMedalHistoryStore.getState().getPlayerMedalHistory(id) : list(`/api/medals/player/${id}`),
  getTournamentMedals: async (id: string): Promise<MedalHistory[]> => isExplicitMockApiMode ? useMedalHistoryStore.getState().getTournamentMedalHistory(id) : list(`/api/medals/tournament/${id}`),
  getCategoryMedals: async (id: string): Promise<MedalHistory[]> => isExplicitMockApiMode ? useMedalHistoryStore.getState().medalHistory.filter((item) => item.categoryId === id) : list(`/api/medals/category/${id}`),
}
