import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import { hashPassword, verifyPassword } from '../utils/password'
import type { AppUser } from '../ipc/types'

interface SessionUser {
  user_id: string
  institution_id: string
  faculty_id: string | null
  username: string
  role: string
}

/**
 * AuthService — in-memory session management.
 * The session lives only in the main process.
 * The renderer never holds a raw session token — it calls window.api.auth.*
 */
export class AuthService {
  private static _session: SessionUser | null = null
  private static _db: Database.Database | null = null

  static initialize(db: Database.Database): void {
    this._db = db
  }

  private static db(): Database.Database {
    if (!this._db) throw new Error('AuthService not initialized')
    return this._db
  }

  /**
   * Called at startup. If no app_user rows exist for this institution,
   * create a default MASTER_ADMIN with username=admin, password=admin123.
   * The user will be prompted to change this on first login.
   */
  static async createFirstAdminIfNeeded(): Promise<void> {
    const db = this.db()
    const institution = db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!institution) return // Institution not set up yet

    const count = (db.prepare('SELECT COUNT(*) as c FROM app_user WHERE institution_id = ?')
      .get(institution.id) as { c: number }).c

    if (count === 0) {
      const hash = await hashPassword('admin123')
      db.prepare(`
        INSERT INTO app_user (user_id, institution_id, username, password_hash, role, status)
        VALUES (?, ?, 'admin', ?, 'MASTER_ADMIN', 'ACTIVE')
      `).run(uuidv4(), institution.id, hash)
      console.log('[Auth] Default admin account created (admin / admin123)')
    }
  }

  static async login(username: string, password: string): Promise<{ success: boolean; error?: string }> {
    const db = this.db()
    const user = db.prepare(`
      SELECT * FROM app_user WHERE username = ? AND status = 'ACTIVE'
    `).get(username) as (AppUser & { password_hash: string }) | undefined

    if (!user) return { success: false, error: 'Invalid username or password' }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) return { success: false, error: 'Invalid username or password' }

    // Update last_login
    db.prepare(`UPDATE app_user SET last_login = datetime('now'), updated_at = datetime('now') WHERE user_id = ?`)
      .run(user.user_id)

    this._session = {
      user_id: user.user_id,
      institution_id: user.institution_id,
      faculty_id: user.faculty_id,
      username: user.username,
      role: user.role,
    }

    return { success: true }
  }

  static logout(): void {
    this._session = null
  }

  static getCurrentUser(): SessionUser | null {
    return this._session
  }

  static isAuthenticated(): boolean {
    return this._session !== null
  }
}
