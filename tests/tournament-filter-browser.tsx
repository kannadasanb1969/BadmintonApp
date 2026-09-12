// Browser-only test harness. This file is not imported by the application.
import React from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { useTournamentStore } from '../src/features/tournaments/store/tournamentStore'
import { useResultStore } from '../src/features/fixtures/store/resultStore'
import apiClient from '../src/api/apiClient'
import Page from '../src/features/player/pages/PlayerTournamentListPage'
import PlayerLayout from '../src/layouts/PlayerLayout'
const category = { id: 'c', name: 'Singles', eventType: 'SINGLES', registrationPhase: 'OPEN' }
const base = { name: 'Smash Open Older', status: 'PUBLISHED', createdAt: '2026-09-01', tournamentDate: '2099-09-30', registrationCloseDate: '2099-09-28', registrationCloseTime: '18:00', venueName: 'Test Court', registeredPlayerCount: 4, categories: [category] }
const tournaments = [
  { ...base, id: 'older' },
  { ...base, id: 'closed', name: 'Smash Closed', categories: [{ ...category, registrationPhase: 'CLOSED' }] },
  { ...base, id: 'single', name: 'Smash Singles Complete', categories: [{ ...category, registrationPhase: 'CLOSED' }] },
  { ...base, id: 'double', name: 'Smash Doubles Complete', registeredTeamCount: 2, categories: [{ ...category, eventType: 'DOUBLES', registrationPhase: 'CLOSED' }] },
  { ...base, id: 'newer', name: 'Smash Open Newest', createdAt: '2026-09-12' },
]
const result = { categoryId: 'c', completedAt: '2026-09-12T01:00:00Z', winnerParticipantId: 'p1', runnerUpParticipantId: 'p2', winnerParticipantType: 'PLAYER', runnerUpParticipantType: 'PLAYER' }
const results = [{ ...result, id: 'r1', tournamentId: 'single' }, { ...result, id: 'r2', tournamentId: 'double', winnerParticipantId: 'team1', runnerUpParticipantId: 'team2', winnerParticipantType: 'TEAM', runnerUpParticipantType: 'TEAM' }]
const data = {
  '/api/results': results, '/api/tournaments': tournaments,
  '/api/players': [{ id: 'p1', fullName: 'Karthik', playerCode: 'PLR000001' }, { id: 'p2', fullName: 'Arun Kumar', playerCode: 'PLR000003' }],
  '/api/guest-players': [{ id: 'g', fullName: 'Guest Partner' }],
  '/api/teams': [
    { id: 'team1', teamCode: 'TEM1', player1: { id: 'p1', type: 'PLAYER' }, player2: { id: 'g', type: 'GUEST' } },
    { id: 'team2', teamCode: 'TEM2', player1: { id: 'p1', type: 'PLAYER' }, player2: { id: 'p2', type: 'PLAYER' } },
  ],
}
apiClient.get = async path => ({ data: data[path] ?? [] })
useTournamentStore.setState({ tournaments, loading: false, error: null })
useResultStore.setState({ results: [] })
createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={['/player/tournaments']}><Routes><Route path="/player" element={<PlayerLayout />}><Route path="tournaments" element={<Page />} /><Route path="tournaments/:id" element={<p>Navigation passed</p>} /></Route></Routes></MemoryRouter>)
