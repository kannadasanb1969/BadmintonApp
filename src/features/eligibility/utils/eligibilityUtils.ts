import { PlayerProfile } from '@/features/player/types/player.types';
import { GuestPlayer } from '@/features/player/types/guest.player.types';
import { Tournament, TournamentCategory } from '@/features/tournaments/types/tournament.types';
import { EligibilityReason, EligibilityResult } from '@/features/eligibility/types/eligibility.types';
import { MedalHistory } from '@/features/medals/types/medalHistory.types';

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
 * Calculate experience years from playingSince (year)
 */
export const calculateExperienceYears = (playingSince: number): number => {
  const currentYear = new Date().getFullYear();
  return currentYear - playingSince;
};

/**
 * Check if player profile is complete and active
 */
export const isProfileActive = (profile: PlayerProfile | GuestPlayer | null): boolean => {
  return profile?.profileStatus === 'ACTIVE';
};

/**
 * Check if tournament is published (visible to players)
 */
export const isTournamentPublished = (tournament: Tournament): boolean => {
  return tournament.status === 'PUBLISHED';
};

/**
 * Check age eligibility for a category
 */
export const checkAgeEligibility = (
  profile: PlayerProfile | GuestPlayer,
  category: TournamentCategory
): EligibilityReason[] => {
  const reasons: EligibilityReason[] = [];
  const age = calculateAge(profile.dob);

  if (category.minAge !== undefined && age < category.minAge) {
    reasons.push({
      code: 'AGE_BELOW_MINIMUM',
      message: `Age must be at least ${category.minAge} years old`,
    });
  }

  if (category.maxAge !== undefined && age > category.maxAge) {
    reasons.push({
      code: 'AGE_ABOVE_MAXIMUM',
      message: `Age must be no more than ${category.maxAge} years old`,
    });
  }

  return reasons;
};

export const checkGenderEligibility = (profile: PlayerProfile | GuestPlayer, category: TournamentCategory, tournament?: Tournament): EligibilityReason[] => {
  const legacyText = `${tournament?.name ?? ''} ${category.additionalRuleNotes ?? ''}`.toLowerCase();
  const inferredRestriction = /women|woman|ladies|female/.test(legacyText) ? 'WOMEN_ONLY' : /men only|mens|men's|male/.test(legacyText) ? 'MEN_ONLY' : 'OPEN';
  const restriction = category.genderEligibility ?? inferredRestriction;
  const gender = 'gender' in profile ? profile.gender : undefined;
  if (restriction === 'WOMEN_ONLY' && gender !== 'FEMALE') return [{ code: 'GENDER_NOT_ELIGIBLE', message: 'This category is open to women players only' }];
  if (restriction === 'MEN_ONLY' && gender !== 'MALE') return [{ code: 'GENDER_NOT_ELIGIBLE', message: 'This category is open to men players only' }];
  return [];
};

/**
 * Check medalist eligibility based on actual medal history
 * If category does not allow medalists, check if player has any WINNER/RUNNER_UP medal history
 */
export const checkMedalistEligibility = (
  profile: PlayerProfile | GuestPlayer,
  category: TournamentCategory,
  medalHistory: MedalHistory[] = []
): EligibilityReason[] => {
  const reasons: EligibilityReason[] = [];

  // If category allows medalists, no restriction based on medal history
  if (category.medalistsAllowed) {
    return reasons;
  }

  // If category does not allow medalists, check if player has any medal history
  // Check if player has any WINNER or RUNNER_UP medals
  const hasMedalHistory = medalHistory.some(
    medal =>
      medal.position === 'WINNER' ||
      medal.position === 'RUNNER_UP'
  );

  if (hasMedalHistory) {
    reasons.push({
      code: 'MEDALIST_NOT_ALLOWED',
      message: 'Players with medal history are not allowed in this category'
    });
  }

  return reasons;
};

/**
 * Check open player eligibility (placeholder for future implementation)
 * For Phase 6, we treat all players as non-open (isOpenPlayer returns false).
 * So if category does not allow open players, then non-open player is allowed -> eligible.
 * If category allows open players, then non-open player is also allowed -> eligible.
 * So no reason to add.
 */
export const checkOpenPlayerEligibility = (
  _profile: PlayerProfile | GuestPlayer,
  category: TournamentCategory
): EligibilityReason[] => {
  return [];
};

