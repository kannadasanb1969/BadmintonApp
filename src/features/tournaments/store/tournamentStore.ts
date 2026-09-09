import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Tournament, TournamentFormValues, TournamentStatus } from '@/features/tournaments/types/tournament.types';
import { normalizeTimeValue } from '@/features/tournaments/utils/tournamentHelpers';

// Helper function to generate category IDs
const generateCategoryId = () =>
  `CAT-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

interface TournamentStoreState {
  tournaments: Tournament[];
  tournament: Tournament | null;
  loading: boolean;
  error: string | null;

  // Tournament operations
  fetchTournaments: () => Promise<void>;
  fetchTournamentById: (id: string) => Promise<void>;
  createTournament: (tournamentData: TournamentFormValues, organizer: { id: string; displayName?: string; mobile: string; role: string }) => Tournament;
  updateTournament: (id: string, tournamentData: Partial<TournamentFormValues>) => Tournament;
  submitTournamentForApproval: (id: string) => Tournament;
  approveTournament: (id: string, adminId?: string) => Tournament;
  rejectTournament: (id: string, rejectionReason: string, adminId?: string) => Tournament;
  publishTournament: (id: string) => Tournament;
  getTournamentsByOrganizer: (organizerId: string) => Tournament[];
  // New action for closing category registration
  closeCategoryRegistration: (organizerId: string, tournamentId: string, categoryId: string) => Promise<void>;
  reopenCategoryRegistration: (organizerId: string, tournamentId: string, categoryId: string) => Promise<void>;

  // Reset state
  reset: () => void;
}

export const useTournamentStore = create<TournamentStoreState>()(
  persist(
    (set, get) => ({
      tournaments: [],
      tournament: null,
      loading: false,
      error: null,

      fetchTournaments: async () => {
        set({ loading: true, error: null });
        try {
          const { tournamentService } = await import('@/features/tournaments/services/tournamentService');
          await tournamentService.getTournaments();
          set({ loading: false });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : 'An error occurred' });
        }
      },

      fetchTournamentById: async (id: string) => {
        set({ loading: true, error: null });
        try {
          const { tournamentService } = await import('@/features/tournaments/services/tournamentService');
          const tournament = await tournamentService.getTournamentById(id);
          set({
            tournament: tournament ? { ...tournament } : null,
            loading: false
          });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : 'An error occurred' });
        }
      },

      createTournament: (tournamentData: TournamentFormValues, organizer: { id: string; displayName?: string; mobile: string; role: string }) => {
        const normalizedRules = (Array.isArray(tournamentData.generalRules) ? tournamentData.generalRules : String(tournamentData.generalRules ?? '').split('\n')).map(rule => String(rule).trim()).filter(Boolean);
        // Generate IDs for categories since TournamentFormValues omits them
        const generatedCategories = tournamentData.categories.map(
          (category, index) => ({
            ...category,
            id: generateCategoryId(),
            registrationPhase:
              category.registrationPhase ?? 'OPEN',
            registrationClosedAt:
              category.registrationClosedAt ?? null,
          })
        );

        const newTournament: Tournament = {
          id: Math.random().toString(36).substr(2, 9),
          tournamentCode: `TRN-${String(get().tournaments.length + 1).padStart(4, '0')}`,
          organizerId: organizer.id,
          organizerMobile: organizer.mobile,
          organizerName: organizer.displayName || organizer.mobile,
          ...tournamentData,
          generalRules: normalizedRules,
          categories: generatedCategories, // Override with generated categories
          status: 'DRAFT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set(state => ({
          tournaments: [...state.tournaments, newTournament]
        }));

        return newTournament;
      },

      updateTournament: (id: string, tournamentData: Partial<TournamentFormValues>) => {
        const state = get();
        const index = state.tournaments.findIndex(t => t.id === id);
        if (index === -1) {
          throw new Error('Tournament not found');
        }

        // Preserve category IDs during update since TournamentFormValues omits them
        const existingCategories = state.tournaments[index].categories;
        const updatedCategories = tournamentData.categories?.map((category, categoryIndex) => ({
          ...category,
          id:
            existingCategories[categoryIndex]?.id ??
            generateCategoryId(),
          registrationPhase:
            existingCategories[categoryIndex]?.registrationPhase ??
            category.registrationPhase ??
            'OPEN',
          registrationClosedAt:
            existingCategories[categoryIndex]?.registrationClosedAt ??
            null,
        })) ?? existingCategories;

        const normalizedRules = tournamentData.generalRules === undefined ? state.tournaments[index].generalRules : (Array.isArray(tournamentData.generalRules) ? tournamentData.generalRules : String(tournamentData.generalRules ?? '').split('\n')).map(rule => String(rule).trim()).filter(Boolean);
        const updatedTournament = {
          ...state.tournaments[index],
          ...tournamentData,
          generalRules: normalizedRules,
          categories: updatedCategories, // Override with preserved/updated categories
          updatedAt: new Date().toISOString(),
        };

        set(state => {
          const updatedTournaments = [...state.tournaments];
          updatedTournaments[index] = updatedTournament;
          return { tournaments: updatedTournaments };
        });

        return updatedTournament;
      },

      submitTournamentForApproval: (id: string) => {
        const state = get();
        const index = state.tournaments.findIndex(t => t.id === id);
        if (index === -1) {
          throw new Error('Tournament not found');
        }

        const tournament = state.tournaments[index];
        if (tournament.status !== 'DRAFT') {
          throw new Error('Only draft tournaments can be submitted for approval');
        }

        const updatedTournament = {
          ...tournament,
          status: 'PENDING_ADMIN_APPROVAL' as TournamentStatus,
          submittedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set(state => {
          const updatedTournaments = [...state.tournaments];
          updatedTournaments[index] = updatedTournament;
          return { tournaments: updatedTournaments };
        });

        return updatedTournament;
      },

      approveTournament: (id: string, adminId?: string) => {
        const state = get();
        const index = state.tournaments.findIndex(t => t.id === id);
        if (index === -1) {
          throw new Error('Tournament not found');
        }

        const tournament = state.tournaments[index];
        if (tournament.status !== 'PENDING_ADMIN_APPROVAL') {
          throw new Error('Only pending approval tournaments can be approved');
        }

        const updatedTournament = {
          ...tournament,
          status: 'APPROVED' as TournamentStatus,
          approvedAt: new Date().toISOString(),
          approvedBy: adminId ?? undefined,
          updatedAt: new Date().toISOString(),
        };

        set(state => {
          const updatedTournaments = [...state.tournaments];
          updatedTournaments[index] = updatedTournament;
          return { tournaments: updatedTournaments };
        });

        return updatedTournament;
      },

      rejectTournament: (id: string, rejectionReason: string, adminId?: string) => {
        const state = get();
        const index = state.tournaments.findIndex(t => t.id === id);
        if (index === -1) {
          throw new Error('Tournament not found');
        }

        const tournament = state.tournaments[index];
        if (tournament.status !== 'PENDING_ADMIN_APPROVAL') {
          throw new Error('Only pending approval tournaments can be rejected');
        }

        // Trim and check rejection reason
        const trimmedReason = rejectionReason.trim();
        if (!trimmedReason) {
          throw new Error('Rejection reason is required');
        }

        const updatedTournament = {
          ...tournament,
          status: 'REJECTED' as TournamentStatus,
          rejectionReason: trimmedReason,
          rejectedAt: new Date().toISOString(),
          rejectedBy: adminId ?? undefined,
          updatedAt: new Date().toISOString(),
        };

        set(state => {
          const updatedTournaments = [...state.tournaments];
          updatedTournaments[index] = updatedTournament;
          return { tournaments: updatedTournaments };
        });

        return updatedTournament;
      },

      publishTournament: (id: string) => {
        const state = get();
        const index = state.tournaments.findIndex(t => t.id === id);
        if (index === -1) {
          throw new Error('Tournament not found');
        }

        const tournament = state.tournaments[index];
        if (tournament.status !== 'APPROVED') {
          throw new Error('Only approved tournaments can be published');
        }

        const updatedTournament = {
          ...tournament,
          status: 'PUBLISHED' as TournamentStatus,
          publishedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        set(state => {
          const updatedTournaments = [...state.tournaments];
          updatedTournaments[index] = updatedTournament;
          return { tournaments: updatedTournaments };
        });

        return updatedTournament;
      },

      getTournamentsByOrganizer: (organizerId: string) => {
        return get().tournaments
          .filter(t => t.organizerId === organizerId)
          .map(t => ({ ...t }));
      },

      // New action for closing category registration
      closeCategoryRegistration: async (organizerId: string, tournamentId: string, categoryId: string) => {
        set({ loading: true, error: null });
        try {
          // Simulate API delay
          await new Promise(resolve => setTimeout(resolve, 500));
          const state = get();
          const tournament = state.tournaments.find(t => t.id === tournamentId);
          if (!tournament) {
            throw new Error('Tournament not found');
          }
          // Check organizer ownership
          if (tournament.organizerId !== organizerId) {
            throw new Error('Unauthorized: Not the organizer of this tournament');
          }
          // Find the category
          const categoryIndex = tournament.categories.findIndex(c => c.id === categoryId);
          if (categoryIndex === -1) {
            throw new Error('Category not found');
          }
          const category = tournament.categories[categoryIndex];
          if (category.registrationPhase !== 'OPEN') {
            throw new Error('Registration is not open');
          }
          // Update the category
          const updatedCategories = [...tournament.categories];
          updatedCategories[categoryIndex] = {
            ...category,
            registrationPhase: 'CLOSED',
            registrationClosedAt: new Date().toISOString()
          };
          // Update the tournament
          const updatedTournament = {
            ...tournament,
            categories: updatedCategories,
            updatedAt: new Date().toISOString()
          };
          // Update the state
          set(state => {
            const updatedTournaments = state.tournaments.map(t =>
              t.id === tournamentId ? updatedTournament : t
            );
            return { tournaments: updatedTournaments, loading: false };
          });
        } catch (err) {
          set({ loading: false, error: err instanceof Error ? err.message : 'An unknown error occurred' });
        }
      },

      reopenCategoryRegistration: async (organizerId, tournamentId, categoryId) => {
        const tournament = get().tournaments.find(item => item.id === tournamentId);
        if (!tournament) throw new Error('Tournament not found');
        if (tournament.organizerId !== organizerId) throw new Error('Unauthorized: Not the organizer of this tournament');
        const category = tournament.categories.find(item => item.id === categoryId);
        if (!category) throw new Error('Category not found');
        const updatedTournament = {
          ...tournament,
          categories: tournament.categories.map(item => item.id === categoryId ? { ...item, registrationPhase: 'OPEN' as const, registrationClosedAt: null } : item),
          updatedAt: new Date().toISOString(),
        };
        set(state => ({ tournaments: state.tournaments.map(item => item.id === tournamentId ? updatedTournament : item), tournament: state.tournament?.id === tournamentId ? updatedTournament : state.tournament }));
      },

      // Migration action for legacy tournament organizer IDs
      migrateLegacyTournaments: (currentUserId: string, currentUserMobile: string) => {
        const state = get();
        const updatedTournaments = state.tournaments.map(tournament => {
          // If tournament already has organizerMobile, it's already migrated
          if (tournament.organizerMobile) {
            return tournament;
          }

          // Check if this looks like a legacy tournament
          const isLegacyOrganizerId = /^organizer-\d+$/.test(tournament.organizerId);
          const isLegacyPlayerId = /^player-\d+$/.test(tournament.organizerId);
          const isLegacyAdminId = /^admin-\d+$/.test(tournament.organizerId);

          if (isLegacyOrganizerId || isLegacyPlayerId || isLegacyAdminId) {
            // Extract the role from the legacy ID
            const roleMatch = tournament.organizerId.match(/^([a-z]+)-\d+$/);
            if (roleMatch) {
              const role = roleMatch[1]; // organizer, player, or admin

              // For this frontend mock environment, we migrate ONLY when ownership is unambiguous
              // We assume that if the current user's role matches the tournament's legacy role,
              // and we're migrating for that specific user, then it's safe to migrate
              if (role === currentUserId.split('-')[0]) {
                // Migrate to stable ID based on current user's mobile
                const newOrganizerId = `${role}-${currentUserMobile}`;
                return {
                  ...tournament,
                  organizerId: newOrganizerId,
                  organizerMobile: currentUserMobile
                };
              }
            }
          }

          // If not legacy or not safe to migrate, return as-is
          return tournament;
        });

        // Only update if any tournaments were actually migrated
        const hasMigrations = updatedTournaments.some((t, i) =>
          t.organizerId !== state.tournaments[i].organizerId ||
          t.organizerMobile !== state.tournaments[i].organizerMobile
        );

        if (hasMigrations) {
          set({ tournaments: updatedTournaments });
        }
      },

      reset: () => {
        set({
          tournaments: [],
          tournament: null,
          loading: false,
          error: null
        });
      }
    }),
    {
      name: 'badminton-tournaments', // Persistence key
      // The local REST API is the persistent source. Starting from the
      // in-store array prevents stale browser storage from replacing it with
      // an incompatible response shape before API hydration completes.
      skipHydration: true,
      partialize: () => ({}),
      version: 5,
      migrate: (persistedState, version) => {
        if (version < 5) {
          // Repair legacy category IDs and single-hour time values (for example, "7" → "07:00").
          const state = persistedState as unknown as { tournaments: Tournament[] };
          const fixedTournaments = state.tournaments.map(tournament => ({
            ...tournament,
            reportingTime: normalizeTimeValue(tournament.reportingTime) ?? tournament.reportingTime,
            registrationCloseTime: normalizeTimeValue(tournament.registrationCloseTime) ?? tournament.registrationCloseTime,
            generalRules: (Array.isArray(tournament.generalRules) ? tournament.generalRules : String(tournament.generalRules ?? '').split('\n')).map(rule => String(rule).trim()).filter(Boolean),
            categories: tournament.categories.map(category => ({
              ...category,
              id:
                typeof category.id === 'string' &&
                category.id.trim().length > 0
                  ? category.id
                  : generateCategoryId(),
              registrationPhase: category.registrationPhase ?? 'OPEN',
              registrationClosedAt: category.registrationClosedAt ?? null,
            })),
          }));
          return { ...state, tournaments: fixedTournaments };
        }
        return persistedState; // No migration needed for version >= 2
      }
    }
  )
);
