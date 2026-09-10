import { Tournament, TournamentCategory } from '@/features/tournaments/types/tournament.types';
import { PlayerProfile } from '@/features/player/types/player.types';
import { Team } from '@/features/teams/types/team.types';
import { Fixture, FixtureMatch, FixtureParticipant, TournamentFormat } from '@/features/fixtures/types/fixture.types';
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore';
import { useTeamStore } from '@/features/teams/store/teamStore';
import { useRegistrationStore } from '@/features/registrations/store/registrationStore';
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore';
import { notificationService } from '@/features/notifications/services/notificationService';
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient';
import { tournamentService } from '@/features/tournaments/services/tournamentService';
import { refreshPlayerDirectory } from '@/features/player/services/playerProfileService';
import { guestPlayerService } from '@/features/player/services/guestPlayerService';
import { teamService } from '@/features/teams/services/teamService';
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore';
import { useGuestPlayerStore } from '@/features/player/store/guestPlayerStore';

// Mock delay function to simulate API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FixtureService {
  getFixtures: () => Promise<Fixture[]>;
  getEligibleParticipants: (tournamentId: string, categoryId: string) => Promise<FixtureParticipant[]>;
  canGenerateFixture: (organizerId: string, tournamentId: string, categoryId: string) => Promise<void>;
  generateFixture: (organizerId: string, tournamentId: string, categoryId: string, format: TournamentFormat) => Promise<Fixture>;
  generateKnockoutFixture: (tournament: Tournament, category: TournamentCategory, participants: FixtureParticipant[]) => Fixture;
  getRoundNameForKnockout: (bracketSize: number, roundIndex: number, totalRounds: number) => string;
  generateLeagueFixture: (tournament: Tournament, category: TournamentCategory, participants: FixtureParticipant[]) => Fixture;
  reshuffleFixture: (organizerId: string, fixtureId: string) => Promise<Fixture>;
  publishFixture: (organizerId: string, fixtureId: string) => Promise<Fixture>;
  getFixture: (fixtureId: string) => Promise<Fixture | undefined>;
}

type WorkerParticipant = {
  participantId: string;
  participantType: 'PLAYER' | 'TEAM';
  displayName?: string;
  displayCode?: string;
  name?: string;
  playerName?: string;
  participantName?: string;
  teamName?: string;
  playerCode?: string;
  participantCode?: string;
};
type WorkerMatch = Omit<FixtureMatch, 'participant1' | 'participant2' | 'nextMatchSlot'> & { participant1Id: string | null; participant1Type?: string | null; participant2Id: string | null; participant2Type?: string | null; nextMatchSlot: FixtureMatch['nextMatchSlot'] | null };
type WorkerFixture = Omit<Fixture, 'tournamentCode' | 'categoryName' | 'format' | 'participants' | 'matches'> & { format: string; participants?: WorkerParticipant[]; matches?: WorkerMatch[] };

type ParticipantDirectory = {
  playerById: Map<string, { fullName: string; playerCode: string }>;
  guestById: Map<string, { fullName: string; guestCode: string }>;
  teamById: Map<string, Team>;
};

const isIdentifier = (value: string | undefined): boolean => Boolean(value && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value));
const firstDisplayValue = (...values: Array<string | undefined>): string | undefined => values.find((value) => value && !isIdentifier(value));

const fixtureParticipantDirectory = async (): Promise<ParticipantDirectory> => {
  if (!isExplicitMockApiMode) {
    // These are collection requests, deliberately loaded once per fixture response
    // batch instead of making one request for every participant on the bracket.
    await refreshPlayerDirectory();
    await guestPlayerService.loadGuests();
    await teamService.getTeams();
  }

  const players = usePlayerDirectoryStore.getState().profiles;
  const guests = useGuestPlayerStore.getState().guests;
  const teams = useTeamStore.getState().teams;
  return {
    playerById: new Map(players.map((player) => [player.id, player])),
    guestById: new Map(guests.map((guest) => [guest.id, guest])),
    teamById: new Map(teams.map((team) => [team.id, team])),
  };
};

