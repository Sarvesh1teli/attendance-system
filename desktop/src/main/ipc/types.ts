/**
 * Shared IPC type contract between main process and renderer.
 * This file defines the full API surface exposed via contextBridge.
 * Every method maps to an ipcMain.handle() registration.
 */
export interface IpcApi {
  institution: {
    get: () => Promise<Institution | null>
    upsert: (data: UpsertInstitutionInput) => Promise<Institution>
  }

  config: {
    getAll: () => Promise<ConfigEntry[]>
    get: (key: string) => Promise<string | null>
    set: (key: string, value: string, label?: string) => Promise<void>
  }

  courseProgram: {
    list: () => Promise<CourseProgram[]>
    create: (data: CreateCourseProgramInput) => Promise<CourseProgram>
    update: (id: string, data: UpdateCourseProgramInput) => Promise<CourseProgram>
    delete: (id: string) => Promise<void>
  }

  department: {
    list: () => Promise<Department[]>
    create: (data: CreateDepartmentInput) => Promise<Department>
    update: (id: string, data: UpdateDepartmentInput) => Promise<Department>
    delete: (id: string) => Promise<void>
  }

  batch: {
    list: () => Promise<Batch[]>
    create: (data: CreateBatchInput) => Promise<Batch>
    update: (id: string, data: UpdateBatchInput) => Promise<Batch>
  }

  timetable: {
    list: (filters?: { day_of_week?: number; active_only?: boolean }) => Promise<TimetableSlot[]>
    getById: (id: string) => Promise<TimetableSlot | null>
    create: (data: CreateTimetableSlotInput) => Promise<TimetableSlot>
    update: (id: string, data: UpdateTimetableSlotInput) => Promise<TimetableSlot>
    delete: (id: string) => Promise<void>
    generateTodaySessions: () => Promise<GenerateSessionsResult>
  }

  academicYear: {
    list: () => Promise<AcademicYear[]>
    create: (data: CreateAcademicYearInput) => Promise<AcademicYear>
    update: (id: string, data: UpdateAcademicYearInput) => Promise<AcademicYear>
  }

  subject: {
    list: (filters?: SubjectFilters) => Promise<Subject[]>
    create: (data: CreateSubjectInput) => Promise<Subject>
    update: (id: string, data: UpdateSubjectInput) => Promise<Subject>
  }

  faculty: {
    list: (filters?: FacultyFilters) => Promise<Faculty[]>
    getById: (id: string) => Promise<Faculty | null>
    create: (data: CreateFacultyInput) => Promise<Faculty>
    update: (id: string, data: UpdateFacultyInput) => Promise<Faculty>
  }

  student: {
    list: (filters?: StudentFilters) => Promise<Student[]>
    getById: (id: string) => Promise<Student | null>
    create: (data: CreateStudentInput) => Promise<Student>
    update: (id: string, data: UpdateStudentInput) => Promise<Student>
    delete: (id: string) => Promise<void>
    enroll: (data: EnrollStudentInput) => Promise<StudentSubjectEnrollment>
  }

  studentGroup: {
    list: (filters?: GroupFilters) => Promise<any[]>
    getById: (id: string) => Promise<any>
    create: (data: CreateGroupInput) => Promise<any>
    update: (id: string, data: UpdateGroupInput) => Promise<any>
    delete: (id: string) => Promise<void>
    addMembers: (groupId: string, memberData: AddGroupMembersInput) => Promise<void>
    removeMember: (membershipId: string) => Promise<void>
    getAvailableStudents: (groupId: string) => Promise<any[]>
  }

  topic: {
    list: (subjectId: string) => Promise<Topic[]>
    create: (data: CreateTopicInput) => Promise<Topic>
    update: (id: string, data: UpdateTopicInput) => Promise<Topic>
  }

  appUser: {
    list: () => Promise<AppUser[]>
    create: (data: CreateAppUserInput) => Promise<AppUser>
    update: (id: string, data: UpdateAppUserInput) => Promise<AppUser>
  }

  audit: {
    list: (filters?: AuditFilters) => Promise<AuditLog[]>
  }

