import { Tournament } from '@/features/tournaments/types/tournament.types'
import { CategoryResult } from '@/features/fixtures/types/fixture.types'
import { isTournamentCompleted } from '@/features/player/components/TournamentCardResults'

export type TournamentListStatus = 'OPEN' | 'CLOSED' | 'COMPLETED' | 'ALL'
export const tournamentListStatus = (tournament: Tournament, results: CategoryResult[], now = new Date()): Exclude<TournamentListStatus, 'ALL'> => {
  if (isTournamentCompleted(tournament, results)) return 'COMPLETED'
  // The current API eligibility rule closes registration after its UTC closing date.
  const closeDate = tournament.registrationCloseDate?.slice(0, 10)
  const expired = /^\d{4}-\d{2}-\d{2}$/.test(closeDate ?? '') && now.toISOString().slice(0, 10) > closeDate
  return !expired && tournament.categories.some(category => category.registrationPhase === 'OPEN' && !category.registrationClosedAt) ? 'OPEN' : 'CLOSED'
}

export const filterPlayerTournaments = (tournaments: Tournament[], results: CategoryResult[], query: string, eventType: 'ALL' | 'SINGLES' | 'DOUBLES', status: TournamentListStatus, now = new Date()) => tournaments
  .filter(tournament => tournament.status === 'PUBLISHED')
  .filter(tournament => !query.trim() || [tournament.name, tournament.venueName, tournament.venueAddress].join(' ').toLowerCase().includes(query.trim().toLowerCase()))
  .filter(tournament => eventType === 'ALL' || tournament.categories.some(category => category.eventType === eventType))
  .filter(tournament => status === 'ALL' || tournamentListStatus(tournament, results, now) === status)
  .sort((a, b) => {
    const timestamp = (value: string) => { const parsed = Date.parse(value); return Number.isFinite(parsed) ? parsed : 0 }
    return timestamp(b.createdAt) - timestamp(a.createdAt)
  })
