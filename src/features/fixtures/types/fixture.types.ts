// Fixture related types

export type RegistrationPhase = 'OPEN' | 'CLOSED';

export type FixtureStatus = 'DRAFT' | 'PUBLISHED';

export const MatchStatus = {
  SCHEDULED: 'SCHEDULED',
  LIVE: 'LIVE',
  COMPLETED: 'COMPLETED',
  WALKOVER: 'WALKOVER',
  CANCELLED: 'CANCELLED',
} as const;

export type MatchStatus = (typeof MatchStatus)[keyof typeof MatchStatus];

export type TournamentFormat = 'KNOCKOUT' | 'LEAGUE' | 'LEAGUE_KNOCKOUT';

export type ParticipantType = 'PLAYER' | 'TEAM';

export interface Fixture {
  id: string;
  fixtureCode: string;

  tournamentId: string;
  tournamentCode: string;
  categoryId: string;
  categoryName: string;

  format: TournamentFormat;

  status: FixtureStatus;

  registrationPhase: RegistrationPhase;

  eventType: 'SINGLES' | 'DOUBLES';

  participants: FixtureParticipant[];

  matches: FixtureMatch[];

  createdAt: string;
  updatedAt: string;

  publishedAt: string | null;
}

export interface FixtureParticipant {
  id: string; // PlayerProfile.id or Team.id
  name: string;
  code: string; // playerCode or teamCode
  type: ParticipantType;
}

export interface ScoreSnapshot {
  participant1Score: number;
  participant2Score: number;
}

export interface FixtureMatch {
  id: string;
  matchCode: string; // e.g., MATCH000001
  fixtureId: string;
  tournamentId: string;
  categoryId: string;
  roundNumber: number; // 0-indexed or 1-indexed? We'll use 0-indexed internally but display round names
  roundName: string; // e.g., "Quarter Final", "Semi Final", "Final", "League Match 1"
  matchNumber: number; // match number within the round
  participant1: FixtureParticipant | null; // null means bye
  participant2: FixtureParticipant | null;
  winnerId: string | null; // id of the winning participant (playerId or teamId)
  // Supplied by the Worker for a completed match. These are presentation data;
  // the identifier remains available for bracket progression but is never shown
  // as the winner label.
  winnerParticipantId?: string | null;
  winnerParticipantType?: ParticipantType | null;
  winnerParticipantName?: string | null;
  winnerParticipantCode?: string | null;
  nextMatchId: string | null; // id of the match where the winner advances
  nextMatchSlot: 'PARTICIPANT_1' | 'PARTICIPANT_2' | null; // which participant slot in the next match
  status: MatchStatus;
  courtNumber: number | null;
  scheduledTime: string | null; // ISO time string, optional
  // Score fields for Phase 9
  participant1Score: number;
  participant2Score: number;
  scoreHistory?: ScoreSnapshot[];
  winningPoints?: 15 | 21 | 30;
  startedAt?: string | null; // ISO timestamp when match started
  completedAt?: string | null; // ISO timestamp when match completed
}

export interface CategoryResult {
  id: string;
  tournamentId: string;
  tournamentCode: string;
  tournamentName: string;
  categoryId: string;
  categoryName: string;
  eventType: 'SINGLES' | 'DOUBLES';
  winnerParticipantId: string;
  winnerParticipantCode: string;
  winnerParticipantName: string;
  runnerUpParticipantId: string;
  runnerUpParticipantCode: string;
  runnerUpParticipantName: string;
  completedAt: string; // ISO timestamp
}
