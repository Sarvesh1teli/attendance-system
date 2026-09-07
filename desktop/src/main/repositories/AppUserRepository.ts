import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { AppUser, CreateAppUserInput, UpdateAppUserInput } from '../ipc/types'
import { hashPassword } from '../utils/password'

export class AppUserRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(): AppUser[] {
    return this.db
      .prepare('SELECT user_id, institution_id, faculty_id, username, role, status, last_login, created_at, updated_at FROM app_user WHERE institution_id = ? ORDER BY created_at DESC')
      .all(this.institutionId()) as AppUser[]
  }

  getById(id: string): AppUser | null {
    return this.db
      .prepare('SELECT user_id, institution_id, faculty_id, username, role, status, last_login, created_at, updated_at FROM app_user WHERE user_id = ?')
      .get(id) as AppUser | null
  }

  findByUsername(username: string): (AppUser & { password_hash: string }) | null {
    return this.db
      .prepare('SELECT * FROM app_user WHERE username = ?')
      .get(username) as (AppUser & { password_hash: string }) | null
  }

  async create(data: CreateAppUserInput): Promise<AppUser> {
    const id = uuidv4()
    const instId = this.institutionId()
    const hash = await hashPassword(data.password)

    this.db.prepare(`
      INSERT INTO app_user (user_id, institution_id, faculty_id, username, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
    `).run(id, instId, data.faculty_id ?? null, data.username, hash, data.role)

    return this.getById(id)!
  }

  async update(id: string, data: UpdateAppUserInput): Promise<AppUser> {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.username !== undefined) { sets.push('username = ?'); params.push(data.username) }
    if (data.role !== undefined) { sets.push('role = ?'); params.push(data.role) }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status) }
    if (data.faculty_id !== undefined) { sets.push('faculty_id = ?'); params.push(data.faculty_id) }
    if (data.new_password !== undefined) {
      const hash = await hashPassword(data.new_password)
      sets.push('password_hash = ?')
      params.push(hash)
    }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)

    this.db.prepare(`UPDATE app_user SET ${sets.join(', ')} WHERE user_id = ?`).run(...params)
    return this.getById(id)!
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM app_user WHERE user_id = ?').run(id)
  }
}
