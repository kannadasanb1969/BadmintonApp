export type FriendlyEventType = 'SINGLES' | 'DOUBLES'
export type FriendlyFormat = 'LEAGUE' | 'KNOCKOUT'
export type FriendlyMatchStatus = 'DRAFT' | 'OPEN' | 'ACTIVE' | 'COMPLETED' | 'CLEANUP_PENDING' | 'DELETED'

export interface FriendlyMatch {
  id: string
  friendly_match_code: string
  title: string
  description: string | null
  creator_player_id: string
  event_type: FriendlyEventType
  format: FriendlyFormat
  max_players: number
  status: FriendlyMatchStatus
  created_at: string
  updated_at: string
  participant_count?: number | string
  isCreator: boolean
  isParticipant: boolean
  hasPendingJoinRequest: boolean
  canJoin: boolean
}

export interface CreateFriendlyMatchRequest {
  title: string
  description?: string | null
  eventType: FriendlyEventType
  format: FriendlyFormat
  maxPlayers: number
}

export interface FriendlyJoinRequest {
  id: string
  friendly_match_id: string
  player_id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'
  created_at: string
  updated_at: string
}

export interface FriendlyJoinRequestRow extends FriendlyJoinRequest {
  full_name: string
  player_code: string
}

export interface FriendlyJoinRequestDecision {
  id: string
  friendly_match_id: string
  player_id: string
  status: 'APPROVED' | 'REJECTED'
  created_at: string
  updated_at: string
}

export interface FriendlyParticipant {
  id: string
  friendly_match_id: string
  player_id: string
  created_at: string
  full_name: string
  player_code: string
}

export interface FriendlyTeamMember { id: string; name: string; code: string }
export interface FriendlyTeam {
  id: string
  friendly_match_id: string
  team_code: string
  created_at: string
  updated_at: string
  members: FriendlyTeamMember[]
}
export type FriendlyTeamMutation = Omit<FriendlyTeam, 'members'>

export type CurrentUserState = Pick<FriendlyMatch, 'isCreator' | 'isParticipant' | 'hasPendingJoinRequest' | 'canJoin'>
export type CreateFriendlyMatchResponse = FriendlyMatch
export type FriendlyMatchListResponse = FriendlyMatch[]
export type FriendlyMatchDetailsResponse = FriendlyMatch
export type JoinFriendlyMatchResponse = FriendlyJoinRequest
export type FriendlyJoinRequestsResponse = FriendlyJoinRequestRow[]
export type FriendlyParticipantsResponse = FriendlyParticipant[]
export type ApproveFriendlyJoinRequestResponse = FriendlyJoinRequestDecision
export type RejectFriendlyJoinRequestResponse = FriendlyJoinRequestDecision
export type FriendlyTeamsResponse = FriendlyTeam[]

export type FriendlyFixtureFormat = 'LEAGUE' | 'KNOCKOUT'
export type FriendlyFixtureStatus = 'DRAFT' | 'PUBLISHED'
export type FriendlyGameMatchStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED'
export type FriendlyGameParticipantType = 'PLAYER' | 'TEAM'
export interface FriendlyFixture { id: string; friendly_match_id: string; fixture_code: string; format: FriendlyFixtureFormat; status: FriendlyFixtureStatus; created_at: string; updated_at: string }
export interface FriendlyGameMatch {
  id: string; friendly_match_id: string; fixture_id: string; match_code: string
  round_number: number; match_number: number; status: FriendlyGameMatchStatus
  participant1_id: string | null; participant1_type: FriendlyGameParticipantType | null
  participant2_id: string | null; participant2_type: FriendlyGameParticipantType | null
  participant1_score: number; participant2_score: number; winning_points: number | null
  source_match_1_id: string | null; source_match_2_id: string | null; next_match_id: string | null; next_match_slot: 1 | 2 | null
  started_at: string | null; completed_at: string | null; created_at: string; updated_at: string
  /** Populated only from the verified MATCH_COMPLETED realtime payload. */
  live_winner_id?: string | null
  live_winner_type?: FriendlyGameParticipantType | null
}
export interface FriendlyFixtureData { fixture: FriendlyFixture; matches: FriendlyGameMatch[] }
export type FriendlyFixtureResponse = FriendlyFixtureData

export interface FriendlyResultIdentity {
  participantId: string
  participantType: FriendlyGameParticipantType
}
export interface FriendlyResult {
  friendlyMatchId: string
  format: FriendlyFormat
  eventType: FriendlyEventType
  status: FriendlyMatchStatus
  winner: FriendlyResultIdentity | null
  runnerUp: FriendlyResultIdentity | null
  winnerScore?: number | null
  runnerUpScore?: number | null
}
export interface FriendlyStandingRow extends FriendlyResultIdentity {
  position?: number | null
  played: number
  won: number
  lost: number
}
export interface FriendlyStandings {
  friendlyMatchId: string
  eventType: FriendlyEventType
  format: 'LEAGUE'
  allGamesCompleted: boolean
  rankingStatus: 'CLEAR_LEADER' | 'TIE_BREAK_REQUIRED' | null
  provisionalLeader?: FriendlyResultIdentity | null
  standings: FriendlyStandingRow[]
}
