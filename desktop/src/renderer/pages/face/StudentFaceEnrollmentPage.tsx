import { useState, useEffect, useMemo } from 'react'
import { Camera, User, CheckCircle, RefreshCw, X, ShieldAlert, ShieldCheck, Filter, RotateCcw, Search } from 'lucide-react'
import { CameraCapture, SampleType } from '../../components/face/CameraCapture'
import { EnrollmentStatusBadge } from '../../components/face/EnrollmentStatus'
import type { Student, Batch, FaceEnrollment, FaceSample } from '../../../main/ipc/types'
import { faceRecognitionService } from '../../services/FaceRecognitionService'
import * as faceapi from '@vladmandic/face-api'

export default function StudentFaceEnrollmentPage() {
  const [students, setStudents] = useState<Student[]>([])
  const [batches, setBatches] = useState<Batch[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterBatch, setFilterBatch] = useState('')
  const [filterFaceStatus, setFilterFaceStatus] = useState<'ALL' | 'ENROLLED' | 'PENDING'>('ALL')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [currentEnrollment, setCurrentEnrollment] = useState<FaceEnrollment | null>(null)
  const [samples, setSamples] = useState<FaceSample[]>([])
  const [currentStep, setCurrentStep] = useState<SampleType>('FRONT')
  const [enrollmentComplete, setEnrollmentComplete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [list, bList] = await Promise.all([
        window.api.student.list(),
        window.api.batch.list(),
      ])
      setStudents(list || [])
      setBatches(bList || [])
    } catch (err) {
      console.error('Failed to load students and batches:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const batchMap = useMemo(() => {
    return new Map((batches || []).map((b) => [b.batch_id, b.batch_name]))
  }, [batches])

  const startEnrollment = async (student: Student) => {
    setSelectedStudent(student)
    setErrorMessage(null)
    setEnrollmentComplete(false)
    setActionLoading(true)

    try {
      const enrollment = await window.api.faceEnrollment.getOrCreate('STUDENT', student.student_id)
      setCurrentEnrollment(enrollment)
      const existingSamples = await window.api.faceEnrollment.getSamples(enrollment.enrollment_id)
      setSamples(existingSamples)

      // Decide which step to start on based on existing samples
      const types = existingSamples.map((s) => s.sample_type)
      if (!types.includes('FRONT')) setCurrentStep('FRONT')
      else if (!types.includes('LEFT')) setCurrentStep('LEFT')
      else if (!types.includes('RIGHT')) setCurrentStep('RIGHT')
      else setCurrentStep('FRONT')
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not initialize enrollment session')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSampleCaptured = async (
    sampleType: SampleType,
    imageBase64: string,
    descriptorJson?: string | null
  ) => {
    if (!currentEnrollment) return
    setErrorMessage(null)

    try {
      const newSample = await window.api.faceEnrollment.saveSample(
        currentEnrollment.enrollment_id,
        sampleType,
        imageBase64
      )
      const updatedSamples = [...samples.filter((s) => s.sample_type !== sampleType), newSample]
      setSamples(updatedSamples)

      // Save descriptor directly from camera capture if available
      if (descriptorJson) {
        await window.api.faceEnrollment.saveDescriptor(
          currentEnrollment.enrollment_id,
          descriptorJson
        )
      } else {
        // Fallback: try extraction from base64 image
        try {
          await faceRecognitionService.loadModels()
          const img = new Image()
          img.onload = async () => {
            const det = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 }))
              .withFaceLandmarks(true)
              .withFaceDescriptor()
            if (det) {
              await window.api.faceEnrollment.saveDescriptor(
                currentEnrollment.enrollment_id,
                JSON.stringify(Array.from(det.descriptor))
              )
            }
          }
          img.src = `data:image/jpeg;base64,${imageBase64}`
        } catch (e) {
          console.warn('Fallback face descriptor extraction failed:', e)
        }
      }

      // Advance step
      if (sampleType === 'FRONT') {
        setCurrentStep('LEFT')
      } else if (sampleType === 'LEFT') {
        setCurrentStep('RIGHT')
      } else if (sampleType === 'RIGHT') {
        // Complete the 3-shot enrollment!
        setActionLoading(true)
        await window.api.faceEnrollment.complete(currentEnrollment.enrollment_id)
        setEnrollmentComplete(true)
        // Refresh local student status
        setStudents((prev) =>
          prev.map((s) =>
            s.student_id === currentEnrollment.entity_id ? { ...s, face_enrolled: true } : s
          )
        )
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save sample')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRevoke = async (student: Student) => {
    if (!confirm(`Are you sure you want to revoke face enrollment for ${student.name}?`)) return

    try {
      const enr = await window.api.faceEnrollment.getByEntity('STUDENT', student.student_id)
      if (enr) {
        await window.api.faceEnrollment.revoke(enr.enrollment_id)
        setStudents((prev) =>
          prev.map((s) =>
            s.student_id === student.student_id ? { ...s, face_enrolled: false } : s
          )
        )
      }
    } catch (err) {
      alert('Revocation failed: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const handleManualComplete = async () => {
    if (!currentEnrollment) return
    setActionLoading(true)
    try {
      await window.api.faceEnrollment.complete(currentEnrollment.enrollment_id)
      setEnrollmentComplete(true)
      setStudents((prev) =>
        prev.map((s) =>
          s.student_id === currentEnrollment.entity_id ? { ...s, face_enrolled: true } : s
        )
      )
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to complete enrollment')
    } finally {
      setActionLoading(false)
    }
  }

  const closeModal = () => {
    setSelectedStudent(null)
    setCurrentEnrollment(null)
    setSamples([])
    setEnrollmentComplete(false)
    setErrorMessage(null)
    loadData()
  }

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = search.trim().toLowerCase()
      const admNo = ((s as any).admission_number || (s as any).admissionNumber || '').toLowerCase()
      const sName = (s.name || '').toLowerCase()
      const matchSearch = !q || sName.includes(q) || admNo.includes(q)

      const sBatchId = s.batch_id || (s as any).batchId || ''
      const matchBatch = !filterBatch || sBatchId === filterBatch

      const isEnrolled = !!(s.face_enrolled || (s as any).faceEnrolled)
      const matchFace =
        filterFaceStatus === 'ALL' ||
        (filterFaceStatus === 'ENROLLED' && isEnrolled) ||
        (filterFaceStatus === 'PENDING' && !isEnrolled)

      return matchSearch && matchBatch && matchFace
    })
  }, [students, search, filterBatch, filterFaceStatus])

  const totalCount = students.length
  const enrolledCount = students.filter((s) => s.face_enrolled || (s as any).faceEnrolled).length
  const pendingCount = totalCount - enrolledCount

  const handleResetFilters = () => {
    setSearch('')
    setFilterBatch('')
    setFilterFaceStatus('ALL')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Face Enrollment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Capture biometric reference models for automated AI face recognition attendance.
          </p>
        </div>
      </div>

      {/* Summary Stat Counters */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Students</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{totalCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm border-emerald-500/30 bg-emerald-500/5">
          <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Face Enrolled</p>
          <p className="text-2xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">{enrolledCount}</p>
        </div>
        <div className="bg-card border rounded-xl p-4 shadow-sm border-amber-500/30 bg-amber-500/5">
          <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Face Pending</p>
          <p className="text-2xl font-bold mt-1 text-amber-600 dark:text-amber-400">{pendingCount}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" /> Filter Student Records
          </span>
          {(search || filterBatch || filterFaceStatus !== 'ALL') && (
            <button
              onClick={handleResetFilters}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" /> Reset Filters
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or admission no..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {/* Batch Filter Dropdown */}
          <div>
            <select
              value={filterBatch}
              onChange={(e) => setFilterBatch(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Batches ({batches.length})</option>
              {batches.map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  {b.batch_name}
                </option>
              ))}
            </select>
          </div>

          {/* Face Status Dropdown */}
          <div>
            <select
              value={filterFaceStatus}
              onChange={(e) => setFilterFaceStatus(e.target.value as any)}
              className="w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="ALL">All Face Status ({totalCount})</option>
              <option value="ENROLLED">Enrolled ({enrolledCount})</option>
              <option value="PENDING">Pending / Not Enrolled ({pendingCount})</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm">Loading student directory...</span>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <User className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No students found matching current filters</p>
            <p className="text-xs mt-1">Try resetting the filter criteria or register new students.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Student Name</th>
                  <th className="px-6 py-3.5">Admission No</th>
                  <th className="px-6 py-3.5">Batch</th>
                  <th className="px-6 py-3.5">Gender</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Biometric Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredStudents.map((s) => {
                  const sBatchId = s.batch_id || (s as any).batchId || ''
                  const batchName = batchMap.get(sBatchId) || sBatchId || '—'
                  const admNo = (s as any).admission_number || (s as any).admissionNumber || '—'
                  const isEnrolled = !!(s.face_enrolled || (s as any).faceEnrolled)

                  return (
                    <tr key={s.student_id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs flex-shrink-0">
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{s.name}</div>
                            <div className="text-xs text-muted-foreground font-mono">
                              {s.phone || 'No phone'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                        {admNo}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                          {batchName}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-muted-foreground text-xs">{s.gender || '—'}</td>
                      <td className="px-6 py-4">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                          {s.current_status || 'ACTIVE'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <EnrollmentStatusBadge
                          status={isEnrolled ? 'ENROLLED' : 'NOT_ENROLLED'}
                        />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isEnrolled ? (
                            <>
                              <button
                                onClick={() => startEnrollment(s)}
                                className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
                              >
                                Re-enroll
                              </button>
                              <button
                                onClick={() => handleRevoke(s)}
                              className="px-3 py-1.5 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              Revoke
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEnrollment(s)}
                            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 shadow-sm transition-all"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Enroll Face
                          </button>
                        )}
                      </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3-Shot Camera Modal */}
      {selectedStudent && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Biometric Enrollment</h3>
                <p className="text-xs text-muted-foreground">
                  Enrolling face for <span className="font-semibold text-foreground">{selectedStudent.name}</span>
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto">
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-500 flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {enrollmentComplete ? (
                <div className="py-10 text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 ring-8 ring-emerald-500/10">
                    <ShieldCheck className="h-8 w-8" />
                  </div>
                  <div>
                    <h4 className="text-xl font-bold text-foreground">Face Enrolled Successfully</h4>
                    <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                      All 3 biometric reference angles have been securely encrypted and stored locally.
                    </p>
                  </div>
                  <button
                    onClick={closeModal}
                    className="mt-4 bg-primary text-primary-foreground font-semibold px-6 py-2 rounded-lg text-sm shadow-md hover:bg-primary/90 transition-all"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Step Progress Pills */}
                  <div className="flex items-center justify-center gap-3">
                    {(['FRONT', 'LEFT', 'RIGHT'] as SampleType[]).map((type, idx) => {
                      const isDone = samples.some((s) => s.sample_type === type)
                      const isCurrent = currentStep === type && !isDone
                      return (
                        <div
                          key={type}
                          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isDone
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                              : isCurrent
                              ? 'bg-primary border-primary text-primary-foreground shadow-sm'
                              : 'bg-muted border-border text-muted-foreground'
                          }`}
                        >
                          <span>{idx + 1}. {type}</span>
                          {isDone && <CheckCircle className="h-3 w-3" />}
                        </div>
                      )
                    })}
                  </div>

                  {/* Camera Component */}
                  <CameraCapture
                    entityName={selectedStudent.name}
                    currentStep={currentStep}
                    onCapture={handleSampleCaptured}
                    disabled={actionLoading}
                  />

                  {samples.length >= 1 && (
                    <div className="flex justify-center pt-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleManualComplete}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg shadow-md transition-all flex items-center gap-1.5 active:scale-[0.98]"
                      >
                        <CheckCircle className="h-4 w-4" />
                        <span>Save & Complete Face Enrollment ({samples.length} sample{samples.length > 1 ? 's' : ''})</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
