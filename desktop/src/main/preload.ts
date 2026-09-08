import { contextBridge, ipcRenderer } from 'electron'
import type { IpcApi } from './ipc/types'

/**
 * Expose a typed API to the renderer process via contextBridge.
 * The renderer can access this as window.api.
 *
 * IMPORTANT: Never expose ipcRenderer directly to the renderer.
 * Always go through contextBridge with explicit method definitions.
 */
const api: IpcApi = {
  // Institution
  institution: {
    get: () => ipcRenderer.invoke('institution:get'),
    upsert: (data) => ipcRenderer.invoke('institution:upsert', data),
  },

  // Configuration
  config: {
    getAll: () => ipcRenderer.invoke('config:getAll'),
    get: (key) => ipcRenderer.invoke('config:get', key),
    set: (key, value, label) => ipcRenderer.invoke('config:set', key, value, label),
  },

  // Academic structure
  courseProgram: {
    list: () => ipcRenderer.invoke('courseProgram:list'),
    create: (data) => ipcRenderer.invoke('courseProgram:create', data),
    update: (id, data) => ipcRenderer.invoke('courseProgram:update', id, data),
    delete: (id) => ipcRenderer.invoke('courseProgram:delete', id),
  },

  department: {
    list: () => ipcRenderer.invoke('department:list'),
    create: (data) => ipcRenderer.invoke('department:create', data),
    update: (id, data) => ipcRenderer.invoke('department:update', id, data),
    delete: (id) => ipcRenderer.invoke('department:delete', id),
  },

  batch: {
    list: () => ipcRenderer.invoke('batch:list'),
    create: (data) => ipcRenderer.invoke('batch:create', data),
    update: (id, data) => ipcRenderer.invoke('batch:update', id, data),
  },

  // Timetable
  timetable: {
    list: (filters?) => ipcRenderer.invoke('timetable:list', filters),
    getById: (id: string) => ipcRenderer.invoke('timetable:getById', id),
    create: (data) => ipcRenderer.invoke('timetable:create', data),
    update: (id: string, data) => ipcRenderer.invoke('timetable:update', id, data),
    delete: (id: string) => ipcRenderer.invoke('timetable:delete', id),
    generateTodaySessions: () => ipcRenderer.invoke('timetable:generateTodaySessions'),
  },

  academicYear: {
    list: () => ipcRenderer.invoke('academicYear:list'),
    create: (data) => ipcRenderer.invoke('academicYear:create', data),
    update: (id, data) => ipcRenderer.invoke('academicYear:update', id, data),
  },

  subject: {
    list: (filters?) => ipcRenderer.invoke('subject:list', filters),
    create: (data) => ipcRenderer.invoke('subject:create', data),
    update: (id, data) => ipcRenderer.invoke('subject:update', id, data),
  },

  // People
  faculty: {
    list: (filters?) => ipcRenderer.invoke('faculty:list', filters),
    getById: (id) => ipcRenderer.invoke('faculty:getById', id),
    create: (data) => ipcRenderer.invoke('faculty:create', data),
    update: (id, data) => ipcRenderer.invoke('faculty:update', id, data),
  },

  student: {
    list: (filters?) => ipcRenderer.invoke('student:list', filters),
    getById: (id) => ipcRenderer.invoke('student:getById', id),
    create: (data) => ipcRenderer.invoke('student:create', data),
    update: (id, data) => ipcRenderer.invoke('student:update', id, data),
    delete: (id) => ipcRenderer.invoke('student:delete', id),
    enroll: (data) => ipcRenderer.invoke('student:enroll', data),
  },

  // Groups
  studentGroup: {
    list: (filters?) => ipcRenderer.invoke('studentGroup:list', filters),
    getById: (id) => ipcRenderer.invoke('studentGroup:getById', id),
    create: (data) => ipcRenderer.invoke('studentGroup:create', data),
    update: (id, data) => ipcRenderer.invoke('studentGroup:update', id, data),
    delete: (id) => ipcRenderer.invoke('studentGroup:delete', id),
    addMembers: (groupId, memberData) => ipcRenderer.invoke('studentGroup:addMembers', groupId, memberData),
    removeMember: (membershipId) => ipcRenderer.invoke('studentGroup:removeMember', membershipId),
    getAvailableStudents: (groupId) => ipcRenderer.invoke('studentGroup:getAvailableStudents', groupId),
  },

  // Topics
  topic: {
    list: (subjectId) => ipcRenderer.invoke('topic:list', subjectId),
    create: (data) => ipcRenderer.invoke('topic:create', data),
    update: (id, data) => ipcRenderer.invoke('topic:update', id, data),
  },

  // App users
  appUser: {
    list: () => ipcRenderer.invoke('appUser:list'),
    create: (data) => ipcRenderer.invoke('appUser:create', data),
    update: (id, data) => ipcRenderer.invoke('appUser:update', id, data),
  },

  // Audit
  audit: {
    list: (filters?) => ipcRenderer.invoke('audit:list', filters),
  },

  // Auth
  auth: {
    login: (username, password) => ipcRenderer.invoke('auth:login', username, password),
    logout: () => ipcRenderer.invoke('auth:logout'),
    getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  },

  // Face Enrollment
  faceEnrollment: {
    getByEntity: (entityType, entityId) => ipcRenderer.invoke('faceEnrollment:getByEntity', entityType, entityId),
    getOrCreate: (entityType, entityId) => ipcRenderer.invoke('faceEnrollment:getOrCreate', entityType, entityId),
    list: (entityType?) => ipcRenderer.invoke('faceEnrollment:list', entityType),
    getSamples: (enrollmentId) => ipcRenderer.invoke('faceEnrollment:getSamples', enrollmentId),
    saveSample: (enrollmentId, sampleType, imageBase64) =>
      ipcRenderer.invoke('faceEnrollment:saveSample', enrollmentId, sampleType, imageBase64),
    saveDescriptor: (enrollmentId: string, descriptorJson: string) =>
      ipcRenderer.invoke('faceEnrollment:saveDescriptor', enrollmentId, descriptorJson),
    complete: (enrollmentId) => ipcRenderer.invoke('faceEnrollment:complete', enrollmentId),
    revoke: (enrollmentId) => ipcRenderer.invoke('faceEnrollment:revoke', enrollmentId),
  },

  // Sync
  sync: {
    pushMasterData: () => ipcRenderer.invoke('sync:pushMasterData'),
    pullCompletedSessions: (options?: { incremental?: boolean; sessionDate?: string }) =>
      ipcRenderer.invoke('sync:pullCompletedSessions', options),
    getStatus: () => ipcRenderer.invoke('sync:getStatus'),
    testConnection: (url?: string) => ipcRenderer.invoke('sync:testConnection', url),
  },

  // Attendance
  attendance: {
    createSession: (data: any) => ipcRenderer.invoke('attendance:createSession', data),
    listSessions: (filters?: any) => ipcRenderer.invoke('attendance:listSessions', filters),
    getSession: (sessionId: string) => ipcRenderer.invoke('attendance:getSession', sessionId),
    updateRecord: (recordId: string, status: string, reason?: string) =>
      ipcRenderer.invoke('attendance:updateRecord', recordId, status, reason),
    closeSession: (sessionId: string) => ipcRenderer.invoke('attendance:closeSession', sessionId),
  },

  // Faculty Daily Log
  facultyDailyLog: {
    checkIn: (facultyId: string, method?: string, notes?: string) =>
      ipcRenderer.invoke('facultyDailyLog:checkIn', facultyId, method, notes),
    checkOut: (facultyId: string) => ipcRenderer.invoke('facultyDailyLog:checkOut', facultyId),
    getDailyLogs: (date: string) => ipcRenderer.invoke('facultyDailyLog:getDailyLogs', date),
    getFacultyHistory: (facultyId: string, limit?: number) =>
      ipcRenderer.invoke('facultyDailyLog:getFacultyHistory', facultyId, limit),
  },

  // Reports & Analytics
  report: {
    getStudentSummary: (filters?: any) => ipcRenderer.invoke('report:getStudentSummary', filters),
    getShortageReport: (batchId?: string, subjectId?: string, threshold?: number) =>
      ipcRenderer.invoke('report:getShortageReport', batchId, subjectId, threshold),
    getFacultyWorkload: (filters?: any) => ipcRenderer.invoke('report:getFacultyWorkload', filters),
    exportToExcel: (title: string, columns: any[], rows: any[], filename: string) =>
      ipcRenderer.invoke('report:exportToExcel', title, columns, rows, filename),
    exportToPdf: (title: string, columns: any[], rows: any[], filename: string) =>
      ipcRenderer.invoke('report:exportToPdf', title, columns, rows, filename),
  },

  // Google Drive Backup
  backup: {
    getOAuthConfig: () => ipcRenderer.invoke('backup:getOAuthConfig'),
    saveOAuthConfig: (clientId: string, clientSecret?: string) =>
      ipcRenderer.invoke('backup:saveOAuthConfig', clientId, clientSecret),
    getAccount: () => ipcRenderer.invoke('backup:getAccount'),
    connectAccount: () => ipcRenderer.invoke('backup:connectAccount'),
    disconnectAccount: () => ipcRenderer.invoke('backup:disconnectAccount'),
    getSettings: () => ipcRenderer.invoke('backup:getSettings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('backup:saveSettings', settings),
    getLastBackup: () => ipcRenderer.invoke('backup:getLastBackup'),
    runBackupNow: () => ipcRenderer.invoke('backup:runBackupNow'),
  },

  // Notifications
  notification: {
    list: (filters?) => ipcRenderer.invoke('notification:list', filters),
    getUnreadCount: () => ipcRenderer.invoke('notification:getUnreadCount'),
    markRead: (id: string) => ipcRenderer.invoke('notification:markRead', id),
    markAllRead: () => ipcRenderer.invoke('notification:markAllRead'),
    delete: (id: string) => ipcRenderer.invoke('notification:delete', id),
    deleteAll: () => ipcRenderer.invoke('notification:deleteAll'),
    scanShortage: (threshold?: number) => ipcRenderer.invoke('notification:scanShortage', threshold),
    exportShortageLetters: (threshold?: number, batchId?: string) =>
      ipcRenderer.invoke('notification:exportShortageLetters', threshold, batchId),
  },

  // Face Recognition
  faceRecognition: {
    getSessionStudents: (sessionId: string) =>
      ipcRenderer.invoke('faceRecognition:getSessionStudents', sessionId),
    markRecognized: (recordId: string, confidence: number) =>
      ipcRenderer.invoke('faceRecognition:markRecognized', recordId, confidence),
    getMissingDescriptorsData: () =>
      ipcRenderer.invoke('faceRecognition:getMissingDescriptorsData'),
  },

  // Utility
  app: {
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    getDataPath: () => ipcRenderer.invoke('app:getDataPath'),
  },
}

contextBridge.exposeInMainWorld('api', api)

// Type augmentation so renderer TypeScript knows about window.api
export type { IpcApi }
