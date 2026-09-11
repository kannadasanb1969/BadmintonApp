import { Fixture, FixtureMatch, MatchStatus, ScoreSnapshot } from '@/features/fixtures/types/fixture.types';
import { Tournament } from '@/features/tournaments/types/tournament.types';
import { useFixtureStore } from '@/features/fixtures/store/fixtureStore';
import { useTournamentStore } from '@/features/tournaments/store/tournamentStore';
import { useResultStore } from '@/features/fixtures/store/resultStore';
import { useMedalHistoryStore } from '@/features/medals/store/medalHistoryStore';
import { usePlayerDirectoryStore } from '@/features/player/store/playerDirectoryStore';
import { useTeamStore } from '@/features/teams/store/teamStore';
import { notificationService } from '@/features/notifications/services/notificationService';
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient';
import { fixtureService } from '@/features/fixtures/services/fixtureService';


export interface MatchService {
  getMatches: () => Promise<FixtureMatch[]>;
  getMatch: (matchId: string) => Promise<FixtureMatch | undefined>;
  getMatchesByFixture: (fixtureId: string) => Promise<FixtureMatch[]>;
  getMatchesByTournament: (tournamentId: string) => Promise<FixtureMatch[]>;
  getScoreHistory: (matchId: string) => Promise<ScoreSnapshot[]>;
  startMatch: (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string,
    winningPoints: 15 | 21 | 30,
  ) => Promise<FixtureMatch | undefined>;
  updateScore: (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string,
    side: 'PARTICIPANT_1' | 'PARTICIPANT_2',
    delta: 1 | -1
  ) => Promise<FixtureMatch | undefined>;
  undoScore: (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string
  ) => Promise<FixtureMatch | undefined>;
  completeMatch: (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string
  ) => Promise<FixtureMatch | undefined>;
  advanceWinner: (
    fixtureId: string,
    matchId: string
  ) => Promise<void>;
}

type WorkerMatch = Omit<FixtureMatch, 'participant1' | 'participant2' | 'nextMatchSlot'> & {
  participant1Id: string | null;
  participant2Id: string | null;
  nextMatchSlot: FixtureMatch['nextMatchSlot'] | null;
};

const workerMatch = (raw: WorkerMatch): FixtureMatch => {
  const fixture = useFixtureStore.getState().fixtures.find((item) => item.id === raw.fixtureId);
  const existing = fixture?.matches.find((item) => item.id === raw.id);
  const findParticipant = (id: string | null) => id ? fixture?.participants.find((item) => item.id === id) ?? null : null;
  return { ...existing, ...raw, participant1: findParticipant(raw.participant1Id) ?? existing?.participant1 ?? null, participant2: findParticipant(raw.participant2Id) ?? existing?.participant2 ?? null } as FixtureMatch;
};

const cacheWorkerMatch = (match: FixtureMatch): FixtureMatch => {
  const fixtureStore = useFixtureStore.getState();
  const fixture = fixtureStore.getFixtureById(match.fixtureId);
  if (!fixture) return match;

  const matches = fixture.matches.map((existing) => (
    existing.id === match.id ? { ...existing, ...match } : existing
  ));
  fixtureStore.saveGeneratedFixture({ ...fixture, matches, updatedAt: new Date().toISOString() });
  return matches.find((item) => item.id === match.id) ?? match;
};

const syncWorkerMatch = async (raw: WorkerMatch): Promise<FixtureMatch> => {
  // The mutation response is the authoritative, post-update score. Do not wait
  // for a separate fixture read that can repopulate the cache with older data.
  return cacheWorkerMatch(workerMatch(raw));
};

