import { GuestPlayer } from '@/features/player/types/guest.player.types';
import { useGuestPlayerStore } from '@/features/player/store/guestPlayerStore';
import apiClient, { isExplicitMockApiMode } from '@/api/apiClient';

// Mock delay function to simulate API calls
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const guestPlayerService = {
  loadGuests: async (): Promise<GuestPlayer[]> => {
    if (isExplicitMockApiMode) return useGuestPlayerStore.getState().guests;
    const guests = (await apiClient.get<GuestPlayer[]>('/api/guest-players')).data;
    const list = Array.isArray(guests) ? guests : [];
    useGuestPlayerStore.getState().replaceGuests(list);
    return list;
  },
  /**
   * Create a new guest player
   * @param guestData Guest player data without id, guestCode, createdAt, updatedAt, profileType, profileStatus
   */
  createGuest: async (guestData: Omit<GuestPlayer, 'id' | 'guestCode' | 'createdAt' | 'updatedAt' | 'profileType' | 'profileStatus'>): Promise<GuestPlayer> => {
    if (!isExplicitMockApiMode) {
      const guest = (await apiClient.post<GuestPlayer>('/api/guest-players', {
        fullName: guestData.fullName.trim(),
        mobile: guestData.mobile.trim(),
        dob: guestData.dob,
        location: guestData.location || null,
        playingSince: guestData.playingSince,
        regularPlayer: Boolean(guestData.regularPlayer),
        courtAcademy: guestData.regularPlayer ? guestData.courtAcademy || null : null,
      })).data;
      useGuestPlayerStore.getState().replaceGuests([
        ...useGuestPlayerStore.getState().guests.filter(item => item.id !== guest.id),
        guest,
      ]);
      return guest;
    }
    await delay(500);
    const storeState = useGuestPlayerStore.getState();
    // Check for duplicate by mobile
    const existingGuest = storeState.getGuestByMobile(guestData.mobile);
    if (existingGuest) {
      return existingGuest;
    }
    const guest = storeState.createGuest(guestData);
    return guest;
  },

  /**
   * Get guest player by ID
   */
  getGuestById: async (id: string): Promise<GuestPlayer | undefined> => {
    if (!isExplicitMockApiMode) {
      const guest = (await apiClient.get<GuestPlayer>(`/api/guest-players/${id}`)).data;
      useGuestPlayerStore.getState().replaceGuests([
        ...useGuestPlayerStore.getState().guests.filter(item => item.id !== guest.id),
        guest,
      ]);
      return guest;
    }
    await delay(500);
    const storeState = useGuestPlayerStore.getState();
    return storeState.getGuestById(id);
  },

  /**
   * Get guest player by mobile
   */
  getGuestByMobile: async (mobile: string): Promise<GuestPlayer | undefined> => {
    if (!isExplicitMockApiMode) {
      const guests = await guestPlayerService.loadGuests();
      return guests.find(guest => guest.mobile === mobile);
    }
    await delay(500);
    const storeState = useGuestPlayerStore.getState();
    return storeState.getGuestByMobile(mobile);
  },

  /**
   * Update guest player
   */
  updateGuest: async (id: string, updates: Partial<GuestPlayer>): Promise<GuestPlayer | undefined> => {
    if (!isExplicitMockApiMode) {
      const guest = (await apiClient.put<GuestPlayer>(`/api/guest-players/${id}`, {
        fullName: updates.fullName,
        mobile: updates.mobile,
        dob: updates.dob,
        location: updates.location,
        playingSince: updates.playingSince,
        regularPlayer: updates.regularPlayer,
        courtAcademy: updates.courtAcademy,
      })).data;
      useGuestPlayerStore.getState().replaceGuests([
        ...useGuestPlayerStore.getState().guests.filter(item => item.id !== guest.id),
        guest,
      ]);
      return guest;
    }
    await delay(500);
    const storeState = useGuestPlayerStore.getState();
    const updatedGuest = storeState.updateGuest(id, updates);
    return updatedGuest;
  }
};
