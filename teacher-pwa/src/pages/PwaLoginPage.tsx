import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePwaAuth } from '../context/PwaAuthContext'
import { pwaFaceRecognitionService } from '../services/PwaFaceRecognitionService'
import { GraduationCap, Lock, User, Building2, Camera, X, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

export default function PwaLoginPage() {
  const navigate = useNavigate()
  const { login, faceLogin } = usePwaAuth()

  const [institutionId, setInstitutionId] = useState(() => localStorage.getItem('pwa_institute_id') || '')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Face Login Modal State
  const [isFaceModalOpen, setIsFaceModalOpen] = useState(false)
  const [faceStatus, setFaceStatus] = useState<'INITIALIZING' | 'READY_TO_SCAN' | 'DETECTING' | 'VERIFYING' | 'SUCCESS' | 'ERROR'>('INITIALIZING')
  const [faceMessage, setFaceMessage] = useState('Initializing AI face recognition...')
  const [recognizedName, setRecognizedName] = useState<string | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const scanIntervalRef = useRef<number | null>(null)
  const isVerifyingRef = useRef(false)

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const res = await login(username, password, institutionId)
      if (res.success) {
        navigate('/schedule')
      } else {
        setError(res.error || 'Login failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setLoading(false)
    }
  }

  // Stop camera stream safely
  const stopCamera = useCallback(() => {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    isVerifyingRef.current = false
  }, [])

  // Start face login scanner
  const startFaceLogin = async () => {
    setIsFaceModalOpen(true)
    setFaceStatus('INITIALIZING')
    setFaceMessage('Loading biometric neural networks...')
    setError(null)
    isVerifyingRef.current = false

    try {
      // 1. Load Face-API models
      await pwaFaceRecognitionService.loadModels()

      // 2. Request user camera
      setFaceMessage('Accessing front camera...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setFaceStatus('READY_TO_SCAN')
      setFaceMessage('Looking for face... Please look directly at the camera.')

      // 3. Scan loop
      scanIntervalRef.current = window.setInterval(async () => {
        if (isVerifyingRef.current || !videoRef.current || videoRef.current.paused || videoRef.current.ended) {
          return
        }

        try {
          const descriptor = await pwaFaceRecognitionService.extractDescriptor(videoRef.current)
          if (descriptor && descriptor.length >= 128) {
            isVerifyingRef.current = true
            setFaceStatus('VERIFYING')
            setFaceMessage('Face captured! Matching against college faculty database...')

            const cleanInst = institutionId.trim()
            if (!cleanInst) {
              setFaceStatus('ERROR')
              setFaceMessage('Please enter your Institution Code before face scan.')
              isVerifyingRef.current = false
              return
            }
            const result = await faceLogin(descriptor, cleanInst)

            if (result.success) {
              setFaceStatus('SUCCESS')
              const name = result.teacherName || 'Faculty Member'
              setRecognizedName(name)
              setFaceMessage(`Welcome, ${name}! Authentication successful.`)
              stopCamera()
              setTimeout(() => {
                setIsFaceModalOpen(false)
                navigate('/schedule')
              }, 1200)
            } else {
              setFaceStatus('ERROR')
              setFaceMessage(result.error || 'Face not matched in faculty roster.')
              // Allow retry after 2.5s
              setTimeout(() => {
                isVerifyingRef.current = false
                setFaceStatus('READY_TO_SCAN')
                setFaceMessage('Looking for face... Please adjust position and try again.')
              }, 2500)
            }
          }
        } catch (scanErr) {
          console.warn('Face detection pass failed:', scanErr)
        }
      }, 350)
    } catch (err) {
      console.error('Face camera error:', err)
      setFaceStatus('ERROR')
      setFaceMessage(
        err instanceof Error
          ? `Camera access error: ${err.message}`
          : 'Unable to start camera for face recognition.'
      )
      stopCamera()
    }
  }

  const closeFaceModal = () => {
    stopCamera()
    setIsFaceModalOpen(false)
  }

  useEffect(() => {
    return () => {
      stopCamera()
    }
  }, [stopCamera])

  return (
    <div className="min-h-screen max-w-md mx-auto bg-gradient-to-b from-primary/10 via-background to-background p-6 flex flex-col justify-center relative">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30 mb-3">
          <GraduationCap className="h-9 w-9" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Teacher Portal</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Multi-Tenant Cloud & Offline Face Recognition System
        </p>
      </div>

      {/* Main Card */}
      <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-5">
        {error && (
          <div className="text-xs bg-destructive/10 text-destructive border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Biometric Face Recognition Login Button */}
        <div className="space-y-2">
          <button
            type="button"
            onClick={startFaceLogin}
            className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-700 hover:to-cyan-700 text-white font-semibold py-3 px-4 rounded-xl text-sm shadow-md transition-all flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <Camera className="h-5 w-5 animate-pulse" />
            <span>Login with Face Recognition</span>
          </button>
          <p className="text-[11px] text-center text-muted-foreground">
            Instant biometric verification using device camera
          </p>
        </div>

        <div className="relative flex items-center justify-center">
          <div className="border-t border-border w-full" />
          <span className="bg-card px-3 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            or use credentials
          </span>
          <div className="border-t border-border w-full" />
        </div>

        {/* Credentials Form */}
        <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Institute / College ID
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Building2 className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={institutionId}
                onChange={(e) => setInstitutionId(e.target.value)}
                placeholder="e.g. oxford, mit"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Teacher ID or Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. FAC001 or username"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Password or PIN
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-muted-foreground">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-2.5 rounded-lg text-sm shadow transition-all disabled:opacity-50 mt-2"
          >
            {loading ? 'Authenticating...' : 'Sign In with Password'}
          </button>
        </form>
      </div>

      {/* Face Recognition Modal Overlay */}
      {isFaceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl p-5 shadow-2xl space-y-4 relative text-foreground">
            <button
              onClick={closeFaceModal}
              className="absolute top-4 right-4 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="text-center space-y-1 pr-6">
              <h3 className="font-semibold text-base flex items-center justify-center gap-1.5">
                <Camera className="h-4 w-4 text-emerald-500" />
                <span>Faculty Face Recognition</span>
              </h3>
              <p className="text-xs text-muted-foreground">
                College: <span className="font-medium text-foreground">{institutionId || 'Default'}</span>
              </p>
            </div>

            {/* Camera Viewport */}
            <div className="relative w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-border flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover -scale-x-100"
              />

              {/* Reticle / Face Target Overlay */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div
                  className={`w-44 h-56 rounded-full border-2 transition-all duration-300 ${
                    faceStatus === 'SUCCESS'
                      ? 'border-emerald-500 ring-4 ring-emerald-500/30'
                      : faceStatus === 'VERIFYING'
                      ? 'border-cyan-400 ring-4 ring-cyan-400/30 animate-pulse'
                      : faceStatus === 'ERROR'
                      ? 'border-rose-500'
                      : 'border-white/50 border-dashed animate-pulse'
                  }`}
                />
              </div>

              {/* Scanning status banner inside camera view */}
              {faceStatus === 'VERIFYING' && (
                <div className="absolute bottom-2 inset-x-2 bg-black/70 backdrop-blur-sm py-1.5 px-3 rounded-lg text-xs text-cyan-300 text-center font-medium flex items-center justify-center gap-1.5">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>Matching live biometric signature...</span>
                </div>
              )}
            </div>

            {/* Message & Feedback */}
            <div className="text-center space-y-2">
              {faceStatus === 'SUCCESS' ? (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{faceMessage}</span>
                </div>
              ) : faceStatus === 'ERROR' ? (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs font-medium flex items-center justify-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{faceMessage}</span>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{faceMessage}</p>
              )}

              <button
                type="button"
                onClick={closeFaceModal}
                className="text-xs text-muted-foreground hover:text-foreground underline pt-1"
              >
                Cancel and use username/password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