export const matchService: MatchService = {
  async getMatches(): Promise<FixtureMatch[]> {
    if (isExplicitMockApiMode) return useFixtureStore.getState().fixtures.flatMap((fixture) => fixture.matches);
    const data = (await apiClient.get<WorkerMatch[]>('/api/matches')).data;
    return (Array.isArray(data) ? data : []).map(workerMatch);
  },

  async getMatchesByFixture(fixtureId: string): Promise<FixtureMatch[]> {
    if (isExplicitMockApiMode) return useFixtureStore.getState().getFixtureById(fixtureId)?.matches ?? [];
    await fixtureService.getFixture(fixtureId);
    const data = (await apiClient.get<WorkerMatch[]>(`/api/matches/fixture/${fixtureId}`)).data;
    return (Array.isArray(data) ? data : []).map(workerMatch);
  },

  async getMatchesByTournament(tournamentId: string): Promise<FixtureMatch[]> {
    if (isExplicitMockApiMode) return useFixtureStore.getState().fixtures.filter((fixture) => fixture.tournamentId === tournamentId).flatMap((fixture) => fixture.matches);
    const data = (await apiClient.get<WorkerMatch[]>(`/api/matches/tournament/${tournamentId}`)).data;
    return (Array.isArray(data) ? data : []).map(workerMatch);
  },

  async getScoreHistory(matchId: string): Promise<ScoreSnapshot[]> {
    if (isExplicitMockApiMode) return (await matchService.getMatch(matchId))?.scoreHistory ?? [];
    const data = (await apiClient.get<Array<{ participant1Score: number; participant2Score: number }>>(`/api/matches/${matchId}/score-history`)).data;
    return (Array.isArray(data) ? data : []).map((entry) => ({ participant1Score: entry.participant1Score, participant2Score: entry.participant2Score }));
  },
  /**
   * Get a match by ID
   */
  getMatch: async (matchId: string): Promise<FixtureMatch | undefined> => {
    if (!isExplicitMockApiMode) {
      const data = (await apiClient.get<WorkerMatch>(`/api/matches/${matchId}`)).data;
      return syncWorkerMatch(data);
    }
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const fixtureStore = useFixtureStore.getState();
    if (!fixtureStore) throw new Error('Fixture store not initialized');

    // Find the match across all fixtures
    const fixtures = fixtureStore.fixtures;
    for (const fixture of fixtures) {
      const match = fixture.matches.find(m => m.id === matchId);
      if (match) {
        return match;
      }
    }

    return undefined;
  },

  /**
   * Start a match (SCHEDULED -> LIVE)
   */
  startMatch: async (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string,
    winningPoints: 15 | 21 | 30,
  ): Promise<FixtureMatch | undefined> => {
    if (!isExplicitMockApiMode) {
      const data = (await apiClient.post<WorkerMatch>(`/api/matches/${matchId}/start`, { requestedByUserId: organizerId, winningPoints })).data;
      return syncWorkerMatch(data);
    }
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const fixtureStore = useFixtureStore.getState();
    if (!fixtureStore) throw new Error('Fixture store not initialized');
    const tournamentStore = useTournamentStore.getState();
    if (!tournamentStore) throw new Error('Tournament store not initialized');

    // Ensure tournament is loaded
    if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
      await tournamentStore.fetchTournamentById(tournamentId);
    }
    const tournament = tournamentStore.tournament;
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Verify organizer ownership
    if (tournament.organizerId !== organizerId) {
      throw new Error('Unauthorized: Not the organizer of this tournament');
    }

    // Find the fixture and match
    const fixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId);
    if (!fixture) {
      throw new Error('Fixture not found for this tournament and category');
    }

    if (fixture.status !== 'PUBLISHED') {
      throw new Error('Only published fixtures can be started');
    }

    const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) {
      throw new Error('Match not found');
    }

    const match = fixture.matches[matchIndex];
    if (match.status !== MatchStatus.SCHEDULED) {
      throw new Error('Only scheduled matches can be started');
    }

    if (!match.participant1 || !match.participant2) {
      throw new Error('Both participants must be present to start match');
    }

    fixtureStore.setMatchWinningPoints(fixture.id, matchId, winningPoints);
    // Use explicit published match action
    return fixtureStore.startPublishedMatch(fixture.id, matchId);
  },

  /**
   * Update score for a participant
   */
  updateScore: async (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string,
    side: 'PARTICIPANT_1' | 'PARTICIPANT_2',
    delta: 1 | -1
  ): Promise<FixtureMatch | undefined> => {
    if (!isExplicitMockApiMode) {
      const data = (await apiClient.post<WorkerMatch>(`/api/matches/${matchId}/score`, {
        side: side === 'PARTICIPANT_1' ? 'A' : 'B',
        action: delta === 1 ? 'INCREMENT' : 'DECREMENT',
        requestedByUserId: organizerId,
      })).data;
      return syncWorkerMatch(data);
    }
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const fixtureStore = useFixtureStore.getState();
    if (!fixtureStore) throw new Error('Fixture store not initialized');
    const tournamentStore = useTournamentStore.getState();
    if (!tournamentStore) throw new Error('Tournament store not initialized');

    // Ensure tournament is loaded
    if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
      await tournamentStore.fetchTournamentById(tournamentId);
    }
    const tournament = tournamentStore.tournament;
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Verify organizer ownership
    if (tournament.organizerId !== organizerId) {
      throw new Error('Unauthorized: Not the organizer of this tournament');
    }

    // Find the fixture and match
    const fixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId);
    if (!fixture) {
      throw new Error('Fixture not found for this tournament and category');
    }

    if (fixture.status !== 'PUBLISHED') {
      throw new Error('Only published fixtures can be scored');
    }

    const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) {
      throw new Error('Match not found');
    }

    const match = fixture.matches[matchIndex];
    if (match.status !== MatchStatus.LIVE) {
      throw new Error('Only live matches can be scored');
    }

    // Use explicit published match action
    return fixtureStore.updatePublishedMatchScore(fixture.id, matchId, side, delta);
  },

  /**
   * Undo the last score update
   */
  undoScore: async (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string
  ): Promise<FixtureMatch | undefined> => {
    if (!isExplicitMockApiMode) {
      throw new Error('Undo is not a Worker match operation. Use the matching decrement control instead.');
    }
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const fixtureStore = useFixtureStore.getState();
    if (!fixtureStore) throw new Error('Fixture store not initialized');
    const tournamentStore = useTournamentStore.getState();
    if (!tournamentStore) throw new Error('Tournament store not initialized');

    // Ensure tournament is loaded
    if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
      await tournamentStore.fetchTournamentById(tournamentId);
    }
    const tournament = tournamentStore.tournament;
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Verify organizer ownership
    if (tournament.organizerId !== organizerId) {
      throw new Error('Unauthorized: Not the organizer of this tournament');
    }

    // Find the fixture and match
    const fixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId);
    if (!fixture) {
      throw new Error('Fixture not found for this tournament and category');
    }

    if (fixture.status !== 'PUBLISHED') {
      throw new Error('Only published fixtures can have scores undone');
    }

    const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) {
      throw new Error('Match not found');
    }

    const match = fixture.matches[matchIndex];
    if (match.status !== MatchStatus.LIVE) {
      throw new Error('Only live matches can have scores undone');
    }

    // Use explicit published match action
    return fixtureStore.undoPublishedMatchScore(fixture.id, matchId);
  },

  /**
   * Complete a match (LIVE -> COMPLETED) and determine winner
   */
  completeMatch: async (
    organizerId: string,
    tournamentId: string,
    categoryId: string,
    matchId: string
  ): Promise<FixtureMatch | undefined> => {
    if (!isExplicitMockApiMode) {
      const data = (await apiClient.post<WorkerMatch>(`/api/matches/${matchId}/complete`, { requestedByUserId: organizerId })).data;
      return syncWorkerMatch(data);
    }
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const fixtureStore = useFixtureStore.getState();
    if (!fixtureStore) throw new Error('Fixture store not initialized');
    const tournamentStore = useTournamentStore.getState();
    if (!tournamentStore) throw new Error('Tournament store not initialized');
    const resultStore = useResultStore.getState();
    if (!resultStore) throw new Error('Result store not initialized');
    const medalHistoryStore = useMedalHistoryStore.getState();
    if (!medalHistoryStore) throw new Error('Medal history store not initialized');
    const playerDirectoryStore = usePlayerDirectoryStore.getState();
    const teamStore = useTeamStore.getState();

    // Ensure tournament is loaded
    if (!tournamentStore.tournament || tournamentStore.tournament.id !== tournamentId) {
      await tournamentStore.fetchTournamentById(tournamentId);
    }
    const tournament = tournamentStore.tournament;
    if (!tournament) {
      throw new Error('Tournament not found');
    }

    // Verify organizer ownership
    if (tournament.organizerId !== organizerId) {
      throw new Error('Unauthorized: Not the organizer of this tournament');
    }

    // Find the fixture and match
    const fixture = fixtureStore.getFixtureByTournamentCategory(tournamentId, categoryId);
    if (!fixture) {
      throw new Error('Fixture not found for this tournament and category');
    }

    if (fixture.status !== 'PUBLISHED') {
      throw new Error('Only published fixtures can be completed');
    }

    const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) {
      throw new Error('Match not found');
    }

    const match = fixture.matches[matchIndex];
    if (match.status !== MatchStatus.LIVE) {
      throw new Error('Only live matches can be completed');
    }

    if (!match.participant1 || !match.participant2) {
      throw new Error('Both participants must be present to complete match');
    }

    // Check for tie
    if (match.participant1Score === match.participant2Score) {
      throw new Error('Match cannot finish with a tied score');
    }

    // Determine winner
    const winnerId = match.participant1Score > match.participant2Score
      ? match.participant1!.id
      : match.participant2!.id;

    // Resolve category
    const category = tournament.categories.find(
      cat => cat.id === categoryId
    );
    if (!category) {
      throw new Error('Category not found');
    }

    // Update match to completed using explicit action
    const updatedMatch = fixtureStore.completePublishedMatch(
      fixture.id,
      matchId,
      winnerId,
      new Date().toISOString()
    );

    // Notify that match was completed
    await notificationService.notifyMatchCompleted(
      fixture.id,
      matchId,
      winnerId
    );

    // Handle winner advancement and results/medals
    const isFinalMatch = fixture.format === 'KNOCKOUT' && match.roundName === 'Final' && match.nextMatchId === null;
    if (isFinalMatch) {
      // This is a final match - save result and create medal history
      // Determine runner-up (the loser)
      const loserId = match.participant1Score > match.participant2Score
        ? match.participant2!.id
        : match.participant1!.id;

      // Save the final result
      resultStore.saveCategoryResult({
        tournamentId: tournament.id,
        tournamentCode: tournament.tournamentCode,
        tournamentName: tournament.name,
        categoryId: category.id,
        categoryName: category.name,
        eventType: category.eventType,
        winnerParticipantId: winnerId,
        winnerParticipantCode: match.participant1!.id === winnerId ? match.participant1!.code : match.participant2!.code,
        winnerParticipantName: match.participant1!.id === winnerId ? match.participant1!.name : match.participant2!.name,
        runnerUpParticipantId: loserId,
        runnerUpParticipantCode: match.participant1!.id === winnerId ? match.participant2!.code : match.participant1!.code,
        runnerUpParticipantName: match.participant1!.id === winnerId ? match.participant2!.name : match.participant1!.name,
        completedAt: new Date().toISOString()
      });

      // Create medal history for the winner and runner-up
      if (medalHistoryStore) {
        // Get participant details for medal creation
        const winnerParticipant = match.participant1!.id === winnerId ? match.participant1 : match.participant2;
        const loserParticipant = match.participant1!.id === winnerId ? match.participant2 : match.participant1;

        if (category.eventType === 'SINGLES') {
          // For singles, participant is a player
          if (winnerParticipant) {
            // Determine if winner is a registered player or guest
            let isWinnerRegistered = false;
            let winnerName = winnerParticipant.name;
            let winnerCode = winnerParticipant.code;

            // Check player directory for registered player
            if (playerDirectoryStore) {
              const playerProfile = playerDirectoryStore.getProfileById(winnerParticipant.id);
              if (playerProfile) {
                isWinnerRegistered = true;
                winnerName = playerProfile.fullName;
                winnerCode = playerProfile.playerCode;
              }
            }

            // Add medal history for winner (GOLD)
            medalHistoryStore.addMedalHistory({
              playerId: winnerParticipant.id,
              playerCode: winnerCode,
              playerName: winnerName,
              tournamentId: tournament.id,
              tournamentCode: tournament.tournamentCode,
              tournamentName: tournament.name,
              categoryId: category.id,
              categoryName: category.name,
              eventType: category.eventType,
              position: 'WINNER',
              medalType: 'GOLD',
              achievedAt: new Date().toISOString(),
              playerType: isWinnerRegistered ? 'REGISTERED' : 'GUEST'
            });
          }

          if (loserParticipant) {
            // Determine if loser is a registered player or guest
            let isLoserRegistered = false;
            let loserName = loserParticipant.name;
            let loserCode = loserParticipant.code;

            // Check player directory for registered player
            if (playerDirectoryStore) {
              const playerProfile = playerDirectoryStore.getProfileById(loserParticipant.id);
              if (playerProfile) {
                isLoserRegistered = true;
                loserName = playerProfile.fullName;
                loserCode = playerProfile.playerCode;
              }
            }

            // Add medal history for loser (SILVER)
            medalHistoryStore.addMedalHistory({
              playerId: loserParticipant.id,
              playerCode: loserCode,
              playerName: loserName,
              tournamentId: tournament.id,
              tournamentCode: tournament.tournamentCode,
              tournamentName: tournament.name,
              categoryId: category.id,
              categoryName: category.name,
              eventType: category.eventType,
              position: 'RUNNER_UP',
              medalType: 'SILVER',
              achievedAt: new Date().toISOString(),
              playerType: isLoserRegistered ? 'REGISTERED' : 'GUEST'
            });
          }
        } else if (category.eventType === 'DOUBLES') {
          // For doubles, participant is a team
          if (winnerParticipant && teamStore) {
            const winningTeam = teamStore.getTeamById(winnerParticipant.id);
            if (winningTeam) {
              // Add medal history for both team members (GOLD)
              const addTeamMemberMedal = (playerId: string, playerCode: string, fullName: string, playerType: 'REGISTERED' | 'GUEST') => {
                medalHistoryStore.addMedalHistory({
                  playerId,
                  tournamentId: tournament.id,
                  tournamentCode: tournament.tournamentCode,
                  tournamentName: tournament.name,
                  categoryId: category.id,
                  categoryName: category.name,
                  eventType: category.eventType,
                  position: 'WINNER',
                  medalType: 'GOLD',
                  achievedAt: new Date().toISOString(),
                  playerType,
                  playerCode,
                  playerName: fullName
                });
              };

              // Player 1
              if (winningTeam.player1Id) {
                let isPlayer1Registered = false;
                let player1Name = winningTeam.player1Name;
                let player1Code = winningTeam.player1Code;

                if (playerDirectoryStore) {
                  const playerProfile = playerDirectoryStore.getProfileById(winningTeam.player1Id);
                  if (playerProfile) {
                    isPlayer1Registered = true;
                    player1Name = playerProfile.fullName;
                    player1Code = playerProfile.playerCode;
                  }
                }

                addTeamMemberMedal(
                  winningTeam.player1Id,
                  player1Code,
                  player1Name,
                  isPlayer1Registered ? 'REGISTERED' : 'GUEST'
                );
              }

              // Player 2
              if (winningTeam.player2Id) {
                let isPlayer2Registered = false;
                let player2Name = winningTeam.player2Name;
                let player2Code = winningTeam.player2Code;

                if (playerDirectoryStore) {
                  const playerProfile = playerDirectoryStore.getProfileById(winningTeam.player2Id);
                  if (playerProfile) {
                    isPlayer2Registered = true;
                    player2Name = playerProfile.fullName;
                    player2Code = playerProfile.playerCode;
                  }
                }

                addTeamMemberMedal(
                  winningTeam.player2Id,
                  player2Code,
                  player2Name,
                  isPlayer2Registered ? 'REGISTERED' : 'GUEST'
                );
              }
            }
          }

          if (loserParticipant && teamStore) {
            const losingTeam = teamStore.getTeamById(loserParticipant.id);
            if (losingTeam) {
              // Add medal history for both team members (SILVER)
              const addTeamMemberMedal = (playerId: string, playerCode: string, fullName: string, playerType: 'REGISTERED' | 'GUEST') => {
                medalHistoryStore.addMedalHistory({
                  playerId,
                  tournamentId: tournament.id,
                  tournamentCode: tournament.tournamentCode,
                  tournamentName: tournament.name,
                  categoryId: category.id,
                  categoryName: category.name,
                  eventType: category.eventType,
                  position: 'RUNNER_UP',
                  medalType: 'SILVER',
                  achievedAt: new Date().toISOString(),
                  playerType,
                  playerCode,
                  playerName: fullName
                });
              };

              // Player 1
              if (losingTeam.player1Id) {
                let isPlayer1Registered = false;
                let player1Name = losingTeam.player1Name;
                let player1Code = losingTeam.player1Code;

                if (playerDirectoryStore) {
                  const playerProfile = playerDirectoryStore.getProfileById(losingTeam.player1Id);
                  if (playerProfile) {
                    isPlayer1Registered = true;
                    player1Name = playerProfile.fullName;
                    player1Code = playerProfile.playerCode;
                  }
                }

                addTeamMemberMedal(
                  losingTeam.player1Id,
                  player1Code,
                  player1Name,
                  isPlayer1Registered ? 'REGISTERED' : 'GUEST'
                );
              }

              // Player 2
              if (losingTeam.player2Id) {
                let isPlayer2Registered = false;
                let player2Name = losingTeam.player2Name;
                let player2Code = losingTeam.player2Code;

                if (playerDirectoryStore) {
                  const playerProfile = playerDirectoryStore.getProfileById(losingTeam.player2Id);
                  if (playerProfile) {
                    isPlayer2Registered = true;
                    player2Name = playerProfile.fullName;
                    player2Code = playerProfile.playerCode;
                  }
                }

                addTeamMemberMedal(
                  losingTeam.player2Id,
                  player2Code,
                  player2Name,
                  isPlayer2Registered ? 'REGISTERED' : 'GUEST'
                );
              }
            }
          }
        }
      }

      // Notify that medals were awarded (for final matches)
      if (isFinalMatch) {
        await notificationService.notifyMedalAwarded(
          winnerId,
          tournamentId,
          categoryId,
          'GOLD',
          'WINNER'
        );

        await notificationService.notifyMedalAwarded(
          loserId,
          tournamentId,
          categoryId,
          'SILVER',
          'RUNNER_UP'
        );
      }
    } else {
      // This is not a final match - advance winner to next match
      const winnerParticipant = match.participant1?.id === winnerId ? match.participant1 :
        match.participant2?.id === winnerId ? match.participant2 : null;

      if (winnerParticipant) {
        fixtureStore.advanceWinnerToNextMatch(fixture.id, matchId, winnerParticipant);
      }
    }

    return updatedMatch;
  },

  /**
   * Advance winner to next match in the bracket
   */
  advanceWinner: async (
    fixtureId: string,
    matchId: string
  ): Promise<void> => {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const fixtureStore = useFixtureStore.getState();
    if (!fixtureStore) throw new Error('Fixture store not initialized');

    // Find the completed match to get the winner
    const fixture = fixtureStore.getFixtureById(fixtureId);
    if (!fixture) {
      throw new Error('Fixture not found');
    }

    const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
    if (matchIndex === -1) {
      throw new Error('Match not found');
    }

    const match = fixture.matches[matchIndex];
    if (match.status !== MatchStatus.COMPLETED) {
      throw new Error('Only completed matches can advance winners');
    }

    if (!match.winnerId) {
      throw new Error('Match has no winner to advance');
    }

    // Find the winner participant
    const winnerParticipant =
      match.participant1?.id === match.winnerId ? match.participant1 :
      match.participant2?.id === match.winnerId ? match.participant2 :
      null;

    if (!winnerParticipant) {
      throw new Error('Winner participant not found');
    }

    // Use explicit published match action to advance winner
    fixtureStore.advanceWinnerToNextMatch(fixtureId, matchId, winnerParticipant);
  }
};
