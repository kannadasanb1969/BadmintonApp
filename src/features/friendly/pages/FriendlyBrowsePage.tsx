import { Link } from 'react-router-dom'
import { useFriendlyMatches } from '../hooks/friendlyHooks'
import { FriendlyMatchCard } from '../components/FriendlyMatchCard'

export const FriendlyBrowsePage = () => {
  const query = useFriendlyMatches()
  if (query.isLoading) return <p className="py-12 text-center">Loading Friendly Matches...</p>
  if (query.isError) return <div role="alert" className="mx-auto max-w-xl rounded-2xl bg-rose-50 p-5 text-rose-700">Unable to load Friendly Matches.<button className="ml-2 font-bold underline" onClick={() => query.refetch()}>Retry</button></div>
  if (!query.data?.length) return <div className="mx-auto max-w-xl px-4 py-12 text-center"><h1 className="text-2xl font-black">Friendly Matches not found yet</h1><Link className="mt-5 inline-flex rounded-xl bg-emerald-600 px-5 py-3 font-bold text-white" to="/player/friendly-matches/create">Create Friendly Match</Link></div>
  return <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black">Browse Friendly Matches</h1><Link to="/player/friendly-matches/create" className="rounded-xl bg-emerald-600 px-4 py-2 font-bold text-white">Create</Link></div><div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{query.data.map(match => <FriendlyMatchCard key={match.id} match={match} />)}</div></section>
}
