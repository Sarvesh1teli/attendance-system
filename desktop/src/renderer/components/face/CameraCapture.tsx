import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { faceRecognitionService } from '../../services/FaceRecognitionService'
import * as faceapi from '@vladmandic/face-api'

export type SampleType = 'FRONT' | 'LEFT' | 'RIGHT'

export interface QualityScore {
  score: number        // 0-100
  label: 'GOOD' | 'FAIR' | 'POOR'
  issues: string[]
}

interface Props {
  entityName: string
  currentStep: SampleType
  onCapture: (sampleType: SampleType, imageBase64: string, descriptorJson?: string | null, quality?: QualityScore) => Promise<void>
  disabled?: boolean
}

export function CameraCapture({ entityName, currentStep, onCapture, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)
  const [lastQuality, setLastQuality] = useState<QualityScore | null>(null)

  function computeQuality(
    canvas: HTMLCanvasElement,
    faceBox: { x: number; y: number; width: number; height: number } | null
  ): QualityScore {
    const issues: string[] = []
    let score = 100

    // 1. Face size check: face should be at least 20% of frame height
    if (faceBox) {
      const faceRatio = faceBox.height / canvas.height
      if (faceRatio < 0.20) {
        score -= 30
        issues.push('Face too small — move closer')
      } else if (faceRatio < 0.30) {
        score -= 10
        issues.push('Face could be larger')
      }

      // Face should be roughly centered (within 30% of center)
      const centerX = canvas.width / 2
      const faceCenterX = faceBox.x + faceBox.width / 2
      const offsetRatio = Math.abs(faceCenterX - centerX) / canvas.width
      if (offsetRatio > 0.30) {
        score -= 15
        issues.push('Face not centered')
      }
    }

    // 2. Brightness check via grayscale mean of center region
    const ctx = canvas.getContext('2d')
    if (ctx) {
      const cx = Math.floor(canvas.width * 0.3)
      const cy = Math.floor(canvas.height * 0.2)
      const cw = Math.floor(canvas.width * 0.4)
      const ch = Math.floor(canvas.height * 0.6)
      try {
        const imageData = ctx.getImageData(cx, cy, cw, ch)
        const data = imageData.data
        let totalBrightness = 0
        const pixelCount = data.length / 4
        for (let i = 0; i < data.length; i += 4) {
          totalBrightness += (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114)
        }
        const avgBrightness = totalBrightness / pixelCount

        if (avgBrightness < 40) {
          score -= 30
          issues.push('Too dark — increase lighting')
        } else if (avgBrightness < 70) {
          score -= 10
          issues.push('Slightly dark')
        } else if (avgBrightness > 220) {
          score -= 25
          issues.push('Too bright — reduce lighting')
        }

        // 3. Sharpness via Laplacian variance
        let laplacianSum = 0
        let laplacianCount = 0
        for (let y = 1; y < ch - 1; y++) {
          for (let x = 1; x < cw - 1; x++) {
            const idx = (y * cw + x) * 4
            const center = data[idx]
            const top = data[((y - 1) * cw + x) * 4]
            const bottom = data[((y + 1) * cw + x) * 4]
            const left = data[(y * cw + (x - 1)) * 4]
            const right = data[(y * cw + (x + 1)) * 4]
            const laplacian = Math.abs(-4 * center + top + bottom + left + right)
            laplacianSum += laplacian
            laplacianCount++
          }
        }
        const sharpness = laplacianCount > 0 ? laplacianSum / laplacianCount : 0

        if (sharpness < 10) {
          score -= 30
          issues.push('Image blurry — hold steady')
        } else if (sharpness < 20) {
          score -= 10
          issues.push('Slightly blurry')
        }
      } catch {
        // Canvas tainted or unavailable — skip pixel analysis
      }
    }

    const clampedScore = Math.max(0, Math.min(100, score))
    const label: QualityScore['label'] = clampedScore >= 70 ? 'GOOD' : clampedScore >= 40 ? 'FAIR' : 'POOR'

    return { score: clampedScore, label, issues }
  }

  useEffect(() => {
    let activeStream: MediaStream | null = null

    async function startCamera() {
      setCameraError(null)
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        })
        activeStream = s
        setStream(s)
        if (videoRef.current) {
          videoRef.current.srcObject = s
        }
      } catch (err) {
        console.error('Camera access error:', err)
        setCameraError(
          err instanceof Error
            ? err.message
            : 'Could not access camera. Please verify camera permissions.'
        )
      }
    }

    startCamera()

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const takeSnapshot = async () => {
    if (!videoRef.current || capturing) return

    setCapturing(true)
    try {
      const video = videoRef.current
      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth || 640
      canvas.height = video.videoHeight || 480

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      // Extract pure base64 without prefix
      const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '')

      // Directly extract face descriptor using faceapi on live video element
      let descriptorJson: string | null = null
      let faceBox: { x: number; y: number; width: number; height: number } | null = null
      try {
        await faceRecognitionService.loadModels()
        const det = await faceapi
          .detectSingleFace(
            video,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.25 })
          )
          .withFaceLandmarks(true)
          .withFaceDescriptor()
        if (det) {
          descriptorJson = JSON.stringify(Array.from(det.descriptor))
          faceBox = { x: det.detection.box.x, y: det.detection.box.y, width: det.detection.box.width, height: det.detection.box.height }
        }
      } catch (e) {
        console.warn('[FaceEnrollment] Live face extraction from camera failed:', e)
      }

      // Compute image quality score
      const quality = computeQuality(canvas, faceBox)
      setLastQuality(quality)

      setCapturedPreview(dataUrl)
      await onCapture(currentStep, base64, descriptorJson, quality)
      setCapturedPreview(null)
    } catch (err) {
      console.error('Snapshot capture error:', err)
    } finally {
      setCapturing(false)
    }
  }

  const stepInstructions: Record<SampleType, { title: string; instruction: string }> = {
    FRONT: {
      title: '1. Front View',
      instruction: 'Look straight into the camera with a neutral expression.',
    },
    LEFT: {
      title: '2. Left Angle',
      instruction: 'Turn your head slightly to the left (~15-20 degrees).',
    },
    RIGHT: {
      title: '3. Right Angle',
      instruction: 'Turn your head slightly to the right (~15-20 degrees).',
    },
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Current Step Instruction */}
      <div className="w-full bg-primary/10 border border-primary/20 rounded-xl p-3.5 text-center">
        <h4 className="font-semibold text-primary text-sm">{stepInstructions[currentStep].title}</h4>
        <p className="text-xs text-muted-foreground mt-0.5">
          {stepInstructions[currentStep].instruction}
        </p>
      </div>

      {/* Video Viewport with Oval Guide */}
      <div className="relative w-[480px] h-[360px] bg-black rounded-2xl overflow-hidden shadow-xl border-2 border-border flex items-center justify-center">
        {cameraError ? (
          <div className="p-6 text-center text-red-400 space-y-2">
            <AlertCircle className="h-8 w-8 mx-auto text-red-400" />
            <p className="text-sm font-medium">Camera Unavailable</p>
            <p className="text-xs text-slate-400">{cameraError}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {/* Oval Face Guide Overlay */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-48 h-64 border-2 border-dashed border-white/60 rounded-[50%] shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>

            {/* Entity Badge */}
            <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-full text-xs text-white font-medium">
              {entityName}
            </div>

            {/* Live Indicator */}
            <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-red-500/80 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[10px] text-white font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              Live
            </div>
          </>
        )}
      </div>

      {/* Capture Button */}
      <button
        onClick={takeSnapshot}
        disabled={!!cameraError || capturing || disabled}
        className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-3 rounded-full shadow-lg shadow-primary/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {capturing ? (
          <>
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span>Saving Sample...</span>
          </>
        ) : (
          <>
            <Camera className="h-4 w-4" />
            <span>Capture {currentStep} Photo</span>
          </>
        )}
      </button>

      {/* Last Capture Quality Badge */}
      {lastQuality && (
        <div className={`w-full text-center px-4 py-2.5 rounded-xl border text-xs font-semibold ${
          lastQuality.label === 'GOOD'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
            : lastQuality.label === 'FAIR'
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-600'
            : 'bg-red-500/10 border-red-500/30 text-red-600'
        }`}>
          <div className="flex items-center justify-center gap-2">
            <span>{lastQuality.label}</span>
            <span className="font-mono">({lastQuality.score}/100)</span>
          </div>
          {lastQuality.issues.length > 0 && (
            <p className="mt-1 text-[11px] font-normal opacity-80">
              {lastQuality.issues.join(' · ')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
