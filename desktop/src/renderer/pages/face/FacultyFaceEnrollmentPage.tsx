import { useState, useEffect } from 'react'
import { Camera, User, CheckCircle, RefreshCw, X, ShieldAlert, ShieldCheck } from 'lucide-react'
import { CameraCapture, SampleType } from '../../components/face/CameraCapture'
import { EnrollmentStatusBadge } from '../../components/face/EnrollmentStatus'
import type { Faculty, FaceEnrollment, FaceSample } from '../../../main/ipc/types'

export default function FacultyFaceEnrollmentPage() {
  const [facultyList, setFacultyList] = useState<Faculty[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedFaculty, setSelectedFaculty] = useState<Faculty | null>(null)
  const [currentEnrollment, setCurrentEnrollment] = useState<FaceEnrollment | null>(null)
  const [samples, setSamples] = useState<FaceSample[]>([])
  const [currentStep, setCurrentStep] = useState<SampleType>('FRONT')
  const [enrollmentComplete, setEnrollmentComplete] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const loadFaculty = async () => {
    setLoading(true)
    try {
      const list = await window.api.faculty.list()
      setFacultyList(list)
    } catch (err) {
      console.error('Failed to load faculty:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFaculty()
  }, [])

  const startEnrollment = async (fac: Faculty) => {
    setSelectedFaculty(fac)
    setErrorMessage(null)
    setEnrollmentComplete(false)
    setActionLoading(true)

    try {
      const enrollment = await window.api.faceEnrollment.getOrCreate('FACULTY', fac.faculty_id)
      setCurrentEnrollment(enrollment)
      const existingSamples = await window.api.faceEnrollment.getSamples(enrollment.enrollment_id)
      setSamples(existingSamples)

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

  const handleSampleCaptured = async (sampleType: SampleType, imageBase64: string) => {
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

      if (sampleType === 'FRONT') {
        setCurrentStep('LEFT')
      } else if (sampleType === 'LEFT') {
        setCurrentStep('RIGHT')
      } else if (sampleType === 'RIGHT') {
        setActionLoading(true)
        await window.api.faceEnrollment.complete(currentEnrollment.enrollment_id)
        setEnrollmentComplete(true)
        setFacultyList((prev) =>
          prev.map((f) =>
            f.faculty_id === currentEnrollment.entity_id ? { ...f, face_enrolled: true } : f
          )
        )
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save sample')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRevoke = async (fac: Faculty) => {
    if (!confirm(`Are you sure you want to revoke face enrollment for ${fac.name}?`)) return

    try {
      const enr = await window.api.faceEnrollment.getByEntity('FACULTY', fac.faculty_id)
      if (enr) {
        await window.api.faceEnrollment.revoke(enr.enrollment_id)
        setFacultyList((prev) =>
          prev.map((f) =>
            f.faculty_id === fac.faculty_id ? { ...f, face_enrolled: false } : f
          )
        )
      }
    } catch (err) {
      alert('Revocation failed: ' + (err instanceof Error ? err.message : String(err)))
    }
  }

  const closeModal = () => {
    setSelectedFaculty(null)
    setCurrentEnrollment(null)
    setSamples([])
    setEnrollmentComplete(false)
    setErrorMessage(null)
  }

  const filteredFaculty = facultyList.filter(
    (f) =>
      f.name.toLowerCase().includes(search.toLowerCase()) ||
      f.employee_id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Faculty Face Enrollment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enroll teaching staff for automated workload and attendance verification.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search faculty..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-64 border rounded-lg px-3.5 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-card border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground flex flex-col items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm">Loading faculty directory...</span>
          </div>
        ) : filteredFaculty.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <User className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
            <p className="font-medium text-foreground">No faculty found</p>
            <p className="text-xs mt-1">Register faculty in the People directory first.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/50 border-b text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3.5">Faculty Member</th>
                  <th className="px-6 py-3.5">Employee ID</th>
                  <th className="px-6 py-3.5">Designation</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5">Biometric Status</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredFaculty.map((f) => (
                  <tr key={f.faculty_id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs flex-shrink-0">
                          {f.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">{f.name}</div>
                          <div className="text-xs text-muted-foreground">{f.email || 'No email'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs">{f.employee_id}</td>
                    <td className="px-6 py-4 text-muted-foreground text-xs">{f.designation || '—'}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-secondary text-secondary-foreground">
                        {f.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <EnrollmentStatusBadge
                        status={f.face_enrolled ? 'ENROLLED' : 'NOT_ENROLLED'}
                      />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {f.face_enrolled ? (
                          <>
                            <button
                              onClick={() => startEnrollment(f)}
                              className="px-3 py-1.5 rounded-md border text-xs font-medium hover:bg-accent transition-colors"
                            >
                              Re-enroll
                            </button>
                            <button
                              onClick={() => handleRevoke(f)}
                              className="px-3 py-1.5 rounded-md text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                            >
                              Revoke
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => startEnrollment(f)}
                            className="inline-flex items-center gap-1.5 bg-primary text-primary-foreground px-3.5 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 shadow-sm transition-all"
                          >
                            <Camera className="h-3.5 w-3.5" />
                            Enroll Face
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 3-Shot Camera Modal */}
      {selectedFaculty && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-xl rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-bold text-lg">Biometric Enrollment</h3>
                <p className="text-xs text-muted-foreground">
                  Enrolling face for <span className="font-semibold text-foreground">{selectedFaculty.name}</span>
                </p>
              </div>
              <button
                onClick={closeModal}
                className="p-1 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

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
                    <h4 className="text-xl font-bold text-foreground">Faculty Enrolled Successfully</h4>
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

                  <CameraCapture
                    entityName={selectedFaculty.name}
                    currentStep={currentStep}
                    onCapture={handleSampleCaptured}
                    disabled={actionLoading}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
