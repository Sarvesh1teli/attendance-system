import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  pwaFaceRecognitionService,
  PwaMatchResult,
} from '../../services/PwaFaceRecognitionService'
import { pwaFaceSettings } from '../../services/PwaFaceSettings'
import { livenessDetector } from '../../services/LivenessDetector'
import { temporalMatcher, TemporalMatchResult } from '../../services/TemporalMatcher'
import { CachedStudent } from '../../db/pwa-db'
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  SwitchCamera,
  X,
  Volume2,
  VolumeX,
  ArrowLeft,
  Users,
} from 'lucide-react'

interface PwaFaceScannerProps {
  students: CachedStudent[]
  onRecognized: (studentId: string, confidence: number) => void
  onClose: () => void
  alreadyPresentIds: Set<string>
  onStudentEnrolled?: (studentId: string, descriptor: number[]) => void
  subjectName?: string
  batchName?: string
  presentCount?: number
  totalCount?: number
}

export function PwaFaceScanner({
  students,
  onRecognized,
  onClose,
  alreadyPresentIds,
  onStudentEnrolled,
  subjectName,
  batchName,
  presentCount,
  totalCount,
}: PwaFaceScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const animFrameIdRef = useRef<number | null>(null)

  const [loadingModels, setLoadingModels] = useState(true)
  const [modelError, setModelError] = useState<string | null>(null)
  const [cameraFacing, setCameraFacing] = useState<'user' | 'environment'>('user')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [recognizedStudents, setRecognizedStudents] = useState<
    Array<{ id: string; name: string; time: string; confidence: number }>
  >([])
  const [enrolledCount, setEnrolledCount] = useState(0)
  const [qualityBreakdown, setQualityBreakdown] = useState<{ high: number; low: number } | null>(null)
  const [statusBanner, setStatusBanner] = useState<{
    name: string
    type: 'JUST_MARKED' | 'ALREADY_MARKED' | 'NOT_RECOGNIZED' | 'NO_ENROLLMENT'
    confidence?: number
    time: number
  } | null>(null)
  const [hasActiveFace, setHasActiveFace] = useState(false)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const localMarkedRef = useRef<Set<string>>(new Set())
  const lastWarningBeepRef = useRef<number>(0)
  const unrecognizedCountRef = useRef<number>(0)

  // Initialize and unlock AudioContext immediately so browser doesn't block sound
  const initAudioContext = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume()
      }
    } catch (e) {
      console.warn('AudioContext init error:', e)
    }
  }, [])

  useEffect(() => {
    initAudioContext()
    const unlock = () => initAudioContext()
    window.addEventListener('click', unlock, { once: true })
    window.addEventListener('touchstart', unlock, { once: true })
    return () => {
      window.removeEventListener('click', unlock)
      window.removeEventListener('touchstart', unlock)
    }
  }, [initAudioContext])

  // Low rejection tone for unrecognized faces (throttled to once every 2.5s)
  const playWarningBeep = useCallback(() => {
    if (!soundEnabled) return
    const nowMs = Date.now()
    if (nowMs - lastWarningBeepRef.current < 2500) return
    lastWarningBeepRef.current = nowMs

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      // Low 2-tone warning "boop-boop": 320Hz -> 200Hz
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.setValueAtTime(200, now + 0.12)

      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.32)
    } catch (e) {
      console.warn('Warning beep could not play:', e)
    }
  }, [soundEnabled])

  // Sharp, loud, crisp scanner confirmation BEEP
  const playBeep = useCallback((variant: 'SUCCESS' | 'ALREADY' = 'SUCCESS') => {
    if (!soundEnabled) return
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioCtx) return

      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()

      if (variant === 'SUCCESS') {
        // High-energy crisp scanner confirmation beep: 1050Hz sharp pulse
        osc.type = 'sine'
        osc.frequency.setValueAtTime(1050, now)
        osc.frequency.exponentialRampToValueAtTime(1450, now + 0.07)

        gain.gain.setValueAtTime(0.75, now)
        gain.gain.setValueAtTime(0.75, now + 0.10)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.18)
      } else {
        // Double soft pip for already marked
        osc.type = 'sine'
        osc.frequency.setValueAtTime(750, now)

        gain.gain.setValueAtTime(0.4, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

        osc.connect(gain)
        gain.connect(ctx.destination)

        osc.start(now)
        osc.stop(now + 0.12)
      }
    } catch (e) {
      console.warn('Recognition beep could not play:', e)
    }
  }, [soundEnabled])

  // 1. Initialize models & build face matcher
  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        setLoadingModels(true)
        await pwaFaceRecognitionService.loadModels('/models')
        if (!isMounted) return

        const count = pwaFaceRecognitionService.buildMatcher(students, pwaFaceSettings.getMatchThreshold())
        setEnrolledCount(count)

        // Compute quality breakdown: multi-descriptor students are higher quality
        let high = 0
        let low = 0
        for (const s of students) {
          if (!s.face_descriptor) continue
          if (Array.isArray(s.face_descriptor) && s.face_descriptor.length === 128 && typeof s.face_descriptor[0] === 'number') {
            low++ // Single descriptor
          } else if (Array.isArray(s.face_descriptor) && s.face_descriptor.length > 0 && Array.isArray((s.face_descriptor as number[][])[0])) {
            high++ // Multiple descriptors
          } else {
            low++
          }
        }
        setQualityBreakdown({ high, low })
        setLoadingModels(false)
      } catch (err) {
        if (!isMounted) return
        console.error('Failed to initialize face models:', err)
        setModelError(
          err instanceof Error
            ? err.message
            : 'Could not load face recognition models. Please check network/cache.'
        )
        setLoadingModels(false)
      }
    }

    init()

    return () => {
      isMounted = false
    }
  }, [students])

  // 2. Start webcam stream
  useEffect(() => {
    let stream: MediaStream | null = null

    async function startCamera() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: cameraFacing,
            width: { ideal: 640 },
            height: { ideal: 480 },
          },
          audio: false,
        })

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
        }
      } catch (err) {
        console.error('Camera access failed:', err)
        setModelError(
          'Could not access camera. Please ensure camera permissions are allowed.'
        )
      }
    }

    if (!loadingModels && !modelError) {
      startCamera()
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [loadingModels, modelError, cameraFacing])

  // 3. Live Recognition Loop with Temporal Smoothing (single inference pass)
  useEffect(() => {
    if (loadingModels || modelError) return

    let isScanning = true
    let lastDetectionTime = 0
    let activeBox: { box: { x: number; y: number; width: number; height: number }; match: PwaMatchResult; time: number } | null = null

    livenessDetector.reset()
    temporalMatcher.reset()

    const runRecognitionLoop = async () => {
      if (!isScanning) return

      const now = Date.now()
      if (
        now - lastDetectionTime > 120 &&
        videoRef.current &&
        videoRef.current.readyState === 4 &&
        !videoRef.current.paused
      ) {
        lastDetectionTime = now

        try {
          const match: PwaMatchResult | null =
            await pwaFaceRecognitionService.detectAndMatch(videoRef.current, pwaFaceSettings.getMatchThreshold())

          if (match && match.box) {
            activeBox = { box: match.box, match, time: now }
            setHasActiveFace(true)
          } else if (activeBox && now - activeBox.time > 600) {
            activeBox = null
            setHasActiveFace(false)
            unrecognizedCountRef.current = 0
          }

          // --- Temporal Smoothing (always fed when there is a match) ----------
          let temporalResult: TemporalMatchResult | null = null
          if (match && match.matched && match.studentId) {
            temporalResult = temporalMatcher.processFrame({
              matched: true,
              studentId: match.studentId,
              studentName: match.studentName,
              confidence: match.confidence,
              box: match.box,
            })
          } else {
            temporalMatcher.processFrame(null)
          }

          // --- Non-blocking Liveness (reuses the SAME detection pass) ---------
          // Reports blink/motion status for the UI hint. It does NOT gate the
          // marking — a student sitting still will still be marked via temporal
          // smoothing, while liveness is captured opportunistically.
          if (pwaFaceSettings.isLivenessEnabled() && match && match.rawDetection) {
            livenessDetector.processFrame(
              match.rawDetection as never,
              videoRef.current!.videoWidth || 640,
              videoRef.current!.videoHeight || 480
            )
          }

          // --- Canvas Drawing -------------------------------------------------
          const canvas = canvasRef.current
          const video = videoRef.current

          if (canvas && video) {
            canvas.width = video.videoWidth || 640
            canvas.height = video.videoHeight || 480
            const ctx = canvas.getContext('2d')

            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)

              if (activeBox) {
                const currentMatch = activeBox.match
                const { x, y, width, height } = activeBox.box
                // Mirror horizontally on front camera without mirroring text
                const drawX = cameraFacing === 'user' ? Math.max(0, canvas.width - x - width) : x

                if (currentMatch.noEnrollment) {
                  ctx.strokeStyle = '#f59e0b'
                  ctx.lineWidth = 3
                  ctx.setLineDash([6, 3])
                  ctx.strokeRect(drawX, y, width, height)
                  ctx.setLineDash([])

                  ctx.fillStyle = '#f59e0b'
                  const label = '⚠️ Face Detected (0 Enrolled in Batch)'
                  ctx.font = 'bold 14px sans-serif'
                  const textWidth = ctx.measureText(label).width
                  ctx.fillRect(drawX, Math.max(0, y - 28), textWidth + 16, 28)

                  ctx.fillStyle = '#ffffff'
                  ctx.fillText(label, drawX + 8, Math.max(20, y - 9))

                  setStatusBanner({
                    name: 'Class Has 0 Enrolled Faces',
                    type: 'NO_ENROLLMENT',
                    time: Date.now(),
                  })
                } else if (currentMatch.matched && currentMatch.studentId && currentMatch.studentName) {
                  unrecognizedCountRef.current = 0
                  const isAlreadyPresent =
                    alreadyPresentIds.has(currentMatch.studentId) ||
                    localMarkedRef.current.has(currentMatch.studentId)

                  const isConfirmed = temporalResult?.confirmed ?? false
                  const themeColor = isAlreadyPresent ? '#2563eb' : isConfirmed ? '#10b981' : '#f59e0b'

                  // Draw bounding box
                  ctx.strokeStyle = themeColor
                  ctx.lineWidth = isConfirmed ? 4 : 3
                  if (!isConfirmed) ctx.setLineDash([6, 3])
                  ctx.strokeRect(drawX, y, width, height)
                  ctx.setLineDash([])

                  // Draw label background
                  ctx.fillStyle = themeColor
                  const sightingsText = temporalResult
                    ? ` (${temporalResult.sightings}/${temporalResult.requiredSightings})`
                    : ''
                  const label = isAlreadyPresent
                    ? `✓ ${currentMatch.studentName} (Present)`
                    : isConfirmed
                    ? `✓ ${currentMatch.studentName} (${Math.round(currentMatch.confidence * 100)}%)`
                    : `⏳ ${currentMatch.studentName}...${sightingsText}`
                  ctx.font = 'bold 15px sans-serif'
                  const textWidth = ctx.measureText(label).width
                  ctx.fillRect(drawX, Math.max(0, y - 30), textWidth + 18, 30)

                  // Draw label text
                  ctx.fillStyle = '#ffffff'
                  ctx.fillText(label, drawX + 8, Math.max(20, y - 9))

                  // Mark ONLY when confirmed by temporal smoothing
                  if (isAlreadyPresent) {
                    playBeep('ALREADY')
                    setStatusBanner({
                      name: currentMatch.studentName,
                      type: 'ALREADY_MARKED',
                      time: Date.now(),
                    })
                  } else if (isConfirmed && !localMarkedRef.current.has(currentMatch.studentId)) {
                    localMarkedRef.current.add(currentMatch.studentId)
                    temporalMatcher.clearStudent(currentMatch.studentId)
                    playBeep('SUCCESS')
                    onRecognized(currentMatch.studentId, currentMatch.confidence)

                    setStatusBanner({
                      name: currentMatch.studentName,
                      type: 'JUST_MARKED',
                      confidence: Math.round(currentMatch.confidence * 100),
                      time: Date.now(),
                    })

                    // Add to recent feed ONLY on actual confirmation/mark
                    setRecognizedStudents((prev) => {
                      const filtered = prev.filter((p) => p.id !== currentMatch.studentId)
                      return [
                        {
                          id: currentMatch.studentId!,
                          name: currentMatch.studentName!,
                          time: new Date().toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          }),
                          confidence: Math.round(currentMatch.confidence * 100),
                        },
                        ...filtered.slice(0, 4),
                      ]
                    })
                  }
                } else {
                  // Face detected but not matched in current frame
                  unrecognizedCountRef.current++

                  if (unrecognizedCountRef.current < 3) {
                    // Frame 1-2: Camera focusing / student moving into frame - show cyan analyzing box
                    ctx.strokeStyle = '#0284c7'
                    ctx.lineWidth = 3
                    ctx.setLineDash([6, 3])
                    ctx.strokeRect(drawX, y, width, height)
                    ctx.setLineDash([])

                    ctx.fillStyle = '#0284c7'
                    const label = '🔍 Identifying...'
                    ctx.font = 'bold 14px sans-serif'
                    const textWidth = ctx.measureText(label).width
                    ctx.fillRect(drawX, Math.max(0, y - 28), textWidth + 16, 28)

                    ctx.fillStyle = '#ffffff'
                    ctx.fillText(label, drawX + 8, Math.max(20, y - 9))
                  } else {
                    // Persistent unrecognized face (after 3 consecutive attempts)
                    ctx.strokeStyle = '#ef4444'
                    ctx.lineWidth = 4
                    ctx.setLineDash([8, 4])
                    ctx.strokeRect(drawX, y, width, height)
                    ctx.setLineDash([])

                    ctx.fillStyle = '#ef4444'
                    const label = '❌ Face Not Recognized'
                    ctx.font = 'bold 15px sans-serif'
                    const textWidth = ctx.measureText(label).width
                    ctx.fillRect(drawX, Math.max(0, y - 30), textWidth + 18, 30)

                    ctx.fillStyle = '#ffffff'
                    ctx.fillText(label, drawX + 8, Math.max(20, y - 9))

                    playWarningBeep()

                    setStatusBanner({
                      name: 'Unknown',
                      type: 'NOT_RECOGNIZED',
                      time: Date.now(),
                    })
                  }
                }
              }
            }
          }
        } catch (err) {
          console.warn('[FaceScanner] Frame match error:', err)
        }
      }

      if (isScanning) {
        animFrameIdRef.current = requestAnimationFrame(runRecognitionLoop)
      }
    }

    animFrameIdRef.current = requestAnimationFrame(runRecognitionLoop)

    return () => {
      isScanning = false
      livenessDetector.reset()
      temporalMatcher.reset()
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current)
      }
    }
  }, [loadingModels, modelError, alreadyPresentIds, onRecognized, playBeep, playWarningBeep])

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col overflow-hidden animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="bg-slate-900/95 backdrop-blur border-b border-white/10 px-4 py-3 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-all border border-white/10 active:scale-95"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to List</span>
          </button>
          <div>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">Live Face Scanner</h2>
              {enrolledCount === 0 ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                  ⚠️ 0 enrolled
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-500/30">
                  {enrolledCount} enrolled
                  {qualityBreakdown && qualityBreakdown.high > 0 && (
                    <span className="text-emerald-300 ml-1">({qualityBreakdown.high} multi-angle)</span>
                  )}
                </span>
              )}
            </div>
            {(batchName || subjectName) && (
              <p className="text-[11px] text-white/60 font-medium truncate max-w-[200px] sm:max-w-md mt-0.5">
                {batchName} {subjectName ? `· ${subjectName}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Live Attendance Stats */}
          {presentCount !== undefined && totalCount !== undefined && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
              <Users className="h-3.5 w-3.5" />
              <span>Present: {presentCount} / {totalCount}</span>
            </div>
          )}

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Beep sound ON (Tap to mute)' : 'Beep sound MUTED (Tap to unmute)'}
            className={`p-2 rounded-xl border transition-all ${
              soundEnabled
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/10 border-white/10 text-white/40'
            }`}
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          {/* Flip Camera */}
          <button
            onClick={() => setCameraFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            title="Switch Camera (Front / Back)"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-white transition-all"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>

          {/* Close button */}
          <button
            onClick={onClose}
            title="Close scanner"
            className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 transition-all"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Main Big Camera Viewport */}
      <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
        {/* Loading state */}
        {loadingModels && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30 bg-slate-950">
            <RefreshCw className="h-10 w-10 text-blue-400 animate-spin" />
            <h3 className="text-base font-bold text-white">Starting Face Recognition Engine...</h3>
            <p className="text-xs text-white/60 max-w-sm">
              Loading local biometric models. Stand by...
            </p>
          </div>
        )}

        {/* Error state */}
        {modelError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center space-y-3 z-30 bg-slate-950">
            <AlertCircle className="h-10 w-10 text-rose-500" />
            <h3 className="text-base font-bold text-white">Camera or Neural Net Error</h3>
            <p className="text-xs text-rose-300 max-w-sm">{modelError}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-3 px-4 py-2 bg-white/10 border border-white/20 rounded-xl text-xs font-semibold text-white hover:bg-white/20"
            >
              Reload App
            </button>
          </div>
        )}

        {/* Video stream and overlay */}
        {!loadingModels && !modelError && (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className={`w-full h-full object-contain md:object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 w-full h-full pointer-events-none"
            />

              {/* Viewfinder Reticle Guide - seamlessly fades out when face is detected to eliminate double-box clutter */}
              <div className={`absolute inset-0 pointer-events-none flex items-center justify-center transition-all duration-300 ${hasActiveFace ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}>
                <div className="w-64 h-64 sm:w-80 sm:h-80 border-2 border-white/20 rounded-3xl relative">
                  {/* 4 Corner Brackets */}
                  <div className="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-blue-400 rounded-tl-xl" />
                  <div className="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-blue-400 rounded-tr-xl" />
                  <div className="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-blue-400 rounded-bl-xl" />
                  <div className="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-blue-400 rounded-br-xl" />

                  {/* Subtle animated scanning pulse bar */}
                  <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent opacity-60 animate-pulse absolute top-1/2 -translate-y-1/2" />
                </div>
              </div>

              {/* Liveness Status Indicator */}
              {pwaFaceSettings.isLivenessEnabled() && (
                <div className="absolute bottom-14 left-3 bg-black/60 backdrop-blur-sm text-white/80 px-2.5 py-1 rounded-lg text-[10px] font-mono border border-white/10 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Liveness: Blink or move to confirm
                </div>
              )}

            {/* Live Status Overlay Banner */}
            {statusBanner && Date.now() - statusBanner.time < 3500 ? (
              <div
                className={`absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-3 backdrop-blur-xl border transition-all duration-200 z-30 ${
                  statusBanner.type === 'JUST_MARKED'
                    ? 'bg-emerald-600/95 text-white border-emerald-400/50 ring-4 ring-emerald-500/30 scale-105'
                    : statusBanner.type === 'ALREADY_MARKED'
                    ? 'bg-blue-600/95 text-white border-blue-400/50 ring-4 ring-blue-500/30'
                    : statusBanner.type === 'NO_ENROLLMENT'
                    ? 'bg-amber-600/95 text-white border-amber-400/50 ring-4 ring-amber-500/30'
                    : 'bg-rose-600/95 text-white border-rose-400/50 ring-4 ring-rose-500/30 animate-pulse'
                }`}
              >
                {statusBanner.type === 'NOT_RECOGNIZED' || statusBanner.type === 'NO_ENROLLMENT' ? (
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-white" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-white" />
                )}
                <span>
                  {statusBanner.type === 'JUST_MARKED'
                    ? `✓ ${statusBanner.name} — Marked Present! (${statusBanner.confidence}%)`
                    : statusBanner.type === 'ALREADY_MARKED'
                    ? `${statusBanner.name} — Already Marked`
                    : statusBanner.type === 'NO_ENROLLMENT'
                    ? 'Face Detected — 0 Students Enrolled in Class'
                    : 'Face Not Recognized — No Student Match'}
                </span>
              </div>
            ) : (
              <div className="absolute top-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md text-white/90 px-4 py-1.5 rounded-full text-xs font-medium tracking-wide border border-white/10 z-20">
                Align face inside viewfinder to scan
              </div>
            )}

            {/* Privacy Badge */}
            <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur-sm text-white/80 px-2.5 py-1 rounded-lg text-[10px] font-mono border border-white/10">
              🔒 Local Biometric Engine (No Cloud Photo Sent)
            </div>
          </>
        )}
      </div>

      {/* Bottom Tray & Recognized Students Feed */}
      <div className="bg-slate-900/95 backdrop-blur border-t border-white/10 px-4 py-3 space-y-3 z-20 shrink-0">
        {/* Recent Recognitions Feed */}
        {recognizedStudents.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-white/60 uppercase tracking-wider">
              <span>Just Marked Present</span>
              <span>{recognizedStudents.length} recent</span>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {recognizedStudents.map((s, idx) => (
                <div
                  key={`${s.id}-${idx}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shrink-0 animate-in fade-in"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span>{s.name}</span>
                  <span className="text-[10px] text-emerald-400/70 font-mono">({s.confidence}%)</span>
                  <span className="text-[10px] text-white/40 font-mono">{s.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Done / Return to Attendance button */}
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Done · Return to Attendance List</span>
          </button>
        </div>
      </div>
    </div>
  )
}
