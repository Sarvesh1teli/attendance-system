import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { Institution, UpsertInstitutionInput } from '../ipc/types'

export class InstitutionRepository {
  constructor(private db: Database.Database) {}

  get(): Institution | null {
    return this.db
      .prepare('SELECT * FROM institution LIMIT 1')
      .get() as Institution | null
  }

  upsert(data: UpsertInstitutionInput): Institution {
    const existing = this.get()
    if (existing) {
      this.db
        .prepare(`
          UPDATE institution
          SET name = ?, address = ?, phone = ?, email = ?, logo_path = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `)
        .run(data.name, data.address ?? null, data.phone ?? null,
             data.email ?? null, data.logo_path ?? null, existing.id)
      return this.get()!
    } else {
      const id = uuidv4()
      this.db
        .prepare(`
          INSERT INTO institution (id, name, address, phone, email, logo_path)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(id, data.name, data.address ?? null, data.phone ?? null,
             data.email ?? null, data.logo_path ?? null)
      return this.get()!
    }
  }
}