  auth: {
    login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
    logout: () => Promise<void>
    getCurrentUser: () => Promise<SessionUser | null>
  }

  faceEnrollment: {
    getByEntity: (entityType: 'STUDENT' | 'FACULTY', entityId: string) => Promise<FaceEnrollment | null>
    getOrCreate: (entityType: 'STUDENT' | 'FACULTY', entityId: string) => Promise<FaceEnrollment>
    list: (entityType?: 'STUDENT' | 'FACULTY') => Promise<FaceEnrollment[]>
    getSamples: (enrollmentId: string) => Promise<FaceSample[]>
    saveSample: (enrollmentId: string, sampleType: 'FRONT' | 'LEFT' | 'RIGHT' | 'OTHER', imageBase64: string) => Promise<FaceSample>
    saveDescriptor: (enrollmentId: string, descriptorJson: string) => Promise<void>
    complete: (enrollmentId: string) => Promise<FaceEnrollment>
    revoke: (enrollmentId: string) => Promise<FaceEnrollment>
  }

  sync: {
    pushMasterData: () => Promise<{ success: boolean; message: string; details?: unknown }>
    pullCompletedSessions: (options?: {
      incremental?: boolean
      sessionDate?: string
    }) => Promise<{ success: boolean; sessionsCount: number; recordsCount: number; message?: string }>
    getStatus: () => Promise<DesktopSyncStatus>
  }

  attendance: {
    createSession: (data: any) => Promise<any>
    listSessions: (filters?: any) => Promise<any[]>
    getSession: (sessionId: string) => Promise<any>
    updateRecord: (recordId: string, status: string, reason?: string) => Promise<boolean>
    closeSession: (sessionId: string) => Promise<boolean>
  }

  facultyDailyLog: {
    checkIn: (facultyId: string, method?: string, notes?: string) => Promise<any>
    checkOut: (facultyId: string) => Promise<any>
    getDailyLogs: (date: string) => Promise<any[]>
    getFacultyHistory: (facultyId: string, limit?: number) => Promise<any[]>
  }

  report: {
    getStudentSummary: (filters?: any) => Promise<any[]>
    getShortageReport: (batchId?: string, subjectId?: string, threshold?: number) => Promise<any[]>
    getFacultyWorkload: (filters?: any) => Promise<any[]>
    exportToExcel: (title: string, columns: any[], rows: any[], filename: string) => Promise<any>
    exportToPdf: (title: string, columns: any[], rows: any[], filename: string) => Promise<any>
  }

  // Google Drive Backup
  backup: {
    getOAuthConfig: () => Promise<GoogleOAuthConfig>
    saveOAuthConfig: (clientId: string, clientSecret?: string) => Promise<GoogleOAuthConfig>
    getAccount: () => Promise<GoogleAccount>
    connectAccount: () => Promise<{ success: boolean; email?: string; message?: string }>
    disconnectAccount: () => Promise<void>
    getSettings: () => Promise<BackupSettings>
    saveSettings: (settings: Partial<BackupSettings>) => Promise<BackupSettings>
    getLastBackup: () => Promise<LastBackupRecord | null>
    runBackupNow: () => Promise<BackupResult>
  }

  // Notifications
  notification: {
    list: (filters?: NotificationFiltersInput) => Promise<AppNotificationData[]>
    getUnreadCount: () => Promise<number>
    markRead: (id: string) => Promise<void>
    markAllRead: () => Promise<void>
    delete: (id: string) => Promise<void>
    deleteAll: () => Promise<void>
    scanShortage: (threshold?: number) => Promise<number>
    exportShortageLetters: (threshold?: number, batchId?: string) => Promise<void>
  }

  faceRecognition: {
    getSessionStudents: (sessionId: string) => Promise<RecognitionStudent[]>
    markRecognized: (recordId: string, confidence: number) => Promise<boolean>
    getMissingDescriptorsData: () => Promise<Array<{ enrollment_id: string; sampleBase64: string }>>
  }

  app: {
    getVersion: () => Promise<string>
    getDataPath: () => Promise<string>
  }
}

