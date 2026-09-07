import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { Faculty, CreateFacultyInput, UpdateFacultyInput, FacultyFilters } from '../ipc/types'

export class FacultyRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(filters?: FacultyFilters): Faculty[] {
    let sql = 'SELECT * FROM faculty WHERE institution_id = ?'
    const params: unknown[] = [this.institutionId()]

    if (filters?.department_id) {
      sql += ' AND department_id = ?'
      params.push(filters.department_id)
    }
    if (filters?.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }
    sql += ' ORDER BY name'
    return this.db.prepare(sql).all(...params) as Faculty[]
  }

  getById(id: string): Faculty | null {
    return this.db
      .prepare('SELECT * FROM faculty WHERE faculty_id = ?')
      .get(id) as Faculty | null
  }

  create(data: CreateFacultyInput): Faculty {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db
      .prepare(`
        INSERT INTO faculty
          (faculty_id, institution_id, employee_id, name, gender, date_of_birth,
           department_id, designation, phone, email, joining_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id, institutionId, data.employee_id, data.name,
        data.gender ?? null, data.date_of_birth ?? null,
        data.department_id ?? null, data.designation ?? null,
        data.phone ?? null, data.email ?? null, data.joining_date ?? null
      )
    return this.getById(id)!
  }

  update(id: string, data: UpdateFacultyInput): Faculty {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.gender !== undefined) { sets.push('gender = ?'); params.push(data.gender) }
    if (data.department_id !== undefined) { sets.push('department_id = ?'); params.push(data.department_id) }
    if (data.designation !== undefined) { sets.push('designation = ?'); params.push(data.designation) }
    if (data.phone !== undefined) { sets.push('phone = ?'); params.push(data.phone) }
    if (data.email !== undefined) { sets.push('email = ?'); params.push(data.email) }
    if (data.status !== undefined) { sets.push('status = ?'); params.push(data.status) }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)

    this.db.prepare(`UPDATE faculty SET ${sets.join(', ')} WHERE faculty_id = ?`).run(...params)
    return this.getById(id)!
  }
}
