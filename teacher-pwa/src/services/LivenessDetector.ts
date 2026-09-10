/**
 * LivenessDetector
 *
 * Detects photo/video spoofing by analyzing facial landmarks across frames:
 *  - Blink detection: Eye Aspect Ratio (EAR) transition across consecutive frames
 *  - Motion detection: Landmark displacement across consecutive frames
 *
 * Uses the same faceLandmark68TinyNet already loaded by the face recognition service.
 * No additional models required.
 */

import * as faceapi from '@vladmandic/face-api'

interface LandmarkSnapshot {
  timestamp: number
  leftEyeEAR: number
  rightEyeEAR: number
  landmarks: Float32Array
  faceBox: { x: number; y: number; width: number; height: number }
}

export interface LivenessResult {
  isLive: boolean
  blinkDetected: boolean
  motionDetected: boolean
  message: string
}

/**
 * Compute Eye Aspect Ratio from 6 landmark points for one eye.
 * EAR = ||p2-p6|| + ||p3-p5|| / (2 * ||p1-p4||)
 * A blink causes EAR to drop near 0 then recover.
 */
function computeEAR(landmarks: Float32Array, eyeIndices: number[]): number {
  const points = eyeIndices.map(i => ({ x: landmarks[i * 2], y: landmarks[i * 2 + 1] }))
  if (points.length < 6) return 0.5

  const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2)

  // Standard 6-point EAR
  const vertical1 = dist(points[1], points[5])
  const vertical2 = dist(points[2], points[4])
  const horizontal = dist(points[0], points[3])

  return horizontal > 0 ? (vertical1 + vertical2) / (2 * horizontal) : 0.5
}

// Left eye indices in 68-landmark model: [36,37,38,39,40,41]
const LEFT_EYE = [36, 37, 38, 39, 40, 41]
// Right eye indices: [42,43,44,45,46,47]
const RIGHT_EYE = [42, 43, 44, 45, 46, 47]

const EAR_CLOSED_THRESHOLD = 0.22
const EAR_OPEN_THRESHOLD = 0.28
const BLINK_WINDOW_MS = 3000
const MOTION_THRESHOLD = 2.0

class LivenessDetector {
  private history: LandmarkSnapshot[] = []
  private maxHistory = 30 // ~1.5 seconds at 20fps

  /**
   * Feed a new detection frame. Returns liveness result.
   * @param detection - The face-api detection with landmarks
   * @param videoWidth - Width of the video element (for scaling motion)
   * @param videoHeight - Height of the video element
   */
  processFrame(
    detection: faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }, faceapi.FaceLandmarks68>,
    videoWidth: number,
    videoHeight: number
  ): LivenessResult {
    const now = Date.now()
    if (!detection || !detection.landmarks) {
      return { isLive: true, blinkDetected: false, motionDetected: false, message: 'Analyzing...' }
    }
    const landmarks = detection.landmarks.positions
    const flatLandmarks = new Float32Array(landmarks.length * 2)
    for (let i = 0; i < landmarks.length; i++) {
      flatLandmarks[i * 2] = landmarks[i].x
      flatLandmarks[i * 2 + 1] = landmarks[i].y
    }

    const leftEAR = computeEAR(flatLandmarks, LEFT_EYE)
    const rightEAR = computeEAR(flatLandmarks, RIGHT_EYE)
    const faceBox = detection.detection.box

    const snapshot: LandmarkSnapshot = {
      timestamp: now,
      leftEyeEAR: leftEAR,
      rightEyeEAR: rightEAR,
      landmarks: flatLandmarks,
      faceBox: { x: faceBox.x, y: faceBox.y, width: faceBox.width, height: faceBox.height },
    }

    this.history.push(snapshot)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }

    // Need at least 5 frames for meaningful analysis
    if (this.history.length < 5) {
      return { isLive: true, blinkDetected: false, motionDetected: false, message: 'Analyzing...' }
    }

    const blinkDetected = this.detectBlink()
    const motionDetected = this.detectMotion()

    const isLive = blinkDetected || motionDetected
    let message = ''
    if (!isLive) {
      message = 'Please blink or move your head slightly'
    } else if (blinkDetected && !motionDetected) {
      message = 'Blink detected'
    } else if (!blinkDetected && motionDetected) {
      message = 'Motion detected'
    } else {
      message = 'Liveness confirmed'
    }

    return { isLive, blinkDetected, motionDetected, message }
  }

  private detectBlink(): boolean {
    const recent = this.history.filter(h => Date.now() - h.timestamp < BLINK_WINDOW_MS)
    if (recent.length < 3) return false

    const avgEAR = recent.map(h => (h.leftEyeEAR + h.rightEyeEAR) / 2)

    // Look for open → closed → open transition
    let foundOpen = false
    let foundClosed = false

    for (const ear of avgEAR) {
      if (ear > EAR_OPEN_THRESHOLD) {
        if (foundClosed) return true // Open after closed = blink complete
        foundOpen = true
      } else if (ear < EAR_CLOSED_THRESHOLD && foundOpen) {
        foundClosed = true
      }
    }

    return false
  }

  private detectMotion(): boolean {
    const recent = this.history.slice(-10) // Last 10 frames
    if (recent.length < 3) return false

    // Compare nose tip (landmark index 30) position across frames
    const noseIdx = 30
    let maxDisplacement = 0

    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1]
      const curr = recent[i]

      const dx = Math.abs(curr.landmarks[noseIdx * 2] - prev.landmarks[noseIdx * 2])
      const dy = Math.abs(curr.landmarks[noseIdx * 2 + 1] - prev.landmarks[noseIdx * 2 + 1])
      const displacement = Math.sqrt(dx * dx + dy * dy)

      if (displacement > maxDisplacement) {
        maxDisplacement = displacement
      }
    }

    // Also check jaw movement (landmark 8 = chin)
    const chinIdx = 8
    let chinMaxDisp = 0
    for (let i = 1; i < recent.length; i++) {
      const prev = recent[i - 1]
      const curr = recent[i]
      const dx = Math.abs(curr.landmarks[chinIdx * 2] - prev.landmarks[chinIdx * 2])
      const dy = Math.abs(curr.landmarks[chinIdx * 2 + 1] - prev.landmarks[chinIdx * 2 + 1])
      chinMaxDisp = Math.max(chinMaxDisp, Math.sqrt(dx * dx + dy * dy))
    }

    // Normalize by face size to be resolution-independent
    const avgFaceHeight = recent.reduce((sum, h) => sum + h.faceBox.height, 0) / recent.length
    const normalizedMotion = avgFaceHeight > 0 ? maxDisplacement / avgFaceHeight : 0

    return normalizedMotion > (MOTION_THRESHOLD / avgFaceHeight) || chinMaxDisp > MOTION_THRESHOLD
  }

  reset(): void {
    this.history = []
  }
}

export const livenessDetector = new LivenessDetector()