export interface DesktopSyncStatus {
  cloudUrl: string
  lastSyncTime: string | null
  lastSyncResult: 'SUCCESS' | 'FAILED' | 'NEVER'
  pendingOutboxCount: number
}

export interface RecognitionStudent {
  record_id: string
  student_id: string
  student_name: string
  admission_number: string
  face_enrolled: boolean
  status: string
  face_samples_base64: string[]  // Active JPEG face samples encoded as base64
}

export type NotificationSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL'
export type NotificationTypeEnum =
  | 'SHORTAGE_ALERT' | 'SESSION_REMINDER'
  | 'SYNC_SUCCESS' | 'SYNC_FAILED'
  | 'PARENT_ALERT' | 'SYSTEM'

export interface AppNotificationData {
  notification_id: string
  type: NotificationTypeEnum
  severity: NotificationSeverity
  title: string
  message: string
  entity_type: string | null
  entity_id: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
}

export interface NotificationFiltersInput {
  unread_only?: boolean
  type?: NotificationTypeEnum
  severity?: NotificationSeverity
  limit?: number
}

// ─── Domain Types ────────────────────────────────────────────────────────────

export interface Institution {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  logo_path: string | null
  created_at: string
  updated_at: string
}

export interface ConfigEntry {
  config_id: string
  config_key: string
  config_value: string
  display_label: string | null
  data_type: string
}

