import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError } from '@/api/apiClient'
import { friendlyService } from '@/features/friendly/services/friendlyService'
import type { QueryClient } from '@tanstack/react-query'
import type { FriendlyFixtureData, FriendlyGameMatch, FriendlyParticipant, FriendlyTeam } from '../types/friendly.types'
import { replaceFriendlyFixtureMatch } from '../utils/friendlyScoring'

export const friendlyKeys = {
  all: ['friendly-matches'] as const,
  detail: (id: string) => ['friendly-matches', id] as const,
  joinRequests: (id: string) => ['friendly-matches', id, 'join-requests'] as const,
  participants: (id: string) => ['friendly-matches', id, 'participants'] as const,
  teams: (id: string) => ['friendly-matches', id, 'teams'] as const,
  fixtures: (id: string) => ['friendly-matches', id, 'fixtures'] as const,
  result: (id: string) => ['friendly-matches', id, 'result'] as const,
  standings: (id: string) => ['friendly-matches', id, 'standings'] as const,
}

export const invalidateFriendlyManagement = async (client: QueryClient, id: string) => {
  await Promise.all([
    client.invalidateQueries({ queryKey: friendlyKeys.all }),
    client.invalidateQueries({ queryKey: friendlyKeys.detail(id) }),
    client.invalidateQueries({ queryKey: friendlyKeys.joinRequests(id) }),
    client.invalidateQueries({ queryKey: friendlyKeys.participants(id) }),
  ])
}

export const invalidateFriendlyAfterJoin = async (client: QueryClient, id: string) => {
  await Promise.all([
    client.invalidateQueries({ queryKey: friendlyKeys.all }),
    client.invalidateQueries({ queryKey: friendlyKeys.detail(id) }),
  ])
}

export const useFriendlyMatches = () => useQuery({ queryKey: friendlyKeys.all, queryFn: friendlyService.getFriendlyMatches })
export const useFriendlyMatch = (id?: string) => useQuery({ queryKey: friendlyKeys.detail(id ?? ''), queryFn: () => friendlyService.getFriendlyMatch(id!), enabled: Boolean(id), retry: false })

export const useCreateFriendlyMatch = () => {
  const client = useQueryClient()
  return useMutation({ mutationFn: friendlyService.createFriendlyMatch, onSuccess: () => client.invalidateQueries({ queryKey: friendlyKeys.all }) })
}

export const useJoinFriendlyMatch = (id: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => friendlyService.joinFriendlyMatch(id),
    onSuccess: () => invalidateFriendlyAfterJoin(client, id),
  })
}

export const useFriendlyJoinRequests = (id: string, enabled: boolean) => useQuery({ queryKey: friendlyKeys.joinRequests(id), queryFn: () => friendlyService.getJoinRequests(id), enabled, retry: false })
export const useFriendlyParticipants = (id: string) => useQuery({ queryKey: friendlyKeys.participants(id), queryFn: () => friendlyService.getParticipants(id), enabled: Boolean(id), retry: false })

const useFriendlyDecision = (id: string, decision: 'approve' | 'reject') => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) => decision === 'approve' ? friendlyService.approveJoinRequest(id, requestId) : friendlyService.rejectJoinRequest(id, requestId),
    onSuccess: () => invalidateFriendlyManagement(client, id),
  })
}

export const useApproveFriendlyJoinRequest = (id: string) => useFriendlyDecision(id, 'approve')
export const useRejectFriendlyJoinRequest = (id: string) => useFriendlyDecision(id, 'reject')

export const invalidateFriendlyTeams = async (client: QueryClient, id: string) => {
  await Promise.all([
    client.invalidateQueries({ queryKey: friendlyKeys.teams(id) }),
    client.invalidateQueries({ queryKey: friendlyKeys.fixtures(id) }),
    client.invalidateQueries({ queryKey: friendlyKeys.participants(id) }),
    client.invalidateQueries({ queryKey: friendlyKeys.detail(id) }),
    client.invalidateQueries({ queryKey: friendlyKeys.all }),
  ])
}

