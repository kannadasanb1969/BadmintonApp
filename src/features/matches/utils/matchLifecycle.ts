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

export const getCompletionBlockedReason = (match: FixtureMatch): string | null => {
  if (!validWinningPoints(match.winningPoints)) return 'Winning points are missing for this live match.'
  if (match.participant1Score === match.participant2Score) return 'Scores must not be tied to complete the match.'
  return null
}
