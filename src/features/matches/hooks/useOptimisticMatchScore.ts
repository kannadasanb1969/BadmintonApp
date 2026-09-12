import { useRef } from 'react'

import { FixtureMatch } from '@/features/fixtures/types/fixture.types'

type ScoreSide = 'PARTICIPANT_1' | 'PARTICIPANT_2'
type ScoreAction = { id: number; side: ScoreSide; delta: 1 | -1 }

const applyPendingActions = (match: FixtureMatch, actions: ScoreAction[]) => actions.reduce((current, action) => ({
  ...current,
  participant1Score: action.side === 'PARTICIPANT_1'
    ? Math.min(current.winningPoints ?? 0, Math.max(0, current.participant1Score + action.delta))
    : current.participant1Score,
  participant2Score: action.side === 'PARTICIPANT_2'
    ? Math.min(current.winningPoints ?? 0, Math.max(0, current.participant2Score + action.delta))
    : current.participant2Score,
}), match)

/**
 * Keeps rapid score clicks ordered while making each click visible immediately.
 * The Worker response replaces the optimistic version after every request.
 */
export const useOptimisticMatchScore = () => {
  const queues = useRef(new Map<string, Promise<void>>())
  const pending = useRef(new Map<string, ScoreAction[]>())
  const authoritative = useRef(new Map<string, FixtureMatch>())
  const sequence = useRef(0)

  const enqueue = (
    match: FixtureMatch,
    side: ScoreSide,
    delta: 1 | -1,
    submit: () => Promise<FixtureMatch | undefined>,
    applyMatch: (next: FixtureMatch) => void,
    onError: (message: string) => void,
  ) => {
    const current = applyPendingActions(authoritative.current.get(match.id) ?? match, pending.current.get(match.id) ?? [])
    const currentScore = side === 'PARTICIPANT_1' ? current.participant1Score : current.participant2Score
    if (current.status !== 'LIVE' || ![15, 21, 30].includes(current.winningPoints ?? 0) || (delta === -1 && currentScore <= 0) || (delta === 1 && currentScore >= current.winningPoints!)) return

    if (!authoritative.current.has(match.id)) authoritative.current.set(match.id, match)
    const action = { id: ++sequence.current, side, delta } as ScoreAction
    const actions = [...(pending.current.get(match.id) ?? []), action]
    pending.current.set(match.id, actions)
    applyMatch(applyPendingActions(authoritative.current.get(match.id) ?? match, actions))

    const prior = queues.current.get(match.id) ?? Promise.resolve()
    const request = prior.catch(() => undefined).then(async () => {
      try {
        const updated = await submit()
        if (!updated) throw new Error('Score update did not return a match')
        authoritative.current.set(match.id, updated)
      } catch (error) {
        onError(error instanceof Error ? error.message : 'Score update failed. Please try again.')
      } finally {
        const remaining = (pending.current.get(match.id) ?? []).filter((item) => item.id !== action.id)
        if (remaining.length === 0) {
          pending.current.delete(match.id)
          const serverMatch = authoritative.current.get(match.id)
          if (serverMatch) applyMatch(serverMatch)
          authoritative.current.delete(match.id)
        } else {
          pending.current.set(match.id, remaining)
          const serverMatch = authoritative.current.get(match.id)
          if (serverMatch) applyMatch(applyPendingActions(serverMatch, remaining))
        }
      }
    })
    queues.current.set(match.id, request)
    void request.finally(() => {
      if (queues.current.get(match.id) === request) queues.current.delete(match.id)
    })
  }

  return { enqueue }
}
