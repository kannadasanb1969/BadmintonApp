import { FixtureMatch } from '@/features/fixtures/types/fixture.types'

export const validWinningPoints = (value: FixtureMatch['winningPoints']): 15 | 21 | 30 | undefined => (
  value === 15 || value === 21 || value === 30 ? value : undefined
)

export const canShowMatchMutation = (
  fixtureStatus: string | undefined,
  match: FixtureMatch,
  expectedStatus: 'SCHEDULED' | 'LIVE',
  authorized: boolean,
) => fixtureStatus === 'PUBLISHED'
  && match.status === expectedStatus
  && match.participant1 !== null
  && match.participant2 !== null
  && authorized

export const isMatchCompletionEligible = (
  participant1Score: number,
  participant2Score: number,
  winningPoints: FixtureMatch['winningPoints'],
): boolean => {
  const target = validWinningPoints(winningPoints)
  return Boolean(target
    && Math.max(participant1Score, participant2Score) >= target
    && Math.abs(participant1Score - participant2Score) >= 2)
}

export const getMatchCompletionStatus = (match: FixtureMatch): string => {
  const target = validWinningPoints(match.winningPoints)
  if (!target) return 'Winning points are missing for this live match.'
  if (isMatchCompletionEligible(match.participant1Score, match.participant2Score, target)) return 'Match can be completed'
  if (Math.max(match.participant1Score, match.participant2Score) >= target) return 'Two-point lead required'
  return `Reach ${target} points with a two-point lead`
}

export const getCompletionBlockedReason = (match: FixtureMatch): string | null => {
  return isMatchCompletionEligible(match.participant1Score, match.participant2Score, match.winningPoints)
    ? null
    : getMatchCompletionStatus(match)
}
