import { Link } from 'react-router-dom'
import { FriendlyMatchList } from '../components/FriendlyMatchList'

export const FriendlyBrowsePage = () => {
  return <section className="mobile-app-shell -mx-4 px-4 py-6 sm:mx-0 sm:px-6"><div className="mx-auto max-w-6xl"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-black">Friendly Matches</h1><Link to="/player/friendly-matches/create" className="mobile-primary-button">+ Create</Link></div><div className="mt-6"><FriendlyMatchList showEmptyCreate /></div></div></section>
}
