import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Team, TeamCreateInput, TeamStatus, PartnerStatus } from '@/features/teams/types/team.types';

// Helper to generate team code (e.g., TEAM000001)
// We'll use a simple counter persisted in localStorage
const generateTeamCode = (teams: Team[]): string => {
  const nextNum = teams.length + 1;
  return `TEAM${String(nextNum).padStart(6, '0')}`;
};

interface TeamStoreState {
  teams: Team[];
  createTeam: (team: Omit<Team, 'id' | 'teamCode' | 'createdAt' | 'confirmedAt' | 'cancelledAt'>) => Team;
  getTeamById: (id: string) => Team | undefined;
  getPlayerTeams: (playerId: string) => Team[];
  getTournamentTeams: (tournamentId: string) => Team[];
  getCategoryTeams: (tournamentId: string, categoryId: string) => Team[];
  acceptPartner: (teamId: string) => Team | undefined;
  confirmTeam: (teamId: string) => Team | undefined;
  cancelTeam: (teamId: string) => Team | undefined;
  teamExists: (tournamentId: string, categoryId: string, player1Id: string, player2Id: string) => boolean;
}

export const useTeamStore = create<TeamStoreState>()(
  persist(
    (set, get) => ({
      teams: [],

      createTeam: (team: Omit<Team, 'id' | 'teamCode' | 'createdAt' | 'confirmedAt' | 'cancelledAt'>): Team => {
        const now = new Date().toISOString();
        const newTeam: Team = {
          id: Math.random().toString(36).substr(2, 9),
          teamCode: generateTeamCode(get().teams),
          createdAt: now,
          ...team,
          // Set initial partnerStatus and status based on player2Type
          // If player2 is guest, then partnerStatus is ACCEPTED (since guest is pre-accepted)
          // If player2 is existing player, then partnerStatus is PENDING_CONFIRMATION (awaiting acceptance)
          // Status starts as PENDING_PARTNER for both cases
          partnerStatus: team.player2Type === 'GUEST' ? 'ACCEPTED' : 'PENDING_CONFIRMATION',
          status: 'PENDING_PARTNER',
        };

        set(state => ({
          teams: [...state.teams, newTeam]
        }));

        return newTeam;
      },

      getTeamById: (id) => {
        return get().teams.find(team => team.id === id);
      },

      getPlayerTeams: (playerId) => {
        return get().teams.filter(
          team => team.player1Id === playerId || team.player2Id === playerId
        );
      },

      getTournamentTeams: (tournamentId) => {
        return get().teams.filter(team => team.tournamentId === tournamentId);
      },

      getCategoryTeams: (tournamentId, categoryId) => {
        return get().teams.filter(
          team => team.tournamentId === tournamentId && team.categoryId === categoryId
        );
      },

      acceptPartner: (teamId: string): Team | undefined => {
        const state = get();
        const team = state.teams.find(t => t.id === teamId);
        if (!team) {
          return undefined;
        }

        // Only update if partnerStatus is PENDING_CONFIRMATION
        if (team.partnerStatus !== 'PENDING_CONFIRMATION') {
          return team;
        }

        const updatedTeam: Team = {
          ...team,
          partnerStatus: 'ACCEPTED', // Partner has accepted the invitation
          // status remains PENDING_PARTNER until final confirmation
        };

        set(state => {
          const teams = [...state.teams];
          const index = teams.findIndex(t => t.id === teamId);
          teams[index] = updatedTeam;
          return { teams };
        });

        return updatedTeam;
      },

      confirmTeam: (teamId: string): Team | undefined => {
        // Confirm a team only if partner has accepted; sets status to CONFIRMED and confirmedAt.
        const state = get();
        const team = state.teams.find(t => t.id === teamId);
        if (!team) {
          return undefined;
        }

        // If already confirmed, return as is
        if (team.status === 'CONFIRMED') {
          return team;
        }

        // Require partner to be accepted before confirming
        if (team.partnerStatus !== 'ACCEPTED') {
          return undefined;
        }

        const updatedTeam: Team = {
          ...team,
          status: 'CONFIRMED', // Team is now confirmed
          confirmedAt: new Date().toISOString(),
        };

        set(state => {
          const teams = [...state.teams];
          const index = teams.findIndex(t => t.id === teamId);
          teams[index] = updatedTeam;
          return { teams };
        });

        return updatedTeam;
      },

      cancelTeam: (teamId: string): Team | undefined => {
        const state = get();
        const team = state.teams.find(t => t.id === teamId);
        if (!team) {
          return undefined;
        }

        const updatedTeam: Team = {
          ...team,
          status: 'CANCELLED',
          cancelledAt: new Date().toISOString(),
          // When a team is cancelled, partnership status remains as it was before cancellation
        };

        set(state => {
          const teams = [...state.teams];
          const index = teams.findIndex(t => t.id === teamId);
          teams[index] = updatedTeam;
          return { teams };
        });

        return updatedTeam;
      },

      teamExists: (tournamentId: string, categoryId: string, player1Id: string, player2Id: string): boolean => {
        const state = get();
        return state.teams.some(
          team =>
            team.tournamentId === tournamentId &&
            team.categoryId === categoryId &&
            ((team.player1Id === player1Id && team.player2Id === player2Id) ||
              (team.player1Id === player2Id && team.player2Id === player1Id)) &&
            team.status === 'CONFIRMED' // Only consider confirmed teams as existing
        );
      }
    }),
    {
      name: 'badminton-teams', partialize: () => ({}), skipHydration: true
    }
  )
);
