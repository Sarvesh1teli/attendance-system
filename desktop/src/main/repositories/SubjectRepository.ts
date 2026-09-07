import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { Subject, CreateSubjectInput, UpdateSubjectInput, SubjectFilters } from '../ipc/types'

export class SubjectRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(filters?: SubjectFilters): Subject[] {
    let sql = 'SELECT * FROM subject WHERE institution_id = ?'
    const params: unknown[] = [this.institutionId()]
    if (filters?.department_id) {
      sql += ' AND department_id = ?'
      params.push(filters.department_id)
    }
    if (filters?.program_id) {
      sql += ' AND program_id = ?'
      params.push(filters.program_id)
    }
    if (filters?.subject_type) {
      sql += ' AND subject_type = ?'
      params.push(filters.subject_type)
    }
    if (filters?.active !== undefined) {
      sql += ' AND active = ?'
      params.push(filters.active ? 1 : 0)
    }
    sql += ' ORDER BY subject_name ASC'
    return this.db.prepare(sql).all(...params) as Subject[]
  }

  getById(id: string): Subject | null {
    return this.db.prepare('SELECT * FROM subject WHERE subject_id = ?').get(id) as Subject | null
  }

  create(data: CreateSubjectInput): Subject {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db
      .prepare(`
        INSERT INTO subject
          (subject_id, institution_id, subject_name, subject_code,
           department_id, program_id, subject_type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id, institutionId, data.subject_name, data.subject_code,
        data.department_id ?? null, data.program_id ?? null, data.subject_type
      )
    return this.getById(id)!
  }

  update(id: string, data: UpdateSubjectInput): Subject {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.subject_name !== undefined) { sets.push('subject_name = ?'); params.push(data.subject_name) }
    if (data.subject_code !== undefined) { sets.push('subject_code = ?'); params.push(data.subject_code) }
    if (data.department_id !== undefined) { sets.push('department_id = ?'); params.push(data.department_id || null) }
    if (data.program_id !== undefined) { sets.push('program_id = ?'); params.push(data.program_id || null) }
    if (data.subject_type !== undefined) { sets.push('subject_type = ?'); params.push(data.subject_type) }
    if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0) }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)
    this.db.prepare(`UPDATE subject SET ${sets.join(', ')} WHERE subject_id = ?`).run(...params)
    return this.getById(id)!
  }
}