/**
 * Check beginner/pure beginner eligibility based on temporary Phase 6 classification
 * TEMPORARY LOGIC FOR PHASE 6 ONLY - TO BE REPLACED WITH FINAL BUSINESS RULES
 *
 * Classification logic:
 * - PURE_BEGINNER: experience <= 1 year AND regularPlayer === false
 * - BEGINNER: experience <= 2 years
 * - REGULAR: experience > 2 years
 * - OPEN: reserved for future (returned only if future classification says so)
 */
export const checkBeginnerEligibility = (
  profile: PlayerProfile | GuestPlayer,
  category: TournamentCategory
): EligibilityReason[] => {
  const reasons: EligibilityReason[] = [];
  const experienceYears = calculateExperienceYears(profile.playingSince);
  const isPureBeginner = experienceYears <= 1 && !profile.regularPlayer;
  const isBeginner = experienceYears <= 2; // includes pure beginner

  if (category.pureBeginnerOnly && !isPureBeginner) {
    reasons.push({
      code: 'PURE_BEGINNER_ONLY',
      message: 'This category is for pure beginners only',
    });
  }

  if (category.beginnerOnly && !isBeginner) {
    reasons.push({
      code: 'BEGINNER_ONLY',
      message: 'This category is for beginners only',
    });
  }

  return reasons;
};

/**
 * Evaluate player eligibility for a tournament category
 *
 * @param profile Player profile (must be active and exist)
 * @param tournament Tournament (must be published)
 * @param category Tournament category
 * @param currentRegistrations Current registrations for this tournament/category (to check duplicates and capacity)
 * @param medalHistory Optional medal history for the player (to check medalist eligibility)
 * @returns EligibilityResult
 */
export const evaluatePlayerEligibility = (
  profile: PlayerProfile | GuestPlayer | null,
  tournament: Tournament,
  category: TournamentCategory,
  currentRegistrations: number = 0,
  medalHistory: MedalHistory[] = []
): EligibilityResult => {
  const reasons: EligibilityReason[] = [];

  // 1. Check profile
  if (!profile || !isProfileActive(profile)) {
    reasons.push({
      code: 'PROFILE_INCOMPLETE',
      message: 'Complete your Player Profile before registering',
    });
    // If profile is not active, we cannot check other eligibility rules that depend on profile data
    return { eligible: false, reasons };
  }

  // 2. Check tournament status
  if (!isTournamentPublished(tournament)) {
    reasons.push({
      code: 'TOURNAMENT_NOT_PUBLISHED',
      message: 'Tournament is not yet available for registration',
    });
    // We can still check other rules? But if not published, player shouldn't register.
    // However, we might want to show why not published? But spec says only published visible to players.
    // So we return early.
    return { eligible: false, reasons };
  }

  // 3. Check manual registration close (category level)
  if (category.registrationPhase === 'CLOSED') {
    reasons.push({
      code: 'REGISTRATION_CLOSED',
      message: 'Registration is closed',
    });
    return { eligible: false, reasons };
  }

  // Category registrationPhase is provided by the Worker and is the frontend
  // source of truth. Do not derive a conflicting closed state from a cached
  // tournament date/time; the registration endpoint still enforces closure.

  // 4. Check age
  reasons.push(...checkAgeEligibility(profile, category));
  reasons.push(...checkGenderEligibility(profile, category, tournament));

  // 5. Check medalist (placeholder)
  reasons.push(...checkMedalistEligibility(profile, category, medalHistory));

  // 6. Check open player (placeholder)
  reasons.push(...checkOpenPlayerEligibility(profile, category));

  // 7. Check beginner/pure beginner
  reasons.push(...checkBeginnerEligibility(profile, category));

  // 8. Check category capacity (if maxTeams exists and we have current registrations)
  if (category.maxTeams !== undefined && currentRegistrations >= category.maxTeams) {
    reasons.push({
      code: 'CATEGORY_FULL',
      message: 'Category is full',
    });
  }

  // 9. Check duplicate registration (this will be checked by the registration service, but we can include if we have the data)
  // We don't have playerId here, so we'll skip in this function. The service will check duplicate.
  // We'll leave it to the service to add ALREADY_REGISTERED reason.

  return {
    eligible: reasons.length === 0,
    reasons,
  };
};
