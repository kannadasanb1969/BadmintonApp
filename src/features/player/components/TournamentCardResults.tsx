import { CategoryResult } from '@/features/fixtures/types/fixture.types'
import { Tournament } from '@/features/tournaments/types/tournament.types'

export const completedCategoryResults = (tournament: Tournament, results: CategoryResult[]) => tournament.categories
  .map(category => results.find(result => result.tournamentId === tournament.id && result.categoryId === category.id
    && result.winnerParticipantId && result.runnerUpParticipantId
    && result.winnerParticipantId !== result.runnerUpParticipantId && Number.isFinite(Date.parse(result.completedAt))))
  .filter((result): result is CategoryResult => Boolean(result))

export const isTournamentCompleted = (tournament: Tournament, results: CategoryResult[]) =>
  tournament.categories.length > 0 && completedCategoryResults(tournament, results).length === tournament.categories.length

const displayName = (name: string, id: string) => {
  const value = name?.trim()
  return value && value !== id && !/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(value) ? value : 'Result pending'
}

const playerCode = (code: string) => /^(?:PLR|PLY|PLAYER)[-_]?\d+$/i.test(code ?? '') ? code : null

export const TournamentCardResults = ({ tournament, results }: { tournament: Tournament; results: CategoryResult[] }) => {
  const completed = completedCategoryResults(tournament, results)
  if (!isTournamentCompleted(tournament, results)) return null
  return <div className="mt-4 space-y-3 border-t border-slate-100 pt-3">
    {completed.map(result => <section key={result.categoryId} aria-label={`${result.categoryName || 'Category'} results`}>
      {tournament.categories.length > 1 && <p className="mb-2 text-xs font-semibold text-slate-500">{tournament.categories.find(category => category.id === result.categoryId)?.name}</p>}
      <div className="grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-amber-50 px-3 py-2">
          <p className="text-xs font-bold text-amber-800">🏆 Winner</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-800">{displayName(result.winnerParticipantName, result.winnerParticipantId)}</p>
          {tournament.categories.find(category => category.id === result.categoryId)?.eventType === 'SINGLES' && playerCode(result.winnerParticipantCode) && <p className="mt-0.5 text-xs text-slate-500">{playerCode(result.winnerParticipantCode)}</p>}
        </div>
        <div className="min-w-0 rounded-lg bg-slate-100 px-3 py-2">
          <p className="text-xs font-bold text-slate-600">🥈 Runner-up</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-800">{displayName(result.runnerUpParticipantName, result.runnerUpParticipantId)}</p>
          {tournament.categories.find(category => category.id === result.categoryId)?.eventType === 'SINGLES' && playerCode(result.runnerUpParticipantCode) && <p className="mt-0.5 text-xs text-slate-500">{playerCode(result.runnerUpParticipantCode)}</p>}
        </div>
      </div>
    </section>)}
  </div>
}