const fromWorkerFixture = async (raw: WorkerFixture, directory?: ParticipantDirectory): Promise<Fixture> => {
  const tournament = await tournamentService.getTournamentById(raw.tournamentId);
  const category = tournament?.categories.find((item) => item.id === raw.categoryId);
  const participants = (Array.isArray(raw.participants) ? raw.participants : []).map((item) => {
    const team = item.participantType === 'TEAM' ? directory?.teamById.get(item.participantId) : undefined;
    const player = item.participantType === 'PLAYER' ? directory?.playerById.get(item.participantId) : undefined;
    const guest = item.participantType === 'PLAYER' ? directory?.guestById.get(item.participantId) : undefined;
    const name = firstDisplayValue(
      item.displayName,
      item.name,
      item.playerName,
      item.participantName,
      item.teamName,
      team ? `${team.player1Name} / ${team.player2Name}` : undefined,
      player?.fullName,
      guest?.fullName,
    ) ?? 'Participant pending';
    const code = firstDisplayValue(item.displayCode, item.playerCode, item.participantCode, team?.teamCode, player?.playerCode, guest?.guestCode) ?? '';
    return { id: item.participantId, name, code, type: item.participantType };
  });
  const participant = new Map(participants.map((item) => [item.id, item]));
  return {
    ...raw,
    tournamentCode: tournament?.tournamentCode ?? raw.tournamentId,
    categoryName: category?.name ?? raw.categoryId,
    format: raw.format === 'ROUND_ROBIN' ? 'LEAGUE' : raw.format === 'LEAGUE' ? 'LEAGUE' : 'KNOCKOUT',
    participants,
    matches: (Array.isArray(raw.matches) ? raw.matches : []).map((match) => ({ ...match, participant1: match.participant1Id ? participant.get(match.participant1Id) ?? null : null, participant2: match.participant2Id ? participant.get(match.participant2Id) ?? null : null })),
  } as Fixture;
};

const cacheFixture = (fixture: Fixture) => useFixtureStore.getState().saveGeneratedFixture(fixture);

