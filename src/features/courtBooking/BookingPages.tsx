import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '@/api/apiClient'
import { bookingApi, bookingKey, useBookingQuery, type Booking, type BookingPaymentOption, type Checkout, type Quote, type Selection, type Venue } from './api'
import './booking.css'

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })
const indiaDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' })
const readableDate = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const todayInIndia = () => {
  const parts = indiaDate.formatToParts(new Date())
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}
const dateLabel = (date: string) => readableDate.format(new Date(date + 'T00:00:00Z'))
const timeLabel = (time: string) => time.slice(0, 5)
const money = (amount: string) => currency.format(Number(amount))
const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please try again.'

function BookingPage({ title, children, history = false }: { title: string; children: ReactNode; history?: boolean }) {
  return <section className="court-booking-page">
    <header className="court-booking-header">
      <h1>{title}</h1>
      <Link className="court-outline" to={history ? '/player/courts' : '/player/court-bookings'}>
        {history ? 'Find courts' : 'My bookings'}
      </Link>
    </header>
    {children}
  </section>
}

function LoadState({ pending, error, retry }: { pending: boolean; error: unknown; retry: () => void }) {
  if (pending) return <p role="status" className="court-panel">Loading…</p>
  if (!error) return null
  return <div className="court-panel" role="alert"><p>{errorMessage(error)}</p><button className="court-outline" onClick={retry}>Try again</button></div>
}

const photosOf = (venue: Venue) => Array.from(new Set([
  venue.coverPhotoUrl, ...(venue.photos ?? []).map(photo => photo.url),
].filter((url): url is string => Boolean(url))))

function VenuePhoto({ url, name }: { url?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  if (!url || failed) return <div className="court-image court-image-placeholder" aria-hidden="true"><span>🏸</span></div>
  return <img className="court-image" src={url} alt={name} loading="lazy" onError={() => setFailed(true)} />
}

export function CourtsPage() {
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [cityId, setCityId] = useState('')
  const [position, setPosition] = useState<{ lat: number; lng: number } | null>(null)
  const [positionPending, setPositionPending] = useState(false)
  const [positionError, setPositionError] = useState('')
  const cities = useBookingQuery(['cities'], bookingApi.cities)
  const city = cities.data?.find(item => item.cityId === cityId)
  const location = position ?? (city ? { stateId: city.stateId, cityId: city.cityId } : {})
  const venues = useBookingQuery(['venues', search, location], signal => bookingApi.venues(search, location, signal))
  const updateSearch = (event: FormEvent) => {
    event.preventDefault()
    setSearch(input.trim())
  }
  const locate = () => {
    setPositionError('')
    if (!navigator.geolocation) {
      setPositionError('Location is unavailable in this browser. Search by city or academy instead.')
      return
    }
    setPositionPending(true)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPosition({ lat: coords.latitude, lng: coords.longitude })
      setCityId('')
      setPositionPending(false)
    }, () => {
      setPositionError('Could not get your location. Check browser permissions or search by city.')
      setPositionPending(false)
    }, { timeout: 10000 })
  }

  return <BookingPage title="Find badminton courts">
    <form className="court-panel court-search" onSubmit={updateSearch}>
      <label>Academy or city<input type="search" value={input} onChange={event => setInput(event.target.value)} placeholder="Search courts" /></label>
      <button className="court-primary" type="submit">Search</button>
      {Boolean(cities.data?.length) && <label>Popular cities
        <select value={cityId} disabled={positionPending} onChange={event => { setCityId(event.target.value); setPosition(null); setPositionError('') }}>
          <option value="">All cities</option>
          {cities.data?.map(item => <option key={item.cityId} value={item.cityId}>{item.city}, {item.state}</option>)}
        </select>
      </label>}
      <button className="court-outline" type="button" disabled={positionPending} onClick={locate}>{positionPending ? 'Locating…' : 'Use my location'}</button>
      {position && <button className="court-outline" type="button" onClick={() => setPosition(null)}>Clear location</button>}
      {positionError && <p role="alert">{positionError}</p>}
    </form>
    <LoadState pending={venues.isPending} error={venues.error} retry={() => void venues.refetch()} />
    {venues.data?.cityReferenceUnavailable && <p role="status">Nearby search is unavailable for this city. Showing venues registered in the city.</p>}
    {venues.data?.venues.length === 0 && <p className="court-panel">No bookable venues match your search.</p>}
    <div className="court-venue-grid">
      {venues.data?.venues.map(venue => <article key={venue.id} className="court-panel court-venue-card">
        <VenuePhoto key={photosOf(venue)[0]} url={photosOf(venue)[0]} name={venue.name} />
        <div className="court-card-body">
          <h2>{venue.name}</h2>
          <p>{[venue.area, venue.city].filter(Boolean).join(', ') || venue.address || 'Address unavailable'}</p>
          <p>{venue.courtCount} {venue.courtCount === 1 ? 'court' : 'courts'}{venue.distanceKm != null ? ` · ${venue.distanceKm.toFixed(1)} km` : ''}</p>
          <div className="court-card-footer"><strong>{venue.hourlyRate !== venue.maxHourlyRate ? 'From ' : ''}{money(venue.hourlyRate)}/hr</strong>
            <Link className="court-primary" to={`/player/courts/${encodeURIComponent(venue.id)}`}>View slots</Link>
          </div>
        </div>
      </article>)}
    </div>
  </BookingPage>
}

