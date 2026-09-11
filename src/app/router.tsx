import { createBrowserRouter } from 'react-router-dom'
import HomePage from '@/pages/public/HomePage'
import LoginPage from '@/pages/public/LoginPage'
import PlayerDashboard from '@/pages/player/PlayerDashboard'
import OrganizerDashboard from '@/pages/organizer/OrganizerDashboard'
import AdminDashboard from '@/pages/admin/AdminDashboard'
import NotFoundPage from '@/pages/errors/NotFoundPage'
import UnauthorizedPage from '@/pages/errors/UnauthorizedPage'
import ProtectedRoute from '@/routes/ProtectedRoute'
import RoleRoute from '@/routes/RoleRoute'
import PlayerLayout from '@/layouts/PlayerLayout'
import OrganizerLayout from '@/layouts/OrganizerLayout'
import AdminLayout from '@/layouts/AdminLayout'
import PlayerProfilePage from '@/features/player/pages/PlayerProfilePage'
import TournamentListPage from '@/features/organizer/pages/TournamentListPage'
import CreateTournamentPage from '@/features/organizer/pages/CreateTournamentPage'
import TournamentDetailPage from '@/features/organizer/pages/TournamentDetailPage'
import AdminTournamentListPage from '@/pages/admin/TournamentListPage'
import AdminTournamentReviewPage from '@/pages/admin/TournamentReviewPage'
import PlayerTournamentListPage from '@/features/player/pages/PlayerTournamentListPage'
import PlayerTournamentDetailPage from '@/features/player/pages/PlayerTournamentDetailPage'
import PlayerRegistrationsPage from '@/features/player/pages/RegistrationsPage'
import PartnerChoicePage from '@/features/player/pages/PartnerChoicePage'
import ExistingPartnerSearchPage from '@/features/player/pages/ExistingPartnerSearchPage'
import GuestPartnerFormPage from '@/features/player/pages/GuestPartnerFormPage'
import DoubleRegistrationConfirmationPage from '@/features/player/pages/DoubleRegistrationConfirmationPage'
import PlayerFixturesPage from '@/features/player/pages/PlayerFixturesPage'
import PlayersPage from '@/features/player/pages/PlayersPage'
import TournamentRegistrationsPage from '@/features/organizer/pages/TournamentRegistrationsPage'
import MatchScoringPage from '@/features/organizer/pages/MatchScoringPage'
import CategoryFixturePage from '@/features/organizer/pages/CategoryFixturePage'
import PlayerNotificationsPage from '@/features/notifications/pages/PlayerNotificationsPage'
import OrganizerNotificationsPage from '@/features/notifications/pages/OrganizerNotificationsPage'
import AdminNotificationsPage from '@/features/notifications/pages/AdminNotificationsPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />
  },
  {
    path: '/login',
    element: <LoginPage />
  },
  {
    path: '/player',
    element: (
      <ProtectedRoute>
        <RoleRoute roles={[ 'PLAYER' ]}>
          <PlayerLayout />
        </RoleRoute>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <PlayerDashboard /> },
      { path: 'dashboard', element: <PlayerDashboard /> },
      { path: 'profile', element: <PlayerProfilePage /> },
      { path: 'profile/edit', element: <PlayerProfilePage /> },
      // Player tournament routes
      {
        path: 'tournaments',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <PlayerTournamentListPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournaments/:tournamentId',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <PlayerTournamentDetailPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      // Doubles partner selection routes
      {
        path: 'tournaments/:tournamentId/doubles/:categoryId/partner',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <PartnerChoicePage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournaments/:tournamentId/doubles/:categoryId/partner/search',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <ExistingPartnerSearchPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournaments/:tournamentId/doubles/:categoryId/guest',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <GuestPartnerFormPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'tournaments/:tournamentId/doubles/:categoryId/confirm',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <DoubleRegistrationConfirmationPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'registrations',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <PlayerRegistrationsPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      { path: 'fixtures', element: <PlayerFixturesPage /> },
      {
        path: 'players',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <PlayersPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      {
        path: 'notifications',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'PLAYER' ]}>
              <PlayerNotificationsPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
    ]
  },
  {
    path: '/organizer',
    element: (
      <ProtectedRoute>
        <RoleRoute roles={[ 'ORGANIZER' ]}>
          <OrganizerLayout />
        </RoleRoute>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <OrganizerDashboard /> },
      { path: 'dashboard', element: <OrganizerDashboard /> },
      // FLAT organizer child routes for tournaments (not nested under TournamentListPage)
      { path: 'tournaments', element: <TournamentListPage /> },
      { path: 'tournaments/new', element: <CreateTournamentPage /> },
      { path: 'tournaments/:tournamentId', element: <TournamentDetailPage /> },
      { path: 'tournaments/:tournamentId/edit', element: <CreateTournamentPage /> },
      { path: 'tournaments/:tournamentId/registrations', element: <TournamentRegistrationsPage /> },
      // Organizer tournament category routes
      {
        path: 'tournaments/:tournamentId/categories/:categoryId',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'ORGANIZER' ]}>
              <CategoryFixturePage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      // Organizer match scoring route
      {
        path: 'tournaments/:tournamentId/categories/:categoryId/matches/:matchId/score',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'ORGANIZER' ]}>
              <MatchScoringPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
      // Organizer notifications route
      {
        path: 'notifications',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'ORGANIZER' ]}>
              <OrganizerNotificationsPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      },
    ]
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <RoleRoute roles={[ 'ADMIN' ]}>
          <AdminLayout />
        </RoleRoute>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: 'dashboard', element: <AdminDashboard /> },
      { path: 'tournaments', element: <AdminTournamentListPage /> },
      { path: 'tournaments/:tournamentId', element: <AdminTournamentReviewPage /> },
      { path: 'notifications',
        element: (
          <ProtectedRoute>
            <RoleRoute roles={[ 'ADMIN' ]}>
              <AdminNotificationsPage />
            </RoleRoute>
          </ProtectedRoute>
        ),
      }
    ]
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />
  },
  {
    path: '*',
    element: <NotFoundPage />
  }
])

export default router
