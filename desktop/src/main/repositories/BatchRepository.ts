import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { Batch, CreateBatchInput, UpdateBatchInput } from '../ipc/types'

export class BatchRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(): Batch[] {
    const rows = this.db
      .prepare('SELECT * FROM batch WHERE institution_id = ? ORDER BY admission_year DESC, batch_name ASC')
      .all(this.institutionId()) as any[]
    return rows.map(this.map)
  }

  getById(id: string): Batch | null {
    const row = this.db.prepare('SELECT * FROM batch WHERE batch_id = ?').get(id) as any
    return row ? this.map(row) : null
  }

  create(data: CreateBatchInput): Batch {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db
      .prepare(`
        INSERT INTO batch
          (batch_id, institution_id, batch_name, program_id, department_id,
           admission_year, expected_completion_year, notify_parents)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id, institutionId, data.batch_name, data.program_id,
        data.department_id ?? null, data.admission_year, data.expected_completion_year,
        data.notify_parents === false ? 0 : 1   // default ON
      )
    return this.getById(id)!
  }

  update(id: string, data: UpdateBatchInput): Batch {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.batch_name !== undefined)             { sets.push('batch_name = ?');              params.push(data.batch_name) }
    if (data.program_id !== undefined)             { sets.push('program_id = ?');              params.push(data.program_id) }
    if (data.department_id !== undefined)          { sets.push('department_id = ?');           params.push(data.department_id || null) }
    if (data.admission_year !== undefined)         { sets.push('admission_year = ?');          params.push(data.admission_year) }
    if (data.expected_completion_year !== undefined){ sets.push('expected_completion_year = ?'); params.push(data.expected_completion_year) }
    if (data.active !== undefined)                 { sets.push('active = ?');                  params.push(data.active ? 1 : 0) }
    if (data.notify_parents !== undefined)         { sets.push('notify_parents = ?');          params.push(data.notify_parents ? 1 : 0) }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)
    this.db.prepare(`UPDATE batch SET ${sets.join(', ')} WHERE batch_id = ?`).run(...params)
    return this.getById(id)!
  }

  private map(row: any): Batch {
    return {
      ...row,
      active: !!row.active,
      notify_parents: row.notify_parents !== 0,  // default true if NULL or 1
    }
  }
}
