import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { AcademicYear, CreateAcademicYearInput, UpdateAcademicYearInput } from '../ipc/types'

export class AcademicYearRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(): AcademicYear[] {
    return this.db
      .prepare('SELECT * FROM academic_year WHERE institution_id = ? ORDER BY start_date DESC')
      .all(this.institutionId()) as AcademicYear[]
  }

  getById(id: string): AcademicYear | null {
    return this.db
      .prepare('SELECT * FROM academic_year WHERE academic_year_id = ?')
      .get(id) as AcademicYear | null
  }

  create(data: CreateAcademicYearInput): AcademicYear {
    const id = uuidv4()
    const institutionId = this.institutionId()

    const doCreate = this.db.transaction(() => {
      // If new year is current, unset all others
      if (data.is_current) {
        this.db
          .prepare('UPDATE academic_year SET is_current = 0 WHERE institution_id = ?')
          .run(institutionId)
      }
      this.db
        .prepare(`
          INSERT INTO academic_year
            (academic_year_id, institution_id, year_label, start_date, end_date, is_current)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(id, institutionId, data.year_label, data.start_date, data.end_date, data.is_current ? 1 : 0)
    })

    doCreate()
    return this.getById(id)!
  }

  update(id: string, data: UpdateAcademicYearInput): AcademicYear {
    const sets: string[] = []
    const params: unknown[] = []

    const doUpdate = this.db.transaction(() => {
      if (data.is_current) {
        const row = this.getById(id)
        if (row) {
          this.db
            .prepare('UPDATE academic_year SET is_current = 0 WHERE institution_id = ?')
            .run(row.institution_id)
        }
        sets.push('is_current = 1')
      } else if (data.is_current === false) {
        sets.push('is_current = 0')
      }

      if (data.year_label !== undefined) { sets.push('year_label = ?'); params.push(data.year_label) }
      if (data.start_date !== undefined) { sets.push('start_date = ?'); params.push(data.start_date) }
      if (data.end_date !== undefined) { sets.push('end_date = ?'); params.push(data.end_date) }

      if (sets.length === 0) return
      sets.push("updated_at = datetime('now')")
      params.push(id)

      this.db
        .prepare(`UPDATE academic_year SET ${sets.join(', ')} WHERE academic_year_id = ?`)
        .run(...params)
    })

    doUpdate()
    return this.getById(id)!
  }
}