export const useFriendlyTeams = (id: string, enabled: boolean) => useQuery({ queryKey: friendlyKeys.teams(id), queryFn: () => friendlyService.getTeams(id), enabled, retry: false })

export const optimisticallyRemoveFriendlyTeam = async (client: QueryClient, id: string, teamId: string) => {
  await client.cancelQueries({ queryKey: friendlyKeys.teams(id) })
  const previousTeams = client.getQueryData<FriendlyTeam[]>(friendlyKeys.teams(id))
  client.setQueryData<FriendlyTeam[]>(friendlyKeys.teams(id), current => current?.filter(team => team.id !== teamId))
  return previousTeams
}

export const rollbackFriendlyTeams = (client: QueryClient, id: string, previousTeams?: FriendlyTeam[]) => {
  if (previousTeams) client.setQueryData(friendlyKeys.teams(id), previousTeams)
}

export const friendlyTeamWithMembers = (team: Omit<FriendlyTeam, 'members'>, playerIds: [string, string], participants: FriendlyParticipant[]): FriendlyTeam => ({
  ...team,
  members: playerIds.map(playerId => { const participant = participants.find(item => item.player_id === playerId); return { id: playerId, name: participant?.full_name ?? 'Player', code: participant?.player_code ?? '' } }),
})

export const optimisticallyAddFriendlyTeam = async (client: QueryClient, id: string, playerIds: [string, string], tempId = `TEMP_TEAM_${Date.now()}`) => {
  await client.cancelQueries({ queryKey: friendlyKeys.teams(id) })
  const previousTeams = client.getQueryData<FriendlyTeam[]>(friendlyKeys.teams(id))
  const participants = client.getQueryData<FriendlyParticipant[]>(friendlyKeys.participants(id)) ?? []
  const optimisticTeam = friendlyTeamWithMembers({ id: tempId, friendly_match_id: id, team_code: 'Creating team...', created_at: '', updated_at: '' }, playerIds, participants)
  client.setQueryData<FriendlyTeam[]>(friendlyKeys.teams(id), current => [...(current ?? []), optimisticTeam])
  return { previousTeams, tempId }
}

export const replaceOptimisticFriendlyTeam = (client: QueryClient, id: string, tempId: string, team: FriendlyTeam) => client.setQueryData<FriendlyTeam[]>(friendlyKeys.teams(id), current => [...(current ?? []).filter(item => item.id !== tempId && item.id !== team.id), team])
export const refreshFriendlyTeams = (client: QueryClient, id: string) => client.invalidateQueries({ queryKey: friendlyKeys.teams(id) })

const useTeamMutation = <T,>(id: string, mutationFn: (variables: T) => Promise<unknown>) => {
  const client = useQueryClient()
  return useMutation({ mutationFn, onSuccess: () => invalidateFriendlyTeams(client, id) })
}
export const useCreateFriendlyTeam = (id: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (playerIds: [string, string]) => friendlyService.createTeam(id, playerIds),
    onMutate: async playerIds => optimisticallyAddFriendlyTeam(client, id, playerIds),
    onError: (_error, _playerIds, context) => rollbackFriendlyTeams(client, id, context?.previousTeams),
    onSuccess: async (team, playerIds, context) => {
      const participants = client.getQueryData<FriendlyParticipant[]>(friendlyKeys.participants(id)) ?? []
      if (context) replaceOptimisticFriendlyTeam(client, id, context.tempId, friendlyTeamWithMembers(team, playerIds, participants))
      await refreshFriendlyTeams(client, id)
    },
  })
}
export const useDeleteFriendlyTeam = (id: string) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (teamId: string) => friendlyService.deleteTeam(id, teamId),
    onMutate: async teamId => ({ previousTeams: await optimisticallyRemoveFriendlyTeam(client, id, teamId) }),
    onError: (_error, _teamId, context) => rollbackFriendlyTeams(client, id, context?.previousTeams),
    onSuccess: () => refreshFriendlyTeams(client, id),
  })
}
export const useShuffleFriendlyPartners = (id: string) => {
  const client = useQueryClient()
  return useMutation({ mutationFn: async () => { await client.cancelQueries({ queryKey: friendlyKeys.teams(id) }); return friendlyService.shufflePartners(id) }, onSuccess: () => refreshFriendlyTeams(client, id) })
}
export const useResetFriendlyFixtures = (id: string) => useTeamMutation<void>(id, () => friendlyService.resetFixtures(id))
export const useFriendlyFixtures = (id: string) => useQuery({ queryKey: friendlyKeys.fixtures(id), queryFn: () => friendlyService.getFixtures(id), enabled: Boolean(id), retry: false })
export const useFriendlyResult = (id: string, enabled = true) => useQuery({ queryKey: friendlyKeys.result(id), queryFn: () => friendlyService.getFriendlyResult(id), enabled: Boolean(id) && enabled, retry: false })
export const useFriendlyStandings = (id: string, enabled = true) => useQuery({ queryKey: friendlyKeys.standings(id), queryFn: () => friendlyService.getFriendlyStandings(id), enabled: Boolean(id) && enabled, retry: false })
export const useGenerateFriendlyFixtures = (id: string) => useTeamMutation<void>(id, () => friendlyService.generateFixtures(id))

