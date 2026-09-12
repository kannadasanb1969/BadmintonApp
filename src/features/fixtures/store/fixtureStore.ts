import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Fixture, FixtureMatch, MatchStatus } from '@/features/fixtures/types/fixture.types';
import { FixtureParticipant } from '@/features/fixtures/types/fixture.types';

interface FixtureStoreState {
  fixtures: Fixture[];
  saveGeneratedFixture: (fixture: Fixture) => Fixture;
  createFixture: (fixture: Omit<Fixture, 'id' | 'fixtureCode' | 'createdAt' | 'updatedAt' | 'publishedAt'>) => Fixture;
  getFixtureById: (id: string) => Fixture | undefined;
  getFixtureByTournamentCategory: (tournamentId: string, categoryId: string) => Fixture | undefined;
  replaceFixture: (id: string, fixture: Omit<Fixture, 'id'>) => Fixture | undefined;
  deleteFixture: (id: string) => void;
  publishFixture: (id: string) => Fixture | undefined;
  // Explicit published match actions for Phase 9 scoring
  startPublishedMatch: (fixtureId: string, matchId: string) => FixtureMatch | undefined;
  updatePublishedMatchScore: (fixtureId: string, matchId: string, side: 'PARTICIPANT_1' | 'PARTICIPANT_2', delta: 1 | -1) => FixtureMatch | undefined;
  setMatchWinningPoints: (fixtureId: string, matchId: string, points: 15 | 21 | 30) => FixtureMatch | undefined;
  undoPublishedMatchScore: (fixtureId: string, matchId: string) => FixtureMatch | undefined;
  completePublishedMatch: (fixtureId: string, matchId: string, winnerId: string, completedAt: string) => FixtureMatch | undefined;
  advanceWinnerToNextMatch: (fixtureId: string, matchId: string, winnerParticipant: FixtureParticipant | null) => void;
}

