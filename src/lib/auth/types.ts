export type AuthUserType = 'guest' | 'regular';

export interface AuthUser {
  id: string;
  email?: string | null;
  type: AuthUserType;
}

export interface AuthSession {
  user: AuthUser | null;
  expires?: string;
}

export interface AuthAdapter {
  getSession(): Promise<AuthSession | null>;
  signIn(credentials: { email: string; password: string }): Promise<void>;
  signOut(): Promise<void>;
}
export type AuthProvider = 'better-auth' | 'clerk';