import Dexie, { Table } from 'dexie'

export interface TeacherProfile {
  id: string
  employee_id: string
  name: string
  username: string
  department: string
  institution_name: string
  institution_id: string
}

export interface AssignedClass {
  id: string
  faculty_id?: string
  batch_id: string
  batch_name: string
  subject_id: string
  subject_name: string
  subject_code: string
  program_name: string
  academic_year_id: string
  group_id?: string
  group_name?: string
  schedule_time: string
  room?: string
}

export interface CachedStudent {
  id: string
  class_id: string
  student_id: string
  name: string
  admission_number: string
  gender?: string
  face_enrolled: boolean
  face_descriptor?: number[]
  photo_url?: string
}

export interface CachedTopic {
  id: string
  subject_id: string
  topic_name: string
  unit_name?: string
  sequence_number?: number
}

export interface LocalAttendanceSession {
  id: string
  session_id: string
  institution_id: string
  faculty_id: string
  subject_id: string
  batch_id: string
  academic_year_id: string
  student_group_id?: string
  session_date: string
  start_time: string
  end_time?: string
  status: 'OPEN' | 'COMPLETED' | 'CANCELLED'
  topic_id?: string
  custom_topic?: string
  sync_status: 'LOCAL_ONLY' | 'SYNCED' | 'FAILED'
  created_at: string
}

export interface LocalAttendanceRecord {
  id: string
  record_id: string
  session_id: string
  student_id: string
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
  recognition_method: 'MANUAL_TEACHER' | 'FACE_RECOGNITION' | 'SYSTEM_DEFAULT'
  confidence_score?: number
  marked_at: string
  sync_status: 'LOCAL_ONLY' | 'SYNCED'
}

export interface OutboxSyncItem {
  id?: number
  action: 'CREATE_SESSION' | 'UPDATE_SESSION' | 'SUBMIT_ATTENDANCE'
  entity_type: string
  entity_id: string
  payload: unknown
  created_at: string
  attempts: number
  last_error?: string
}

export class AttendancePwaDatabase extends Dexie {
  teacherProfile!: Table<TeacherProfile, string>
  classes!: Table<AssignedClass, string>
  students!: Table<CachedStudent, string>
  topics!: Table<CachedTopic, string>
  sessions!: Table<LocalAttendanceSession, string>
  records!: Table<LocalAttendanceRecord, string>
  syncQueue!: Table<OutboxSyncItem, number>

  constructor() {
    super('TeliAttendancePwaDb')

    this.version(1).stores({
      teacherProfile: 'id, employee_id, username',
      classes: 'id, batch_id, subject_id',
      students: 'id, class_id, student_id, admission_number',
      topics: 'id, subject_id',
      sessions: 'id, session_id, session_date, status, sync_status',
      records: 'id, record_id, session_id, student_id, status',
      syncQueue: '++id, action, entity_type, entity_id, created_at',
    })
  }
}

export const db = new AttendancePwaDatabase()

/**
 * Purge all local tables in Dexie IndexedDB.
 */
export async function clearAllPwaData(): Promise<void> {
  await db.transaction('rw', [db.teacherProfile, db.classes, db.students, db.topics, db.sessions, db.records, db.syncQueue], async () => {
    await db.teacherProfile.clear()
    await db.classes.clear()
    await db.students.clear()
    await db.topics.clear()
    await db.sessions.clear()
    await db.records.clear()
    await db.syncQueue.clear()
  })
}

/**
 * Automatically purge any old hardcoded demo/test data if found in Dexie.
 */
export async function seedInitialDataIfEmpty(): Promise<void> {
  // Purge any legacy hardcoded demo items
  const demoClasses = await db.classes.filter(c => c.id.startsWith('cls-mbbs-') || c.id.startsWith('cls-anat-') || c.id.startsWith('cls-path-')).toArray()
  if (demoClasses.length > 0) {
    await db.classes.bulkDelete(demoClasses.map(c => c.id))
  }

  const demoStudents = await db.students.filter(s => s.id.startsWith('stu-') || s.student_id.startsWith('stu-')).toArray()
  if (demoStudents.length > 0) {
    await db.students.bulkDelete(demoStudents.map(s => s.id))
  }

  const demoTopics = await db.topics.filter(t => t.id.startsWith('top-')).toArray()
  if (demoTopics.length > 0) {
    await db.topics.bulkDelete(demoTopics.map(t => t.id))
  }

  const demoTeachers = await db.teacherProfile.filter(t => t.id === 'fac-001' || t.username === 'sarah.jenkins').toArray()
  if (demoTeachers.length > 0) {
    await db.teacherProfile.bulkDelete(demoTeachers.map(t => t.id))
  }
}

