import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { user, type User } from './schema'
import { eq } from 'drizzle-orm'

// biome-ignore lint/style/noNonNullAssertion: <explanation>
const client = postgres(process.env.POSTGRES_URL!)
export const db = drizzle(client)

export async function getUser(email: string): Promise<Array<User>> {
  try {
    return await db.select().from(user).where(eq(user.email, email))
  } catch (error) {
    throw new Error('Failed to get user by email')
  }
}