export const useFixtureStore = create<FixtureStoreState>()(
  persist(
    (set, get) => ({
      fixtures: [],

      saveGeneratedFixture: (fixture) => {
        set(state => ({ fixtures: [...state.fixtures.filter(item => item.id !== fixture.id), fixture] }));
        return fixture;
      },

      createFixture: (fixture: Omit<Fixture, 'id' | 'fixtureCode' | 'createdAt' | 'updatedAt' | 'publishedAt'>): Fixture => {
        const now = new Date().toISOString();
        // Generate fixture code: FIXTURE + padded index
        const fixtureCode = `FIXTURE${String(get().fixtures.length + 1).padStart(6, '0')}`;
        const newFixture: Fixture = {
          id: Math.random().toString(36).substr(2, 9),
          fixtureCode,
          createdAt: now,
          updatedAt: now,
          publishedAt: null,
          ...fixture,
        };

        set(state => ({
          fixtures: [...state.fixtures, newFixture]
        }));

        return newFixture;
      },

      getFixtureById: (id: string) => {
        return get().fixtures.find(fixture => fixture.id === id);
      },

      getFixtureByTournamentCategory: (tournamentId: string, categoryId: string) => {
        return get().fixtures.find(
          fixture => fixture.tournamentId === tournamentId && fixture.categoryId === categoryId
        );
      },

      replaceFixture: (id: string, fixture: Omit<Fixture, 'id'>): Fixture | undefined => {
        const state = get();
        const index = state.fixtures.findIndex(f => f.id === id);
        if (index === -1) {
          return undefined;
        }

        const existingFixture = state.fixtures[index];
        // Only allow replacing a draft fixture
        if (existingFixture.status === 'PUBLISHED') {
          return undefined;
        }

        const now = new Date().toISOString();
        const updatedFixture: Fixture = {
          id,
          updatedAt: now,
          ...fixture,
        };

        set(state => {
          const fixtures = [...state.fixtures];
          fixtures[index] = updatedFixture;
          return { fixtures };
        });

        return updatedFixture;
      },

      deleteFixture: (id: string) => {
        const state = get();
        const index = state.fixtures.findIndex(f => f.id === id);
        if (index === -1) {
          return;
        }

        const existingFixture = state.fixtures[index];
        // Do not allow deleting a published fixture
        if (existingFixture.status === 'PUBLISHED') {
          return;
        }

        set(state => ({
          fixtures: state.fixtures.filter(fixture => fixture.id !== id)
        }));
      },

      publishFixture: (id: string): Fixture | undefined => {
        const state = get();
        const index = state.fixtures.findIndex(f => f.id === id);
        if (index === -1) {
          return undefined;
        }

        const existingFixture = state.fixtures[index];
        // Only allow publishing a draft fixture
        if (existingFixture.status !== 'DRAFT') {
          return undefined;
        }

        const now = new Date().toISOString();
        const updatedFixture: Fixture = {
          ...existingFixture,
          status: 'PUBLISHED',
          publishedAt: now,
          updatedAt: now,
        };

        set(state => {
          const fixtures = [...state.fixtures];
          fixtures[index] = updatedFixture;
          return { fixtures };
        });

        return updatedFixture;
      },

      // Explicit published match actions for Phase 9 scoring
      startPublishedMatch: (fixtureId: string, matchId: string) => {
        const state = get();
        const fixtureIndex = state.fixtures.findIndex(f => f.id === fixtureId);
        if (fixtureIndex === -1) {
          throw new Error('Fixture not found');
        }

        const fixture = state.fixtures[fixtureIndex];
        // Only allow operations on published fixtures
        if (fixture.status !== 'PUBLISHED') {
          throw new Error('Fixture must be published');
        }

        const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
          throw new Error('Match not found');
        }

        const match = fixture.matches[matchIndex];
        // Only allow starting scheduled matches
        if (match.status !== MatchStatus.SCHEDULED) {
          throw new Error('Only scheduled matches can be started');
        }

        if (!match.participant1 || !match.participant2) {
          throw new Error('Both participants must be present to start match');
        }

        // Start the match
        const updatedMatch: FixtureMatch = {
          ...match,
          status: MatchStatus.LIVE,
          startedAt: new Date().toISOString(),
          participant1Score: match.participant1Score ?? 0,
          participant2Score: match.participant2Score ?? 0,
          scoreHistory: match.scoreHistory ?? []
        };

        // Update the match in the fixture
        const updatedMatches = [...fixture.matches];
        updatedMatches[matchIndex] = updatedMatch;

        // Update the fixture
        const updatedFixture: Fixture = {
          ...fixture,
          matches: updatedMatches,
          updatedAt: new Date().toISOString()
        };

        set(state => {
          const fixtures = [...state.fixtures];
          fixtures[fixtureIndex] = updatedFixture;
          return { fixtures };
        });

        return updatedMatch;
      },

      updatePublishedMatchScore: (fixtureId: string, matchId: string, side: 'PARTICIPANT_1' | 'PARTICIPANT_2', delta: 1 | -1) => {
        const state = get();
        const fixtureIndex = state.fixtures.findIndex(f => f.id === fixtureId);
        if (fixtureIndex === -1) {
          throw new Error('Fixture not found');
        }

        const fixture = state.fixtures[fixtureIndex];
        // Only allow operations on published fixtures
        if (fixture.status !== 'PUBLISHED') {
          throw new Error('Fixture must be published');
        }

        const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
          throw new Error('Match not found');
        }

        const match = fixture.matches[matchIndex];
        const winningPoints = match.winningPoints;
        if (winningPoints !== 15 && winningPoints !== 21 && winningPoints !== 30) throw new Error('Select valid winning points before scoring');
        // Only allow scoring live matches
        if (match.status !== MatchStatus.LIVE) {
          throw new Error('Only live matches can be scored');
        }

        // Calculate new scores with proper validation
        let newParticipant1Score = match.participant1Score;
        let newParticipant2Score = match.participant2Score;

        if (side === 'PARTICIPANT_1') {
          if (match.participant1Score === 0 && delta === -1) {
            throw new Error('Score cannot go below 0');
          }
          newParticipant1Score = match.participant1Score + delta;
        } else {
          if (match.participant2Score === 0 && delta === -1) {
            throw new Error('Score cannot go below 0');
          }
          newParticipant2Score = match.participant2Score + delta;
        }

        // Prevent negative scores (redundant check but kept for safety)
        if (newParticipant1Score < 0 || newParticipant2Score < 0) {
          throw new Error('Score cannot go below 0');
        }
        if (newParticipant1Score > winningPoints || newParticipant2Score > winningPoints) {
          throw new Error(`Score cannot exceed ${winningPoints} points`);
        }

        // Create snapshot of current state before updating
        const snapshot: { participant1Score: number; participant2Score: number } = {
          participant1Score: match.participant1Score,
          participant2Score: match.participant2Score
        };

        // Update match with new scores and history
        const updatedMatch: FixtureMatch = {
          ...match,
          participant1Score: newParticipant1Score,
          participant2Score: newParticipant2Score,
          scoreHistory: [...(match.scoreHistory ?? []), snapshot]
        };

        // Update the match in the fixture
        const updatedMatches = [...fixture.matches];
        updatedMatches[matchIndex] = updatedMatch;

        // Update the fixture
        const updatedFixture: Fixture = {
          ...fixture,
          matches: updatedMatches,
          updatedAt: new Date().toISOString()
        };

        set(state => {
          const fixtures = [...state.fixtures];
          fixtures[fixtureIndex] = updatedFixture;
          return { fixtures };
        });

        return updatedMatch;
      },

      setMatchWinningPoints: (fixtureId, matchId, points) => {
        const fixture = get().fixtures.find(item => item.id === fixtureId);
        const match = fixture?.matches.find(item => item.id === matchId);
        if (!fixture || !match || match.status === MatchStatus.COMPLETED) return undefined;
        const updatedMatch = { ...match, winningPoints: points };
        const updatedFixture = { ...fixture, matches: fixture.matches.map(item => item.id === matchId ? updatedMatch : item), updatedAt: new Date().toISOString() };
        set(state => ({ fixtures: state.fixtures.map(item => item.id === fixtureId ? updatedFixture : item) }));
        return updatedMatch;
      },

      undoPublishedMatchScore: (fixtureId: string, matchId: string) => {
        const state = get();
        const fixtureIndex = state.fixtures.findIndex(f => f.id === fixtureId);
        if (fixtureIndex === -1) {
          throw new Error('Fixture not found');
        }

        const fixture = state.fixtures[fixtureIndex];
        // Only allow operations on published fixtures
        if (fixture.status !== 'PUBLISHED') {
          throw new Error('Fixture must be published');
        }

        const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
          throw new Error('Match not found');
        }

        const match = fixture.matches[matchIndex];
        // Only allow undoing live matches
        if (match.status !== MatchStatus.LIVE) {
          throw new Error('Only live matches can have scores undone');
        }

        if (!match.scoreHistory || match.scoreHistory.length === 0) {
          throw new Error('No score history to undo');
        }

        // Get the last snapshot
        const lastSnapshot = match.scoreHistory[match.scoreHistory.length - 1];

        // Remove the last snapshot from history
        const updatedHistory = match.scoreHistory.slice(0, -1);

        // Update match with restored scores
        const updatedMatch: FixtureMatch = {
          ...match,
          participant1Score: lastSnapshot.participant1Score,
          participant2Score: lastSnapshot.participant2Score,
          scoreHistory: updatedHistory
        };

        // Update the match in the fixture
        const updatedMatches = [...fixture.matches];
        updatedMatches[matchIndex] = updatedMatch;

        // Update the fixture
        const updatedFixture: Fixture = {
          ...fixture,
          matches: updatedMatches,
          updatedAt: new Date().toISOString()
        };

        set(state => {
          const fixtures = [...state.fixtures];
          fixtures[fixtureIndex] = updatedFixture;
          return { fixtures };
        });

        return updatedMatch;
      },

      completePublishedMatch: (fixtureId: string, matchId: string, winnerId: string, completedAt: string) => {
        const state = get();
        const fixtureIndex = state.fixtures.findIndex(f => f.id === fixtureId);
        if (fixtureIndex === -1) {
          throw new Error('Fixture not found');
        }

        const fixture = state.fixtures[fixtureIndex];
        // Only allow operations on published fixtures
        if (fixture.status !== 'PUBLISHED') {
          throw new Error('Fixture must be published');
        }

        const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
          throw new Error('Match not found');
        }

        const match = fixture.matches[matchIndex];
        // Only allow completing live matches
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

        // Complete the match
        const updatedMatch: FixtureMatch = {
          ...match,
          status: MatchStatus.COMPLETED,
          winnerId: winnerId,
          completedAt: completedAt
        };

        // Update the match in the fixture
        const updatedMatches = [...fixture.matches];
        updatedMatches[matchIndex] = updatedMatch;

        // Update the fixture
        const updatedFixture: Fixture = {
          ...fixture,
          matches: updatedMatches,
          updatedAt: new Date().toISOString()
        };

        set(state => {
          const fixtures = [...state.fixtures];
          fixtures[fixtureIndex] = updatedFixture;
          return { fixtures };
        });

        return updatedMatch;
      },

      advanceWinnerToNextMatch: (fixtureId: string, matchId: string, winnerParticipant: FixtureParticipant | null) => {
        const state = get();
        const fixtureIndex = state.fixtures.findIndex(f => f.id === fixtureId);
        if (fixtureIndex === -1) {
          throw new Error('Fixture not found');
        }

        const fixture = state.fixtures[fixtureIndex];
        // Only allow operations on published fixtures
        if (fixture.status !== 'PUBLISHED') {
          throw new Error('Fixture must be published');
        }

        // Find the completed match
        const matchIndex = fixture.matches.findIndex(m => m.id === matchId);
        if (matchIndex === -1) {
          throw new Error('Match not found');
        }

        const match = fixture.matches[matchIndex];
        // Only allow advancing winners from completed matches
        if (match.status !== MatchStatus.COMPLETED) {
          throw new Error('Only completed matches can advance winners');
        }

        if (!match.winnerId) {
          throw new Error('Match has no winner to advance');
        }

        if (!match.nextMatchId) {
          // No next match (this is the final match)
          return;
        }

        // Find the next match
        const nextMatchIndex = fixture.matches.findIndex(m => m.id === match.nextMatchId);
        if (nextMatchIndex === -1) {
          throw new Error('Next match not found');
        }

        const nextMatch = fixture.matches[nextMatchIndex];

        // Find the winner participant from the completed match
        const winnerParticipantFromMatch =
          match.participant1?.id === match.winnerId ? match.participant1 :
          match.participant2?.id === match.winnerId ? match.participant2 :
          null;

        // Use the provided winnerParticipant or fall back to looking it up
        const finalWinnerParticipant = winnerParticipant || winnerParticipantFromMatch;

        if (!finalWinnerParticipant) {
          throw new Error('Winner participant not found');
        }

        // Advance winner to next match based on slot
        const updatedNextMatch: FixtureMatch = {
          ...nextMatch
        };

        if (match.nextMatchSlot === 'PARTICIPANT_1') {
          if (!updatedNextMatch.participant1) {
            updatedNextMatch.participant1 = finalWinnerParticipant;
          }
          // If participant1 already exists and is different, don't overwrite (idempotent)
        } else if (match.nextMatchSlot === 'PARTICIPANT_2') {
          if (!updatedNextMatch.participant2) {
            updatedNextMatch.participant2 = finalWinnerParticipant;
          }
          // If participant2 already exists and is different, don't overwrite (idempotent)
        }

        // Update the next match in the fixture
        const updatedMatches = [...fixture.matches];
        updatedMatches[nextMatchIndex] = updatedNextMatch;

        // Update the fixture
        const updatedFixture: Fixture = {
          ...fixture,
          matches: updatedMatches,
          updatedAt: new Date().toISOString()
        };

        set(state => {
          const fixtures = [...state.fixtures];
          fixtures[fixtureIndex] = updatedFixture;
          return { fixtures };
        });
      }
    }),
    {
      name: 'badminton-fixtures', partialize: () => ({}), skipHydration: true
    }
  )
);
