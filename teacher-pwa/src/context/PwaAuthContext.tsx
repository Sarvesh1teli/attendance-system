import React, { createContext, useContext, useEffect, useState } from 'react'
import { db, TeacherProfile, seedInitialDataIfEmpty, clearAllPwaData } from '../db/pwa-db'
import { extractDayOfWeek, formatTo12Hour } from '../utils/time-utils'

interface PwaAuthContextType {
  teacher: TeacherProfile | null
  isOnline: boolean
  pendingSyncCount: number
  loading: boolean
  login: (username: string, password?: string, institutionId?: string) => Promise<{ success: boolean; error?: string }>
  faceLogin: (faceDescriptor: number[], institutionId?: string) => Promise<{ success: boolean; teacherName?: string; error?: string }>
  logout: () => Promise<void>
  clearAllData: () => Promise<void>
  triggerSync: () => Promise<{ synced: number; error?: string }>
  refreshSyncCount: () => Promise<void>
}

const PwaAuthContext = createContext<PwaAuthContextType | undefined>(undefined)

export function PwaAuthProvider({ children }: { children: React.ReactNode }) {
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine)
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  const refreshSyncCount = async () => {
    try {
      const count = await db.syncQueue.count()
      setPendingSyncCount(count)
    } catch {
      setPendingSyncCount(0)
    }
  }

  const PWA_STORAGE_EPOCH_KEY = 'pwa_data_reset_epoch'
  const CURRENT_STORAGE_EPOCH = 'epoch_2026_09_09_hard_purge_v4'

  useEffect(() => {
    async function init() {
      try {
        if (localStorage.getItem(PWA_STORAGE_EPOCH_KEY) !== CURRENT_STORAGE_EPOCH) {
          console.log('[PWA] Resetting all local cached data as requested...')
          await clearAllPwaData()
          localStorage.clear()
          sessionStorage.clear()
          localStorage.setItem(PWA_STORAGE_EPOCH_KEY, CURRENT_STORAGE_EPOCH)
          setTeacher(null)
          return
        }

        await seedInitialDataIfEmpty()
        const saved = await db.teacherProfile.toCollection().first()
        if (saved) {
          if (saved.name?.toLowerCase().includes('bhavu') || saved.username?.toLowerCase().includes('bhavu') || saved.institution_name === 'svhs') {
            await clearAllPwaData()
            setTeacher(null)
          } else {
            setTeacher(saved)
          }
        }
        await refreshSyncCount()
      } catch (err) {
        console.error('PWA init error:', err)
      } finally {
        setLoading(false)
      }
    }

    init()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const login = async (username: string, password?: string, institutionId?: string) => {
    try {
      if (!username || !username.trim()) {
        return { success: false, error: 'Please enter a valid Teacher ID or Username' }
      }
      const trimmed = username.trim()
      const lower = trimmed.toLowerCase()
      const cleanInst = (institutionId?.trim() || localStorage.getItem('pwa_institute_id') || '').trim()
      if (!cleanInst) {
        return { success: false, error: 'Please enter your Institution Code' }
      }
      localStorage.setItem('pwa_institute_id', cleanInst)

      // 1. Try remote Cloud Login if online
      if (navigator.onLine) {
        try {
          const apiBase =
            (import.meta as any).env?.VITE_CLOUD_API_URL ??
            (typeof window !== 'undefined' && window.location.hostname === 'localhost'
              ? 'http://localhost:8086'
              : '')
          const resp = await fetch(`${apiBase}/api/v1/auth/teacher/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ institutionId: cleanInst, username: trimmed, password }),
          })
          if (resp.ok) {
            const data = await resp.json()
            if (data.success && data.teacher) {
              const remoteProfile: TeacherProfile = {
                id: data.teacher.id,
                employee_id: data.teacher.employee_id || trimmed,
                name: data.teacher.name || trimmed,
                username: data.teacher.username || trimmed,
                department: data.teacher.department || 'General',
                institution_name: data.teacher.institution_name || cleanInst,
                institution_id: data.teacher.institution_id || cleanInst,
              }
              await db.teacherProfile.put(remoteProfile)
              setTeacher(remoteProfile)
              triggerSync().catch(console.error)
              return { success: true }
            } else if (data.error) {
              return { success: false, error: data.error }
            }
          }
        } catch (netErr) {
          console.warn('Remote login failed, checking local profiles:', netErr)
        }
      }

      // 2. Check local Dexie teacher profiles for this tenant
      const allProfiles = await db.teacherProfile.toArray()
      const found = allProfiles.find(
        (p) =>
          (p.institution_name?.toLowerCase() === cleanInst.toLowerCase() || p.institution_id?.toLowerCase() === cleanInst.toLowerCase()) &&
          (p.username.toLowerCase() === lower || p.employee_id.toLowerCase() === lower)
      )
      if (found) {
        setTeacher(found)
        return { success: true }
      }

      return { success: false, error: 'Account not found in institution ' + cleanInst + '. Please verify your username and password.' }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Login failed' }
    }
  }


  const faceLogin = async (
    faceDescriptor: number[],
    institutionId?: string
  ): Promise<{ success: boolean; teacherName?: string; error?: string }> => {
    try {
      if (!faceDescriptor || faceDescriptor.length < 128) {
        return { success: false, error: 'Invalid face features detected. Please try again.' }
      }
      const cleanInst = institutionId?.trim() || localStorage.getItem('pwa_institute_id') || 'svhs'
      localStorage.setItem('pwa_institute_id', cleanInst)

      const apiBase =
        (import.meta as any).env?.VITE_CLOUD_API_URL ??
        (typeof window !== 'undefined' && window.location.hostname === 'localhost'
          ? 'http://localhost:8086'
          : '')

      if (navigator.onLine) {
        try {
          const resp = await fetch(`${apiBase}/api/v1/auth/teacher/face-login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              institutionId: cleanInst,
              faceDescriptor: Array.from(faceDescriptor),
            }),
          })
          if (resp.ok) {
            const data = await resp.json()
            if (data.success && data.teacher) {
              const remoteProfile: TeacherProfile = {
                id: data.teacher.id,
                employee_id: data.teacher.employee_id || 'FAC001',
                name: data.teacher.name || 'Faculty Member',
                username: data.teacher.username || data.teacher.name,
                department: data.teacher.department || 'General',
                institution_name: data.teacher.institution_name || cleanInst,
                institution_id: data.teacher.institution_id || cleanInst,
              }
              await db.teacherProfile.put(remoteProfile)
              setTeacher(remoteProfile)
              triggerSync().catch(console.error)
              return { success: true, teacherName: remoteProfile.name }
            } else {
              return { success: false, error: data.error || 'Face not recognized.' }
            }
          }
        } catch (netErr) {
          console.warn('Remote face login failed, checking local profiles:', netErr)
        }
      }

      // Offline fallback: Check if existing saved teacher exists
      const saved = await db.teacherProfile.toCollection().first()
      if (saved) {
        setTeacher(saved)
        return { success: true, teacherName: saved.name }
      }

      return {
        success: false,
        error: 'Face recognition login requires cloud connection or pre-enrolled local profile.',
      }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Face login error' }
    }
  }

  const logout = async () => {
    setTeacher(null)
  }

  const clearAllData = async () => {
    await clearAllPwaData()
    setTeacher(null)
    setPendingSyncCount(0)
  }

  const triggerSync = async () => {
    try {
      // Sweep up any completed sessions marked LOCAL_ONLY that are missing from syncQueue
      const unsyncedSessions = await db.sessions.where('sync_status').equals('LOCAL_ONLY').toArray()
      for (const s of unsyncedSessions) {
        const inQueue = await db.syncQueue.where('entity_id').equals(s.session_id).first()
        if (!inQueue) {
          const sRecs = await db.records.where('session_id').equals(s.session_id).toArray()
          await db.syncQueue.put({
            action: 'SUBMIT_ATTENDANCE',
            entity_type: 'ATTENDANCE_SESSION',
            entity_id: s.session_id,
            payload: {
              session: s,
              records: sRecs,
            },
            created_at: new Date().toISOString(),
            attempts: 0,
          })
        }
      }

      const queue = await db.syncQueue.toArray()
      let syncedCount = 0

      for (const item of queue) {
        if (item.action === 'SUBMIT_ATTENDANCE') {
          const payload = item.payload as {
            session: any
            records: any[]
          }

          const sess = payload.session || {}
          const mappedSession = {
            sessionId: sess.session_id || sess.sessionId,
            facultyId: sess.faculty_id || sess.facultyId || teacher?.id || 'fac-001',
            subjectId: sess.subject_id || sess.subjectId,
            batchId: sess.batch_id || sess.batchId,
            academicYearId: sess.academic_year_id || sess.academicYearId || 'ay-default',
            studentGroupId: sess.student_group_id || sess.studentGroupId || null,
            sessionDate: sess.session_date || sess.sessionDate || new Date().toISOString().split('T')[0],
            startTime: sess.start_time || sess.startTime || '09:00:00',
            endTime: sess.end_time || sess.endTime || '10:00:00',
            status: sess.status || 'COMPLETED',
            topicId: sess.topic_id || sess.topicId || null,
            customTopic: sess.custom_topic || sess.customTopic || null,
            version: sess.version || 1,
          }

          const mappedRecords = (payload.records || []).map((r: any) => ({
            recordId: r.record_id || r.recordId || r.id,
            studentId: r.student_id || r.studentId,
            status: r.status || 'ABSENT',
            recognitionMethod: r.recognition_method || r.recognitionMethod || 'SYSTEM_DEFAULT',
            recordState: r.record_state || r.recordState || 'ACTIVE',
            confidenceScore: r.confidence_score !== undefined ? r.confidence_score : (r.confidenceScore !== undefined ? r.confidenceScore : null),
            markedAt: r.marked_at || r.markedAt || new Date().toISOString(),
            version: r.version || 1,
          }))

          const instId =
            (teacher?.institution_id && teacher.institution_id !== 'inst-001')
              ? teacher.institution_id
              : (sess.institution_id && sess.institution_id !== 'inst-001' ? sess.institution_id : '392112ee-d8da-40ce-a563-8a835b45a1bd')

          const apiBase = (import.meta as any).env?.VITE_CLOUD_API_URL ?? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8086' : '')
          const response = await fetch(`${apiBase}/api/v1/sync/pwa/push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              institutionId: instId,
              session: mappedSession,
              records: mappedRecords,
            }),
          })

          if (response.ok) {
            const sessId = mappedSession.sessionId
            await db.transaction('rw', db.sessions, db.records, db.syncQueue, async () => {
              if (sessId) {
                await db.sessions.where('session_id').equals(sessId).modify({ sync_status: 'SYNCED' })
                await db.records.where('session_id').equals(sessId).modify({ sync_status: 'SYNCED' })
              }
              if (item.id) await db.syncQueue.delete(item.id)
            })
            syncedCount++
          } else {
            console.warn('Sync item failed:', response.statusText)
          }
        }
      }

      // Also pull latest assignments & topics if online
      try {
        const apiBase = (import.meta as any).env?.VITE_CLOUD_API_URL ?? (typeof window !== 'undefined' && window.location.hostname === 'localhost' ? 'http://localhost:8086' : '')
        const pullRes = await fetch(
          `${apiBase}/api/v1/sync/pwa/pull?institutionId=${teacher?.institution_id || ''}`
        )
        if (pullRes.ok) {
          const pullData = await pullRes.json()
          if (pullData.institutionId && teacher && teacher.institution_id !== pullData.institutionId) {
            teacher.institution_id = pullData.institutionId
            await db.teacherProfile.put(teacher)
          }
          if (pullData.topics && pullData.topics.length > 0) {
            const mappedTopics = pullData.topics.map((t: any) => ({
              id: t.id,
              subject_id: t.subject_id || t.subjectId || '',
              topic_name: t.topic_name || t.topicName || '',
              unit_name: t.unit_name || t.unitName,
              sequence_number: t.sequence_number || t.sequenceNumber,
            }))
            const demoTopics = await db.topics.filter(t => t.id.startsWith('top-')).toArray()
            if (demoTopics.length > 0) {
              await db.topics.bulkDelete(demoTopics.map(t => t.id))
            }
            await db.topics.bulkPut(mappedTopics)
          }
          if (pullData.classes && pullData.classes.length > 0) {
            const mappedClasses = pullData.classes.map((c: any) => {
              const dow = extractDayOfWeek(c)
              const rawTime = c.schedule_time || c.scheduleTime || '09:00 AM - 10:30 AM'
              const formattedTime = formatTo12Hour(rawTime)

              return {
                id: c.id,
                faculty_id: c.faculty_id || c.facultyId || '',
                faculty_name: c.faculty_name || c.facultyName || '',
                employee_id: c.employee_id || c.employeeId || '',
                department: c.department || '',
                batch_id: c.batch_id || c.batchId || '',
                batch_name: c.batch_name || c.batchName || '',
                subject_id: c.subject_id || c.subjectId || '',
                subject_name: c.subject_name || c.subjectName || '',
                subject_code: c.subject_code || c.subjectCode || '',
                program_name: c.program_name || c.programName || '',
                academic_year_id: c.academic_year_id || c.academicYearId || '',
                group_id: c.group_id || c.groupId,
                group_name: c.group_name || c.groupName,
                day_of_week: dow !== null ? dow : undefined,
                schedule_time: formattedTime,
                room: c.room || 'Lecture Hall 1',
              }
            })
            const demoClasses = await db.classes.filter(c => c.id.startsWith('cls-mbbs-') || c.id.startsWith('cls-anat-') || c.id.startsWith('cls-path-')).toArray()
            if (demoClasses.length > 0) {
              await db.classes.bulkDelete(demoClasses.map(c => c.id))
            }
            await db.classes.bulkPut(mappedClasses)
          }

          if (pullData.teachers && pullData.teachers.length > 0 && teacher) {
            const matchedTeacher = pullData.teachers.find((t: any) =>
              (teacher.username && t.username?.toLowerCase() === teacher.username.toLowerCase()) ||
              (teacher.employee_id && t.employee_id?.toLowerCase() === teacher.employee_id.toLowerCase()) ||
              (teacher.id && t.id === teacher.id)
            )
            if (matchedTeacher) {
              teacher.id = matchedTeacher.id || teacher.id
              teacher.name = matchedTeacher.name || teacher.name
              teacher.department = matchedTeacher.department || teacher.department
              teacher.employee_id = matchedTeacher.employee_id || matchedTeacher.employeeId || teacher.employee_id
              teacher.institution_name = matchedTeacher.institution_name || matchedTeacher.institutionName || teacher.institution_name
              await db.teacherProfile.put(teacher)
              setTeacher({ ...teacher })
            }
          }

          if (pullData.students && pullData.students.length > 0) {
            const mappedStudents = pullData.students.map((s: any) => {
              let parsedDesc: number[] | undefined = undefined
              if (s.faceDescriptor) {
                if (Array.isArray(s.faceDescriptor)) {
                  parsedDesc = s.faceDescriptor
                } else if (typeof s.faceDescriptor === 'string') {
                  try {
                    parsedDesc = JSON.parse(s.faceDescriptor)
                  } catch {}
                }
              }
              return {
                id: s.id || s.studentId,
                class_id: s.batchId,
                student_id: s.studentId,
                name: s.name,
                admission_number: s.admissionNumber,
                gender: s.gender,
                face_enrolled: !!s.faceEnrolled,
                face_descriptor: parsedDesc,
              }
            })
            const demoStudents = await db.students.filter(s => s.id.startsWith('stu-')).toArray()
            if (demoStudents.length > 0) {
              await db.students.bulkDelete(demoStudents.map(s => s.id))
            }
            await db.students.bulkPut(mappedStudents)
          }
        }
      } catch (pullErr) {
        console.warn('Pull update deferred:', pullErr)
      }

      await refreshSyncCount()
      return { synced: syncedCount }
    } catch (err) {
      console.error('Trigger sync error:', err)
      return { synced: 0, error: err instanceof Error ? err.message : 'Cloud sync failed' }
    }
  }

  return (
    <PwaAuthContext.Provider
      value={{
        teacher,
        isOnline,
        pendingSyncCount,
        loading,
        login,
        faceLogin,
        logout,
        clearAllData,
        triggerSync,
        refreshSyncCount,
      }}
    >
      {children}
    </PwaAuthContext.Provider>
  )
}

export function usePwaAuth(): PwaAuthContextType {
  const context = useContext(PwaAuthContext)
  if (!context) {
    throw new Error('usePwaAuth must be used within PwaAuthProvider')
  }
  return context
}
