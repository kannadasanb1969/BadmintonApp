import { useEffect, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribeToMatchRealtime } from '@/api/realtime/matchRealtime'
import { useAuthStore } from '@/store/authStore'
import { friendlyKeys } from './friendlyHooks'
import type { FriendlyFixtureData, FriendlyGameMatch } from '../types/friendly.types'
import { applyFriendlyAbsoluteScore } from '../utils/friendlyScoring'

export const useFriendlyLiveUpdates = (friendlyId: string, matchIds: string[], format?: 'LEAGUE' | 'KNOCKOUT') => {
  const token = useAuthStore(state => state.accessToken); const client = useQueryClient(); const ids = useMemo(() => [...new Set(matchIds)].sort(), [matchIds.join(',')])
  useEffect(() => {
    if (!token) return
    const cleanups = ids.map(matchId => subscribeToMatchRealtime(matchId, token, { onEvent: event => {
      if (event.status !== 'SCHEDULED' && event.status !== 'LIVE' && event.status !== 'COMPLETED') return
      const eventWithWinner = event as typeof event & { winnerId?: string | null; winnerType?: 'PLAYER' | 'TEAM' | null }
      const friendlyEvent = { status: event.status, participant1Score: event.participant1Score, participant2Score: event.participant2Score, winningPoints: event.winningPoints, winnerId: eventWithWinner.winnerId, winnerType: eventWithWinner.winnerType, updatedAt: event.updatedAt }
      client.setQueryData<FriendlyFixtureData>(friendlyKeys.fixtures(friendlyId), current => current ? { ...current, matches: current.matches.map(match => match.id === event.matchId ? applyFriendlyAbsoluteScore(match, friendlyEvent) as FriendlyGameMatch : match) } : current)
      if (event.type === 'MATCH_COMPLETED') {
        void client.invalidateQueries({ queryKey: friendlyKeys.fixtures(friendlyId) })
        void client.invalidateQueries({ queryKey: friendlyKeys.detail(friendlyId) })
        void client.invalidateQueries({ queryKey: friendlyKeys.result(friendlyId) })
        if (format === 'LEAGUE') void client.invalidateQueries({ queryKey: friendlyKeys.standings(friendlyId) })
      }
    }, onReconnect: () => { void client.invalidateQueries({ queryKey: friendlyKeys.fixtures(friendlyId) }) } }))
    return () => cleanups.forEach(cleanup => cleanup())
  }, [client, friendlyId, format, token, ids.join(',')])
}
