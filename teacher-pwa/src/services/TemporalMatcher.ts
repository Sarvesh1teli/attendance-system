/**
 * TemporalMatcher
 *
 * Provides temporal smoothing for face recognition results.
 * Instead of accepting a single-frame match (which can flicker),
 * it counts how many times the SAME student is seen at a similar
 * position within a short sliding window. A student is confirmed
 * only after enough consistent sightings — brief drops (blinks,
 * micro head movement) no longer reset the count.
 *
 * Correlation between frames uses bounding-box center distance
 * (scaled to face size) rather than strict IoU, so small movements
 * don't reset progress.
 */

export interface TemporalMatchResult {
  confirmed: boolean
  studentId: string
  studentName: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
  sightings: number
  requiredSightings: number
}

interface FrameResult {
  timestamp: number
  studentId: string
  studentName: string
  confidence: number
  box: { x: number; y: number; width: number; height: number }
}

const WINDOW_SIZE = 6                // look at last 6 frames
const MATCH_WINDOW_MS = 3000         // ... within 3.0 seconds
const CENTER_DIST_RATIO = 0.40       // centers may drift up to 40% of face size

function centersAreCorrelated(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  const ax = a.x + a.width / 2
  const ay = a.y + a.height / 2
  const bx = b.x + b.width / 2
  const by = b.y + b.height / 2
  const dx = Math.abs(ax - bx)
  const dy = Math.abs(ay - by)
  const size = Math.max(a.width, a.height, 1) * CENTER_DIST_RATIO
  return dx <= size && dy <= size
}

class TemporalMatcher {
  private frameHistory: FrameResult[] = []

  /**
   * Process a new frame's match result.
   * Returns a TemporalMatchResult indicating whether the match is confirmed.
   * Pass `null` when NO face is detected in a frame (gap frames are tolerated
   * up to the window limit, so a single dropped frame doesn't reset progress).
   */
  processFrame(
    match: {
      matched: boolean
      studentId?: string
      studentName?: string
      confidence?: number
      box: { x: number; y: number; width: number; height: number }
    } | null
  ): TemporalMatchResult | null {
    const now = Date.now()

    // Drop entries older than the window
    this.frameHistory = this.frameHistory.filter(
      f => now - f.timestamp < MATCH_WINDOW_MS
    )

    // Gaps: keep history, but don't add a null entry. If no face is on
    // screen for the whole window, clear everything.
    if (!match || !match.matched || !match.studentId) {
      if (this.frameHistory.length > 0 && now - this.frameHistory[this.frameHistory.length - 1].timestamp > MATCH_WINDOW_MS) {
        this.frameHistory = []
      }
      return null
    }

    const frameResult: FrameResult = {
      timestamp: now,
      studentId: match.studentId,
      studentName: match.studentName ?? match.studentId,
      confidence: match.confidence ?? 0,
      box: match.box,
    }
    this.frameHistory.push(frameResult)

    if (this.frameHistory.length > WINDOW_SIZE) {
      this.frameHistory.shift()
    }

    // Count sightings of the same student at a correlated position
    // within the current window (not strictly consecutive).
    let sightings = 0
    for (const prev of this.frameHistory) {
      if (prev.studentId === match.studentId && centersAreCorrelated(prev.box, match.box)) {
        sightings++
      }
    }

    // High confidence match (confidence >= 52%, distance <= 0.48) confirms instantly.
    // Borderline match (distance 0.48 - 0.52) safely confirms on 2nd sighting.
    const requiredSightings = (match.confidence ?? 0) >= 0.52 ? 1 : 2

    return {
      confirmed: sightings >= requiredSightings,
      studentId: match.studentId,
      studentName: match.studentName ?? match.studentId,
      confidence: match.confidence ?? 0,
      box: match.box,
      sightings,
      requiredSightings,
    }
  }

  /**
   * Remove sightings for one student only (called after their attendance is
   * recorded, so other in-flight tracks are not disturbed).
   */
  clearStudent(studentId: string): void {
    this.frameHistory = this.frameHistory.filter(f => f.studentId !== studentId)
  }

  reset(): void {
    this.frameHistory = []
  }
}

export const temporalMatcher = new TemporalMatcher()