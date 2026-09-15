import { Link } from 'react-router-dom'
import { useFriendlyMatches } from '../hooks/friendlyHooks'
import { FriendlyMatchCard } from './FriendlyMatchCard'
import type { FriendlyMatch } from '../types/friendly.types'

export const FriendlyMatchListContent = ({ matches, loading, failed, onRetry, showEmptyCreate = false }: { matches?: FriendlyMatch[]; loading: boolean; failed: boolean; onRetry: () => void; showEmptyCreate?: boolean }) => {
  if (loading) return <div aria-live="polite" className="mobile-card py-10 text-center text-slate-600">Loading Friendly Matches...</div>
  if (failed) return <div role="alert" className="mobile-card border-rose-100 bg-rose-50 p-5 text-rose-700">Unable to load Friendly Matches.<button className="ml-2 font-bold underline" onClick={onRetry}>Retry</button></div>
  if (!matches?.length) return <div className="mobile-card py-10 text-center"><p className="font-bold text-slate-700">No Friendly Matches available yet.</p>{showEmptyCreate && <Link className="mobile-primary-button mt-5" to="/player/friendly-matches/create">Create Friendly Match</Link>}</div>
  return <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">{matches.map(match => <FriendlyMatchCard key={match.id} match={match} />)}</div>
}

export const FriendlyMatchList = ({ showEmptyCreate = false }: { showEmptyCreate?: boolean }) => {
  const query = useFriendlyMatches()
  return <FriendlyMatchListContent matches={query.data} loading={query.isLoading} failed={query.isError} onRetry={() => void query.refetch()} showEmptyCreate={showEmptyCreate} />
}
