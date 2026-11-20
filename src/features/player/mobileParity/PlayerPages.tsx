import { useState, type ReactNode } from 'react'
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import apiClient from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'
import { usePlayerProfileStore } from '@/features/player/store/playerProfileStore'
import { useMatchLiveUpdates } from '@/features/matches/hooks/useMatchLiveUpdates'
import { matchService } from '@/features/matches/services/matchService'
import { notificationApiService } from '@/features/notifications/services/notificationApiService'

type Player = { id: string; fullName: string; playerCode: string; profilePhoto?: string; location?: string; age?: number; playingSince?: number; courtAcademy?: string; regularPlayer?: boolean; isSelf?: boolean }
type Connection = { player: Player; connectionId?: string; connectionState?: 'NONE' | 'CONNECTED' | 'REQUESTED' | 'INCOMING' }
type Medal = { id: string; medalType?: string; position?: string; tournamentName?: string; categoryName?: string; achievedAt?: string }
type Activity = { stats: { completedMatches: number; wins: number; losses: number; winPercentage: number }; matches: { id: string; title: string; kind: string; opponentSide: string; playerScore: number; opponentScore: number; won: boolean }[]; achievements: Medal[]; page: number; hasMore: boolean }
type Partner = { id: string; tournamentId: string; categoryId: string; partnerId?: string; partnerResponseStatus?: string; partnerInvitationVersion?: number; status: string; reviewStatus?: string; paymentStatus?: string }
type Candidate = { player: Player; state: string }
const key = ['player-workspace'] as const
const encode = (value: string) => encodeURIComponent(value)
const button = 'inline-flex min-h-10 w-fit items-center rounded-lg border border-emerald-700 bg-white px-3 font-semibold text-emerald-800 disabled:opacity-50'
const panel = 'grid gap-3 rounded-2xl border border-emerald-100 bg-white p-4 text-slate-900'
const get = async <T,>(path: string, params?: Record<string, string | number>, signal?: AbortSignal) => (await apiClient.get<T>(path, { params, signal })).data
const post = async <T,>(path: string, data: unknown = {}) => (await apiClient.post<T>(path, data)).data
const name = (value?: string) => value?.toLowerCase().split('_').join(' ')
const cause = (error: unknown) => error instanceof Error ? error.message : 'Could not complete this request.'
function usePlayerQuery<T>(path: string, params?: Record<string, string | number>, enabled = true) {
  const userId = useAuthStore(state => state.user?.id)
  return useQuery({ queryKey: [...key, userId, path, params], queryFn: ({ signal }) => get<T>(path, params, signal), enabled: Boolean(userId && enabled && path), retry: false })
}
function usePlayerAction<T>(mutationFn: (value: T) => Promise<unknown>) {
  const client = useQueryClient()
  const userId = useAuthStore(state => state.user?.id)
  return useMutation({ mutationFn, onSettled: async () => {
    await client.invalidateQueries({ queryKey: key })
    if (userId) await notificationApiService.refresh(userId).catch(() => undefined)
  } })
}
function State({ query }: { query: { isLoading: boolean; error: unknown; refetch: () => unknown } }) {
  if (query.isLoading) return <p role="status">Loading…</p>
  return query.error ? <p role="alert">{cause(query.error)} <button type="button" className={button} onClick={() => void query.refetch()}>Retry</button></p> : null
}
function Page({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mx-auto grid max-w-5xl gap-4 rounded-2xl bg-emerald-50 p-4 text-emerald-950 sm:p-6"><h1 className="text-2xl font-extrabold">{title}</h1>{children}</section>
}
function PlayerLink({ player }: { player: Player }) {
  return <Link className="flex min-w-0 items-center gap-3 text-emerald-900" to={'/player/players/' + encode(player.id)}>
    {player.profilePhoto && <img className="h-10 w-10 rounded-full object-cover" src={player.profilePhoto} alt="" loading="lazy" />}
    <span className="min-w-0"><strong className="block">{player.fullName}</strong><span className="text-sm">{player.playerCode}{player.location ? ' · ' + player.location : ''}</span></span>
  </Link>
}
export function ConnectionsPage() {
  const [search, setSearch] = useState('')
  const [text, setText] = useState('')
  const [tab, setTab] = useState<'discover' | 'connected' | 'requests'>('discover')
  const discover = usePlayerQuery<Connection[]>('/api/connections/discover', { search }, tab === 'discover')
  const connections = usePlayerQuery<Connection[]>('/api/connections', undefined, tab === 'connected')
  const requests = usePlayerQuery<{ received: Connection[]; sent: Connection[] }>('/api/connections/requests', undefined, tab === 'requests')
  return <Page title="Player connections">
    <div className="flex flex-wrap gap-2">
      {(['discover', 'connected', 'requests'] as const).map(item => <button key={item} type="button" className={button} aria-pressed={tab === item} onClick={() => setTab(item)}>{item === 'connected' ? 'My connections' : item === 'requests' ? 'Requests' : 'Discover players'}</button>)}
    </div>
    {tab === 'discover' && <>
      <form className="flex flex-wrap gap-2" onSubmit={event => { event.preventDefault(); setSearch(text.trim()) }}>
        <input aria-label="Search player name or code" className="min-h-10 rounded-lg border bg-white px-3" type="search" value={text} onChange={event => setText(event.target.value)} placeholder="Player name or code" />
        <button className={button}>Search</button>
      </form><State query={discover} /><ConnectionList rows={discover.data} />
    </>}
    {tab === 'connected' && <><State query={connections} /><ConnectionList rows={connections.data} /></>}
    {tab === 'requests' && <><State query={requests} /><h2 className="font-bold">Received</h2><ConnectionList rows={requests.data?.received} /><h2 className="font-bold">Sent</h2><ConnectionList rows={requests.data?.sent} /></>}
  </Page>
}
function ConnectionList({ rows }: { rows?: Connection[] }) {
  return <div className="grid gap-2">
    {rows?.length === 0 && <p>No players in this view.</p>}
    {rows?.map(row => <div className={panel} key={row.player.id}><PlayerLink player={row.player} />{row.connectionState && row.connectionState !== 'NONE' && <p className="capitalize">{name(row.connectionState)}</p>}</div>)}
  </div>
}
export function PublicPlayerPage() {
  const { id = '' } = useParams()
  const [kind, setKind] = useState('ALL')
  const [showConnections, setShowConnections] = useState(false)
  const user = useAuthStore(state => state.user?.id)
  const path = '/api/connections/profile/' + encode(id)
  const profile = usePlayerQuery<Connection>(path, undefined, Boolean(id))
  const connections = usePlayerQuery<Player[]>(path + '/connections', undefined, showConnections && Boolean(id))
  const activity = useInfiniteQuery({
    queryKey: [...key, user, path + '/activity', kind], queryFn: ({ pageParam, signal }) => get<Activity>(path + '/activity', { type: kind, page: pageParam }, signal),
    initialPageParam: 0, getNextPageParam: data => data.hasMore ? data.page + 1 : undefined, enabled: Boolean(user && id && profile.data), retry: false,
  })
  const data = profile.data
  const action = usePlayerAction(async (operation: 'request' | 'accept' | 'decline' | 'remove') => {
    if (operation === 'request') return post('/api/connections/' + encode(id))
    if (!data?.connectionId) throw new Error('The connection is no longer available.')
    const endpoint = '/api/connections/' + encode(data.connectionId)
    return operation === 'remove' ? apiClient.delete(endpoint) : post(endpoint + '/' + operation)
  })
  const stats = activity.data?.pages[0]
  return <Page title={data?.player.fullName ?? 'Player profile'}>
    <State query={profile} />
    {data && <section className={panel}>
      <div className="flex flex-wrap items-center gap-4">{data.player.profilePhoto && <img className="h-20 w-20 rounded-full object-cover" src={data.player.profilePhoto} alt="" />}
        <div><p>{data.player.playerCode}</p><p>{data.player.location}</p><p>{data.player.courtAcademy}</p>{data.player.playingSince && <p>Playing since {data.player.playingSince}</p>}</div>
      </div>
      {!data.player.isSelf && <div className="flex flex-wrap gap-2">
        {data.connectionState === 'NONE' && <button className={button} disabled={action.isPending} onClick={() => action.mutate('request')}>Connect</button>}
        {data.connectionState === 'REQUESTED' && <p>Request sent</p>}
        {data.connectionState === 'INCOMING' && <><button className={button} disabled={action.isPending} onClick={() => action.mutate('accept')}>Accept request</button><button className={button} disabled={action.isPending} onClick={() => action.mutate('decline')}>Decline request</button></>}
        {data.connectionState === 'CONNECTED' && <button className={button} disabled={action.isPending} onClick={() => { if (window.confirm('Remove this connection?')) action.mutate('remove') }}>Remove connection</button>}
      </div>}
      {action.error && <p role="alert">{cause(action.error)}</p>}
      <button className={button} onClick={() => setShowConnections(value => !value)}>{showConnections ? 'Hide connections' : 'View connections'}</button>
      {showConnections && <><State query={connections} /><ConnectionList rows={connections.data?.map(player => ({ player }))} /></>}
    </section>}
    {data && <section className={panel}>
      <h2 className="font-bold">Match history</h2>
      <label>Match type <select className="rounded border p-2" value={kind} onChange={event => setKind(event.target.value)}><option value="ALL">All matches</option><option value="TOURNAMENT">Tournaments</option><option value="FRIENDLY">Friendly matches</option></select></label>
      <State query={activity} />
      {stats && <p>{stats.stats.completedMatches} played · {stats.stats.wins} won · {stats.stats.losses} lost · {stats.stats.winPercentage}% wins</p>}
      {activity.data?.pages.flatMap(page => page.matches).map(match => <article key={match.id} className="border-t pt-2"><strong>{match.title}</strong><p>vs. {match.opponentSide} · {match.playerScore}–{match.opponentScore} · {match.won ? 'Won' : 'Lost'}</p></article>)}
      {activity.hasNextPage && <button className={button} disabled={activity.isFetchingNextPage} onClick={() => void activity.fetchNextPage()}>More matches</button>}
    </section>}
    {Boolean(stats?.achievements.length) && <section className={panel}><h2 className="font-bold">Medals</h2><MedalsList rows={stats?.achievements} /></section>}
  </Page>
}
function MedalsList({ rows }: { rows?: Medal[] }) {
  return <div className="grid gap-2">
    {rows?.length === 0 && <p>No medals yet.</p>}
    {rows?.map(item => <article key={item.id} className="rounded-xl border border-emerald-100 bg-white p-3"><strong>{item.medalType ?? item.position ?? 'Medal'}</strong><p>{item.tournamentName} · {item.categoryName}</p>{item.achievedAt && <p>{item.achievedAt.slice(0, 10)}</p>}</article>)}
  </div>
}
export function MedalsPage() {
  const id = usePlayerProfileStore(state => state.profile?.id)
  const medals = usePlayerQuery<Medal[]>(id ? '/api/medals/player/' + encode(id) : '')
  return <Page title="My medals">{!id && <Link to="/player/profile">Complete your player profile</Link>}<State query={medals} /><MedalsList rows={medals.data} /></Page>
}
export function ResultsPage() {
  const results = usePlayerQuery<{ id: string; tournamentId?: string; categoryId?: string; tournamentName?: string; categoryName?: string; winnerName?: string; runnerUpName?: string; winnerParticipantName?: string; runnerUpParticipantName?: string }[]>('/api/results')
  return <Page title="Tournament results"><State query={results} />{results.data?.length === 0 && <p>No results published.</p>}
    {results.data?.map((item, index) => <article className={panel} key={item.id ?? index}><h2 className="font-bold">{item.tournamentName || item.categoryName || 'Tournament result'}</h2>
      <p>Winner: {item.winnerName ?? item.winnerParticipantName ?? 'Unavailable'}</p><p>Runner-up: {item.runnerUpName ?? item.runnerUpParticipantName ?? 'Unavailable'}</p>
      {item.tournamentId && <Link to={'/player/tournaments/' + encode(item.tournamentId)}>View tournament</Link>}
    </article>)}
  </Page>
}

export function PartnerInvitationPage() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const path = '/api/partner-invitations/' + encode(id)
  const invitation = usePlayerQuery<Partner>(path)
  const action = usePlayerAction((decision: string) => post(path + '/respond', { decision, version: invitation.data?.partnerInvitationVersion }))
  const value = invitation.data
  const stale = params.has('version') && Number(params.get('version')) !== value?.partnerInvitationVersion
  const pending = value && !stale && value.partnerResponseStatus === 'PENDING' && !['CANCELLED', 'REJECTED'].includes(value.status)
  return <Page title="Tournament partner invitation"><State query={invitation} />{value && <section className={panel}>
    <p>{stale ? 'This invitation has been replaced. Open the latest invitation.' : 'Partner response: ' + (name(value.partnerResponseStatus) ?? 'Unavailable')}</p>
    {pending && <><p>Review or payment requirements still apply after accepting.</p><div className="flex gap-2">
      <button className={button} disabled={action.isPending} onClick={() => action.mutate('ACCEPTED')}>Accept invitation</button>
      <button className={button} disabled={action.isPending} onClick={() => action.mutate('REJECTED')}>Reject invitation</button>
    </div></>}
    {action.error && <p role="alert">{cause(action.error)}</p>}
    <Link to={'/player/tournaments/' + encode(value.tournamentId)}>View tournament</Link>
  </section>}</Page>
}
export function RegistrationDetailsPage() {
  const { id = '' } = useParams()
  const query = usePlayerQuery<Partner>('/api/registrations/' + encode(id))
  const [replace, setReplace] = useState(false)
  const profile = usePlayerProfileStore(state => state.profile?.id)
  const players = usePlayerQuery<Player[]>('/api/players', undefined, replace)
  const guests = usePlayerQuery<Player[]>('/api/guest-players', undefined, replace)
  const [type, setType] = useState<'PLAYER' | 'GUEST'>('PLAYER')
  const action = usePlayerAction((input: { partnerId: string; consent: boolean }) =>
    post('/api/partner-invitations/' + encode(id) + '/replace', { partnerId: input.partnerId, partnerType: type, guestWhatsAppConsent: input.consent }),
  )
  return <Page title="Registration details"><State query={query} />{query.data && <section className={panel}>
    <p className="capitalize">Status: {name(query.data.status)}</p>
    {query.data.reviewStatus && <p>Review: {name(query.data.reviewStatus)}</p>}{query.data.paymentStatus && <p>Payment: {name(query.data.paymentStatus)}</p>}
    {query.data.partnerResponseStatus && <p>Partner response: {name(query.data.partnerResponseStatus)}</p>}
    {query.data.partnerResponseStatus === 'REJECTED' && <button className={button} onClick={() => setReplace(!replace)}>Replace partner</button>}
    {replace && <form className="grid gap-3" onSubmit={event => {
      event.preventDefault()
      const data = new FormData(event.currentTarget)
      action.mutate({ partnerId: String(data.get('partnerId')), consent: data.has('consent') }, { onSuccess: () => setReplace(false) })
    }}>
      <label>Partner type <select className="rounded border p-2" value={type} onChange={event => setType(event.target.value === 'GUEST' ? 'GUEST' : 'PLAYER')}><option value="PLAYER">Existing player</option><option value="GUEST">Guest</option></select></label>
      <State query={type === 'PLAYER' ? players : guests} />
      <label>Partner <select className="rounded border p-2" name="partnerId" required key={type}><option value="">Select</option>{(type === 'PLAYER' ? players.data : guests.data)?.filter(person => person.id !== profile).map(person => <option key={person.id} value={person.id}>{person.fullName}</option>)}</select></label>
      {type === 'GUEST' && <label><input type="checkbox" name="consent" /> Guest has consented to a WhatsApp invitation</label>}
      <button className={button} disabled={action.isPending}>Send replacement invitation</button>
    </form>}
    {action.error && <p role="alert">{cause(action.error)}</p>}
    <Link to={'/player/tournaments/' + encode(query.data.tournamentId)}>View tournament</Link>
  </section>}</Page>
}

