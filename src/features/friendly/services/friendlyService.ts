import apiClient from '@/api/apiClient'
import type { CreateFriendlyMatchRequest, FriendlyFixtureData, FriendlyGameMatch, FriendlyJoinRequest, FriendlyJoinRequestDecision, FriendlyJoinRequestRow, FriendlyMatch, FriendlyParticipant, FriendlyResult, FriendlyStandings, FriendlyTeam, FriendlyTeamMutation } from '@/features/friendly/types/friendly.types'

export const friendlyService = {
  getFriendlyMatches: async () => (await apiClient.get<FriendlyMatch[]>('/api/friendly-matches')).data,
  getFriendlyMatch: async (id: string) => (await apiClient.get<FriendlyMatch>(`/api/friendly-matches/${id}`)).data,
  createFriendlyMatch: async (payload: CreateFriendlyMatchRequest) => (await apiClient.post<FriendlyMatch>('/api/friendly-matches', payload)).data,
  joinFriendlyMatch: async (id: string) => (await apiClient.post<FriendlyJoinRequest>(`/api/friendly-matches/${id}/join`, {})).data,
  getJoinRequests: async (friendlyId: string) => (await apiClient.get<FriendlyJoinRequestRow[]>(`/api/friendly-matches/${friendlyId}/join-requests`)).data,
  approveJoinRequest: async (friendlyId: string, requestId: string) => (await apiClient.post<FriendlyJoinRequestDecision>(`/api/friendly-matches/${friendlyId}/join-requests/${requestId}/approve`, {})).data,
  rejectJoinRequest: async (friendlyId: string, requestId: string) => (await apiClient.post<FriendlyJoinRequestDecision>(`/api/friendly-matches/${friendlyId}/join-requests/${requestId}/reject`, {})).data,
  getParticipants: async (friendlyId: string) => (await apiClient.get<FriendlyParticipant[]>(`/api/friendly-matches/${friendlyId}/participants`)).data,
  getTeams: async (friendlyId: string) => (await apiClient.get<FriendlyTeam[]>(`/api/friendly-matches/${friendlyId}/teams`)).data,
  createTeam: async (friendlyId: string, playerIds: [string, string]) => (await apiClient.post<FriendlyTeamMutation>(`/api/friendly-matches/${friendlyId}/teams`, { playerIds })).data,
  deleteTeam: async (friendlyId: string, teamId: string) => { await apiClient.delete(`/api/friendly-matches/${friendlyId}/teams/${teamId}`) },
  shufflePartners: async (friendlyId: string) => (await apiClient.post<FriendlyTeamMutation[]>(`/api/friendly-matches/${friendlyId}/shuffle-partners`, {})).data,
  resetFixtures: async (friendlyId: string) => { await apiClient.post(`/api/friendly-matches/${friendlyId}/fixtures/reset`, {}) },
  getFixtures: async (friendlyId: string) => (await apiClient.get<FriendlyFixtureData>(`/api/friendly-matches/${friendlyId}/fixtures`)).data,
  generateFixtures: async (friendlyId: string) => (await apiClient.post<FriendlyFixtureData>(`/api/friendly-matches/${friendlyId}/fixtures`, {})).data,
  startMatch: async (friendlyId: string, matchId: string, winningPoints: 15 | 21 | 30) => (await apiClient.post<FriendlyGameMatch>(`/api/friendly-matches/${friendlyId}/matches/${matchId}/start`, { winningPoints })).data,
  scoreMatch: async (friendlyId: string, matchId: string, side: 'A' | 'B', action: 'INCREMENT' | 'DECREMENT') => (await apiClient.post<FriendlyGameMatch>(`/api/friendly-matches/${friendlyId}/matches/${matchId}/score`, { side, action })).data,
  completeMatch: async (friendlyId: string, matchId: string) => (await apiClient.post<FriendlyGameMatch>(`/api/friendly-matches/${friendlyId}/matches/${matchId}/complete`, {})).data,
  getFriendlyResult: async (friendlyId: string) => (await apiClient.get<FriendlyResult>(`/api/friendly-matches/${friendlyId}/result`)).data,
  getFriendlyStandings: async (friendlyId: string) => (await apiClient.get<FriendlyStandings>(`/api/friendly-matches/${friendlyId}/standings`)).data,
  closeFriendlyMatch: async (friendlyId: string) => (await apiClient.post<FriendlyMatch>(`/api/friendly-matches/${friendlyId}/close`, {})).data,
  cleanupFriendlyMatch: async (friendlyId: string) => (await apiClient.post<unknown>(`/api/friendly-matches/${friendlyId}/cleanup`, {})).data,
}
