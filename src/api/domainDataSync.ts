import apiClient from '@/api/apiClient'
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore'
import { useRegistrationStore } from '@/features/registrations/store/registrationStore'
import { useTeamStore } from '@/features/teams/store/teamStore'
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore'
import { useResultStore } from '@/features/fixtures/store/resultStore'
import { useMedalHistoryStore } from '@/features/medals/store/medalHistoryStore'
import { useNotificationStore } from '@/features/notifications/services/notificationStore'
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore'
import { useGuestPlayerStore } from '@/features/player/store/guestPlayerStore'

type RecordWithId = { id: string }
type StoreApi = { getState: () => any; setState: (state: any) => void; subscribe: (listener: (state: any, previous: any) => void) => () => void }
const fetchCollection = async <T,>(collection: string) => (await apiClient.get<T[]>(`/${collection}`)).data
const equal = (one: unknown, two: unknown) => JSON.stringify(one) === JSON.stringify(two)

const writeThrough = (store: StoreApi, key: string, collection: string) => store.subscribe((next, previous) => {
  const current = (next[key] as RecordWithId[]) ?? []
  const before = (previous[key] as RecordWithId[]) ?? []
  const beforeById = new Map(before.map(item => [item.id, item]))
  const currentIds = new Set(current.map(item => item.id))
  current.forEach(item => { const old = beforeById.get(item.id); if (!old) void apiClient.post(`/${collection}`, item).catch(() => undefined); else if (!equal(old, item)) void apiClient.put(`/${collection}/${item.id}`, item).catch(() => undefined) })
  before.filter(item => !currentIds.has(item.id)).forEach(item => void apiClient.delete(`/${collection}/${item.id}`).catch(() => undefined))
})

let started = false
export const hydrateAndSyncDomainData = async () => {
  if (started) return
  const sources: Array<[StoreApi, string, string]> = [
    [useTournamentStore, 'tournaments', 'tournaments'], [useRegistrationStore, 'registrations', 'registrations'], [useTeamStore, 'teams', 'teams'], [useFixtureStore, 'fixtures', 'fixtures'], [useResultStore, 'results', 'results'], [useMedalHistoryStore, 'medalHistory', 'medals'], [useNotificationStore, 'notifications', 'notifications'], [usePlayerDirectoryStore, 'profiles', 'players'], [useGuestPlayerStore, 'guests', 'guest-players'],
  ]
  try { await Promise.all(sources.map(async ([store, key, collection]) => store.setState({ [key]: await fetchCollection(collection) }))) } catch { return }
  sources.forEach(([store, key, collection]) => writeThrough(store, key, collection))
  started = true
}