export function VenueBookingPage() {
  const { venueId = '' } = useParams()
  const navigate = useNavigate()
  const client = useQueryClient()
  const [date, setDate] = useState(todayInIndia)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [checkout, setCheckout] = useState<{ quote: Quote; request: Checkout } | null>(null)
  const [error, setError] = useState('')
  const submitted = useRef(false)
  const day = useBookingQuery(['day', venueId, date], signal => bookingApi.day(venueId, date, signal))
  const month = useBookingQuery(['month', venueId, date.slice(0, 7)], signal => bookingApi.month(venueId, date.slice(0, 7), signal))
  const venue = day.data?.venue ?? month.data?.venue
  const starts = [...new Set(day.data?.windows.map(slot => slot.startTime) ?? [])].sort()
  const ends = day.data?.windows.filter(slot => slot.startTime === start).map(slot => slot.endTime).sort() ?? []
  const upcomingDays = month.data?.days.filter(item => item.date >= todayInIndia()).slice(0, 7) ?? []
  const validSlot = Boolean(start && end && ends.includes(end))
  const quote = useMutation({ mutationFn: bookingApi.quote })
  const create = useMutation({ mutationFn: bookingApi.create })
  const resetReview = () => { setCheckout(null); setError('') }
  const chooseDate = (value: string) => {
    if (!value || value < todayInIndia()) return
    setDate(value); setStart(''); setEnd(''); resetReview()
  }
  const review = async (event: FormEvent) => {
    event.preventDefault()
    if (!validSlot || submitted.current) return
    submitted.current = true
    resetReview()
    const selection: Selection = { venueId, bookingDate: date, startTime: start, endTime: end }
    try {
      const result = await quote.mutateAsync(selection)
      setCheckout({ quote: result, request: { ...selection, quotedAmount: result.total, paymentOption: 'PAY_AT_COURT', idempotencyKey: crypto.randomUUID() } })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      submitted.current = false
    }
  }
  const confirm = async () => {
    if (!checkout || submitted.current) return
    submitted.current = true
    setError('')
    try {
      const booking = await create.mutateAsync(checkout.request)
      void client.invalidateQueries({ queryKey: bookingKey })
      navigate(`/player/court-bookings/${encodeURIComponent(booking.id)}`)
    } catch (cause) {
      // If the response is lost, keep the same checkout key so a retry recovers the original booking.
      if (cause instanceof ApiError && cause.status === 409) {
        setCheckout(null)
        void day.refetch()
        void month.refetch()
      }
      setError(errorMessage(cause))
    } finally {
      submitted.current = false
    }
  }
  const busy = quote.isPending || create.isPending
  const updatePayment = (paymentOption: BookingPaymentOption) => {
    if (!checkout || checkout.request.paymentOption === paymentOption) return
    setCheckout({ ...checkout, request: { ...checkout.request, paymentOption, idempotencyKey: crypto.randomUUID() } })
  }
  return <BookingPage title={venue?.name ?? 'Court availability'}>
    <Link className="court-back" to="/player/courts">← All courts</Link>
    {!!venue && <div className="court-panel">
      {venue.address && <p>{venue.address}</p>}
      <div className="court-photo-row">{photosOf(venue).map(url => <VenuePhoto key={url} name={venue.name} url={url} />)}</div>
    </div>}
    <form className="court-panel court-slot-form" onSubmit={review}>
      <h2>Choose a slot</h2>
      <fieldset disabled={busy || Boolean(checkout)}>
        <label>Date (IST)<input type="date" value={date} min={todayInIndia()} onChange={event => chooseDate(event.target.value)} required /></label>
        {upcomingDays.length > 0 && <div className="court-days" aria-label="Upcoming dates">
          {upcomingDays.map(item => <button type="button" key={item.date} className="court-outline" aria-pressed={date === item.date} onClick={() => chooseDate(item.date)}>
            {dateLabel(item.date)}{item.status === 'FULL' ? ' · Limited' : ''}
          </button>)}
        </div>}
        {month.data && <p>{month.data.days.find(item => item.date === date)?.status === 'FULL' ? 'Limited availability. Check the available times below.' : 'Times are shown in IST.'}</p>}
        <LoadState pending={day.isPending} error={day.error} retry={() => void day.refetch()} />
        {day.data && starts.length === 0 && <p>No available slots for {dateLabel(date)}.</p>}
        {starts.length > 0 && <div className="court-time-fields">
          <label>Start time<select value={start} required onChange={event => { setStart(event.target.value); setEnd(''); resetReview() }}>
            <option value="">Select start</option>{starts.map(value => <option key={value} value={value}>{timeLabel(value)}</option>)}
          </select></label>
          <label>End time<select value={end} required disabled={!start} onChange={event => { setEnd(event.target.value); resetReview() }}>
            <option value="">Select end</option>{ends.map(value => <option key={value} value={value}>{timeLabel(value)}</option>)}
          </select></label>
        </div>}
      </fieldset>
      {!checkout && <button type="submit" className="court-primary" disabled={!validSlot || busy}>{quote.isPending ? 'Checking…' : 'Review booking'}</button>}
    </form>
    {error && <div className="court-panel court-error" role="alert">{error} {!checkout && <Link to="/player/profile">View player profile</Link>}</div>}
    {checkout && <section className="court-panel court-review">
      <h2>Review booking</h2>
      <p>{checkout.quote.booker.name} · {dateLabel(date)} · {timeLabel(start)}–{timeLabel(end)} IST</p>
      <p>Available court: {checkout.quote.court.name}</p>
      <p>Total <strong>{money(checkout.quote.total)}</strong></p>
      {checkout.quote.testPayments && checkout.quote.onlinePaymentsAvailable ? <label>Payment option
        <select value={checkout.request.paymentOption} disabled={busy || create.isError} onChange={event => updatePayment(event.target.value as BookingPaymentOption)}>
          <option value="PAY_AT_COURT">Pay at court</option><option value="FULL_ONLINE">Full test payment</option><option value="ADVANCE_30">30% test advance</option>
        </select>
      </label> : <p>Pay at court</p>}
      {checkout.request.paymentOption === 'ADVANCE_30' && checkout.quote.advance && <p>Test advance {money(checkout.quote.advance)}</p>}
      <p>{Date.parse(checkout.quote.cancelUntil) <= Date.now() ? 'Cancellation is closed for this slot.' : 'Cancellation is available until five hours before the slot starts.'} Payments are non-refundable.</p>
      <div className="court-actions">
        <button className="court-primary" disabled={busy} onClick={() => void confirm()}>{create.isPending ? 'Confirming…' : checkout.request.paymentOption === 'PAY_AT_COURT' ? 'Confirm booking' : 'Start test checkout'}</button>
        <button className="court-outline" disabled={busy} onClick={resetReview}>Change slot</button>
      </div>
    </section>}
  </BookingPage>
}

