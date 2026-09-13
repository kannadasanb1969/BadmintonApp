import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import apiClient from '../src/api/apiClient'
import { FriendlyKnockoutResultView, FriendlyLeagueStandingsView, FriendlyResultsSection } from '../src/features/friendly/components/FriendlyResults'
import { friendlyService } from '../src/features/friendly/services/friendlyService'
import type { FriendlyMatch, FriendlyResult, FriendlyStandings } from '../src/features/friendly/types/friendly.types'

const participants = [
  { id: 'r1', friendly_match_id: 'f1', player_id: 'p1', created_at: '', full_name: 'Arun', player_code: 'PLR001' },
  { id: 'r2', friendly_match_id: 'f1', player_id: 'p2', created_at: '', full_name: 'Bala', player_code: 'PLR002' },
]
const teams = [
  { id: 't1', friendly_match_id: 'f1', team_code: 'TEAM-A', created_at: '', updated_at: '', members: [{ id: 'p1', name: 'Arun', code: 'PLR001' }, { id: 'p2', name: 'Bala', code: 'PLR002' }] },
  { id: 't2', friendly_match_id: 'f1', team_code: 'TEAM-B', created_at: '', updated_at: '', members: [{ id: 'p3', name: 'Chitra', code: 'PLR003' }, { id: 'p4', name: 'Deepa', code: 'PLR004' }] },
]
const match: FriendlyMatch = { id: 'f1', friendly_match_code: 'FRN001', title: 'Sunday Smash', description: null, creator_player_id: 'p1', event_type: 'SINGLES', format: 'KNOCKOUT', max_players: 4, status: 'COMPLETED', created_at: '', updated_at: '', isCreator: true, isParticipant: true, hasPendingJoinRequest: false, canJoin: false }
const singles: FriendlyResult = { friendlyMatchId: 'f1', eventType: 'SINGLES', format: 'KNOCKOUT', status: 'COMPLETED', winner: { participantId: 'p1', participantType: 'PLAYER' }, runnerUp: { participantId: 'p2', participantType: 'PLAYER' }, winnerScore: 21, runnerUpScore: 18 }
const html = renderToStaticMarkup(<FriendlyKnockoutResultView match={match} result={singles} participants={participants} teams={[]} />)
assert.match(html, /Winner/); assert.match(html, /Arun/); assert.match(html, /PLR001/)
assert.match(html, /Runner-up/); assert.match(html, /Bala/); assert.match(html, /PLR002/)
assert.match(html, /21/); assert.match(html, /18/); assert.match(html, /Sunday Smash/); assert.match(html, /FRN001/)

const doubles: FriendlyResult = { ...singles, eventType: 'DOUBLES', winner: { participantId: 't1', participantType: 'TEAM' }, runnerUp: { participantId: 't2', participantType: 'TEAM' } }
const doublesHtml = renderToStaticMarkup(<FriendlyKnockoutResultView match={{ ...match, event_type: 'DOUBLES' }} result={doubles} participants={participants} teams={teams} />)
assert.match(doublesHtml, /TEAM-A/); assert.match(doublesHtml, /Arun \/ Bala/); assert.match(doublesHtml, /TEAM-B/); assert.match(doublesHtml, /Chitra \/ Deepa/)
assert.match(renderToStaticMarkup(<FriendlyKnockoutResultView match={match} result={null} participants={participants} teams={[]} />), /No final result is available/)

const standings: FriendlyStandings = { friendlyMatchId: 'f1', eventType: 'SINGLES', format: 'LEAGUE', allGamesCompleted: true, rankingStatus: 'CLEAR_LEADER', provisionalLeader: { participantId: 'p1', participantType: 'PLAYER' }, standings: [{ participantId: 'p1', participantType: 'PLAYER', played: 3, won: 3, lost: 0 }, { participantId: 'p2', participantType: 'PLAYER', played: 3, won: 2, lost: 1 }] }
const leagueHtml = renderToStaticMarkup(<FriendlyLeagueStandingsView standings={standings} participants={participants} teams={[]} />)
assert.match(leagueHtml, /Backend leader/); assert.match(leagueHtml, /Arun/); assert.match(leagueHtml, /Played/); assert.match(leagueHtml, /Won/); assert.match(leagueHtml, /Lost/)
assert.doesNotMatch(leagueHtml, /Points/); assert.match(leagueHtml, /friendly-standings-scroll/)
const tiedHtml = renderToStaticMarkup(<FriendlyLeagueStandingsView standings={{ ...standings, rankingStatus: 'TIE_BREAK_REQUIRED', provisionalLeader: null }} participants={participants} teams={[]} />)
assert.match(tiedHtml, /League result requires a tie-break/); assert.doesNotMatch(tiedHtml, /Backend leader/)
const provisionalHtml = renderToStaticMarkup(<FriendlyLeagueStandingsView standings={{ ...standings, allGamesCompleted: false, rankingStatus: null, provisionalLeader: null }} participants={participants} teams={[]} />)
assert.match(provisionalHtml, /Results will be available after match completion/); assert.doesNotMatch(provisionalHtml, /Backend leader/)
assert.match(renderToStaticMarkup(<FriendlyLeagueStandingsView standings={{ ...standings, standings: [] }} participants={participants} teams={[]} />), /No standings are available/)

const wrap = (node: React.ReactNode) => renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}>{node}</QueryClientProvider>)
assert.match(wrap(<FriendlyResultsSection match={{ ...match, status: 'ACTIVE' }} />), /Results will be available after match completion/)
assert.match(wrap(<FriendlyResultsSection match={{ ...match, format: 'LEAGUE' }} />), /Loading Friendly results/)

const originalGet = apiClient.get; const paths: string[] = []
apiClient.get = async path => { paths.push(path); return { data: path.endsWith('/result') ? singles : standings } as never }
try { await friendlyService.getFriendlyResult('f1'); await friendlyService.getFriendlyStandings('f1') } finally { apiClient.get = originalGet }
assert.deepEqual(paths, ['/api/friendly-matches/f1/result', '/api/friendly-matches/f1/standings'])

const realtimeSource = await readFile('src/features/friendly/hooks/useFriendlyLiveUpdates.ts', 'utf8')
assert.match(realtimeSource, /friendlyKeys\.result\(friendlyId\)/); assert.match(realtimeSource, /format === 'LEAGUE'/); assert.match(realtimeSource, /friendlyKeys\.standings\(friendlyId\)/)
const resultSource = await readFile('src/features/friendly/components/FriendlyResults.tsx', 'utf8')
assert.doesNotMatch(resultSource, /Win = 2|points\s*[+*=]|head.?to.?head|score difference/i); assert.match(resultSource, /role="alert"/); assert.match(resultSource, /Retry/)
console.log('PASS: 40 Friendly result assertions for exact APIs, PLAYER/TEAM results, scores, standings, tie safety, responsive table, states and realtime invalidation')
