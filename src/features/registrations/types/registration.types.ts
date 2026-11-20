export type RegistrationStatus = 'REGISTERED' | 'CANCELLED' | 'PENDING' | 'REJECTED' | 'CONFIRMED';

export const isConfirmedRegistration = (status: RegistrationStatus) => status === 'REGISTERED' || status === 'CONFIRMED'

export interface Registration {
  id: string; // internal ID
  registrationCode: string; // e.g., REG000001
  tournamentId: string;
  tournamentCode: string;
  categoryId: string;
  categoryName: string;
  playerId: string; // references PlayerProfile.id (the logged-in player)
  playerCode: string; // from player profile
  playerName: string; // from player profile
  eventType: 'SINGLES' | 'DOUBLES'; // from category
  status: RegistrationStatus;
  registeredAt: string; // ISO timestamp
  reviewStatus?: string;
  partnerResponseStatus?: string;
  paymentStatus?: string;
  cancelledAt?: string; // ISO timestamp, optional

  // Optional fields for DOUBLES registrations
  teamId?: string; // references Team.id
  teamCode?: string; // from team
  partnerId?: string; // references PlayerProfile.id or GuestPlayer.id (the partner)
  partnerCode?: string; // from partner's profile/guest
  partnerName?: string; // from partner's profile/guest
  partnerType?: 'FULL' | 'GUEST'; // partner's type
}

// Form values for creating a registration (what the client sends to create a registration)
export interface RegistrationCreateInput {
  tournamentId: string;
  categoryId: string;
  // playerId, playerCode, playerName will be filled from profile
  // tournamentCode, categoryName, eventType will be filled from tournament/category
  // registrationCode will be generated
  // status will be set to REGISTERED
  // registeredAt will be set to now
}