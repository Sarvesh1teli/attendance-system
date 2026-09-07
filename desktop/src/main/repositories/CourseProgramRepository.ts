import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type { CourseProgram, CreateCourseProgramInput, UpdateCourseProgramInput } from '../ipc/types'

export class CourseProgramRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(): CourseProgram[] {
    return this.db
      .prepare('SELECT * FROM course_program WHERE institution_id = ? ORDER BY program_name ASC')
      .all(this.institutionId()) as CourseProgram[]
  }

  getById(id: string): CourseProgram | null {
    return this.db
      .prepare('SELECT * FROM course_program WHERE program_id = ?')
      .get(id) as CourseProgram | null
  }

  create(data: CreateCourseProgramInput): CourseProgram {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db
      .prepare(`
        INSERT INTO course_program
          (program_id, institution_id, program_name, program_code,
           duration_years, academic_structure_type, department_id)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id, institutionId, data.program_name, data.program_code,
        data.duration_years, data.academic_structure_type, data.department_id ?? null
      )
    return this.getById(id)!
  }

  update(id: string, data: UpdateCourseProgramInput): CourseProgram {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.program_name !== undefined) { sets.push('program_name = ?'); params.push(data.program_name) }
    if (data.program_code !== undefined) { sets.push('program_code = ?'); params.push(data.program_code) }
    if (data.duration_years !== undefined) { sets.push('duration_years = ?'); params.push(data.duration_years) }
    if (data.academic_structure_type !== undefined) { sets.push('academic_structure_type = ?'); params.push(data.academic_structure_type) }
    if (data.department_id !== undefined) { sets.push('department_id = ?'); params.push(data.department_id || null) }
    if (data.active !== undefined) { sets.push('active = ?'); params.push(data.active ? 1 : 0) }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)
    this.db.prepare(`UPDATE course_program SET ${sets.join(', ')} WHERE program_id = ?`).run(...params)
    return this.getById(id)!
  }

  delete(id: string): void {
    this.db.prepare('DELETE FROM course_program WHERE program_id = ?').run(id)
  }
}