export interface CourseProgram {
  program_id: string
  institution_id: string
  program_name: string
  program_code: string
  duration_years: number
  academic_structure_type: AcademicStructureType
  department_id: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Department {
  department_id: string
  institution_id: string
  department_name: string
  department_code: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface Batch {
  batch_id: string
  institution_id: string
  batch_name: string
  program_id: string
  department_id: string | null
  admission_year: number
  expected_completion_year: number
  active: boolean
  notify_parents: boolean   // false for adult programs like MBBS, BE, MCA
  created_at: string
  updated_at: string
}

export interface AcademicYear {
  academic_year_id: string
  institution_id: string
  year_label: string
  start_date: string
  end_date: string
  is_current: boolean
  created_at: string
  updated_at: string
}

export interface Subject {
  subject_id: string
  institution_id: string
  subject_name: string
  subject_code: string
  department_id: string | null
  program_id: string | null
  subject_type: SubjectType
  active: boolean
  created_at: string
  updated_at: string
}

export interface Faculty {
  faculty_id: string
  institution_id: string
  employee_id: string
  name: string
  gender: Gender | null
  department_id: string | null
  designation: string | null
  phone: string | null
  email: string | null
  joining_date: string | null
  status: FacultyStatus
  face_enrolled: boolean
  created_at: string
  updated_at: string
}

export interface Student {
  student_id: string
  institution_id: string
  name: string
  gender: Gender | null
  date_of_birth: string | null
  phone: string | null
  parent_phone: string | null
  photo_path: string | null
  current_status: StudentStatus
  face_enrolled: boolean
  batch_id?: string
  batch_name?: string
  admission_number?: string
  program_id?: string
  program_name?: string
  department_id?: string
  department_name?: string
  admission_date?: string
  admission_type?: string
  created_at: string
  updated_at: string
}

export interface StudentSubjectEnrollment {
  enrollment_id: string
  student_id: string
  subject_id: string
  batch_id: string
  academic_year_id: string
  effective_from: string
  effective_to: string | null
  enrollment_status: EnrollmentStatus
}

export interface StudentGroup {
  student_group_id: string
  institution_id: string
  group_name: string
  group_type: GroupType
  batch_id: string | null
  subject_id: string | null
  valid_from: string
  valid_to: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface Topic {
  topic_id: string
  institution_id: string
  subject_id: string
  topic_name: string
  description: string | null
  unit_name: string | null
  chapter_name: string | null
  sequence_number: number | null
  is_custom: boolean
  active: boolean
  created_at: string
  updated_at: string
}

export interface AppUser {
  user_id: string
  institution_id: string
  faculty_id: string | null
  username: string
  role: UserRole
  status: string
  last_login: string | null
  created_at: string
  updated_at: string
}

export interface AuditLog {
  audit_id: string
  institution_id?: string | null
  user_id: string | null
  user_role: string | null
  action: string
  entity_type: string
  entity_id: string | null
  old_value: string | null
  new_value: string | null
  reason: string | null
  device_id: string | null
  timestamp: string
}

export interface SessionUser {
  user_id: string
  institution_id: string
  faculty_id: string | null
  username: string
  role: string
}

export interface FaceEnrollment {
  enrollment_id: string
  institution_id: string
  entity_type: 'STUDENT' | 'FACULTY'
  entity_id: string
  status: 'PENDING' | 'ENROLLED' | 'REVOKED'
  enrolled_at: string | null
  enrolled_by: string | null
  revoked_at: string | null
  revoked_by: string | null
  face_descriptor?: string | null
  created_at: string
  updated_at: string
}

export interface FaceSample {
  sample_id: string
  enrollment_id: string
  sample_type: 'FRONT' | 'LEFT' | 'RIGHT' | 'OTHER'
  file_path: string
  quality_score: number | null
  is_active: boolean
  captured_by: string | null
  created_at: string
  updated_at: string
}

// ─── Enums ───────────────────────────────────────────────────────────────────

export type AcademicStructureType = 'SEMESTER' | 'YEAR' | 'TERM' | 'CUSTOM'
export type SubjectType = 'THEORY' | 'PRACTICAL' | 'CLINICAL' | 'SEMINAR' | 'LABORATORY' | 'PROJECT' | 'OTHER'
export type Gender = 'MALE' | 'FEMALE' | 'OTHER'
export type FacultyStatus = 'ACTIVE' | 'INACTIVE' | 'LEFT'
export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'FAILED' | 'REPEATER' | 'DETAINED' | 'LEFT' | 'DISCONTINUED' | 'TRANSFERRED' | 'COMPLETED'
export type EnrollmentStatus = 'ACTIVE' | 'COMPLETED' | 'WITHDRAWN' | 'TRANSFERRED' | 'FAILED'
export type GroupType = 'SEMINAR' | 'CLINICAL' | 'LAB' | 'PRACTICAL' | 'PROJECT' | 'SPORTS' | 'ADMINISTRATIVE' | 'TEMPORARY' | 'CUSTOM'
export type UserRole = 'MASTER_ADMIN' | 'ADMIN' | 'FACULTY' | 'VIEWER'

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface UpsertInstitutionInput {
  name: string
  address?: string
  phone?: string
  email?: string
  logo_path?: string
}

export interface CreateCourseProgramInput {
  program_name: string
  program_code: string
  duration_years: number
  academic_structure_type: AcademicStructureType
  department_id?: string | null
}

export type UpdateCourseProgramInput = Partial<CreateCourseProgramInput> & { active?: boolean }

export interface CreateDepartmentInput {
  department_name: string
  department_code?: string
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput> & { active?: boolean }

export interface CreateBatchInput {
  batch_name: string
  program_id: string
  department_id?: string | null
  admission_year: number
  expected_completion_year: number
  notify_parents?: boolean   // default true; set false for adult programs (MBBS, BE, etc.)
}

export type UpdateBatchInput = Partial<CreateBatchInput> & { active?: boolean; notify_parents?: boolean }

// ─── Timetable ────────────────────────────────────────────────────────────────

export interface TimetableSlot {
  slot_id: string
  institution_id: string
  subject_id: string
  subject_name: string
  subject_code: string
  batch_id: string
  batch_name: string
  group_id: string | null
  group_name: string | null
  faculty_id: string | null
  faculty_name: string | null
  room: string | null
  day_of_week: number        // 0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat
  start_time: string         // 'HH:MM'
  end_time: string
  effective_from: string | null
  effective_until: string | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface CreateTimetableSlotInput {
  subject_id: string
  batch_id: string
  group_id?: string
  faculty_id?: string
  room?: string
  day_of_week: number
  start_time: string
  end_time: string
  effective_from?: string
  effective_until?: string
}

export type UpdateTimetableSlotInput = Partial<CreateTimetableSlotInput> & { active?: boolean }

export interface GenerateSessionsResult {
  created: number
  skipped: number
  details: Array<{
    slot_id: string
    subject_name: string
    batch_name: string
    start_time: string
    result: 'CREATED' | 'SKIPPED' | 'ERROR'
    reason?: string
  }>
}

export interface CreateAcademicYearInput {
  year_label: string
  start_date: string
  end_date: string
  is_current?: boolean
}

export type UpdateAcademicYearInput = Partial<CreateAcademicYearInput>

export interface CreateSubjectInput {
  subject_name: string
  subject_code: string
  department_id?: string | null
  program_id?: string | null
  subject_type: SubjectType
}

export type UpdateSubjectInput = Partial<CreateSubjectInput> & { active?: boolean }

export interface CreateFacultyInput {
  employee_id: string
  name: string
  gender?: Gender
  date_of_birth?: string
  department_id?: string
  designation?: string
  phone?: string
  email?: string
  joining_date?: string
}

export type UpdateFacultyInput = Partial<CreateFacultyInput> & { status?: FacultyStatus }

export interface CreateStudentInput {
  name: string
  gender?: Gender
  date_of_birth?: string
  phone?: string
  parent_phone?: string
  admission_number: string
  batch_id: string
  program_id: string
  department_id?: string
  admission_date: string
  admission_type?: 'NEW' | 'LATERAL' | 'TRANSFER' | 'OTHER'
}

export type UpdateStudentInput = Partial<Omit<CreateStudentInput, 'admission_number'>> & { current_status?: StudentStatus }

export interface EnrollStudentInput {
  student_id: string
  subject_id: string
  batch_id: string
  academic_year_id: string
  semester_id?: string
  section_id?: string
  effective_from: string
}

export interface CreateGroupInput {
  group_name: string
  group_type: GroupType
  batch_id?: string
  subject_id?: string
  valid_from: string
  valid_to?: string
}

export type UpdateGroupInput = Partial<CreateGroupInput> & { status?: string }

export interface AddGroupMembersInput {
  student_ids: string[]
  effective_from: string
}

export interface CreateTopicInput {
  subject_id: string
  topic_name: string
  description?: string
  unit_name?: string
  chapter_name?: string
  sequence_number?: number
}

export type UpdateTopicInput = Partial<CreateTopicInput> & { active?: boolean; is_custom?: boolean }

export interface CreateAppUserInput {
  faculty_id?: string
  username: string
  password: string
  role: UserRole
}

export type UpdateAppUserInput = Partial<Omit<CreateAppUserInput, 'password'>> & { status?: string; new_password?: string }

// ─── Filter Types ─────────────────────────────────────────────────────────────

export interface SubjectFilters {
  department_id?: string
  program_id?: string
  subject_type?: SubjectType
  active?: boolean
}

export interface FacultyFilters {
  department_id?: string
  status?: FacultyStatus
}

export interface StudentFilters {
  batch_id?: string
  department_id?: string
  program_id?: string
  status?: StudentStatus
  face_enrolled?: boolean
  search?: string
}

export interface GroupFilters {
  batch_id?: string
  group_type?: GroupType
}

export interface AuditFilters {
  entity_type?: string
  action?: string
  from_date?: string
  to_date?: string
  limit?: number
}

// ─── Google Drive Backup Types ────────────────────────────────────────────────

export interface GoogleOAuthConfig {
  clientId: string
  clientSecretSet: boolean
  redirectUri: string
  configured: boolean
}

export interface GoogleAccount {
  userEmail: string
  connected: boolean
  connectedAt?: string
}

export interface BackupSettings {
  autoBackupEnabled: boolean
  scheduleTime: string
}

export interface LastBackupRecord {
  time: string
  status: 'success' | 'failed'
  name?: string
  size?: number
  fileId?: string
  accountEmail?: string
  error?: string
}

export interface BackupResult {
  success: boolean
  fileId?: string
  name?: string
  size?: number
  time?: string
  accountEmail?: string
  message?: string
}
