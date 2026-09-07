import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft, Camera, CameraOff, Play, Pause, Lock,
  CheckCircle, XCircle, Loader2, ScanFace, AlertTriangle, Settings
} from 'lucide-react'
import type { RecognitionStudent } from '@main/ipc/types'
import { faceRecognitionService } from '../../services/FaceRecognitionService'

type StudentRow = RecognitionStudent & { recognized: boolean; confidence: number }
type Phase = 'idle' | 'loading-models' | 'building-descriptors' | 'ready' | 'scanning' | 'error'

export default function RecognitionSessionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [phase, setPhase] = useState<Phase>('idle')
  const [phaseMsg, setPhaseMsg] = useState('')
  const [students, setStudents] = useState<StudentRow[]>([])
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [threshold, setThreshold] = useState(0.5)
  const [showSettings, setShowSettings] = useState(false)
  const [buildProgress, setBuildProgress] = useState({ done: 0, total: 0 })
  const [scanCount, setScanCount] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')

  // Derived counts
  const enrolledCount = students.filter(s => s.face_enrolled).length
  const recognizedCount = students.filter(s => s.recognized).length
  const absentCount = students.filter(s => !s.recognized && s.status !== 'PRESENT').length

  // ── Load session + students ─────────────────────────────────────────────────
  useEffect(() => {
    if (!id) return
    const init = async () => {
      try {
        const [sess, studs] = await Promise.all([
          (window.api as any).attendance.getSession(id),
          window.api.faceRecognition.getSessionStudents(id),
        ])
        setSessionInfo(sess)
        setStudents(studs.map(s => ({ ...s, recognized: s.status === 'PRESENT', confidence: 0 })))
      } catch (e: unknown) {
        setPhase('error')
        setErrorMsg(e instanceof Error ? e.message : 'Failed to load session')
      }
    }
    init()
  }, [id])

  // ── Initialize: load models + build descriptors ─────────────────────────────
  const initialize = async () => {
    setPhase('loading-models')
    setPhaseMsg('Loading face detection models…')
    try {
      await faceRecognitionService.loadModels('/models')
      setPhase('building-descriptors')
      setPhaseMsg('Building face descriptors from enrolled photos…')
      setBuildProgress({ done: 0, total: 0 })

      const { builtCount, skippedCount } = await faceRecognitionService.buildDescriptors(
        students.filter(s => s.face_enrolled),
        (done, total) => setBuildProgress({ done, total })
      )
      setPhaseMsg(`Ready — ${builtCount} students indexed, ${skippedCount} skipped`)
      setPhase('ready')

      // Open camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
    } catch (e: unknown) {
      setPhase('error')
      setErrorMsg(e instanceof Error ? e.message : 'Initialization failed')
    }
  }

  // ── Recognition loop ────────────────────────────────────────────────────────
  const startScanning = useCallback(() => {
    setPhase('scanning')

    const runLoop = async () => {
      if (!videoRef.current || !canvasRef.current) return

      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      // Sync canvas size to video
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      try {
        const matches = await faceRecognitionService.detectAndMatch(video, threshold)

        // Draw video frame
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

        // Draw face boxes
        for (const match of matches) {
          const { x, y, width, height } = match.box
          const pct = Math.round(match.confidence * 100)

          ctx.strokeStyle = '#22c55e'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, width, height)

          // Name label
          ctx.fillStyle = 'rgba(34,197,94,0.85)'
          ctx.fillRect(x, y - 24, width, 24)
          ctx.fillStyle = '#fff'
          ctx.font = 'bold 13px sans-serif'
          ctx.fillText(`${match.studentName} (${pct}%)`, x + 4, y - 7)

          // Mark PRESENT via IPC if not already
          setStudents(prev => {
            const existing = prev.find(s => s.record_id === match.recordId)
            if (existing && !existing.recognized) {
              window.api.faceRecognition
                .markRecognized(match.recordId, match.confidence)
                .catch(console.error)
              setScanCount(c => c + 1)
              return prev.map(s =>
                s.record_id === match.recordId
                  ? { ...s, recognized: true, confidence: match.confidence, status: 'PRESENT' }
                  : s
              )
            }
            return prev
          })
        }

        // Draw "no face" boxes gray for unmatched
        if (matches.length === 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        }
      } catch {
        // Swallow per-frame errors, keep loop alive
      }

      loopRef.current = setTimeout(runLoop, 800)
    }

    runLoop()
  }, [threshold])

  const pauseScanning = useCallback(() => {
    if (loopRef.current) clearTimeout(loopRef.current)
    setPhase('ready')

    // Draw last video frame on canvas
    if (videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) ctx.drawImage(videoRef.current, 0, 0)
    }
  }, [])

  // ── Threshold change ────────────────────────────────────────────────────────
  const handleThresholdChange = (val: number) => {
    setThreshold(val)
    faceRecognitionService.updateThreshold(val)
  }

  // ── Manual mark ─────────────────────────────────────────────────────────────
  const handleManualMark = async (s: StudentRow) => {
    try {
      await (window.api as any).attendance.updateRecord(s.record_id, 'PRESENT', 'Manual mark in recognition mode')
      setStudents(prev => prev.map(r => r.record_id === s.record_id ? { ...r, recognized: true, status: 'PRESENT' } : r))
    } catch { /* ignore */ }
  }

  // ── Lock session ────────────────────────────────────────────────────────────
  const handleLockSession = async () => {
    if (!id || !confirm('Lock and close this session?')) return
    try {
      await (window.api as any).attendance.closeSession(id)
      navigate(`/attendance/session/${id}`)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Lock failed')
    }
  }

  // ── Cleanup on unmount ──────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (loopRef.current) clearTimeout(loopRef.current)
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      faceRecognitionService.reset()
    }
  }, [])

  const isLocked = sessionInfo?.status === 'SUBMITTED' || sessionInfo?.status === 'LOCKED'

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(`/attendance/session/${id}`)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              <ScanFace className="h-5 w-5 text-primary" />
              Face Recognition Mode
            </h1>
            {sessionInfo && (
              <p className="text-xs text-muted-foreground">
                {sessionInfo.subject_name} · {sessionInfo.batch_name} · {sessionInfo.session_date}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(s => !s)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
          {!isLocked && (
            <button onClick={handleLockSession}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-destructive text-destructive-foreground hover:bg-destructive/90">
              <Lock className="h-3.5 w-3.5" /> Lock Session
            </button>
          )}
        </div>
      </div>

      {/* ── Settings Panel ── */}
      {showSettings && (
        <div className="bg-card border rounded-lg p-4 flex items-center gap-6">
          <div className="flex-1">
            <label className="text-sm font-medium">
              Confidence Threshold: <strong>{Math.round((1 - threshold) * 100)}%</strong>
              <span className="text-muted-foreground text-xs ml-2">(higher = stricter matching)</span>
            </label>
            <input type="range" min={0.3} max={0.7} step={0.05}
              value={threshold}
              onChange={e => handleThresholdChange(Number(e.target.value))}
              className="w-full mt-1" />
            <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
              <span>Lenient (70%)</span><span>Strict (30%)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Stats Bar ── */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: students.length, color: 'text-foreground' },
          { label: 'Enrolled', value: enrolledCount, color: 'text-blue-600' },
          { label: 'Recognized', value: recognizedCount, color: 'text-green-600' },
          { label: 'Absent', value: absentCount, color: 'text-red-600' },
        ].map(s => (
          <div key={s.label} className="bg-card border rounded-lg p-3 text-center">
            <div className="text-[11px] text-muted-foreground uppercase font-semibold">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* ── Main Content ── */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Camera Panel */}
        <div className="flex-1 flex flex-col gap-3">
          {/* Camera Feed / Canvas */}
          <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
            <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-0" playsInline muted />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover" />

            {/* Overlay states */}
            {(phase === 'idle' || phase === 'ready') && !streamRef.current && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3">
                <Camera className="h-12 w-12 opacity-40" />
                <p className="text-sm opacity-60">Camera not started</p>
              </div>
            )}
            {(phase === 'loading-models' || phase === 'building-descriptors') && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black/70">
                <Loader2 className="h-10 w-10 animate-spin" />
                <p className="text-sm font-medium">{phaseMsg}</p>
                {phase === 'building-descriptors' && buildProgress.total > 0 && (
                  <div className="w-48">
                    <div className="bg-white/20 rounded-full h-2">
                      <div className="bg-green-400 h-2 rounded-full transition-all"
                        style={{ width: `${(buildProgress.done / buildProgress.total) * 100}%` }} />
                    </div>
                    <p className="text-center text-xs mt-1 opacity-60">
                      {buildProgress.done} / {buildProgress.total}
                    </p>
                  </div>
                )}
              </div>
            )}
            {phase === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-3 bg-black/70">
                <AlertTriangle className="h-10 w-10 text-red-400" />
                <p className="text-sm text-red-300 text-center max-w-xs">{errorMsg}</p>
              </div>
            )}
            {phase === 'scanning' && (
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-green-600/90 text-white text-xs px-2 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                LIVE · {scanCount} recognized
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-3">
            {phase === 'idle' && (
              <button onClick={initialize}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90">
                <Camera className="h-4 w-4" /> Initialize & Start Camera
              </button>
            )}
            {phase === 'ready' && (
              <button onClick={startScanning}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">
                <Play className="h-4 w-4" /> Start Scanning
              </button>
            )}
            {phase === 'scanning' && (
              <button onClick={pauseScanning}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600">
                <Pause className="h-4 w-4" /> Pause Scanning
              </button>
            )}
            {(phase === 'loading-models' || phase === 'building-descriptors') && (
              <div className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-muted text-muted-foreground rounded-lg text-sm">
                <Loader2 className="h-4 w-4 animate-spin" /> {phaseMsg}
              </div>
            )}
            {phase === 'error' && (
              <button onClick={() => setPhase('idle')}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border rounded-lg text-sm hover:bg-muted">
                Retry
              </button>
            )}
          </div>
        </div>

        {/* Roster Panel */}
        <div className="w-80 flex flex-col bg-card border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-muted/30">
            <h2 className="text-sm font-semibold">Student Roster</h2>
            <p className="text-xs text-muted-foreground">{students.length} students · {enrolledCount} face-enrolled</p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y">
            {students.map(s => (
              <div key={s.record_id}
                className={`px-4 py-3 flex items-center gap-3 transition-colors ${s.recognized ? 'bg-green-50 dark:bg-green-950/20' : ''}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.student_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.admission_number}
                    {s.recognized && s.confidence > 0 && (
                      <span className="ml-1 text-green-600">· {Math.round(s.confidence * 100)}%</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {!s.face_enrolled && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">No face</span>
                  )}
                  {s.recognized ? (
                    <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                  ) : (
                    !isLocked && (
                      <button onClick={() => handleManualMark(s)}
                        title="Manual mark present"
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground">
                        <XCircle className="h-5 w-5" />
                      </button>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="px-4 py-3 border-t text-xs text-muted-foreground bg-muted/20">
            <p>Unrecognized students can be manually marked using the ✕ button.</p>
            {phase !== 'scanning' && (
              <p className="mt-1 flex items-center gap-1 text-amber-600">
                <CameraOff className="h-3 w-3" /> Scanner is paused.
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
