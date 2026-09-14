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
// Resolve a list in bounded bulk requests, never one request per result/team.
const pendingLists = new Map<string, Promise<CategoryResult[]>>()
const list = (path: string): Promise<CategoryResult[]> => {
  const pending = pendingLists.get(path)
  if (pending) return pending
  const request = (async () => {
    const data = (await apiClient.get<WorkerResult[]>(path)).data
    const rows = Array.isArray(data) ? data : []
    if (!rows.length) { cache([]); return [] }
    type Identity = { id: string; fullName: string }
    type Member = { id: string; type: string }
    type ResultTeam = { id: string; teamCode: string; player1: Member; player2: Member }
    type ResultTournament = { id: string; name: string; tournamentCode: string; categories: { id: string; name: string }[] }
    const hasTeams = rows.some(row => row.winnerParticipantType === 'TEAM' || row.runnerUpParticipantType === 'TEAM')
    const [tournaments, players, teams, guests] = await Promise.all([
      apiClient.get<ResultTournament[]>('/api/tournaments').then(response => response.data),
      apiClient.get<(Identity & { playerCode: string })[]>('/api/players').then(response => response.data),
      hasTeams ? apiClient.get<ResultTeam[]>('/api/teams').then(response => response.data) : Promise.resolve([]),
      hasTeams ? apiClient.get<Identity[]>('/api/guest-players').then(response => response.data) : Promise.resolve([]),
    ])
    const tournamentMap = new Map(tournaments.map(item => [item.id, item]))
    const playerMap = new Map(players.map(item => [item.id, item]))
    const teamMap = new Map(teams.map(item => [item.id, item]))
    const guestMap = new Map(guests.map(item => [item.id, item]))
    const resolveParticipant = (id: string, type?: string) => {
      if (type === 'TEAM') {
        const team = teamMap.get(id)
        const memberName = (member?: Member) => member && (member.type === 'GUEST' ? guestMap : playerMap).get(member.id)?.fullName
        const first = memberName(team?.player1), second = memberName(team?.player2)
        return { name: first && second ? `${first} / ${second}` : '', code: team?.teamCode ?? '' }
      }
      const player = playerMap.get(id)
      return { name: player?.fullName ?? '', code: player?.playerCode ?? '' }
    }
    const results = rows.map(raw => {
      const tournament = tournamentMap.get(raw.tournamentId)
      const winner = resolveParticipant(raw.winnerParticipantId, raw.winnerParticipantType)
      const runnerUp = resolveParticipant(raw.runnerUpParticipantId, raw.runnerUpParticipantType)
      return { ...raw, tournamentCode: tournament?.tournamentCode ?? '', tournamentName: tournament?.name ?? '',
        categoryName: tournament?.categories.find(item => item.id === raw.categoryId)?.name ?? '',
        winnerParticipantName: winner.name, winnerParticipantCode: winner.code,
        runnerUpParticipantName: runnerUp.name, runnerUpParticipantCode: runnerUp.code }
    })
    cache(results)
    return results
  })()
  pendingLists.set(path, request)
  void request.finally(() => { if (pendingLists.get(path) === request) pendingLists.delete(path) }).catch(() => undefined)
  return request
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
