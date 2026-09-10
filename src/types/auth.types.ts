export type Role = 'PLAYER' | 'ORGANIZER' | 'ADMIN';

export interface User {
  id: string;
  mobile: string;
  role: Role;
  displayName?: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  accessToken: string | null;
}
