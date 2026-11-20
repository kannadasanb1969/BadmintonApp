import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { create } from 'zustand'
import apiClient from '@/api/apiClient'

export type DirectoryCity = { cityId: string; stateId: string; city: string; state: string }
export type DiscoveryLocation = { city: DirectoryCity } | { lat: number; lng: number }
export const useDiscoveryLocation = create<{ location: DiscoveryLocation | null; setLocation: (location: DiscoveryLocation | null) => void }>(set => ({
  location: null, setLocation: location => set({ location }),
}))
export function locationParams(location: DiscoveryLocation) {
  return 'city' in location ? { cityId: location.city.cityId, stateId: location.city.stateId } : { lat: location.lat, lng: location.lng }
}

export function CityPicker({ value, onChange }: { value?: DirectoryCity | null; onChange: (city: DirectoryCity | null) => void }) {
  const [search, setSearch] = useState('')
  const [query, setQuery] = useState('')
  const [stateId, setStateId] = useState('')
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [search])
  const states = useQuery({
    queryKey: ['location-directory', 'states'], enabled: !value, retry: false,
    queryFn: async ({ signal }) => (await apiClient.get<{ states: { stateId: string; name: string }[] }>('/api/locations/states', { signal })).data.states,
  })
  const cities = useQuery({
    queryKey: ['location-directory', 'cities', stateId, query], enabled: !value, retry: false,
    queryFn: async ({ signal }) => (await apiClient.get<{ cities: DirectoryCity[] }>('/api/locations/cities', { params: { q: query, stateId: stateId || undefined }, signal })).data.cities,
  })
  const control = 'min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-900'
  if (value) return <div className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-950">
    <strong>{value.city}, {value.state}</strong>
    <button className={control} type="button" onClick={() => { setSearch(''); setQuery(''); onChange(null) }}>Remove city</button>
  </div>
  return <div className="grid gap-2 rounded-lg bg-emerald-50 p-3 text-emerald-950">
    <div className="flex flex-wrap gap-2">
      <label className="grid gap-1">State<select className={control} value={stateId} onChange={event => setStateId(event.target.value)}>
        <option value="">All states</option>{states.data?.map(state => <option key={state.stateId} value={state.stateId}>{state.name}</option>)}</select></label>
      <label className="grid gap-1">Search city<input className={control} type="search" value={search} onChange={event => setSearch(event.target.value)} /></label>
      <label className="grid gap-1">City<select className={control} value="" onChange={event => {
        const next = cities.data?.find(city => city.cityId === event.target.value)
        if (next) onChange(next)
      }}><option value="">Choose a city</option>{cities.data?.map(city => <option key={city.cityId} value={city.cityId}>{city.city}, {city.state}</option>)}</select></label>
    </div>
    {cities.isLoading && <p role="status">Searching cities…</p>}
    {cities.error && <p role="alert">Could not load cities. <button className={control} type="button" onClick={() => void cities.refetch()}>Retry</button></p>}
  </div>
}

export function PlayerLocationPicker() {
  const { location, setLocation } = useDiscoveryLocation()
  const [locating, setLocating] = useState(false)
  const [error, setError] = useState('')
  const [alertStatus, setAlertStatus] = useState('')
  const [savingAlerts, setSavingAlerts] = useState(false)
  const useLocation = () => {
    setError('')
    if (!navigator.geolocation) { setError('Location is unavailable in this browser.'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocation({ lat: coords.latitude, lng: coords.longitude })
      setLocating(false)
    }, () => {
      setError('Could not access your location. Check browser permissions or choose a city.')
      setLocating(false)
    }, { timeout: 10000 })
  }
  const updateNearbyAlerts = async (enable: boolean) => {
    if (enable && !location) return
    setSavingAlerts(true)
    setAlertStatus('')
    try {
      const selected = enable ? location : null
      const payload = selected ? 'city' in selected
        ? { source: 'CITY', cityId: selected.city.cityId, stateId: selected.city.stateId }
        : { source: 'GPS', latitude: selected.lat, longitude: selected.lng }
        : { source: 'CLEAR' }
      const { data } = await apiClient.post<{ enabled: boolean; nearbyAlertsAvailable?: boolean }>('/api/notification-location', payload)
      setAlertStatus(!data.enabled ? 'Nearby alerts are unavailable on this backend.' : !enable ? 'Nearby alerts disabled.' :
        data.nearbyAlertsAvailable ? 'Nearby tournament alerts enabled.' : 'City saved. Nearby alerts may require device location.')
    } catch (cause) {
      setAlertStatus(cause instanceof Error ? cause.message : 'Could not update nearby alerts.')
    } finally { setSavingAlerts(false) }
  }
  return <div className="grid gap-2">
    <CityPicker value={location && 'city' in location ? location.city : null} onChange={city => setLocation(city ? { city } : null)} />
    <div className="flex flex-wrap gap-2"><button type="button" className="rounded-lg bg-emerald-700 px-3 py-2 font-semibold text-white" onClick={useLocation} disabled={locating}>{locating ? 'Locating…' : 'Use my location'}</button>
      {location && 'lat' in location && <button type="button" className="rounded-lg bg-white px-3 py-2 text-emerald-950" onClick={() => setLocation(null)}>Clear current location</button>}
    </div>
    <div className="flex flex-wrap gap-2">
      {location && <button type="button" className="rounded-lg border border-emerald-700 bg-white px-3 py-2" disabled={savingAlerts} onClick={() => void updateNearbyAlerts(true)}>Enable nearby tournament alerts</button>}
      <button type="button" className="rounded-lg border border-emerald-700 bg-white px-3 py-2" disabled={savingAlerts} onClick={() => void updateNearbyAlerts(false)}>Clear saved alert location</button>
    </div>
    {error && <p role="alert">{error}</p>}
    {alertStatus && <p role="status">{alertStatus}</p>}
  </div>
}
