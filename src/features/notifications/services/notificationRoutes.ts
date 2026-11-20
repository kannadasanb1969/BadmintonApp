const id = (value?: string) => Boolean(value && /^[A-Za-z0-9_-]{1,100}$/.test(value))
const paths: Record<string, string> = {
  match: '/player/matches/',
  tournament: '/player/tournaments/',
  registration: '/player/registrations/',
  'friendly-match': '/player/friendly-matches/',
  'friendly-requests': '/player/friendly-matches/',
  PLAYER_COURT_BOOKING: '/player/court-bookings/',
  OWNER_COURT_BOOKING: '/owner/bookings/',
  player: '/player/players/',
}
export const notificationRoute = (link?: string | null) => {
  if (!link) return undefined
  if (/^\/(?:player|owner|organizer|admin)\/[A-Za-z0-9_/?=&%.-]+$/.test(link)) return link
  const [kind, first, second, ...extra] = link.split(':')
  if (!id(first) || extra.length) return undefined
  if (kind === 'connection' && !second) return '/player/connections'
  if (kind === 'friendly-invitation' && id(second)) return '/player/friendly-invitations/' + first
  if (kind === 'friendly-game' && id(second)) return '/player/friendly-matches/' + first
  if (kind === 'fixtures' && id(second)) return '/player/fixtures?tournamentId=' + first + '&categoryId=' + second
  if (kind === 'partner-invitation' && /^\d+$/.test(second ?? '')) return '/player/partner-invitations/' + first + '?version=' + second
  const base = Object.prototype.hasOwnProperty.call(paths, kind) ? paths[kind] : undefined
  return !second && base ? base + first : undefined
}
