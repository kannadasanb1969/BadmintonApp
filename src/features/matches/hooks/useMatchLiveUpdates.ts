import { useEffect, useMemo, useState } from 'react'
import { MatchRealtimeEvent, MatchRealtimeState, subscribeToMatchRealtime } from '@/api/realtime/matchRealtime'
import { queryClient } from '@/api/queryClient'
import { Fixture, FixtureMatch } from '@/features/fixtures/types/fixture.types'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'
import { useAuthStore } from '@/store/authStore'

const applyEvent = (match: FixtureMatch, event: MatchRealtimeEvent): FixtureMatch => ({
  ...match,
  status: event.status,
  participant1Score: event.participant1Score,
  participant2Score: event.participant2Score,
  ...(event.winningPoints ? { winningPoints: event.winningPoints } : {}),
  ...(event.winnerParticipantId !== undefined ? {
    winnerId: event.winnerParticipantId,
    winnerParticipantId: event.winnerParticipantId,
    winnerParticipantName: event.winnerParticipantName,
    winnerParticipantCode: event.winnerParticipantCode,
  } : {}),
  ...(event.type === 'MATCH_COMPLETED' ? { completedAt: event.updatedAt ?? new Date().toISOString() } : {}),
})

const updateUnknownQueryData = (value: unknown, event: MatchRealtimeEvent): unknown => {
  if (Array.isArray(value)) return value.map(item => updateUnknownQueryData(item, event))
  if (!value || typeof value !== 'object') return value
  const record = value as Record<string, unknown>
  if (record.id === event.matchId && typeof record.participant1Score === 'number') {
    return applyEvent(record as unknown as FixtureMatch, event)
  }
  if (Array.isArray(record.matches)) {
    return { ...record, matches: record.matches.map(item => updateUnknownQueryData(item, event)) }
  }
  return value
}

export const useMatchLiveUpdates = (
  matchIds: string[],
  options: { onEvent?: (event: MatchRealtimeEvent) => void; refetch?: () => void | Promise<unknown> } = {},
) => {
  const accessToken = useAuthStore(state => state.accessToken)
  const stableIds = useMemo(() => [...new Set(matchIds.filter(Boolean))].sort(), [matchIds.join(',')])
  const [states, setStates] = useState<Record<string, MatchRealtimeState>>({})

  useEffect(() => {
    if (!accessToken || stableIds.length === 0) {
      setStates({})
      return
    }

    const cleanups = stableIds.map(matchId => subscribeToMatchRealtime(matchId, accessToken, {
      onEvent: event => {
        const store = useFixtureStore.getState()
        const fixture = store.fixtures.find(item => item.matches.some(match => match.id === event.matchId))
        if (fixture) {
          store.saveGeneratedFixture({
            ...fixture,
            matches: fixture.matches.map(match => match.id === event.matchId ? applyEvent(match, event) : match),
            updatedAt: event.updatedAt ?? fixture.updatedAt,
          })
        }
        // The current app renders fixtures from Zustand. Keep any React Query
        // match/fixture caches coherent for consumers added alongside this hook.
        queryClient.setQueriesData({ predicate: query => ['match', 'matches', 'fixtureMatches', 'tournamentMatches', 'fixture'].includes(String(query.queryKey[0])) }, data => updateUnknownQueryData(data, event))
        options.onEvent?.(event)
      },
      onStateChange: state => setStates(current => ({ ...current, [matchId]: state })),
      onReconnect: () => { void options.refetch?.() },
    }))
    return () => cleanups.forEach(cleanup => cleanup())
  }, [accessToken, stableIds.join(',')])

  const allConnected = stableIds.length > 0 && stableIds.every(id => states[id] === 'CONNECTED')
  return { states, allConnected }
}
