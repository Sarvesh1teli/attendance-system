/**
 * SmsService — Teli Gateway Integration Stub
 *
 * ─── IMPORTANT ───────────────────────────────────────────────────────────────
 * SMS sending via "Teli Gateway" is intentionally left as a stub for now.
 *
 * The Teli Gateway is a custom local SMS app. When you are ready to integrate:
 *  1. Obtain the API endpoint / port that Teli Gateway listens on
 *  2. Fill in sendSms() below with the actual HTTP call (e.g., using fetch/axios)
 *  3. Update the config table key 'teli_gateway_url' with the gateway's base URL
 *  4. Call SmsService.sendShortageAlert() or sendBulk() from ShortageAlertService
 *
 * Suggested Teli Gateway API shape (to confirm with the gateway documentation):
 *   POST http://localhost:{GATEWAY_PORT}/send
 *   Body: { to: "+919876543210", message: "..." }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type Database from 'better-sqlite3'

export interface SmsPayload {
  to: string       // phone number (with country code if required)
  message: string
}

export interface SmsSendResult {
  success: boolean
  to: string
  error?: string
}

export class SmsService {
  constructor(private db: Database.Database) {}

  private getGatewayUrl(): string | null {
    const row = this.db
      .prepare(`SELECT value FROM config WHERE key = 'teli_gateway_url' LIMIT 1`)
      .get() as { value: string } | undefined
    return row?.value ?? null
  }

  /**
   * Send a single SMS via Teli Gateway.
   * Currently a STUB — logs the message and returns a mock success.
   * Replace the body of this method with the real Teli Gateway HTTP call.
   */
  async sendSms(payload: SmsPayload): Promise<SmsSendResult> {
    const gatewayUrl = this.getGatewayUrl()

    if (!gatewayUrl) {
      console.warn('[SmsService] Teli Gateway URL not configured. Set config key: teli_gateway_url')
      return { success: false, to: payload.to, error: 'Gateway URL not configured' }
    }

    // ─── TODO: Replace this stub with the real Teli Gateway HTTP call ──────
    // Example (adjust to actual Teli Gateway API):
    //
    // try {
    //   const res = await fetch(`${gatewayUrl}/send`, {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ to: payload.to, message: payload.message }),
    //   })
    //   const json = await res.json()
    //   return { success: res.ok, to: payload.to, error: json.error }
    // } catch (err) {
    //   return { success: false, to: payload.to, error: String(err) }
    // }
    // ────────────────────────────────────────────────────────────────────────

    // STUB: just log and return mock success
    console.log(`[SmsService STUB] Would send SMS to ${payload.to}:`)
    console.log(`  "${payload.message}"`)
    return { success: true, to: payload.to }
  }

  /**
   * Send shortage alert SMS to a student and/or parent.
   */
  async sendShortageAlert(opts: {
    studentName: string
    subjectName: string
    attendancePct: number
    studentPhone?: string
    parentPhone?: string
  }): Promise<SmsSendResult[]> {
    const msg =
      `Shortage Alert: ${opts.studentName} has ${opts.attendancePct}% attendance ` +
      `in ${opts.subjectName}. Minimum 75% required. ` +
      `Please contact the institution immediately.`

    const results: SmsSendResult[] = []
    if (opts.studentPhone) results.push(await this.sendSms({ to: opts.studentPhone, message: msg }))
    if (opts.parentPhone) results.push(await this.sendSms({ to: opts.parentPhone, message: msg }))
    return results
  }

  /**
   * Send SMS to multiple recipients at once.
   */
  async sendBulk(payloads: SmsPayload[]): Promise<SmsSendResult[]> {
    return Promise.all(payloads.map(p => this.sendSms(p)))
  }
}
