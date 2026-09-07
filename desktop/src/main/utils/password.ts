import bcrypt from 'bcryptjs'

const SALT_ROUNDS = 12

/**
 * Hash a plaintext password using bcryptjs (rounds=12).
 *
 * NOTE: Plan to replace with argon2id when VS Build Tools are available
 * in the production build environment. argon2 requires native compilation.
 * bcryptjs is pure JS and runs without compilation — identical API surface.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

/**
 * Verify a plaintext password against a bcrypt hash.
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}
