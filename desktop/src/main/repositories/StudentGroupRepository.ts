import type Database from 'better-sqlite3'
import { v4 as uuidv4 } from 'uuid'
import type {
  StudentGroup,
  GroupFilters,
  CreateGroupInput,
  UpdateGroupInput,
  AddGroupMembersInput
} from '../ipc/types'

export interface GroupMemberDto {
  membership_id: string
  student_id: string
  name: string
  admission_number: string
  gender?: string
  face_enrolled: boolean
  effective_from: string
  effective_to?: string | null
}

export interface StudentGroupDetailDto extends StudentGroup {
  batch_name?: string
  subject_name?: string
  subject_code?: string
  member_count: number
  members?: GroupMemberDto[]
}

export class StudentGroupRepository {
  constructor(private db: Database.Database) {}

  private institutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    if (!row) throw new Error('Institution not configured')
    return row.id
  }

  list(filters?: GroupFilters): StudentGroupDetailDto[] {
    const instId = this.institutionId()
    let sql = `
      SELECT
        g.student_group_id,
        g.institution_id,
        g.group_name,
        g.group_type,
        g.batch_id,
        b.batch_name,
        g.subject_id,
        s.subject_name,
        s.subject_code,
        g.valid_from,
        g.valid_to,
        g.status,
        g.created_at,
        g.updated_at,
        COUNT(m.membership_id) as member_count
      FROM student_group g
      LEFT JOIN batch b ON g.batch_id = b.batch_id
      LEFT JOIN subject s ON g.subject_id = s.subject_id
      LEFT JOIN student_group_membership m ON g.student_group_id = m.student_group_id AND m.effective_to IS NULL
      WHERE g.institution_id = ?
    `
    const params: unknown[] = [instId]

    if (filters?.batch_id) {
      sql += ' AND g.batch_id = ?'
      params.push(filters.batch_id)
    }
    if (filters?.group_type) {
      sql += ' AND g.group_type = ?'
      params.push(filters.group_type)
    }

    sql += ' GROUP BY g.student_group_id ORDER BY g.created_at DESC'
    return this.db.prepare(sql).all(...params) as StudentGroupDetailDto[]
  }

  getById(groupId: string): StudentGroupDetailDto | null {
    const instId = this.institutionId()
    const group = this.db
      .prepare(`
        SELECT
          g.student_group_id,
          g.institution_id,
          g.group_name,
          g.group_type,
          g.batch_id,
          b.batch_name,
          g.subject_id,
          s.subject_name,
          s.subject_code,
          g.valid_from,
          g.valid_to,
          g.status,
          g.created_at,
          g.updated_at,
          COUNT(m.membership_id) as member_count
        FROM student_group g
        LEFT JOIN batch b ON g.batch_id = b.batch_id
        LEFT JOIN subject s ON g.subject_id = s.subject_id
        LEFT JOIN student_group_membership m ON g.student_group_id = m.student_group_id AND m.effective_to IS NULL
        WHERE g.student_group_id = ? AND g.institution_id = ?
        GROUP BY g.student_group_id
      `)
      .get(groupId, instId) as StudentGroupDetailDto | undefined

    if (!group) return null

    const members = this.db
      .prepare(`
        SELECT
          m.membership_id,
          m.student_id,
          st.name,
          COALESCE(sa.admission_number, 'N/A') as admission_number,
          st.gender,
          st.face_enrolled,
          m.effective_from,
          m.effective_to
        FROM student_group_membership m
        JOIN student st ON m.student_id = st.student_id
        LEFT JOIN student_admission sa ON st.student_id = sa.student_id
        WHERE m.student_group_id = ? AND m.effective_to IS NULL
        ORDER BY sa.admission_number ASC, st.name ASC
      `)
      .all(groupId) as GroupMemberDto[]

    return {
      ...group,
      members,
    }
  }

  create(data: CreateGroupInput): StudentGroupDetailDto {
    const instId = this.institutionId()
    const groupId = uuidv4()

    this.db
      .prepare(`
        INSERT INTO student_group (
          student_group_id, institution_id, group_name, group_type,
          batch_id, subject_id, valid_from, valid_to, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE')
      `)
      .run(
        groupId,
        instId,
        data.group_name,
        data.group_type,
        data.batch_id ?? null,
        data.subject_id ?? null,
        data.valid_from,
        data.valid_to ?? null
      )

    return this.getById(groupId)!
  }

  update(id: string, data: UpdateGroupInput): StudentGroupDetailDto {
    const instId = this.institutionId()

    const fields: string[] = []
    const values: unknown[] = []

    if (data.group_name !== undefined) {
      fields.push('group_name = ?')
      values.push(data.group_name)
    }
    if (data.group_type !== undefined) {
      fields.push('group_type = ?')
      values.push(data.group_type)
    }
    if (data.batch_id !== undefined) {
      fields.push('batch_id = ?')
      values.push(data.batch_id)
    }
    if (data.subject_id !== undefined) {
      fields.push('subject_id = ?')
      values.push(data.subject_id)
    }
    if (data.valid_from !== undefined) {
      fields.push('valid_from = ?')
      values.push(data.valid_from)
    }
    if (data.valid_to !== undefined) {
      fields.push('valid_to = ?')
      values.push(data.valid_to)
    }
    if (data.status !== undefined) {
      fields.push('status = ?')
      values.push(data.status)
    }

    if (fields.length === 0) {
      return this.getById(id)!
    }

    fields.push("updated_at = datetime('now')")
    values.push(id, instId)

    this.db
      .prepare(`UPDATE student_group SET ${fields.join(', ')} WHERE student_group_id = ? AND institution_id = ?`)
      .run(...values)

    return this.getById(id)!
  }

  delete(id: string): void {
    const instId = this.institutionId()
    this.db
      .prepare("UPDATE student_group SET status = 'DISSOLVED', updated_at = datetime('now') WHERE student_group_id = ? AND institution_id = ?")
      .run(id, instId)
  }

  addMembers(groupId: string, memberData: AddGroupMembersInput): void {
    const instId = this.institutionId()
    const stmt = this.db.prepare(`
      INSERT INTO student_group_membership (
        membership_id, institution_id, student_group_id, student_id, effective_from
      ) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(student_group_id, student_id) WHERE effective_to IS NULL DO NOTHING
    `)

    const tx = this.db.transaction(() => {
      for (const studentId of memberData.student_ids) {
        stmt.run(uuidv4(), instId, groupId, studentId, memberData.effective_from)
      }
    })

    tx()
  }

  removeMember(membershipId: string): void {
    this.db
      .prepare("UPDATE student_group_membership SET effective_to = datetime('now'), updated_at = datetime('now') WHERE membership_id = ?")
      .run(membershipId)
  }

  getAvailableStudents(groupId: string): Array<{ student_id: string; name: string; admission_number: string }> {
    const instId = this.institutionId()
    const group = this.db.prepare('SELECT batch_id FROM student_group WHERE student_group_id = ?').get(groupId) as { batch_id?: string } | undefined

    let sql = `
      SELECT
        s.student_id,
        s.name,
        COALESCE(sa.admission_number, 'N/A') as admission_number
      FROM student s
      LEFT JOIN student_admission sa ON s.student_id = sa.student_id
      WHERE s.institution_id = ? AND s.current_status = 'ACTIVE'
        AND s.student_id NOT IN (
          SELECT student_id FROM student_group_membership
          WHERE student_group_id = ? AND effective_to IS NULL
        )
    `
    const params: unknown[] = [instId, groupId]

    if (group?.batch_id) {
      sql += ' AND sa.batch_id = ?'
      params.push(group.batch_id)
    }

    sql += ' ORDER BY sa.admission_number ASC, s.name ASC'
    return this.db.prepare(sql).all(...params) as Array<{ student_id: string; name: string; admission_number: string }>
  }
}
