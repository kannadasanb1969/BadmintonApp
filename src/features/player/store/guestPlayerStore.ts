import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { GuestPlayer } from '@/features/player/types/guest.player.types';

// Helper to generate guest code (e.g., GST000001)
// We'll use a simple counter persisted in localStorage
const generateGuestCode = (guests: GuestPlayer[]): string => {
  const nextNum = guests.length + 1;
  return `GST${String(nextNum).padStart(6, '0')}`;
};

const normalizeMobile = (mobile: string): string => {
  // Extract digits
  const digits = mobile.replace(/\D/g, '');
  // If we have more than 10 digits, take the last 10 (assuming country code)
  if (digits.length > 10) {
    return digits.slice(-10);
  }
  // If exactly 10, return as is
  // If less than 10, return the digits (though invalid, but we'll let validation handle)
  return digits;
};

interface GuestPlayerStoreState {
  guests: GuestPlayer[];
  replaceGuests: (guests: GuestPlayer[]) => void;
  createGuest: (guest: Omit<GuestPlayer, 'id' | 'guestCode' | 'createdAt' | 'updatedAt' | 'profileType' | 'profileStatus'>) => GuestPlayer;
  getGuestById: (id: string) => GuestPlayer | undefined;
  getGuestByMobile: (mobile: string) => GuestPlayer | undefined;
  updateGuest: (id: string, updates: Partial<GuestPlayer>) => GuestPlayer | undefined;
}

export const useGuestPlayerStore = create<GuestPlayerStoreState>()(
  persist(
    (set, get) => ({
      guests: [],
      replaceGuests: (guests) => set({ guests: Array.isArray(guests) ? guests : [] }),

      createGuest: (guest) => {
        const now = new Date().toISOString();
        const newGuest: GuestPlayer = {
          id: Math.random().toString(36).substr(2, 9),
          guestCode: generateGuestCode(get().guests),
          profileType: 'GUEST',
          profileStatus: 'ACTIVE', // Guest is always active upon creation
          createdAt: now,
          updatedAt: now,
          ...guest,
          // We'll calculate age and experienceYears in the service or component?
          // For now, we'll leave them to be calculated elsewhere if needed.
          // But note: the GuestPlayer type requires age and experienceYears.
          // We'll set them to 0 and they will be updated by the service or component if needed.
          age: 0,
          experienceYears: 0,
        };

        set(state => ({
          guests: [...state.guests, newGuest]
        }));

        return newGuest;
      },

      getGuestById: (id) => {
        return get().guests.find(guest => guest.id === id);
      },

      getGuestByMobile: (mobile) => {
        const normalizedQuery = normalizeMobile(mobile);
        return get().guests.find(
          (guest) => normalizeMobile(guest.mobile) === normalizedQuery
        );
      },

      updateGuest: (id, updates) => {
        const state = get();
        const index = state.guests.findIndex(guest => guest.id === id);
        if (index === -1) {
          return undefined;
        }

        const updatedGuest = {
          ...state.guests[index],
          ...updates,
          updatedAt: new Date().toISOString(),
        };

        set(state => {
          const guests = [...state.guests];
          guests[index] = updatedGuest;
          return { guests };
        });

        return updatedGuest;
      }
    }),
    {
      name: 'badminton-guest-players', partialize: () => ({}), skipHydration: true
    }
  )
);
