import apiClient, { isExplicitMockApiMode } from '@/api/apiClient'
import { CategoryResult } from '@/features/fixtures/types/fixture.types'
import { useResultStore } from '@/features/fixtures/store/resultStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { tournamentService } from '@/features/tournaments/services/tournamentService'
import { teamService } from '@/features/teams/services/teamService'
import { refreshPlayerDirectory } from '@/features/player/services/playerProfileService'

type WorkerResult = Omit<CategoryResult, 'tournamentCode' | 'tournamentName' | 'categoryName' | 'winnerParticipantCode' | 'winnerParticipantName' | 'runnerUpParticipantCode' | 'runnerUpParticipantName'> & { winnerParticipantType?: 'PLAYER' | 'TEAM'; runnerUpParticipantType?: 'PLAYER' | 'TEAM' }

const participant = async (id: string, type?: 'PLAYER' | 'TEAM') => {
  if (type === 'TEAM') {
    const team = useTeamStore.getState().getTeamById(id) ?? await teamService.getTeamById(id)
    return { code: team?.teamCode ?? id, name: team ? `${team.player1Name} / ${team.player2Name}` : id }
  }
  const player = usePlayerDirectoryStore.getState().getProfileById(id) ?? (await refreshPlayerDirectory()).find((item) => item.id === id)
  return { code: player?.playerCode ?? id, name: player?.fullName ?? id }
}

const fromWorker = async (raw: WorkerResult): Promise<CategoryResult> => {
  const tournament = await tournamentService.getTournamentById(raw.tournamentId)
  const category = tournament?.categories.find((item) => item.id === raw.categoryId)
  const winner = await participant(raw.winnerParticipantId, raw.winnerParticipantType)
  const runnerUp = await participant(raw.runnerUpParticipantId, raw.runnerUpParticipantType)
  return { ...raw, tournamentCode: tournament?.tournamentCode ?? raw.tournamentId, tournamentName: tournament?.name ?? raw.tournamentId, categoryName: category?.name ?? raw.categoryId, winnerParticipantCode: winner.code, winnerParticipantName: winner.name, runnerUpParticipantCode: runnerUp.code, runnerUpParticipantName: runnerUp.name }
}

const cache = (results: CategoryResult[]) => useResultStore.getState().replaceResults(results)
const list = async (path: string) => {
  const data = (await apiClient.get<WorkerResult[]>(path)).data
  const results = await Promise.all((Array.isArray(data) ? data : []).map(fromWorker)); cache(results); return results
}

export const resultService = {
  getResults: async (): Promise<CategoryResult[]> => isExplicitMockApiMode ? useResultStore.getState().results : list('/api/results'),
  getResult: async (id: string): Promise<CategoryResult | undefined> => {
    if (isExplicitMockApiMode) return useResultStore.getState().results.find((item) => item.id === id)
    const result = await fromWorker((await apiClient.get<WorkerResult>(`/api/results/${id}`)).data)
    cache([...useResultStore.getState().results.filter((item) => item.id !== id), result]); return result
  },
  getResultsByTournament: async (id: string): Promise<CategoryResult[]> => isExplicitMockApiMode ? useResultStore.getState().getTournamentResults(id) : list(`/api/results/tournament/${id}`),
  getResultsByCategory: async (id: string): Promise<CategoryResult[]> => isExplicitMockApiMode ? useResultStore.getState().results.filter((item) => item.categoryId === id) : list(`/api/results/category/${id}`),
  generateResult: async (tournamentId: string, categoryId: string, requestedByUserId: string): Promise<CategoryResult> => {
    if (isExplicitMockApiMode) throw new Error('Result generation is handled by the mock match flow.')
    const result = await fromWorker((await apiClient.post<WorkerResult>('/api/results/generate', { tournamentId, categoryId, requestedByUserId })).data)
    const results = await resultService.getResultsByTournament(tournamentId)
    cache(results); return result
  },
}