export function FriendlyInvitePage() {
  const { id = '' } = useParams()
  const path = '/api/friendly-matches/' + encode(id)
  const candidates = usePlayerQuery<Candidate[]>(path + '/invite-candidates')
  const action = usePlayerAction((playerId: string) => post(path + '/invitations', { invitedPlayerId: playerId }))
  return <Page title="Invite connections">
    <Link to={'/player/friendly-matches/' + encode(id)}>Back to Friendly Match</Link>
    <State query={candidates} />
    {candidates.data?.length === 0 && <p>Accepted connections will appear here.</p>}
    {candidates.data?.map(item => <article className={panel} key={item.player.id}>
      <PlayerLink player={item.player} />
      {item.state !== 'AVAILABLE' ? <p className="capitalize">{name(item.state)}</p>
        : <button className={button} disabled={action.isPending} onClick={() => action.mutate(item.player.id)}>Invite to match</button>}
    </article>)}
    {action.error && <p role="alert">{cause(action.error)}</p>}
  </Page>
}
export function FriendlyInvitationPage() {
  const { id = '' } = useParams()
  const path = '/api/friendly-matches/invitations/' + encode(id)
  const query = usePlayerQuery<{ friendlyMatchId: string; status: string }>(path)
  const action = usePlayerAction((value: string) => post(path + '/' + value))
  return <Page title="Friendly Match invitation"><State query={query} />{query.data && <section className={panel}>
    <p className="capitalize">{name(query.data.status)}</p>
    {query.data.status === 'PENDING' && <div className="flex gap-2"><button className={button} disabled={action.isPending} onClick={() => action.mutate('accept')}>Accept invitation</button><button className={button} disabled={action.isPending} onClick={() => action.mutate('decline')}>Decline invitation</button></div>}
    {action.error && <p role="alert">{cause(action.error)}</p>}<Link to={'/player/friendly-matches/' + encode(query.data.friendlyMatchId)}>Open Friendly Match</Link>
  </section>}</Page>
}
export function MatchViewerPage() {
  const { id = '' } = useParams()
  const query = useQuery({ queryKey: ['match', id], queryFn: () => matchService.getMatch(id), enabled: Boolean(id), refetchInterval: 20000 })
  const match = query.data
  useMatchLiveUpdates([id], { refetch: query.refetch })
  return <Page title="Live score">
    <State query={query} />
    {query.isSuccess && !match && <p>Match unavailable.</p>}
    {match && <section className={panel}>
      <p className="capitalize">{name(match.status)}</p>
      <p className="text-4xl font-black">{match.participant1Score} – {match.participant2Score}</p>
      <p>Target {match.winningPoints ?? '—'}{match.winnerParticipantName ? ' · Winner: ' + match.winnerParticipantName : ''}</p>
      <Link to="/player/fixtures">Open fixtures</Link>
    </section>}
  </Page>
}
