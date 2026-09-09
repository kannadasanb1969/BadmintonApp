import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { CategoryResult } from '@/features/fixtures/types/fixture.types';

interface ResultStoreState {
  results: CategoryResult[];
  replaceResults: (results: CategoryResult[]) => void;
  saveCategoryResult: (result: Omit<CategoryResult, 'id'>) => CategoryResult;
  getCategoryResult: (tournamentId: string, categoryId: string) => CategoryResult | undefined;
  getTournamentResults: (tournamentId: string) => CategoryResult[];
}

export const useResultStore = create<ResultStoreState>()(
  persist(
    (set, get) => ({
      results: [],
      replaceResults: (results) => set({ results: Array.isArray(results) ? results : [] }),

      saveCategoryResult: (result: Omit<CategoryResult, 'id'>): CategoryResult => {
        // Check if result already exists for this tournament/category
        const existing = get().results.find(
          r => r.tournamentId === result.tournamentId && r.categoryId === result.categoryId
        );

        if (existing) {
          // Update existing result (idempotent operation)
          const updatedResult = { ...existing, ...result, id: existing.id };
          set(state => ({
            results: state.results.map(r =>
              r.id === existing.id ? updatedResult : r
            )
          }));
          return updatedResult;
        }

        // Create new result
        const now = new Date().toISOString();
        const newResult: CategoryResult = {
          id: Math.random().toString(36).substr(2, 9),
          ...result,
          completedAt: result.completedAt || now
        };

        set(state => ({
          results: [...state.results, newResult]
        }));

        return newResult;
      },

      getCategoryResult: (tournamentId: string, categoryId: string): CategoryResult | undefined => {
        return get().results.find(
          result => result.tournamentId === tournamentId && result.categoryId === categoryId
        );
      },

      getTournamentResults: (tournamentId: string): CategoryResult[] => {
        return get().results.filter(result => result.tournamentId === tournamentId);
      }
    }),
    {
      name: 'badminton-results', partialize: () => ({}), skipHydration: true
    }
  )
);
