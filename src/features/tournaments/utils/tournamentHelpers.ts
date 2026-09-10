import { Tournament, TournamentCategory } from '@/features/tournaments/types/tournament.types';

/**
 * Calculate age from date of birth (YYYY-MM-DD)
 */
export const calculateAge = (dob: string): number => {
  const birthDate = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

/**
 * Calculate years since a given year (e.g., playing since)
 */
export const calculateYearsSince = (startYear: number): number => {
  const currentYear = new Date().getFullYear();
  return Math.max(0, currentYear - startYear);
};

/**
 * Validate tournament dates: registration close date must be before tournament date
 */
export const validateTournamentDates = (
  tournamentDate: string,
  registrationCloseDate: string
): { isValid: boolean; error?: string } => {
  const tournament = new Date(tournamentDate);
  const registrationClose = new Date(registrationCloseDate);

  if (registrationClose >= tournament) {
    return {
      isValid: false,
      error: 'Registration close date must be before the tournament date',
    };
  }

  return { isValid: true };
};

/**
 * Validate tournament time format (HH:mm)
 */
export const validateTimeFormat = (time: string): boolean => {
  return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
};

/**
 * Validate that a tournament has at least one category
 */
export const validateCategories = (categories: TournamentCategory[]): { isValid: boolean; error?: string } => {
  if (!categories || categories.length === 0) {
    return {
      isValid: false,
      error: 'Tournament must have at least one category',
    };
  }
  return { isValid: true };
};

/**
 * Validate that each category has a valid event type
 */
export const validateCategoryEventTypes = (categories: TournamentCategory[]): { isValid: boolean; error?: string } => {
  const validEventTypes = ['SINGLES', 'DOUBLES'];
  for (const category of categories) {
    if (!validEventTypes.includes(category.eventType)) {
      return {
        isValid: false,
        error: `Invalid event type for category '${category.name}'. Must be 'SINGLES' or 'DOUBLES'`,
      };
    }
  }
  return { isValid: true };
};

/**
 * Format date string to display format (e.g., "Jan 15, 2026")
 */
export const formatDateDisplay = (dateString: string): string => {
  const options: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
  return new Date(dateString).toLocaleDateString(undefined, options);
};

/**
 * Format time string to display format (e.g., "2:30 PM")
 */
export const formatTimeDisplay = (timeString: string): string => {
  const normalized = normalizeTimeValue(timeString);
  if (!normalized) return 'Time not set';
  const [hours, minutes] = normalized.split(':');
  const hoursNum = Number(hours);
  const minutesNum = Number(minutes);
  const period = hoursNum >= 12 ? 'PM' : 'AM';
  const displayHours = hoursNum % 12 || 12;
  return `${displayHours}:${String(minutesNum).padStart(2, '0')} ${period}`;
};

/** Converts legacy values such as "7" to "07:00" and rejects invalid times. */
export const normalizeTimeValue = (timeString: string | null | undefined): string | null => {
  if (!timeString) return null;
  const value = timeString.trim();
  if (/^\d{1,2}$/.test(value)) {
    const hours = Number(value);
    return hours >= 0 && hours <= 23 ? `${String(hours).padStart(2, '0')}:00` : null;
  }
  const match = value.match(/^(\d{1,2}):(\d{1,2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

/**
 * Get status label with appropriate styling class
 */
export const getStatusLabel = (status: 'DRAFT' | 'PENDING_ADMIN_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'REJECTED'): { label: string; color: string } => {
  switch (status) {
    case 'DRAFT':
      return { label: 'Draft', color: 'text-gray-500' };
    case 'PENDING_ADMIN_APPROVAL':
      return { label: 'Pending Approval', color: 'text-yellow-500' };
    case 'APPROVED':
      return { label: 'Approved', color: 'text-blue-500' };
    case 'PUBLISHED':
      return { label: 'Published', color: 'text-green-500' };
    case 'REJECTED':
      return { label: 'Rejected', color: 'text-red-500' };
    default:
      return { label: status, color: 'text-gray-500' };
  }
};

/**
 * Check if tournament is editable (only draft tournaments)
 */
export const isTournamentEditable = (status: 'DRAFT' | 'PENDING_ADMIN_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'REJECTED'): boolean => {
  return status === 'DRAFT';
};

/**
 * Check if tournament can be submitted for approval (only draft tournaments)
 */
export const canSubmitForApproval = (status: 'DRAFT' | 'PENDING_ADMIN_APPROVAL' | 'APPROVED' | 'PUBLISHED' | 'REJECTED'): boolean => {
  return status === 'DRAFT' || status === 'REJECTED';
};
