import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { MedalHistory } from '@/features/medals/types/medalHistory.types';

interface MedalHistoryStoreState {
  medalHistory: MedalHistory[];
  replaceMedalHistory: (medals: MedalHistory[]) => void;
  addMedalHistory: (medalHistory: Omit<MedalHistory, 'id'>) => MedalHistory;
  getPlayerMedalHistory: (playerId: string) => MedalHistory[];
  getTournamentMedalHistory: (tournamentId: string) => MedalHistory[];
}

export const useMedalHistoryStore = create<MedalHistoryStoreState>()(
  persist(
    (set, get) => ({
      medalHistory: [],
      replaceMedalHistory: (medals) => set({ medalHistory: Array.isArray(medals) ? medals : [] }),

      addMedalHistory: (medalHistory: Omit<MedalHistory, 'id'>): MedalHistory => {
        // Check if medal history already exists for this player/tournament/category/position
        const existing = get().medalHistory.find(
          m =>
            m.playerId === medalHistory.playerId &&
            m.tournamentId === medalHistory.tournamentId &&
            m.categoryId === medalHistory.categoryId &&
            m.position === medalHistory.position
        );

        if (existing) {
          // Update existing medal history (idempotent operation)
          const updatedMedalHistory = { ...existing, ...medalHistory, id: existing.id };
          set(state => ({
            medalHistory: state.medalHistory.map(m =>
              m.id === existing.id ? updatedMedalHistory : m
            )
          }));
          return updatedMedalHistory;
        }

        // Create new medal history
        const newMedalHistory: MedalHistory = {
          id: Math.random().toString(36).substr(2, 9),
          ...medalHistory
        };

        set(state => ({
          medalHistory: [...state.medalHistory, newMedalHistory]
        }));

        return newMedalHistory;
      },

      getPlayerMedalHistory: (playerId: string): MedalHistory[] => {
        return get().medalHistory.filter(m => m.playerId === playerId);
      },

      getTournamentMedalHistory: (tournamentId: string): MedalHistory[] => {
        return get().medalHistory.filter(m => m.tournamentId === tournamentId);
      }
    }),
    {
      name: 'badminton-medal-history', partialize: () => ({}), skipHydration: true
    }
  )
);
