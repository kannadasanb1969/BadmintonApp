import type { CategoryResult } from '@/features/fixtures/types/fixture.types';
// EventType and TournamentFormat are defined here for now.
// If they become shared across features, they can be moved to root types.

export type TournamentStatus =
  | 'DRAFT'
  | 'PENDING_ADMIN_APPROVAL'
  | 'APPROVED'
  | 'PUBLISHED'
  | 'REJECTED';

export type TournamentFormat = 'KNOCKOUT' | 'LEAGUE' | 'LEAGUE_KNOCKOUT';

export type EventType = 'SINGLES' | 'DOUBLES';
export type GenderEligibility = 'OPEN' | 'WOMEN_ONLY' | 'MEN_ONLY';

export type RegistrationPhase = 'OPEN' | 'CLOSED';

export interface TournamentCategory {
  completionStatus?: 'COMPLETED' | 'IN_PROGRESS';
  result?: CategoryResult | null;
  id: string;
  name: string;
  eventType: EventType;
  genderEligibility?: GenderEligibility;
  minAge?: number;
  maxAge?: number;
  maxTeams?: number;
  medalistsAllowed: boolean;
  openPlayersAllowed: boolean;
  beginnerOnly: boolean;
  pureBeginnerOnly: boolean;
  additionalRuleNotes?: string;
  registrationPhase?: RegistrationPhase;
  registrationClosedAt?: string | null;
  registeredPlayerCount?: number | null;
  registeredEntryCount?: number | null;
  registeredTeamCount?: number | null;
}

export interface Tournament {
  completionStatus?: 'COMPLETED' | 'IN_PROGRESS';
  result?: CategoryResult | null;
  id: string;
  tournamentCode: string;
  organizerId: string;
  organizerMobile: string;
  organizerName: string;
  name: string;
  description: string;
  tournamentDate: string; // ISO date string
  reportingTime: string; // HH:mm format
  registrationCloseDate: string; // ISO date string
  registrationCloseTime: string; // HH:mm format
  venueName: string;
  venueAddress: string;
  mapLink?: string;
  format: TournamentFormat;
  categories: TournamentCategory[];
  generalRules: string[]; // array of rule strings
  prizes?: string;
  shuttle?: string;
  scoringFormat?: string;
  status: TournamentStatus;
  rejectionReason?: string | null;
  // Admin fields
  approvedAt?: string | null;
  approvedBy?: string | null;
  rejectedAt?: string | null;
  rejectedBy?: string | null;
  publishedAt?: string | null;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  submittedAt?: string; // ISO timestamp
  registeredPlayerCount?: number | null;
  registeredEntryCount?: number | null;
  registeredTeamCount?: number | null;
}

// Form types for creating/updating tournament
export type TournamentFormValues = Omit<
  Tournament,
  | 'id'
  | 'tournamentCode'
  | 'organizerId'
  | 'organizerName'
  | 'createdAt'
  | 'updatedAt'
  | 'submittedAt'
  | 'status'
  | 'approvedAt'
  | 'approvedBy'
  | 'rejectedAt'
  | 'rejectedBy'
  | 'publishedAt'
> & {
  categories: Omit<TournamentCategory, 'id'>[];
  generalRules: string[];
};

// We'll also define a type for the tournament without the id for creation
export type TournamentCreateInput = Omit<Tournament, 'id' | 'tournamentCode' | 'createdAt' | 'updatedAt' | 'submittedAt' | 'status' | 'approvedAt' | 'approvedBy' | 'rejectedAt' | 'rejectedBy' | 'publishedAt'> & {
  categories: Omit<TournamentCategory, 'id'>[];
  generalRules: string[];
};