const useMatchMutation = <T,>(friendlyId: string, mutationFn: (variables: T) => Promise<FriendlyGameMatch>, completed = false) => {
  const client = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: async match => {
      client.setQueryData<FriendlyFixtureData>(friendlyKeys.fixtures(friendlyId), data => replaceFriendlyFixtureMatch(data, match))
      if (completed) await Promise.all([
        client.invalidateQueries({ queryKey: friendlyKeys.fixtures(friendlyId) }),
        client.invalidateQueries({ queryKey: friendlyKeys.detail(friendlyId) }),
        client.invalidateQueries({ queryKey: friendlyKeys.result(friendlyId) }),
        client.invalidateQueries({ queryKey: friendlyKeys.standings(friendlyId) }),
      ])
    },
    onError: error => {
      if (error instanceof ApiError && error.status === 409) void client.invalidateQueries({ queryKey: friendlyKeys.fixtures(friendlyId) })
    },
  })
}
export const useStartFriendlyMatch = (friendlyId: string, matchId: string) => useMatchMutation<15 | 21 | 30>(friendlyId, winningPoints => friendlyService.startMatch(friendlyId, matchId, winningPoints))
export const useScoreFriendlyMatch = (friendlyId: string, matchId: string) => useMatchMutation<{ side: 'A' | 'B'; action: 'INCREMENT' | 'DECREMENT' }>(friendlyId, value => friendlyService.scoreMatch(friendlyId, matchId, value.side, value.action))
export const useCompleteFriendlyMatch = (friendlyId: string, matchId: string) => useMatchMutation<void>(friendlyId, () => friendlyService.completeMatch(friendlyId, matchId), true)

export const useCloseFriendlyMatch = (friendlyId: string) => {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => friendlyService.closeFriendlyMatch(friendlyId), onSuccess: async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: friendlyKeys.all, exact: true }),
      client.invalidateQueries({ queryKey: friendlyKeys.detail(friendlyId) }),
      client.invalidateQueries({ queryKey: friendlyKeys.result(friendlyId) }),
      client.invalidateQueries({ queryKey: friendlyKeys.standings(friendlyId) }),
    ])
  } })
}

export const useCleanupFriendlyMatch = (friendlyId: string) => {
  const client = useQueryClient()
  return useMutation({ mutationFn: () => friendlyService.cleanupFriendlyMatch(friendlyId), onSuccess: async () => {
    for (const key of [friendlyKeys.detail(friendlyId), friendlyKeys.joinRequests(friendlyId), friendlyKeys.participants(friendlyId), friendlyKeys.teams(friendlyId), friendlyKeys.fixtures(friendlyId), friendlyKeys.result(friendlyId), friendlyKeys.standings(friendlyId)]) client.removeQueries({ queryKey: key, exact: true })
    await client.invalidateQueries({ queryKey: friendlyKeys.all, exact: true })
  } })
}
