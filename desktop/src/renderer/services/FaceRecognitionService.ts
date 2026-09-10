/**
 * FaceRecognitionService (Renderer Process)
 *
 * Wraps @vladmandic/face-api to:
 *   1. Load TinyFaceDetector + FaceLandmark68TinyNet + FaceRecognitionNet models
 *   2. Build LabeledFaceDescriptors from enrolled student JPEG images (base64)
 *   3. Detect + match faces in a live video frame
 *
 * ALL processing happens in the renderer — no images leave the device.
 */

import * as faceapi from '@vladmandic/face-api'

export interface MatchResult {
  studentId: string
  studentName: string
  recordId: string
  distance: number
  confidence: number   // 1 - distance, clamped 0–1
  box: { x: number; y: number; width: number; height: number }
}

export interface EnrolledStudent {
  record_id: string
  student_id: string
  student_name: string
  face_samples_base64: string[]
}

class FaceRecognitionService {
  private modelsLoaded = false
  private faceMatcher: faceapi.FaceMatcher | null = null
  private studentMap: Map<string, { name: string; recordId: string }> = new Map()

  // ─── Model Loading ─────────────────────────────────────────────────────────

  async loadModels(modelsUrl?: string): Promise<void> {
    if (this.modelsLoaded) return
    const url =
      modelsUrl ||
      ((import.meta as any).env?.BASE_URL
        ? `${(import.meta as any).env.BASE_URL.replace(/\/$/, '')}/models`
        : '/admin/models')
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(url),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(url),
      faceapi.nets.faceRecognitionNet.loadFromUri(url),
    ])
    this.modelsLoaded = true
  }

  isReady(): boolean {
    return this.modelsLoaded && this.faceMatcher !== null
  }

  // ─── Descriptor Building ───────────────────────────────────────────────────

  /**
   * Build face descriptors from enrolled student JPEG base64 images.
   * Call this once after loadModels().
   * @param students  Array of enrolled students with base64 face samples
   * @param onProgress  Optional callback(done, total)
   */
  async buildDescriptors(
    students: EnrolledStudent[],
    onProgress?: (done: number, total: number) => void
  ): Promise<{ builtCount: number; skippedCount: number }> {
    const labeled: faceapi.LabeledFaceDescriptors[] = []
    const enrolledStudents = students.filter(s => s.face_samples_base64.length > 0)
    let done = 0
    let skipped = 0

    for (const student of enrolledStudents) {
      const descriptors: Float32Array[] = []

      for (const b64 of student.face_samples_base64) {
        try {
          const img = await this.base64ToImage(b64)
          const detection = await faceapi
            .detectSingleFace(img as unknown as HTMLVideoElement, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks(true)
            .withFaceDescriptor()

          if (detection) {
            descriptors.push(detection.descriptor)
          }
        } catch (e) {
          console.warn('[FaceRecognition] Skipping unprocessable image for student:', student.student_name, e)
        }
      }

      if (descriptors.length > 0) {
        labeled.push(new faceapi.LabeledFaceDescriptors(student.student_id, descriptors))
        this.studentMap.set(student.student_id, {
          name: student.student_name,
          recordId: student.record_id,
        })
      } else {
        skipped++
      }

      done++
      onProgress?.(done, enrolledStudents.length)
    }

    if (labeled.length > 0) {
      this.faceMatcher = new faceapi.FaceMatcher(labeled, 0.5)
    }

    return { builtCount: labeled.length, skippedCount: skipped }
  }

  // ─── Live Detection ────────────────────────────────────────────────────────

  /**
   * Run one detection pass on a video element.
   * Returns matched results for each face detected.
   */
  async detectAndMatch(
    videoEl: HTMLVideoElement,
    threshold = 0.5
  ): Promise<MatchResult[]> {
    if (!this.modelsLoaded || !this.faceMatcher) return []
    if (videoEl.readyState < 2) return []

    try {
      const detections = await faceapi
        .detectAllFaces(videoEl, new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }))
        .withFaceLandmarks(true)
        .withFaceDescriptors()

      if (!detections || detections.length === 0) return []

      const results: MatchResult[] = []

      for (const det of detections) {
        const match = this.faceMatcher.findBestMatch(det.descriptor)
        if (match.label !== 'unknown' && match.distance <= threshold) {
          const info = this.studentMap.get(match.label)
          if (info) {
            const box = det.detection.box
            results.push({
              studentId: match.label,
              studentName: info.name,
              recordId: info.recordId,
              distance: match.distance,
              confidence: Math.max(0, 1 - match.distance),
              box: { x: box.x, y: box.y, width: box.width, height: box.height },
            })
          }
        }
      }

      return results
    } catch (err) {
      console.warn('[FaceRecognition] detectAndMatch failed:', err)
      return []
    }
  }

  // ─── Threshold Setter ──────────────────────────────────────────────────────

  updateThreshold(threshold: number): void {
    if (this.faceMatcher) {
      this.faceMatcher = new faceapi.FaceMatcher(
        this.faceMatcher.labeledDescriptors,
        threshold
      )
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private base64ToImage(base64: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = `data:image/jpeg;base64,${base64}`
    })
  }

  reset(): void {
    this.faceMatcher = null
    this.studentMap.clear()
  }
}

// Singleton — shared across component mounts
export const faceRecognitionService = new FaceRecognitionService()
