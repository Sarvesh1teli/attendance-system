import { useState, useEffect } from 'react'
import { Cloud, CloudUpload, CloudDownload, CheckCircle2, AlertCircle } from 'lucide-react'
import type { DesktopSyncStatus } from '@main/ipc/types'
import { faceRecognitionService } from '../../services/FaceRecognitionService'
import * as faceapi from '@vladmandic/face-api'

export function SyncStatusWidget() {
  const [status, setStatus] = useState<DesktopSyncStatus | null>(null)
  const [loading, setLoading] = useState(false)
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null)
  const [errorFeedback, setErrorFeedback] = useState<string | null>(null)

  const fetchStatus = async () => {
    try {
      if (window.api?.sync?.getStatus) {
        const s = await window.api.sync.getStatus()
        setStatus(s)
      }
    } catch (e) {
      console.error('Failed to get sync status', e)
    }
  }

  useEffect(() => {
    fetchStatus()
    const interval = setInterval(fetchStatus, 15000)
    return () => clearInterval(interval)
  }, [])

  const handlePush = async () => {
    try {
      setLoading(true)
      setSyncFeedback(null)
      setErrorFeedback(null)

      // Ensure all enrolled students have 128-d face descriptors computed
      try {
        const missing = await window.api.faceRecognition.getMissingDescriptorsData()
        if (missing.length > 0) {
          await faceRecognitionService.loadModels()
          for (const item of missing) {
            const img = new Image()
            img.src = `data:image/jpeg;base64,${item.sampleBase64}`
            await img.decode()
            const det = await faceapi
              .detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
              .withFaceLandmarks(true)
              .withFaceDescriptor()
            if (det) {
              await window.api.faceEnrollment.saveDescriptor(
                item.enrollment_id,
                JSON.stringify(Array.from(det.descriptor))
              )
            }
          }
        }
      } catch (descErr) {
        console.warn('Auto descriptor computation notice:', descErr)
      }

      const res = await window.api.sync.pushMasterData()
      if (res.success) {
        setSyncFeedback('Pushed master data to Cloud!')
      } else {
        setErrorFeedback(res.message || 'Push failed')
      }
      await fetchStatus()
    } catch (err) {
      setErrorFeedback(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setLoading(false)
      setTimeout(() => {
        setSyncFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  const handlePull = async () => {
    try {
      setLoading(true)
      setSyncFeedback(null)
      setErrorFeedback(null)
      const res = await window.api.sync.pullCompletedSessions()
      if (res.success) {
        if (res.sessionsCount === 0) {
          setSyncFeedback('All sessions up to date')
        } else {
          setSyncFeedback(`Pulled ${res.sessionsCount} session(s), ${res.recordsCount} record(s)`)
        }
      } else {
        setErrorFeedback(res.message || 'Pull failed')
      }
      await fetchStatus()
    } catch (err) {
      setErrorFeedback(err instanceof Error ? err.message : 'Pull failed')
    } finally {
      setLoading(false)
      setTimeout(() => {
        setSyncFeedback(null)
        setErrorFeedback(null)
      }, 4000)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border bg-background text-xs text-muted-foreground shadow-sm"
        title={`Cloud: ${status?.cloudUrl || 'Offline'}`}
      >
        <Cloud className="w-3.5 h-3.5 text-sky-500" />
        <span className="hidden md:inline font-medium">Cloud</span>
        {status?.lastSyncResult === 'SUCCESS' ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : status?.lastSyncResult === 'FAILED' ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-600 inline-block" />
        )}
      </div>

      <button
        type="button"
        disabled={loading}
        onClick={handlePush}
        title="Push Master Data (Roster, Topics, Subjects) to Cloud"
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-input rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
      >
        <CloudUpload className={`w-3.5 h-3.5 text-sky-600 ${loading ? 'animate-bounce' : ''}`} />
        <span className="hidden sm:inline">Push Data</span>
      </button>

      <button
        type="button"
        disabled={loading}
        onClick={handlePull}
        title="Pull Completed Sessions from Cloud"
        className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-input rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-50"
      >
        <CloudDownload className={`w-3.5 h-3.5 text-indigo-600 ${loading ? 'animate-bounce' : ''}`} />
        <span className="hidden sm:inline">Pull Attendance</span>
      </button>

      {syncFeedback && (
        <span className="text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 px-2 py-0.5 rounded animate-in fade-in duration-200">
          {syncFeedback}
        </span>
      )}
      {errorFeedback && (
        <span className="text-[11px] font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded animate-in fade-in duration-200">
          {errorFeedback}
        </span>
      )}
    </div>
  )
}
