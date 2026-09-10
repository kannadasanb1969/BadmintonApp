import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { Registration } from '@/features/registrations/types/registration.types';

// Helper to generate registration code (e.g., REG000001)
// We'll use a simple counter persisted in localStorage
const generateRegistrationCode = (registrations: Registration[]): string => {
  const nextNum = registrations.length + 1;
  return `REG${String(nextNum).padStart(6, '0')}`;
};

interface RegistrationStoreState {
  registrations: Registration[];
  replaceRegistrations: (registrations: Registration[]) => void;
  upsertRegistration: (registration: Registration) => void;
  createRegistration: (registration: Omit<Registration, 'id' | 'registrationCode'>) => Registration;
  getPlayerRegistrations: (playerId: string) => Registration[];
  getTournamentRegistrations: (tournamentId: string) => Registration[];
  isAlreadyRegistered: (playerId: string, tournamentId: string, categoryId: string) => boolean;
  cancelRegistration: (registrationId: string) => void;
}

export const useRegistrationStore = create<RegistrationStoreState>()(
  persist(
    (set, get) => ({
      registrations: [],
      replaceRegistrations: (registrations) => set({ registrations: Array.isArray(registrations) ? registrations : [] }),
      upsertRegistration: (registration) => set(state => ({ registrations: [...state.registrations.filter(item => item.id !== registration.id), registration] })),

      createRegistration: (registration) => {
        const newRegistration: Registration = {
          id: Math.random().toString(36).substr(2, 9),
          registrationCode: generateRegistrationCode(get().registrations),
          ...registration,
        };

        set(state => ({
          registrations: [...state.registrations, newRegistration]
        }));

        return newRegistration;
      },

      getPlayerRegistrations: (playerId: string) => {
        return get().registrations
          .filter(reg => reg.playerId === playerId || reg.partnerId === playerId)
          .map(reg => ({ ...reg }));
      },

      getTournamentRegistrations: (tournamentId: string) => {
        return get().registrations
          .filter(reg => reg.tournamentId === tournamentId)
          .map(reg => ({ ...reg }));
      },

      isAlreadyRegistered: (playerId: string, tournamentId: string, categoryId: string) => {
        return get().registrations.some(
          reg => (reg.playerId === playerId || reg.partnerId === playerId) && reg.tournamentId === tournamentId && reg.categoryId === categoryId && reg.status === 'REGISTERED'
        );
      },

      cancelRegistration: (registrationId: string) => {
        set(state => {
          const registrations = state.registrations.map(reg => {
            if (reg.id === registrationId && reg.status === 'REGISTERED') {
              return { ...reg, status: 'CANCELLED', cancelledAt: new Date().toISOString() } as Registration;
            }
            return reg;
          });
          return { registrations };
        });
      }
    }),
    {
      name: 'badminton-registrations', partialize: () => ({}), skipHydration: true
    }
  )
);