function BookingSummary({ booking }: { booking: Booking }) {
  return <>
    <h2>{booking.academyName}</h2>
    <p>{booking.courtName} · {booking.status.toLowerCase()}</p>
    <p>{dateLabel(booking.bookingDate)} · {timeLabel(booking.startTime)}–{timeLabel(booking.endTime)} IST</p>
    <p>Total <strong>{money(booking.paymentSummary.bookingAmount)}</strong> · Paid {money(booking.paymentSummary.totalPaid)} · Balance {money(booking.paymentSummary.balance)}</p>
  </>
}

export function BookingHistoryPage() {
  const history = useBookingQuery(['history'], bookingApi.history)
  return <BookingPage title="My court bookings" history>
    <LoadState pending={history.isPending} error={history.error} retry={() => void history.refetch()} />
    {history.data?.length === 0 && <p className="court-panel">Your court bookings will appear here.</p>}
    <div className="court-venue-grid">
      {history.data?.map(booking => <article key={booking.id} className="court-panel court-review">
        <BookingSummary booking={booking} />
        <Link className="court-outline" to={`/player/court-bookings/${encodeURIComponent(booking.id)}`}>Booking details</Link>
      </article>)}
    </div>
  </BookingPage>
}

export function BookingDetailsPage() {
  const { bookingId = '' } = useParams()
  const client = useQueryClient()
  const [confirmCancel, setConfirmCancel] = useState(false)
  const details = useBookingQuery(['details', bookingId], signal => bookingApi.details(bookingId, signal))
  const awaitingPayment = details.data?.status === 'PENDING' && details.data.paymentOption !== 'PAY_AT_COURT'
  const capabilities = useBookingQuery(['checkout-capabilities', awaitingPayment], signal =>
    awaitingPayment ? bookingApi.venues('', {}, signal) : Promise.resolve(null),
  )
  const testPayment = useMutation({
    mutationFn: (scenario: 'SUCCESS' | 'FAILURE') => bookingApi.testPayment(bookingId, scenario),
    onSuccess: () => client.invalidateQueries({ queryKey: bookingKey }),
  })
  const cancel = useMutation({
    mutationFn: () => bookingApi.cancel(bookingId),
    onSuccess: async () => {
      setConfirmCancel(false)
      await client.invalidateQueries({ queryKey: bookingKey })
    },
  })
  return <BookingPage title="Booking details">
    <LoadState pending={details.isPending} error={details.error} retry={() => void details.refetch()} />
    {details.data && <article className="court-panel court-review">
      <BookingSummary booking={details.data} />
      {awaitingPayment && capabilities.data?.testPayments && capabilities.data.onlinePaymentsAvailable && <section className="court-review" aria-label="Test checkout">
        <p>Test payment. No real money is charged.</p>
        {details.data.amountDueNow && <p>Due now {money(details.data.amountDueNow)}</p>}
        <div className="court-actions">
          <button className="court-primary" disabled={testPayment.isPending || cancel.isPending} onClick={() => testPayment.mutate('SUCCESS')}>Simulate payment</button>
          <button className="court-outline" disabled={testPayment.isPending || cancel.isPending} onClick={() => testPayment.mutate('FAILURE')}>Simulate failure</button>
        </div>
        {testPayment.error && <p role="alert">{errorMessage(testPayment.error)}</p>}
      </section>}
      {(details.data.canCancel || awaitingPayment) && <button className="court-outline" disabled={confirmCancel} onClick={() => setConfirmCancel(true)}>Cancel booking</button>}
      {confirmCancel && <section className="court-review" aria-label="Confirm cancellation">
        <p>This releases your slot. Payments are non-refundable.</p>
        <div className="court-actions">
          <button className="court-primary" disabled={cancel.isPending} onClick={() => cancel.mutate()}>Confirm cancellation</button>
          <button className="court-outline" disabled={cancel.isPending} onClick={() => { setConfirmCancel(false); cancel.reset() }}>Keep booking</button>
        </div>
      </section>}
      {cancel.error && <p role="alert">{errorMessage(cancel.error)}</p>}
    </article>}
  </BookingPage>
}
