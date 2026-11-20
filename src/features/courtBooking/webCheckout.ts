import apiClient, { isExplicitMockApiMode, webApiBaseUrl, webApiPath } from '@/api/apiClient'
import type { Booking, Checkout } from './api'

type Order = { id: string; amount: number; currency: 'INR'; keyId: string }
type Proof = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
type WebCheckout = { checkoutId: string; booking: Booking; order?: Order; paymentStatus: 'AWAITING_PAYMENT' | 'CAPTURED' }
type RazorpayConstructor = new (options: {
  order_id: string; key: string; amount: number; currency: string; name: string; description: string
  handler: (proof: Proof) => void; modal: { ondismiss: () => void }
}) => { open: () => void }
const config = { baseURL: webApiBaseUrl }
const path = webApiPath + '/court-bookings/checkouts'
const checkoutPath = (id: string) => path + '/' + encodeURIComponent(id)
const storageKey = (bookingId: string) => 'smash-karo-web-checkout:' + bookingId
export const webCheckoutEnabled = Boolean(webApiBaseUrl) && !isExplicitMockApiMode && import.meta.env.VITE_WEB_RAZORPAY_TEST === '1'

export const webCheckoutApi = {
  async start(input: Checkout) {
    const { data } = await apiClient.post<WebCheckout>(path, input, config)
    try { localStorage.setItem(storageKey(data.booking.id), data.checkoutId) } catch { /* Use the checkout URL. */ }
    return data
  },
  savedCheckout(bookingId: string) {
    try { return localStorage.getItem(storageKey(bookingId)) } catch { return null }
  },
  async status(id: string, signal?: AbortSignal) {
    return (await apiClient.get<WebCheckout>(checkoutPath(id), { ...config, signal })).data
  },
  async verify(id: string, proof?: Proof) {
    return (await apiClient.post<WebCheckout>(checkoutPath(id) + '/verify', proof ?? {}, config)).data
  },
  async release(id: string) {
    await apiClient.delete(checkoutPath(id) + '/hold', config)
  },
}

let scriptLoad: Promise<RazorpayConstructor> | undefined
function razorpayScript() {
  const getRazorpay = () => (window as Window & { Razorpay?: RazorpayConstructor }).Razorpay
  const existing = getRazorpay()
  if (existing) return Promise.resolve(existing)
  scriptLoad ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    const failed = () => { script.remove(); reject(new Error('Could not load Razorpay test checkout. Try again.')) }
    script.onload = () => {
      const Razorpay = getRazorpay()
      if (Razorpay) resolve(Razorpay)
      else failed()
    }
    script.onerror = failed
    document.head.append(script)
  }).catch(error => { scriptLoad = undefined; throw error })
  return scriptLoad
}

export async function openTestCheckout(order: Order): Promise<Proof | null> {
  if (!order.keyId.startsWith('rzp_test_')) throw new Error('A Razorpay test key is required.')
  const Razorpay = await razorpayScript()
  return new Promise(resolve => new Razorpay({
    order_id: order.id, key: order.keyId, amount: order.amount, currency: order.currency,
    name: 'Smash Karo', description: 'Court booking test payment',
    handler: resolve, modal: { ondismiss: () => resolve(null) },
  }).open())
}
