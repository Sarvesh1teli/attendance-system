import { useEffect, useRef, useState } from 'react'
import { Camera, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react'
import { faceRecognitionService } from '../../services/FaceRecognitionService'
import * as faceapi from '@vladmandic/face-api'

export type SampleType = 'FRONT' | 'LEFT' | 'RIGHT'

interface Props {
  entityName: string
  currentStep: SampleType
  onCapture: (sampleType: SampleType, imageBase64: string, descriptorJson?: string | null) => Promise<void>
  disabled?: boolean
}

export function CameraCapture({ entityName, currentStep, onCapture, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null)

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
        }
      } catch (e) {
        console.warn('Live face extraction from camera failed:', e)
      }

      setCapturedPreview(dataUrl)
      await onCapture(currentStep, base64, descriptorJson)
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
    </div>
  )
}
