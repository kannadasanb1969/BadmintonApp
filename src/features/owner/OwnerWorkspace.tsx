import { useState } from 'react'
import { Link, NavLink, Route, Routes, useParams } from 'react-router-dom'
import { AppIcon, MobileBottomNavigation } from '@/components/mobile/MobileAppShell'
import { logoutSession } from '@/api/apiClient'
import { useAuthStore } from '@/store/authStore'
import PlayerNotificationsPage from '@/features/notifications/pages/PlayerNotificationsPage'
import { AcademyForm, AcademySettings, Courts } from './Academy'
import { Assistant } from './Assistant'
import { Fees, OwnerDashboard, Receipt, Subscription, SubscriptionInvoice, SubscriptionOrder } from './Finance'
import { Members, MemberDetails } from './Members'
import { Batches, BookingDetails, Calendar, OwnerBookings } from './Operations'
import { AutoReminders, Reminders } from './Reminders'
import { ownerWrite, segment, useOwnerQuery, type Academy } from './api'
import { ActionForm, Panel, QueryState } from './ui'
import { useNotificationStore } from '@/features/notifications/services/notificationStore'
import './owner.css'

const navigation = [
  ['', 'Overview'], ['courts', 'Courts'], ['calendar', 'Calendar'], ['bookings', 'Bookings'],
  ['batches', 'Batches'], ['members', 'Members'], ['fees', 'Fees'], ['reminders', 'Reminders'],
  ['reports', 'Reports'], ['assistant', 'Assistant'], ['subscription', 'Subscription'], ['academy', 'Academy'],
]

function MemberRoute({ academy }: { academy: Academy }) {
  const { id = '' } = useParams()
  return <MemberDetails key={id} academy={academy} id={id} />
}
function BookingRoute() {
  const { id = '' } = useParams()
  return <BookingDetails key={id} id={id} />
}
function ReceiptRoute({ booking = false }: { booking?: boolean }) {
  const { id = '' } = useParams()
  return <Receipt id={id} booking={booking} />
}
function OrderRoute() {
  const { id = '' } = useParams()
  return <SubscriptionOrder id={id} />
}
function InvoiceRoute() {
  const { id = '' } = useParams()
  return <SubscriptionInvoice id={id} />
}
function IdentityReviews() {
  type Review = { id: string; reason: string; memberA: { name: string; mobile: string }; memberB: { name: string; mobile: string } }
  const reviews = useOwnerQuery<{ items: Review[] }>('/subscription/identity-reviews')
  return <Panel title="Possible duplicate members">
    <QueryState query={reviews} />
    {reviews.data?.items.length === 0 && <p>No duplicate reviews pending.</p>}
    {reviews.data?.items.map(review => <div className="owner-list-row" key={review.id}>
      <div><p>{review.memberA.name} · {review.memberA.mobile}</p><p>{review.memberB.name} · {review.memberB.mobile}</p><p>{review.reason}</p></div>
      <div className="owner-actions">
        <ActionForm label="Same person" confirm="Confirm these records belong to the same person?" perform={() => ownerWrite('/subscription/identity-reviews/' + segment(review.id) + '/resolve', { decision: 'SAME_PERSON' })} />
        <ActionForm label="Different people" confirm="Confirm these records belong to different people?" perform={() => ownerWrite('/subscription/identity-reviews/' + segment(review.id) + '/resolve', { decision: 'DIFFERENT_PEOPLE' })} />
      </div>
    </div>)}
  </Panel>
}

