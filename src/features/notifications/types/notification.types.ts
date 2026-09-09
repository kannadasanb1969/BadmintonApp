export type NotificationType =
  | 'TOURNAMENT_PUBLISHED'
  | 'TOURNAMENT_REJECTED'
  | 'TOURNAMENT_APPROVED'
  | 'TOURNAMENT_SUBMITTED'
  | 'PARTNER_REQUEST'
  | 'PARTNER_ACCEPTED'
  | 'REGISTRATION_CONFIRMED'
  | 'REGISTRATION_CLOSED'
  | 'FIXTURE_PUBLISHED'
  | 'MATCH_READY'
  | 'MATCH_COMPLETED'
  | 'TOURNAMENT_RESULT'
  | 'MEDAL_AWARDED'
  | 'MEDAL_GOLD'
  | 'MEDAL_SILVER'
  | 'SYSTEM';

export interface AppNotification {
  id: string;
  recipientId: string;
  recipientRole: 'PLAYER' | 'ORGANIZER' | 'ADMIN';
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  readAt: string | null;
  link?: string | null;
  tournamentId?: string | null;
  categoryId?: string | null;
  matchId?: string | null;
  dedupeKey?: string | null;
}
