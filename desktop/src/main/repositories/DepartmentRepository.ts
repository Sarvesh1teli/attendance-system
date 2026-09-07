import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { Department, CreateDepartmentInput, UpdateDepartmentInput } from '../ipc/types'

export class DepartmentRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(): Department[] {
    return this.db
      .prepare('SELECT * FROM department WHERE institution_id = ? ORDER BY department_name ASC')
      .all(this.institutionId()) as Department[]
  }

  getById(id: string): Department | null {
    return this.db
      .prepare('SELECT * FROM department WHERE department_id = ?')
      .get(id) as Department | null
  }

  create(data: CreateDepartmentInput): Department {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db
      .prepare(`
        INSERT INTO department (department_id, institution_id, department_name, department_code)
        VALUES (?, ?, ?, ?)
      `)
      .run(id, institutionId, data.department_name, data.department_code ?? null)
    return this.getById(id)!
  }

  update(id: string, data: UpdateDepartmentInput): Department {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.department_name !== undefined) { sets.push('department_name = ?'); params.push(data.department_name) }
    if (data.department_code !== undefined) { sets.push('department_code = ?'); params.push(data.department_code) }
    if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0) }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)
    this.db.prepare(`UPDATE department SET ${sets.join(', ')} WHERE department_id = ?`).run(...params)
    return this.getById(id)!
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM department WHERE department_id = ?').run(id)
  }
}
