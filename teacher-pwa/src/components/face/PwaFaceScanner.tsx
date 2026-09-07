import React, { useRef, useEffect, useState, useCallback } from 'react'
import {
  pwaFaceRecognitionService,
  PwaMatchResult,
} from '../../services/PwaFaceRecognitionService'
import { CachedStudent, db } from '../../db/pwa-db'
import * as faceapi from '@vladmandic/face-api'
import {
  Camera,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  SwitchCamera,
  X,
  Volume2,
  VolumeX,
} from 'lucide-react'

interface PwaFaceScannerProps {
  students: CachedStudent[]
  onRecognized: (studentId: string, confidence: number) => void
  onClose: () => void
  alreadyPresentIds: Set<string>
  onStudentEnrolled?: (studentId: string, descriptor: number[]) => void
}

export function PwaFaceScanner({
  students,
  onRecognized,
  onClose,
  alreadyPresentIds,
  onStudentEnrolled,
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
  const [statusBanner, setStatusBanner] = useState<{
    name: string
    type: 'JUST_MARKED' | 'ALREADY_MARKED' | 'NOT_RECOGNIZED' | 'NO_ENROLLMENT'
    confidence?: number
    time: number
  } | null>(null)

  const audioCtxRef = useRef<AudioContext | null>(null)
  const localMarkedRef = useRef<Set<string>>(new Set())
  const lastWarningBeepRef = useRef<number>(0)

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

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.32)
    } catch (e) {
      console.warn('Warning beep could not play:', e)
    }
  }, [soundEnabled])

  // Web Audio chime: Plays a clear ascending 2-tone ding-dong chime on recognition
  const playBeep = useCallback(() => {
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

      // High-clarity ascending chime: E5 (659.25Hz) -> A5 (880Hz)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(659.25, now)
      osc.frequency.setValueAtTime(880.0, now + 0.1)

      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)

      osc.connect(gain)
      gain.connect(ctx.destination)

      osc.start(now)
      osc.stop(now + 0.35)
    } catch (e) {
      console.warn('Recognition chime could not play:', e)
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

        const count = pwaFaceRecognitionService.buildMatcher(students, 0.40)
        setEnrolledCount(count)
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

  // 3. Live Recognition Loop
  useEffect(() => {
    if (loadingModels || modelError) return

    let isScanning = true
    let lastDetectionTime = 0

    const runRecognitionLoop = async () => {
      if (!isScanning) return

      const now = Date.now()
      // Run detection every 120ms for instant, fluid responsiveness
      if (
        now - lastDetectionTime > 120 &&
        videoRef.current &&
        videoRef.current.readyState === 4 &&
        !videoRef.current.paused
      ) {
        lastDetectionTime = now

        try {
          const match: PwaMatchResult | null =
            await pwaFaceRecognitionService.detectAndMatch(videoRef.current, 0.40)

          const canvas = canvasRef.current
          const video = videoRef.current

          if (canvas && video) {
            canvas.width = video.videoWidth || 640
            canvas.height = video.videoHeight || 480
            const ctx = canvas.getContext('2d')

            if (ctx) {
              ctx.clearRect(0, 0, canvas.width, canvas.height)

              if (match) {
                const { x, y, width, height } = match.box

                if (match.noEnrollment) {
                  // Face physically detected in camera, but this class has 0 enrolled face templates!
                  ctx.strokeStyle = '#f59e0b'
                  ctx.lineWidth = 3
                  ctx.setLineDash([6, 3])
                  ctx.strokeRect(x, y, width, height)
                  ctx.setLineDash([])

                  ctx.fillStyle = '#f59e0b'
                  const label = '⚠️ Face Detected (0 Enrolled in Batch)'
                  ctx.font = 'bold 14px sans-serif'
                  const textWidth = ctx.measureText(label).width
                  ctx.fillRect(x, Math.max(0, y - 28), textWidth + 16, 28)

                  ctx.fillStyle = '#ffffff'
                  ctx.fillText(label, x + 8, Math.max(20, y - 9))

                  setStatusBanner({
                    name: 'Class Has 0 Enrolled Faces',
                    type: 'NO_ENROLLMENT',
                    time: Date.now(),
                  })
                } else if (match.matched && match.studentId && match.studentName) {
                  const isAlreadyPresent =
                    alreadyPresentIds.has(match.studentId) ||
                    localMarkedRef.current.has(match.studentId)

                  // Color: Royal Blue for already marked, Emerald for fresh recognition
                  const themeColor = isAlreadyPresent ? '#2563eb' : '#10b981'

                  // Draw bounding box
                  ctx.strokeStyle = themeColor
                  ctx.lineWidth = 4
                  ctx.strokeRect(x, y, width, height)

                  // Draw label background
                  ctx.fillStyle = themeColor
                  const label = isAlreadyPresent
                    ? `✓ ${match.studentName} — Already Marked`
                    : `✓ ${match.studentName} (${Math.round(match.confidence * 100)}%)`
                  ctx.font = 'bold 15px sans-serif'
                  const textWidth = ctx.measureText(label).width
                  ctx.fillRect(x, Math.max(0, y - 30), textWidth + 18, 30)

                  // Draw label text
                  ctx.fillStyle = '#ffffff'
                  ctx.fillText(label, x + 8, Math.max(20, y - 9))

                  if (isAlreadyPresent) {
                    setStatusBanner({
                      name: match.studentName,
                      type: 'ALREADY_MARKED',
                      time: Date.now(),
                    })
                  } else {
                    localMarkedRef.current.add(match.studentId)
                    playBeep()
                    onRecognized(match.studentId, match.confidence)

                    setStatusBanner({
                      name: match.studentName,
                      type: 'JUST_MARKED',
                      confidence: Math.round(match.confidence * 100),
                      time: Date.now(),
                    })

                    setRecognizedStudents((prev) => [
                      {
                        id: match.studentId!,
                        name: match.studentName!,
                        time: new Date().toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        }),
                        confidence: Math.round(match.confidence * 100),
                      },
                      ...prev.slice(0, 4),
                    ])
                  }
                } else {
                  // Face detected in camera, but NOT recognized (no match or distance > 0.40)
                  ctx.strokeStyle = '#ef4444'
                  ctx.lineWidth = 4
                  ctx.setLineDash([8, 4])
                  ctx.strokeRect(x, y, width, height)
                  ctx.setLineDash([])

                  ctx.fillStyle = '#ef4444'
                  const label = '❌ Face Not Recognized'
                  ctx.font = 'bold 15px sans-serif'
                  const textWidth = ctx.measureText(label).width
                  ctx.fillRect(x, Math.max(0, y - 30), textWidth + 18, 30)

                  ctx.fillStyle = '#ffffff'
                  ctx.fillText(label, x + 8, Math.max(20, y - 9))

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
        } catch {
          // Frame match skipped
        }
      }

      if (isScanning) {
        animFrameIdRef.current = requestAnimationFrame(runRecognitionLoop)
      }
    }

    animFrameIdRef.current = requestAnimationFrame(runRecognitionLoop)

    return () => {
      isScanning = false
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current)
      }
    }
  }, [loadingModels, modelError, alreadyPresentIds, onRecognized, playBeep, playWarningBeep])

  return (
    <div className="bg-card border rounded-2xl p-4 shadow-md space-y-3">
      {/* Header controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
          <h3 className="text-sm font-bold text-foreground">Live Face Scanner</h3>
          {enrolledCount === 0 ? (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold border border-amber-500/30">
              ⚠️ 0 enrolled
            </span>
          ) : (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
              {enrolledCount} enrolled
            </span>
          )}
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
            Strict (0.40)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSoundEnabled((v) => !v)}
            title={soundEnabled ? 'Mute sound' : 'Unmute sound'}
            className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4 text-rose-500" />}
          </button>
          <button
            onClick={() => setCameraFacing((f) => (f === 'user' ? 'environment' : 'user'))}
            title="Switch camera"
            className="p-1.5 rounded-lg border text-muted-foreground hover:bg-muted"
          >
            <SwitchCamera className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            title="Close camera"
            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600 hover:bg-rose-500/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Loading state */}
      {loadingModels && (
        <div className="h-64 rounded-xl bg-muted/40 border border-dashed flex flex-col items-center justify-center p-4 text-center space-y-2">
          <RefreshCw className="h-8 w-8 text-primary animate-spin" />
          <p className="text-xs font-semibold text-foreground">Loading Face Recognition Neural Nets...</p>
          <p className="text-[10px] text-muted-foreground">Weights are cached locally in your browser after first load.</p>
        </div>
      )}

      {/* Error state */}
      {modelError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <AlertCircle className="h-4 w-4" />
            <span>Face Recognition Error</span>
          </div>
          <p>{modelError}</p>
        </div>
      )}

      {/* Camera preview with overlay canvas */}
      {!loadingModels && !modelError && (
        <div className="relative rounded-xl overflow-hidden bg-black aspect-[4/3] w-full max-h-80 shadow-inner">
          <video
            ref={videoRef}
            playsInline
            muted
            className={`w-full h-full object-cover ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
          />
          <canvas
            ref={canvasRef}
            className={`absolute inset-0 w-full h-full pointer-events-none ${cameraFacing === 'user' ? '-scale-x-100' : ''}`}
          />

          {/* Live Status Overlay Banner */}
          {statusBanner && Date.now() - statusBanner.time < 3500 ? (
            <div
              className={`absolute top-2.5 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full text-xs font-bold shadow-xl flex items-center gap-2 backdrop-blur-md transition-all duration-200 z-10 ${
                statusBanner.type === 'JUST_MARKED'
                  ? 'bg-emerald-600/95 text-white border border-emerald-300/40 ring-4 ring-emerald-500/25'
                  : statusBanner.type === 'ALREADY_MARKED'
                  ? 'bg-blue-600/95 text-white border border-blue-300/40 ring-4 ring-blue-500/25'
                  : statusBanner.type === 'NO_ENROLLMENT'
                  ? 'bg-amber-600/95 text-white border border-amber-300/40 ring-4 ring-amber-500/25'
                  : 'bg-rose-600/95 text-white border border-rose-300/40 ring-4 ring-rose-500/25 animate-pulse'
              }`}
            >
              {statusBanner.type === 'NOT_RECOGNIZED' || statusBanner.type === 'NO_ENROLLMENT' ? (
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-white" />
              ) : (
                <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-white" />
              )}
              <span>
                {statusBanner.type === 'JUST_MARKED'
                  ? `${statusBanner.name} — Marked Present! (${statusBanner.confidence}%)`
                  : statusBanner.type === 'ALREADY_MARKED'
                  ? `${statusBanner.name} — Already Marked`
                  : statusBanner.type === 'NO_ENROLLMENT'
                  ? 'Face Detected — 0 Students Enrolled in Class'
                  : 'Face Not Recognized — No Student Match'}
              </span>
            </div>
          ) : (
            <div className="absolute top-2.5 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white px-3.5 py-1 rounded-full text-[10px] font-medium tracking-wide">
              Look directly at camera to scan
            </div>
          )}

          {/* Zero Cloud Photo Badge */}
          <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm text-white/80 px-2 py-0.5 rounded text-[9px] font-mono">
            🔒 Local WebGL Matching
          </div>
        </div>
      )}

      {/* Recent Recognitions Feed */}
      {recognizedStudents.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
            Just Marked Present
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recognizedStudents.map((s, idx) => (
              <span
                key={`${s.id}-${idx}`}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 text-emerald-700 border border-emerald-500/30"
              >
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                <span>{s.name}</span>
                <span className="text-[10px] opacity-70 font-mono">({s.confidence}%)</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
