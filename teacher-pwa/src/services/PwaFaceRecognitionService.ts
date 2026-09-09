/**
 * PwaFaceRecognitionService
 *
 * Runs inside the browser / mobile browser in Teacher PWA.
 * Uses @vladmandic/face-api:
 *  - TinyFaceDetector
 *  - FaceLandmark68TinyNet
 *  - FaceRecognitionNet
 * Loads weights from '/models' (served from public/models)
 * Uses students' 128-d descriptors to match live camera frames.
 */
import * as faceapi from '@vladmandic/face-api'
import type { CachedStudent } from '../db/pwa-db'

export interface PwaMatchResult {
  matched: boolean
  studentId?: string
  studentName?: string
  distance: number
  confidence: number
  box: { x: number; y: number; width: number; height: number }
  noEnrollment?: boolean
}

class PwaFaceRecognitionService {
  private modelsLoaded = false
  private faceMatcher: faceapi.FaceMatcher | null = null
  private studentNameMap: Map<string, string> = new Map()

  async loadModels(modelsUrl = '/models'): Promise<void> {
    if (this.modelsLoaded) return
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(modelsUrl),
      faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelsUrl),
      faceapi.nets.faceRecognitionNet.loadFromUri(modelsUrl),
    ])
    this.modelsLoaded = true
  }

  isReady(): boolean {
    return this.modelsLoaded
  }

  buildMatcher(students: CachedStudent[], threshold = 0.40): number {
    const labeled: faceapi.LabeledFaceDescriptors[] = []
    this.studentNameMap.clear()

    for (const s of students) {
      if (s.face_descriptor && Array.isArray(s.face_descriptor) && s.face_descriptor.length === 128) {
        const floatArr = new Float32Array(s.face_descriptor)
        labeled.push(new faceapi.LabeledFaceDescriptors(s.student_id, [floatArr]))
        this.studentNameMap.set(s.student_id, s.name)
      }
    }

    if (labeled.length > 0) {
      this.faceMatcher = new faceapi.FaceMatcher(labeled, threshold)
    } else {
      this.faceMatcher = null
    }

    return labeled.length
  }

  async detectAndMatch(
    video: HTMLVideoElement,
    threshold = 0.40
  ): Promise<PwaMatchResult | null> {
    // Ultra-fast TinyFaceDetector configuration (224px input size for instant 30-50ms scans)
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.35,
    })

    if (!this.faceMatcher) {
      // 0 enrolled templates: still detect faces instantly so user gets immediate visual feedback!
      const detection = await faceapi.detectSingleFace(video, detectorOptions)
      if (!detection) return null
      const { x, y, width, height } = detection.box
      return {
        matched: false,
        distance: 1,
        confidence: 0,
        box: { x, y, width, height },
        noEnrollment: true,
      }
    }

    const detection = await faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor()

    if (!detection) return null

    const best = this.faceMatcher.findBestMatch(detection.descriptor)
    const { x, y, width, height } = detection.detection.box

    if (best.label !== 'unknown' && best.distance <= threshold) {
      const studentName = this.studentNameMap.get(best.label) ?? best.label
      return {
        matched: true,
        studentId: best.label,
        studentName,
        distance: best.distance,
        confidence: Math.max(0, Math.min(1, 1 - best.distance)),
        box: { x, y, width, height },
      }
    }

    // Face is physically detected in camera, but is unrecognized / distance exceeded threshold
    return {
      matched: false,
      distance: best.distance,
      confidence: Math.max(0, Math.min(1, 1 - best.distance)),
      box: { x, y, width, height },
    }
  }

  async extractDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 224,
      scoreThreshold: 0.35,
    })
    const detection = await faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceLandmarks(true)
      .withFaceDescriptor()

    if (!detection) return null
    return Array.from(detection.descriptor)
  }

  reset() {
    this.faceMatcher = null
    this.studentNameMap.clear()
  }
}

export const pwaFaceRecognitionService = new PwaFaceRecognitionService()
