import type { AuthSession } from './types';

export class AuthAdapter {
  name = "your-auth-adapter";

  async getSession(): Promise<AuthSession | null> {
    return null;
  }

  async signIn(credentials: { email: string; password: string }): Promise<void> {
  }

  async signOut(options?: { redirectTo?: string }): Promise<void> {

  }
}

const authAdapter = new AuthAdapter();
export default authAdapter;