export type GuestProfileStatus = 'INCOMPLETE' | 'ACTIVE';
export type GuestGender = 'MALE' | 'FEMALE' | 'OTHER';

export interface GuestPlayer {
  id: string; // database/internal ID
  guestCode: string; // e.g., GST000001
  fullName: string;
  gender?: GuestGender | null;
  dob: string; // YYYY-MM-DD
  age: number; // calculated from dob
  mobile: string; // 10-digit Indian mobile
  location: string;
  playingSince: number; // year, e.g., 2018
  experienceYears: number; // calculated from playingSince
  regularPlayer: boolean;
  courtAcademy: string | null; // only if regularPlayer is true
  profileType: 'GUEST';
  profileStatus: GuestProfileStatus;
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
}