export default function OwnerWorkspace() {
  const role = useAuthStore(state => state.user?.role)
  const unread = useNotificationStore(state => state.unreadCount)
  const [academyId, setAcademyId] = useState('')
  const profile = useOwnerQuery<{ id: string } | null>('/profile')
  const academies = useOwnerQuery<Academy[]>('/academies', undefined, Boolean(profile.data))
  const academy = academies.data?.find(item => item.id === academyId) ?? academies.data?.[0]
  const links = navigation.filter(([path]) => academy || path === '' || path === 'subscription')
  const tabs = [
    { to: '/owner', label: 'Home', icon: 'home' as const, match: (path: string) => /^\/owner\/?$/.test(path) },
    ...(academy ? [
      { to: '/owner/courts', label: 'Courts', icon: 'courts' as const },
      { to: '/owner/bookings', label: 'Bookings', icon: 'calendar' as const },
      { to: '/owner/members', label: 'Members', icon: 'people' as const },
    ] : []),
    { to: '/owner/more', label: 'More', icon: 'more' as const, match: (path: string) => !/^\/owner(?:\/?$|\/(?:courts|bookings|members)(?:\/|$))/.test(path) },
  ]
  return <div className="owner-workspace">
    <header className="owner-top owner-no-print">
      <Link className="owner-header-action" to="/owner/more" aria-label="Owner menu"><AppIcon name="menu" /></Link>
      <Link className="owner-brand" to="/owner"><strong>Smash<span>Point</span></strong><small>OWNER</small></Link>
      <Link className="owner-header-action" to="/owner/notifications" aria-label={`Notifications${unread ? ', ' + unread + ' unread' : ''}`}>
        <AppIcon name="bell" />{unread > 0 && <i aria-hidden="true" />}
      </Link>
    </header>
    <div className="owner-layout">
      <aside className="owner-sidebar owner-no-print">
        {academies.data && academies.data.length > 1 && <label>Academy<select value={academy?.id ?? ''} onChange={event => setAcademyId(event.target.value)}>
          {academies.data.map(item => <option value={item.id} key={item.id}>{item.name}</option>)}
        </select></label>}
        <nav aria-label="Owner navigation">{links.map(([path, label]) =>
          <NavLink key={path} end={path === ''} to={path ? '/owner/' + path : '/owner'}>{label}</NavLink>,
        )}<NavLink to="/owner/notifications">Notifications</NavLink></nav>
      </aside>
      <main className="owner-content">
        <QueryState query={profile} />
        {profile.data === null && <Panel title="Set up your owner account">
          <ActionForm label="Create owner profile" confirm="Create an academy-owner profile for this account?" perform={() => ownerWrite('/profile')} />
        </Panel>}
        {profile.data && <QueryState query={academies} />}
        <Routes key={academy?.id ?? 'setup'}>
          <Route path="more" element={<Panel title="More">
            <nav className="owner-more-links" aria-label="Owner menu">{links.map(([path, label]) =>
              <Link key={path} to={path ? '/owner/' + path : '/owner'}>{label}<span aria-hidden="true">›</span></Link>,
            )}</nav>
            <div className="owner-actions">
              {role && <Link className="owner-secondary" to={'/' + role.toLowerCase() + '/dashboard'}>Switch workspace</Link>}
              <button className="owner-secondary" type="button" onClick={logoutSession}>Log out</button>
            </div>
          </Panel>} />
          <Route path="notifications" element={<Panel><PlayerNotificationsPage /></Panel>} />
          {profile.data && <>
            <Route path="subscription" element={<Subscription />} />
            <Route path="subscription/orders/:id" element={<OrderRoute />} />
            <Route path="subscription/invoices/:id" element={<InvoiceRoute />} />
            {academy ? <>
              <Route index element={<OwnerDashboard academy={academy} />} />
              <Route path="academy" element={<><AcademySettings academy={academy} /><Link className="owner-secondary" to="/owner/academy/new">Add another academy</Link></>} />
              <Route path="academy/new" element={<AcademyForm />} />
              <Route path="courts" element={<Courts academy={academy} />} />
              <Route path="calendar" element={<Calendar academy={academy} />} />
              <Route path="batches" element={<Batches academy={academy} />} />
              <Route path="bookings" element={<OwnerBookings academy={academy} />} />
              <Route path="bookings/:id" element={<BookingRoute />} />
              <Route path="booking-receipts/:id" element={<ReceiptRoute booking />} />
              <Route path="members" element={<><Link className="owner-secondary" to="/owner/members/duplicates">Review duplicate members</Link><Members academy={academy} /></>} />
              <Route path="members/duplicates" element={<IdentityReviews />} />
              <Route path="members/:id" element={<MemberRoute academy={academy} />} />
              <Route path="fees" element={<Fees academy={academy} />} />
              <Route path="receipts/:id" element={<ReceiptRoute />} />
              <Route path="reminders" element={<><Link className="owner-secondary" to="/owner/reminders/automatic">Automatic reminders</Link><Reminders academy={academy} /></>} />
              <Route path="reminders/automatic" element={<AutoReminders academy={academy} />} />
              <Route path="reports" element={<Fees academy={academy} report />} />
              <Route path="assistant" element={<Assistant academy={academy} />} />
              <Route path="*" element={<Panel title="Page unavailable"><Link to="/owner">Back to overview</Link></Panel>} />
            </> : <Route path="*" element={academies.data && <AcademyForm />} />}
          </>}
        </Routes>
      </main>
    </div>
    <MobileBottomNavigation items={tabs} />
  </div>
}
