/**
 * PwaFaceSettings
 *
 * Provides configurable face recognition thresholds for the PWA.
 * Settings are synced from the cloud (which gets them from the desktop)
 * or fall back to sensible defaults.
 */

export interface FaceRecognitionPwaSettings {
  autoAcceptThreshold: number
  manualReviewThreshold: number
  rejectBelowThreshold: number
  livenessEnabled: boolean
  blinkDetectionEnabled: boolean
  motionCheckEnabled: boolean
  recognitionTimeoutSeconds: number
}

const DEFAULT_SETTINGS: FaceRecognitionPwaSettings = {
  autoAcceptThreshold: 0.90,
  manualReviewThreshold: 0.75,
  rejectBelowThreshold: 0.52,
  livenessEnabled: true,
  blinkDetectionEnabled: true,
  motionCheckEnabled: true,
  recognitionTimeoutSeconds: 30,
}

class PwaFaceSettingsService {
  private settings: FaceRecognitionPwaSettings = { ...DEFAULT_SETTINGS }

  getSettings(): FaceRecognitionPwaSettings {
    return { ...this.settings }
  }

  getMatchThreshold(): number {
    return this.settings.rejectBelowThreshold
  }

  isLivenessEnabled(): boolean {
    return this.settings.livenessEnabled
  }

  isBlinkDetectionEnabled(): boolean {
    return this.settings.blinkDetectionEnabled && this.settings.livenessEnabled
  }

  isMotionCheckEnabled(): boolean {
    return this.settings.motionCheckEnabled && this.settings.livenessEnabled
  }

  /**
   * Load settings from a cloud sync response or from a JSON blob.
   * Falls back to defaults for any missing fields.
   */
  loadFromPayload(payload: Record<string, any>): void {
    if (!payload) return

    this.settings = {
      autoAcceptThreshold:
        typeof payload.auto_accept_threshold === 'number'
          ? payload.auto_accept_threshold
          : typeof payload.autoAcceptThreshold === 'number'
          ? payload.autoAcceptThreshold
          : DEFAULT_SETTINGS.autoAcceptThreshold,
      manualReviewThreshold:
        typeof payload.manual_review_threshold === 'number'
          ? payload.manual_review_threshold
          : typeof payload.manualReviewThreshold === 'number'
          ? payload.manualReviewThreshold
          : DEFAULT_SETTINGS.manualReviewThreshold,
      rejectBelowThreshold:
        typeof payload.reject_below_threshold === 'number'
          ? payload.reject_below_threshold
          : typeof payload.rejectBelowThreshold === 'number'
          ? payload.rejectBelowThreshold
          : DEFAULT_SETTINGS.rejectBelowThreshold,
      livenessEnabled:
        typeof payload.liveness_enabled === 'number'
          ? payload.liveness_enabled === 1
          : typeof payload.livenessEnabled === 'boolean'
          ? payload.livenessEnabled
          : DEFAULT_SETTINGS.livenessEnabled,
      blinkDetectionEnabled:
        typeof payload.blink_detection_enabled === 'number'
          ? payload.blink_detection_enabled === 1
          : typeof payload.blinkDetectionEnabled === 'boolean'
          ? payload.blinkDetectionEnabled
          : DEFAULT_SETTINGS.blinkDetectionEnabled,
      motionCheckEnabled:
        typeof payload.motion_check_enabled === 'number'
          ? payload.motion_check_enabled === 1
          : typeof payload.motionCheckEnabled === 'boolean'
          ? payload.motionCheckEnabled
          : DEFAULT_SETTINGS.motionCheckEnabled,
      recognitionTimeoutSeconds:
        typeof payload.recognition_timeout_seconds === 'number'
          ? payload.recognition_timeout_seconds
          : typeof payload.recognitionTimeoutSeconds === 'number'
          ? payload.recognitionTimeoutSeconds
          : DEFAULT_SETTINGS.recognitionTimeoutSeconds,
    }
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS }
  }
}

export const pwaFaceSettings = new PwaFaceSettingsService()
