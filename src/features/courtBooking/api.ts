import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'

type Photo = { id: string; url: string; isCover?: boolean }
export type Venue = {
  id: string
  name: string
  area?: string | null
  city?: string | null
  address?: string | null
  courtCount: number
  hourlyRate: string
  maxHourlyRate: string
  coverPhotoUrl?: string | null
  photos?: Photo[]
  distanceKm?: number
}
export type Window = { startTime: string; endTime: string; hourlyRate: string }
export type City = { stateId: string; cityId: string; state: string; city: string }
type Location = { stateId?: string; cityId?: string; lat?: number; lng?: number }
export type Selection = { venueId: string; bookingDate: string; startTime: string; endTime: string }
export type BookingPaymentOption = 'PAY_AT_COURT' | 'FULL_ONLINE' | 'ADVANCE_30'
export type Quote = {
  court: { name: string; academyName: string; hourlyRate: string; photos?: Photo[] }
  total: string
  advance?: string
  testPayments?: boolean
  onlinePaymentsAvailable?: boolean
  booker: { name: string }
  cancelUntil: string
}
export type Booking = {
  id: string
  courtName: string
  academyName: string
  bookingDate: string
  startTime: string
  endTime: string
  status: 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'EXPIRED'
  canCancel: boolean
  paymentOption?: BookingPaymentOption
  amountDueNow?: string
  holdExpiresAt?: string | null
  paymentSummary: { bookingAmount: string; totalPaid: string; balance: string }
}
export type Checkout = Selection & { quotedAmount: string; idempotencyKey: string; paymentOption: BookingPaymentOption }

export const bookingKey = ['court-booking'] as const
const venuePath = (id: string) => '/api/player-venues/' + encodeURIComponent(id)
const bookingPath = (id: string) => '/api/court-bookings/' + encodeURIComponent(id)

export const bookingApi = {
  async cities(signal?: AbortSignal) {
    return (await apiClient.get<{ popularCities?: City[] }>('/api/locations/status', { signal })).data.popularCities ?? []
  },
  async venues(search: string, location: Location, signal?: AbortSignal) {
    const { data } = await apiClient.get<{ venues: Venue[]; cityReferenceUnavailable?: boolean; testPayments?: boolean; onlinePaymentsAvailable?: boolean }>('/api/player-venues', {
      signal, params: { search, ...location, radiusKm: 50, nearby: true },
    })
    return data
  },
  async month(id: string, month: string, signal?: AbortSignal) {
    return (await apiClient.get<{ venue: Venue; days: { date: string; status: 'FREE' | 'PARTIAL' | 'FULL' | 'PAST' }[] }>(
      venuePath(id) + '/availability-month', { params: { month }, signal },
    )).data
  },
  async day(id: string, date: string, signal?: AbortSignal) {
    return (await apiClient.get<{ venue: Venue; windows: Window[] }>(
      venuePath(id) + '/availability', { params: { date }, signal },
    )).data
  },
  async quote(selection: Selection) {
    return (await apiClient.post<Quote>('/api/court-bookings/quote', selection)).data
  },
  async create(input: Checkout) {
    return (await apiClient.post<Booking>('/api/court-bookings', input)).data
  },
  async history(signal?: AbortSignal) {
    return (await apiClient.get<Booking[]>('/api/court-bookings', { signal })).data
  },
  async details(id: string, signal?: AbortSignal) {
    return (await apiClient.get<Booking>(bookingPath(id), { signal })).data
  },
  async testPayment(id: string, scenario: 'SUCCESS' | 'FAILURE') {
    return (await apiClient.post<Booking>(bookingPath(id) + '/test-payment', { scenario })).data
  },
  async cancel(id: string) {
    return (await apiClient.post<Booking>(bookingPath(id) + '/cancel')).data
  },
}

export function useBookingQuery<T>(key: unknown[], read: (signal: AbortSignal) => Promise<T>) {
  const userId = useAuthStore(state => state.user?.id)
  return useQuery({
    queryKey: [...bookingKey, userId, ...key],
    queryFn: ({ signal }) => read(signal),
    enabled: Boolean(userId),
    retry: false,
  })
}