export const fixtureService: FixtureService = {
  async getFixtures(): Promise<Fixture[]> {
    if (isExplicitMockApiMode) return useFixtureStore.getState().fixtures;
    const data = (await apiClient.get<WorkerFixture[]>('/api/fixtures')).data;
    const fixturesRaw = Array.isArray(data) ? data : [];
    const directory = await fixtureParticipantDirectory();
    const fixtures = await Promise.all(fixturesRaw.map((fixture) => fromWorkerFixture(fixture, directory)));
    fixtures.forEach(cacheFixture);
    return fixtures;
  },
  /**
   * Get eligible participants for a category based on registration status.
   * For SINGLES: active registrations (status === 'REGISTERED')
   * For DOUBLES: confirmed teams (status === 'CONFIRMED')
   */
  getEligibleParticipants(tournamentId: string, categoryId: string): Promise<FixtureParticipant[]> {
    if (!isExplicitMockApiMode) {
      return this.getFixtures().then((fixtures) => fixtures.find((fixture) => fixture.tournamentId === tournamentId && fixture.categoryId === categoryId)?.participants ?? []);
    }
    return new Promise(async (resolve) => {
      await delay(500);

      const tournamentStore = useTournamentStore.getState();
      if (!tournamentStore) throw new Error('Tournament store not initialized');
      // Ensure tournament is loaded
      if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
        await tournamentStore.fetchTournamentById(tournamentId);
      }
      // Now we know the tournament is in the store and matches the id
      const tournament = tournamentStore.tournament;
      if (!tournament) {
        throw new Error('Tournament not found');
      }

      const regStore = useRegistrationStore.getState();
      if (!regStore) throw new Error('Registration store not initialized');
      const teamStore = useTeamStore.getState();
      if (!teamStore) throw new Error('Team store not initialized');

      const category = tournament.categories.find(c => c.id === categoryId);
      if (!category) {
        throw new Error('Category not found');
      }

      const participants: FixtureParticipant[] = [];

      if (category.eventType === 'SINGLES') {
        // Get active registrations for this category
        const registrations = regStore.getTournamentRegistrations(tournamentId)
          .filter(reg => reg.categoryId === categoryId && reg.status === 'REGISTERED');

        for (const reg of registrations) {
          // We need the player profile to get name and code
          // For simplicity, we assume the registration has playerName and playerCode
          // In a real app, we might fetch the profile, but registration stores denormalized data
          participants.push({
            id: reg.playerId,
            name: reg.playerName,
            code: reg.playerCode,
            type: 'PLAYER'
          });
        }
      } else if (category.eventType === 'DOUBLES') {
        // Get confirmed teams for this category
        const teams = teamStore.getCategoryTeams(tournamentId, categoryId)
          .filter(team => team.status === 'CONFIRMED');

        for (const team of teams) {
          // For doubles, participant name is "Player A / Player B"
          // We have player1Name and player2Name from the team
          participants.push({
            id: team.id,
            name: `${team.player1Name} / ${team.player2Name}`,
            code: team.teamCode,
            type: 'TEAM'
          });
        }
      }

      resolve(participants);
    });
  },

  /**
   * Check if fixture generation is allowed for a category.
   * Throws error if not allowed.
   */
  canGenerateFixture(organizerId: string, tournamentId: string, categoryId: string): Promise<void> {
    if (!isExplicitMockApiMode) {
      // The Worker owns registration-phase, ownership, and participant validation.
      return Promise.resolve();
    }
    return new Promise(async (resolve, reject) => {
      try {
        await delay(500);

        const tournamentStore = useTournamentStore.getState();
        if (!tournamentStore) throw new Error('Tournament store not initialized');
        // Ensure tournament is loaded
        if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
          await tournamentStore.fetchTournamentById(tournamentId);
        }
        // Now we know the tournament is in the store and matches the id
        const tournament = tournamentStore.tournament;
        if (!tournament) {
          throw new Error('Tournament not found');
        }

        // Check organizer ownership
        if (tournament.organizerId !== organizerId) {
          throw new Error('Unauthorized: Not the organizer of this tournament');
        }

        // Check tournament is published
        if (tournament.status !== 'PUBLISHED') {
          throw new Error('Tournament must be published to generate fixture');
        }

        const category = tournament.categories.find(c => c.id === categoryId);
        if (!category) {
          throw new Error('Category not found');
        }

        // Check registration phase is closed
        if (category.registrationPhase !== 'CLOSED') {
          throw new Error('Registration must be closed to generate fixture');
        }

        // Check if a published fixture already exists
        const fixtureStore = useFixtureStore.getState();
        if (!fixtureStore) throw new Error('Fixture store not initialized');
        const existingFixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId);
        if (existingFixture && existingFixture.status === 'PUBLISHED') {
          throw new Error('A published fixture already exists for this category');
        }

        // Get eligible participants
        const participants = await this.getEligibleParticipants(tournamentId, categoryId);
        if (participants.length < 2) {
          throw new Error('At least 2 participants are required to generate fixture');
        }

        resolve();
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Generate a fixture for a category (creates a draft fixture).
   * This function does not persist the fixture; the caller must use the store.
   * We return the fixture object to be stored.
   */
  generateFixture(organizerId: string, tournamentId: string, categoryId: string, format: TournamentFormat): Promise<Fixture> {
    if (!isExplicitMockApiMode) {
      return apiClient.post<WorkerFixture>('/api/fixtures/generate', {
        tournamentId,
        categoryId,
        organizerUserId: organizerId,
        format: format === 'LEAGUE_KNOCKOUT' ? 'LEAGUE' : format,
      }).then(async (response) => {
        const fixture = await fromWorkerFixture(response.data, await fixtureParticipantDirectory());
        cacheFixture(fixture);
        return fixture;
      });
    }
    return new Promise(async (resolve, reject) => {
      try {
        await delay(500);

        // First, check if generation is allowed
        await this.canGenerateFixture(organizerId, tournamentId, categoryId);

        const tournamentStore = useTournamentStore.getState();
        if (!tournamentStore) throw new Error('Tournament store not initialized');
        // Ensure tournament is loaded
        if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
          await tournamentStore.fetchTournamentById(tournamentId);
        }
        // Now we know the tournament is in the store and matches the id
        const tournament = tournamentStore.tournament;
        if (!tournament) {
          throw new Error('Tournament not found');
        }

        const category = tournament.categories.find(c => c.id === categoryId);
        if (!category) {
          throw new Error('Category not found');
        }

        // Get eligible participants
        const participants = await this.getEligibleParticipants(tournamentId, categoryId);

        let fixture: Fixture;

        if (format === 'KNOCKOUT') {
          fixture = this.generateKnockoutFixture(tournament, category, participants);
        } else if (format === 'LEAGUE') {
          fixture = this.generateLeagueFixture(tournament, category, participants);
        } else if (format === 'LEAGUE_KNOCKOUT') {
          // For Phase 8, we'll treat as knockout with a note that league+knockout requires results
          throw new Error('League + Knockout fixture generation requires match result progression and will be enabled after scoring support.');
        } else {
          throw new Error('Unsupported tournament format');
        }

        resolve(fixture);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Generate a knockout fixture with byes.
   * Fixed: Build the full bracket first with null participants for future rounds.
   * Only first round gets participants/byes.
   * Wire next matches, then process byes.
   */
  generateKnockoutFixture(tournament: Tournament, category: TournamentCategory, participants: FixtureParticipant[]): Fixture {
    // Shuffle participants using Fisher-Yates
    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    // Calculate bracket size (next power of 2)
    let bracketSize = 1;
    while (bracketSize < shuffled.length) {
      bracketSize *= 2;
    }

    const totalRounds = Math.log2(bracketSize);
    const byeCount = bracketSize - shuffled.length;

    // Generate fixtureId first
    const fixtureId = Math.random().toString(36).substr(2, 9);
    const fixtureCode = `FIXTURE${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
    const now = new Date().toISOString();

    // We'll create matches in rounds
    const rounds: FixtureMatch[][] = []; // each round is an array of matches
    let matchIdCounter = 0;
    let matchCodeCounter = 0;

    // Function to create a match
    const createMatch = (
      roundNumber: number,
      roundName: string,
      matchNumberInRound: number,
      p1: FixtureParticipant | null,
      p2: FixtureParticipant | null
    ): FixtureMatch => {
      matchIdCounter++;
      matchCodeCounter++;
      return {
        id: Math.random().toString(36).substr(2, 9),
        matchCode: `MATCH${String(matchCodeCounter).padStart(6, '0')}`,
        fixtureId: fixtureId, // set fixtureId immediately
        tournamentId: tournament.id,
        categoryId: category.id,
        roundNumber,
        roundName,
        matchNumber: matchNumberInRound,
        participant1: p1,
        participant2: p2,
        winnerId: null,
        nextMatchId: null,
        nextMatchSlot: null,
        status: 'SCHEDULED',
        participant1Score: 0,
        participant2Score: 0,
        scoreHistory: [],
        courtNumber: null,
        scheduledTime: null
      };
    };

    // Generate all rounds
    let roundNumber = 0;
    // Distribute byes to avoid BYE-vs-BYE matches
    const slots: (FixtureParticipant | null)[] = [];
    let participantIndex = 0;
    let byesLeft = byeCount;
    while (participantIndex < shuffled.length && byesLeft > 0) {
      slots.push(shuffled[participantIndex++]);
      slots.push(null);
      byesLeft--;
    }
    // Push any remaining participants
    while (participantIndex < shuffled.length) {
      slots.push(shuffled[participantIndex++]);
    }

    let slotIndex = 0; // index into the slots array for round 0
    while (roundNumber < totalRounds) {
      const matchesInRound: FixtureMatch[] = [];
      const matchesCount = bracketSize / Math.pow(2, roundNumber + 1);
      let matchNumberInRound = 0;

      for (let m = 0; m < matchesCount; m++) {
        // For round 0, take from slots; for other rounds, participants are null initially
        let p1: FixtureParticipant | null = null;
        let p2: FixtureParticipant | null = null;
        if (roundNumber === 0) {
          p1 = slots[slotIndex++];
          p2 = slots[slotIndex++];
        }
        // For round > 0, p1 and p2 remain null (will be filled later by BYE advancement)
        const match = createMatch(roundNumber, this.getRoundNameForKnockout(bracketSize, roundNumber, totalRounds), matchNumberInRound, p1, p2);
        matchesInRound.push(match);
        matchNumberInRound++;
      }

      rounds.push(matchesInRound);
      roundNumber++;
    }

    // Wire nextMatchId and nextMatchSlot for each match (except the last round)
    // We'll do a round-by-round pass
    for (let r = 0; r < rounds.length - 1; r++) {
      const currentRoundMatches = rounds[r];
      const nextRoundMatches = rounds[r + 1];
      for (let m = 0; m < currentRoundMatches.length; m++) {
        const currentMatch = currentRoundMatches[m];
        // The winner of this match goes to the next round at position floor(m/2)
        const nextMatchIndex = Math.floor(m / 2);
        if (nextMatchIndex < nextRoundMatches.length) {
          const nextMatch = nextRoundMatches[nextMatchIndex];
          currentMatch.nextMatchId = nextMatch.id;
          currentMatch.nextMatchSlot = (m % 2 === 0) ? 'PARTICIPANT_1' : 'PARTICIPANT_2';
        }
      }
    }

    // Process the first round matches to handle byes and set status
    const firstRoundMatches = rounds[0];
    for (const match of firstRoundMatches) {
      // Count how many non-null participants we have in this match
      const hasP1 = match.participant1 !== null;
      const hasP2 = match.participant2 !== null;

      if (hasP1 && hasP2) {
        // Two real participants: match is scheduled, winner unknown
        match.status = 'SCHEDULED';
        match.winnerId = null;
      } else if (hasP1 || hasP2) {
        // Exactly one real participant (a bye): match is completed, the participant advances
        match.status = 'COMPLETED';
        match.winnerId = (hasP1 ? match.participant1!.id : match.participant2!.id);
      } else {
        // Both null: should not happen with our slot distribution, but handle safely
        match.status = 'SCHEDULED';
        match.winnerId = null;
      }
    }

    // Now, advance the winners from BYE matches to the next round
    // We have already set nextMatchId and nextMatchSlot for each match.
    // For each first round match that is a BYE (completed), we take its winner and place it in the next match.
    for (const match of firstRoundMatches) {
      if (match.status === 'COMPLETED' && match.winnerId !== null && match.nextMatchId !== null && match.nextMatchSlot !== null) {
        // Find the next match by id (we could also use the rounds array, but we have the id)
        const nextMatch = rounds[1].find(m => m.id === match.nextMatchId);
        if (nextMatch) {
          // Determine which participant slot to fill
          const winnerParticipant = match.participant1 !== null ? match.participant1 : match.participant2;
          if (winnerParticipant) {
            if (match.nextMatchSlot === 'PARTICIPANT_1') {
              nextMatch.participant1 = winnerParticipant;
            } else if (match.nextMatchSlot === 'PARTICIPANT_2') {
              nextMatch.participant2 = winnerParticipant;
            }
          }
        }
      }
    }

    // Flatten the rounds into a single list of matches for the fixture
    const allMatches: FixtureMatch[] = [];
    for (const roundMatches of rounds) {
      allMatches.push(...roundMatches);
    }

    // Create the fixture object
    const fixture: Fixture = {
      id: fixtureId,
      fixtureCode: fixtureCode,
      tournamentId: tournament.id,
      tournamentCode: tournament.tournamentCode,
      categoryId: category.id,
      categoryName: category.name,
      eventType: category.eventType,
      format: 'KNOCKOUT',
      status: 'DRAFT',
      registrationPhase: category.registrationPhase,
      participants: participants,
      matches: allMatches,
      createdAt: now,
      updatedAt: now,
      publishedAt: null
    };

    return fixture;
  },

  /**
   * Get round name for knockout bracket.
   * bracketSize: total number of slots (power of 2)
   * roundIndex: 0-based index of the round (0 = first round)
   * totalRounds: log2(bracketSize)
   */
  getRoundNameForKnockout(bracketSize: number, roundIndex: number, totalRounds: number): string {
    const roundsFromEnd = totalRounds - roundIndex - 1; // 0 = final, 1 = semi final, etc.
    switch (roundsFromEnd) {
      case 0:
        return 'Final';
      case 1:
        return 'Semi Final';
      case 2:
        return 'Quarter Final';
      case 3:
        return 'Round of 16';
      case 4:
        return 'Round of 32';
      case 5:
        return 'Round of 64';
      default:
        if (roundsFromEnd > 5) {
          return `Round of ${Math.pow(2, roundsFromEnd + 1)}`;
        }
        // For small brackets, we already covered
        return `Round ${roundsFromEnd + 1}`;
    }
  },

  /**
   * Generate a league fixture (round-robin).
   * Each participant plays every other participant once.
   */
  generateLeagueFixture(tournament: Tournament, category: TournamentCategory, participants: FixtureParticipant[]): Fixture {
    // For simplicity, we'll generate a basic round-robin.
    // If odd number of participants, we add a dummy bye (but we don't create matches against bye).
    // We'll use the circle method.

    // We'll not implement full league for now due to time, but we'll create a placeholder.
    // For Phase 8, we can implement a basic version.
    // Let's create a simple round-robin where each participant plays every other once.
    const matches: FixtureMatch[] = [];
    let matchIdCounter = 0;
    let matchCodeCounter = 0;

    const createMatch = (
      roundNumber: number,
      roundName: string,
      matchNumberInRound: number,
      p1: FixtureParticipant | null,
      p2: FixtureParticipant | null
    ): FixtureMatch => {
      matchIdCounter++;
      matchCodeCounter++;
      return {
        id: Math.random().toString(36).substr(2, 9),
        matchCode: `MATCH${String(matchCodeCounter).padStart(6, '0')}`,
        fixtureId: '',
        tournamentId: tournament.id,
        categoryId: category.id,
        roundNumber,
        roundName,
        matchNumber: matchNumberInRound,
        participant1: p1,
        participant2: p2,
        winnerId: null,
        nextMatchId: null,
        nextMatchSlot: null,
        status: 'SCHEDULED',
        participant1Score: 0,
        participant2Score: 0,
        scoreHistory: [],
        courtNumber: null,
        scheduledTime: null
      };
    };

    // Generate all unique pairs
    for (let i = 0; i < participants.length; i++) {
      for (let j = i + 1; j < participants.length; j++) {
        const match = createMatch(0, 'League Stage', matches.length, participants[i], participants[j]);
        matches.push(match);
      }
    }

    const now = new Date().toISOString();
    const fixture: Fixture = {
      id: Math.random().toString(36).substr(2, 9),
      fixtureCode: `FIXTURE${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`,
      tournamentId: tournament.id,
      tournamentCode: tournament.tournamentCode,
      categoryId: category.id,
      categoryName: category.name,
      eventType: category.eventType,
      format: 'LEAGUE',
      status: 'DRAFT',
      registrationPhase: category.registrationPhase,
      participants: participants,
      matches: matches.map(match => ({
        ...match,
        fixtureId: '',
        tournamentId: tournament.id,
        tournamentCode: tournament.tournamentCode,
        categoryId: category.id,
      })),
      createdAt: now,
      updatedAt: now,
      publishedAt: null
    };

    // Set fixtureId on matches
    fixture.matches.forEach(match => {
      match.fixtureId = fixture.id;
    });

    // In league, there are no next matches (unless we have playoffs, but we don't in Phase 8)
    // So we leave nextMatchId and nextMatchSlot as null.

    return fixture;
  },

  /**
   * Reshuffle a draft fixture (regenerate with new random order).
   * Only works on DRAFT fixtures.
   * Does NOT call generateFixture to avoid duplicate validation.
   * Instead, it directly calls the appropriate pure generator.
   */
  reshuffleFixture(organizerId: string, fixtureId: string): Promise<Fixture> {
    if (!isExplicitMockApiMode) return Promise.reject(new Error('Fixture re-shuffle is not available from the Worker API yet.'));
    return new Promise(async (resolve, reject) => {
      try {
        await delay(500);

        const fixtureStore = useFixtureStore.getState();
        if (!fixtureStore) throw new Error('Fixture store not initialized');
        const fixture = fixtureStore.getFixtureById(fixtureId);
        if (!fixture) {
          throw new Error('Fixture not found');
        }

        if (fixture.status !== 'DRAFT') {
          throw new Error('Only draft fixtures can be reshuffled');
        }

        const tournamentStore = useTournamentStore.getState();
        if (!tournamentStore) throw new Error('Tournament store not initialized');
        // Ensure tournament is loaded
        if (!tournamentStore.tournament || tournamentStore.tournament.id !== fixture.tournamentId) {
          await tournamentStore.fetchTournamentById(fixture.tournamentId);
        }
        // Now we know the tournament is in the store and matches the id
        const tournament = tournamentStore.tournament;
        if (!tournament) {
          throw new Error('Tournament not found');
        }

        // Check organizer ownership
        if (tournament.organizerId !== organizerId) {
          throw new Error('Unauthorized: Not the organizer of this tournament');
        }

        // Get the category
        const category = tournament.categories.find(c => c.id === fixture.categoryId);
        if (!category) {
          throw new Error('Category not found');
        }

        // Get current valid participants
        const participants = await this.getEligibleParticipants(fixture.tournamentId, fixture.categoryId);

        // Generate a new fixture with the same format but new random order
        // We do NOT call generateFixture because it would call canGenerateFixture and do duplicate checks.
        // Instead, we call the appropriate pure generator.
        let newFixtureData: Fixture;
        if (fixture.format === 'KNOCKOUT') {
          newFixtureData = this.generateKnockoutFixture(tournament, category, participants);
        } else if (fixture.format === 'LEAGUE') {
          newFixtureData = this.generateLeagueFixture(tournament, category, participants);
        } else {
          throw new Error('Unsupported tournament format for reshuffle');
        }

        // Prepare the object to pass to replaceFixture (which expects Omit<Fixture, 'id'>)
        // We want to keep the original fixture's id, fixtureCode, and createdAt.
        // We will take all properties from newFixtureData except id, fixtureCode, createdAt, and updatedAt.
        // Then we will set fixtureCode and createdAt to the original ones.
        // The store's replaceFixture will set the id (from the first argument) and updatedAt to now.
        const { id, fixtureCode, createdAt, ...newFixtureDataWithoutId } = newFixtureData;
        const fixtureToUpdate = {
          ...newFixtureDataWithoutId,
          fixtureCode: fixture.fixtureCode,
          createdAt: fixture.createdAt
        };

        // Replace the old fixture in the store
        const updated = useFixtureStore.getState().replaceFixture(fixtureId, fixtureToUpdate);

        if (!updated) {
          throw new Error('Failed to update fixture');
        }

        resolve(updated);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Publish a draft fixture.
   * Only works on DRAFT fixtures.
   */
  publishFixture(organizerId: string, fixtureId: string): Promise<Fixture> {
    if (!isExplicitMockApiMode) return Promise.reject(new Error('Fixture publishing is not available from the Worker API yet.'));
    return new Promise(async (resolve, reject) => {
      try {
        await delay(500);

        const fixtureStore = useFixtureStore.getState();
        if (!fixtureStore) throw new Error('Fixture store not initialized');
        const fixture = fixtureStore.getFixtureById(fixtureId);
        if (!fixture) {
          throw new Error('Fixture not found');
        }

        if (fixture.status !== 'DRAFT') {
          throw new Error('Only draft fixtures can be published');
        }

        const tournamentStore = useTournamentStore.getState();
        if (!tournamentStore) throw new Error('Tournament store not initialized');
        // Ensure tournament is loaded
        if (!tournamentStore.tournament || tournamentStore.tournament.id !== fixture.tournamentId) {
          await tournamentStore.fetchTournamentById(fixture.tournamentId);
        }
        // Now we know the tournament is in the store and matches the id
        const tournament = tournamentStore.tournament;
        if (!tournament) {
          throw new Error('Tournament not found');
        }

        // Check organizer ownership
        if (tournament.organizerId !== organizerId) {
          throw new Error('Unauthorized: Not the organizer of this tournament');
        }

        // Update the fixture to published
        const updated = useFixtureStore.getState().publishFixture(fixtureId);

        if (!updated) {
          throw new Error('Failed to publish fixture');
        }

        // Notify that fixture was published
        await notificationService.notifyFixturePublished(tournament.id, fixture.categoryId);

        resolve(updated);
      } catch (error) {
        reject(error);
      }
    });
  },

  /**
   * Get a fixture by id.
   */
  getFixture(fixtureId: string): Promise<Fixture | undefined> {
    if (!isExplicitMockApiMode) {
      return apiClient.get<WorkerFixture>(`/api/fixtures/${fixtureId}`).then(async (response) => {
        const fixture = await fromWorkerFixture(response.data, await fixtureParticipantDirectory());
        cacheFixture(fixture);
        return fixture;
      });
    }
    return new Promise(async (resolve) => {
      await delay(500);
      resolve(useFixtureStore.getState().getFixtureById(fixtureId));
    });
  }
};
