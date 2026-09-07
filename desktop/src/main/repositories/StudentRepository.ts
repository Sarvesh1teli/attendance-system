import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type {
  Student, CreateStudentInput, UpdateStudentInput,
  StudentFilters, StudentSubjectEnrollment, EnrollStudentInput
} from '../ipc/types'

export class StudentRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(filters?: StudentFilters): Student[] {
    let sql = `
      SELECT 
        s.*,
        sa.admission_number,
        sa.batch_id,
        b.batch_name,
        sa.course_program_id AS program_id,
        cp.program_name,
        sa.department_id,
        d.department_name,
        sa.admission_date,
        sa.admission_type
      FROM student s
      LEFT JOIN student_admission sa ON sa.student_id = s.student_id
      LEFT JOIN batch b ON b.batch_id = sa.batch_id
      LEFT JOIN course_program cp ON cp.program_id = sa.course_program_id
      LEFT JOIN department d ON d.department_id = sa.department_id
      WHERE s.institution_id = ?
    `
    const params: unknown[] = [this.institutionId()]

    if (filters?.status) {
      sql += ' AND s.current_status = ?'
      params.push(filters.status)
    }
    if (filters?.search) {
      sql += ' AND (s.name LIKE ? OR sa.admission_number LIKE ? OR s.phone LIKE ?)'
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`)
    }
    if (filters?.batch_id) {
      sql += ' AND sa.batch_id = ?'
      params.push(filters.batch_id)
    }
    if (filters?.program_id) {
      sql += ' AND sa.course_program_id = ?'
      params.push(filters.program_id)
    }
    if (filters?.department_id) {
      sql += ' AND (sa.department_id = ? OR cp.department_id = ?)'
      params.push(filters.department_id, filters.department_id)
    }
    if (filters?.face_enrolled !== undefined) {
      sql += ' AND s.face_enrolled = ?'
      params.push(filters.face_enrolled ? 1 : 0)
    }

    sql += ' ORDER BY s.name'
    return this.db.prepare(sql).all(...params) as Student[]
  }

  getById(id: string): Student | null {
    const sql = `
      SELECT 
        s.*,
        sa.admission_number,
        sa.batch_id,
        b.batch_name,
        sa.course_program_id AS program_id,
        cp.program_name,
        sa.department_id,
        d.department_name,
        sa.admission_date,
        sa.admission_type
      FROM student s
      LEFT JOIN student_admission sa ON sa.student_id = s.student_id
      LEFT JOIN batch b ON b.batch_id = sa.batch_id
      LEFT JOIN course_program cp ON cp.program_id = sa.course_program_id
      LEFT JOIN department d ON d.department_id = sa.department_id
      WHERE s.student_id = ?
    `
    return this.db.prepare(sql).get(id) as Student | null
  }

  create(data: CreateStudentInput): Student {
    const institutionId = this.institutionId()
    const studentId = uuidv4()
    const admissionId = uuidv4()

    const createStudent = this.db.transaction(() => {
      this.db
        .prepare(`
          INSERT INTO student (student_id, institution_id, name, gender, date_of_birth, phone, parent_phone)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          studentId, institutionId, data.name,
          data.gender ?? null, data.date_of_birth ?? null,
          data.phone ?? null, data.parent_phone ?? null
        )

      this.db
        .prepare(`
          INSERT INTO student_admission
            (admission_id, institution_id, student_id, admission_number, batch_id,
             course_program_id, department_id, admission_date, admission_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          admissionId, institutionId, studentId, data.admission_number,
          data.batch_id, data.program_id, data.department_id ?? null,
          data.admission_date, data.admission_type ?? 'NEW'
        )
    })

    createStudent()
    return this.getById(studentId)!
  }

  update(id: string, data: UpdateStudentInput): Student {
    const sets: string[] = []
    const params: unknown[] = []

    if (data.name !== undefined) { sets.push('name = ?'); params.push(data.name) }
    if (data.gender !== undefined) { sets.push('gender = ?'); params.push(data.gender) }
    if (data.date_of_birth !== undefined) { sets.push('date_of_birth = ?'); params.push(data.date_of_birth) }
    if (data.phone !== undefined) { sets.push('phone = ?'); params.push(data.phone) }
    if (data.parent_phone !== undefined) { sets.push('parent_phone = ?'); params.push(data.parent_phone) }
    if (data.current_status !== undefined) { sets.push('current_status = ?'); params.push(data.current_status) }

    if (sets.length === 0) return this.getById(id)!

    sets.push("updated_at = datetime('now')")
    params.push(id)

    this.db.prepare(`UPDATE student SET ${sets.join(', ')} WHERE student_id = ?`).run(...params)
    return this.getById(id)!
  }

  enroll(data: EnrollStudentInput): StudentSubjectEnrollment {
    const id = uuidv4()
    const institutionId = this.institutionId()
    this.db
      .prepare(`
        INSERT INTO student_subject_enrollment
          (enrollment_id, institution_id, student_id, subject_id, batch_id,
           academic_year_id, semester_id, section_id, effective_from)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        id, institutionId, data.student_id, data.subject_id,
        data.batch_id, data.academic_year_id,
        data.semester_id ?? null, data.section_id ?? null,
        data.effective_from
      )
    return this.db
      .prepare('SELECT * FROM student_subject_enrollment WHERE enrollment_id = ?')
      .get(id) as StudentSubjectEnrollment
  }

  delete(id: string): void {
    const del = this.db.transaction(() => {
      // 1. Face samples (via enrollment_id) and face enrollments (via entity_id)
      this.db
        .prepare(
          'DELETE FROM face_sample WHERE enrollment_id IN (SELECT enrollment_id FROM face_enrollment WHERE entity_id = ?)'
        )
        .run(id)
      this.db.prepare('DELETE FROM face_enrollment WHERE entity_id = ?').run(id)

      // 2. Attendance records and session students
      this.db.prepare('DELETE FROM attendance_record WHERE student_id = ?').run(id)
      this.db.prepare('DELETE FROM attendance_session_student WHERE student_id = ?').run(id)

      // 3. Group memberships and roll history
      this.db.prepare('DELETE FROM student_group_membership WHERE student_id = ?').run(id)
      this.db.prepare('DELETE FROM student_roll_history WHERE student_id = ?').run(id)

      // 4. Enrollments & admissions
      this.db.prepare('DELETE FROM student_subject_enrollment WHERE student_id = ?').run(id)
      this.db.prepare('DELETE FROM student_academic_enrollment WHERE student_id = ?').run(id)
      this.db.prepare('DELETE FROM student_admission WHERE student_id = ?').run(id)

      // 5. Notifications
      this.db.prepare('DELETE FROM notification_log WHERE student_id = ?').run(id)
      this.db.prepare("DELETE FROM notification WHERE entity_id = ? AND entity_type = 'STUDENT'").run(id)

      // 6. Delete core student record
      this.db.prepare('DELETE FROM student WHERE student_id = ?').run(id)
    })
    del()
  }
}
