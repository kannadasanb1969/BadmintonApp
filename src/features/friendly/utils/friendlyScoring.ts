import type { FriendlyFixtureData, FriendlyGameMatch } from '../types/friendly.types'

export const isFriendlyWinningScore = (scoreA: number, scoreB: number, winningPoints: number | null) => Boolean(winningPoints && Math.max(scoreA, scoreB) >= winningPoints && Math.abs(scoreA - scoreB) >= 2)
export const replaceFriendlyFixtureMatch = (data: FriendlyFixtureData | undefined, match: FriendlyGameMatch) => data ? { ...data, matches: data.matches.map(item => item.id === match.id ? match : item) } : data
export const applyFriendlyAbsoluteScore = (match: FriendlyGameMatch, event: { status: FriendlyGameMatch['status']; participant1Score: number; participant2Score: number; winningPoints?: 15 | 21 | 30; winnerId?: string | null; winnerType?: 'PLAYER' | 'TEAM' | null; updatedAt?: string }) => ({
  ...match,
  status: event.status,
  participant1_score: Math.max(0, event.participant1Score),
  participant2_score: Math.max(0, event.participant2Score),
  ...(event.winningPoints ? { winning_points: event.winningPoints } : {}),
  ...(event.winnerId !== undefined ? { live_winner_id: event.winnerId, live_winner_type: event.winnerType ?? null } : {}),
  updated_at: event.updatedAt ?? match.updated_at,
})
export const friendlyScoreError = (message: string) => message === 'Match has reached a valid winning score. Complete the match or correct the score.' ? 'Winning score reached. Complete the match or correct the score.' : message
