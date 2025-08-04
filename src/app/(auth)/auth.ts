import { authAdapter } from '@/lib/auth/auth-service';

export type UserType = 'guest' | 'regular';

export async function auth() {
  const session = await authAdapter.getSession();
  if (!session) {
    return null;
  }
  return session;
}


export async function signOut() {
  return await authAdapter.signOut();
}