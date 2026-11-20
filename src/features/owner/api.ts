import { useQuery } from '@tanstack/react-query'
import apiClient from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'

export type Academy = { id: string; name: string; area?: string; city?: string; state?: string; address?: string; pincode?: string; mobile?: string; mapLink?: string }
export type Court = { id: string; name: string; hourlyRate?: string; playerBookingEnabled?: boolean; status: string }
export type Batch = { id: string; courtId: string; name: string; type: string; startTime: string; endTime: string; feePerPerson: string; status: string; daysOfWeek?: number[]; effectiveFrom?: string; effectiveTo?: string }
export type Member = { id: string; name: string; mobile?: string; status: string }
export type Membership = { id: string; status: string; startDate: string; endDate?: string; batchId: string; batch?: { name: string } }
export type MemberDetail = Member & { memberships: Membership[] }
export type Fee = { id: string; memberId: string; memberName: string; batchName: string; balance: string; status: string; applicableFee: string; paidAmount: string }
export type Payment = { id: string; receiptNumber: string; amount: string; paymentMode: string; paymentDate: string; memberName?: string; allocations?: { amount: string; feeMonth?: string }[] }
export type Booking = { id: string; courtName?: string; courtId: string; customerName: string; customerMobile: string; bookingDate: string; startTime: string; endTime: string; status: string; bookingAmount?: string; paymentSummary?: { bookingAmount: string; totalPaid: string; balance: string } }
export type Window = { startTime: string; endTime: string }
export type Blocker = Window & { type: string; id?: string; blockId?: string; batchId?: string; label?: string }
export type Availability = { available: Window[]; unavailable: Blocker[]; releasedBatches: (Window & { batchId: string; label: string })[] }
export type Billing = { state: string; tier?: number; memberCapacity?: number; membersUsed: number; trialAvailable?: boolean; paymentsAvailable?: boolean; paymentMode?: string; autoPayAvailable?: boolean; pendingChange?: { kind: string; status: string }; billing?: { paidThrough: string } }
export type Plan = { tier: number; memberCapacity: number; price: string; autoPayAvailable?: boolean }
export type Order = { orderId: string; tier: number; amount: string; status: string; provider: string; checkoutReference?: string }
export type Invoice = { id: string; invoiceNumber: string; issuedAt: string; total: string; details?: { periodStart?: string; periodEnd?: string } }
export type Mandate = { id?: string; status?: string; checkoutUrl?: string; monthlyAmount?: string; nextDebitAt?: string }
export type Photo = { id: string; url: string; isCover?: boolean }
export type Album = { version: number; photos: Photo[] }

const root = '/api/owner'
export const segment = (value: string) => encodeURIComponent(value)

export async function ownerRead<T>(path: string, params?: Record<string, string>, signal?: AbortSignal): Promise<T> {
  return (await apiClient.get<T>(root + path, { params, signal })).data
}

export async function ownerWrite<T = unknown>(path: string, data: unknown = {}, method = 'POST'): Promise<T> {
  return (await apiClient.request<T>({ url: root + path, method, data })).data
}

export const ownerKey = ['owner'] as const
export function useOwnerQuery<T>(path: string, params?: Record<string, string>, enabled = true, refreshWhile?: (data: T | undefined) => boolean) {
  const user = useAuthStore(state => state.user?.id)
  return useQuery({
    queryKey: [...ownerKey, user, path, params],
    queryFn: ({ signal }) => ownerRead<T>(path, params, signal),
    enabled: Boolean(user && path && enabled),
    retry: false,
    refetchOnWindowFocus: 'always',
    refetchInterval: query => refreshWhile?.(query.state.data) ? 5000 : false,
  })
}

export async function uploadVenuePhoto(file: File, uploadId: string = crypto.randomUUID()) {
  const body = new FormData()
  body.append('file', file)
  body.append('uploadId', uploadId)
  return (await apiClient.post<Photo>(root + '/photo-uploads', body, { headers: { 'Content-Type': undefined } })).data
}
