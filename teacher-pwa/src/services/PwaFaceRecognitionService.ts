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
  /** Raw face-api detection (with landmarks + descriptor). Reused by liveness
   *  detection so the scanner does NOT run a second inference pass. */
  rawDetection?: unknown
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

  buildMatcher(students: CachedStudent[], threshold = 0.52): number {
    const labeled: faceapi.LabeledFaceDescriptors[] = []
    this.studentNameMap.clear()

    for (const s of students) {
      if (!s.face_descriptor) continue

      const descriptors: Float32Array[] = []

      // Handle both single descriptor (number[]) and multi-descriptor (number[][])
      if (Array.isArray(s.face_descriptor)) {
        if (s.face_descriptor.length === 128 && typeof s.face_descriptor[0] === 'number') {
          // Single descriptor: number[] (128 floats)
          descriptors.push(new Float32Array(s.face_descriptor as number[]))
        } else if (s.face_descriptor.length > 0 && Array.isArray(s.face_descriptor[0])) {
          // Multiple descriptors: number[][] (array of 128-float arrays)
          for (const desc of s.face_descriptor as number[][]) {
            if (Array.isArray(desc) && desc.length === 128) {
              descriptors.push(new Float32Array(desc))
            }
          }
        }
      }

      if (descriptors.length > 0) {
        labeled.push(new faceapi.LabeledFaceDescriptors(s.student_id, descriptors))
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
    threshold = 0.52
  ): Promise<PwaMatchResult | null> {
    // Fast & accurate detection: 320px input size for high mobile FPS & low latency
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
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
        rawDetection: detection,
      }
    }

    // Face is physically detected in camera, but is unrecognized / distance exceeded threshold
    return {
      matched: false,
      distance: best.distance,
      confidence: Math.max(0, Math.min(1, 1 - best.distance)),
      box: { x, y, width, height },
      rawDetection: detection,
    }
  }

  async extractDescriptor(video: HTMLVideoElement): Promise<number[] | null> {
    const detectorOptions = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
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
