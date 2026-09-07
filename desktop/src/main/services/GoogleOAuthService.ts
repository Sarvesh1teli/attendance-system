import { google } from 'googleapis'
import http from 'http'
import { URL } from 'url'
import { shell } from 'electron'
import crypto from 'crypto'
import type Database from 'better-sqlite3'

const REDIRECT_PORT = 58080
const REDIRECT_URI = `http://localhost:${REDIRECT_PORT}/callback`
const SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
]

const ENCRYPT_SECRET = 'teli-admin-oauth-enc-2026'

function encryptSecret(text: string): string {
  const iv = crypto.randomBytes(16)
  const key = crypto.scryptSync(ENCRYPT_SECRET, 'teli-salt', 32)
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

function decryptSecret(text: string): string {
  try {
    const [ivHex, encHex] = text.split(':')
    const iv = Buffer.from(ivHex, 'hex')
    const key = crypto.scryptSync(ENCRYPT_SECRET, 'teli-salt', 32)
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv)
    const decrypted = Buffer.concat([decipher.update(Buffer.from(encHex, 'hex')), decipher.final()])
    return decrypted.toString('utf8')
  } catch {
    return ''
  }
}

export interface GoogleOAuthConfig {
  clientId: string
  clientSecretSet: boolean
  redirectUri: string
  configured: boolean
}

export interface GoogleAccount {
  userEmail: string
  connected: boolean
  connectedAt?: string
}

export class GoogleOAuthService {
  constructor(private db: Database.Database) {}

  private getInstitutionId(): string {
    const row = this.db.prepare('SELECT id FROM institution LIMIT 1').get() as { id: string } | undefined
    return row?.id ?? 'inst-default'
  }

  private getConfig(key: string): string | null {
    const instId = this.getInstitutionId()
    const row = this.db
      .prepare('SELECT config_value FROM institution_configuration WHERE institution_id = ? AND config_key = ?')
      .get(instId, key) as { config_value: string } | undefined
    return row?.config_value ?? null
  }

  private setConfig(key: string, value: string, label = ''): void {
    const instId = this.getInstitutionId()
    this.db
      .prepare(`
        INSERT INTO institution_configuration (config_id, institution_id, config_key, config_value, display_label, updated_at)
        VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(institution_id, config_key) DO UPDATE SET
          config_value = excluded.config_value,
          display_label = excluded.display_label,
          updated_at = datetime('now')
      `)
      .run(instId, key, value, label)
  }

  // ─── OAuth Credentials ───────────────────────────────────────────────────────

  getOAuthConfig(): GoogleOAuthConfig {
    const clientId = this.getConfig('google_oauth_client_id') || ''
    const secretEnc = this.getConfig('google_oauth_client_secret_enc') || ''
    return {
      clientId: clientId.trim(),
      clientSecretSet: !!secretEnc,
      redirectUri: REDIRECT_URI,
      configured: !!(clientId.trim() && secretEnc),
    }
  }

  saveOAuthConfig(clientId: string, clientSecret?: string): GoogleOAuthConfig {
    if (clientId !== undefined && clientId.trim()) {
      this.setConfig('google_oauth_client_id', clientId.trim(), 'Google Drive Client ID')
    }
    if (clientSecret !== undefined && clientSecret.trim()) {
      const encrypted = encryptSecret(clientSecret.trim())
      this.setConfig('google_oauth_client_secret_enc', encrypted, 'Google Drive Client Secret (Encrypted)')
    }
    return this.getOAuthConfig()
  }

  getCredentials(): { clientId: string; clientSecret: string } {
    const clientId = (this.getConfig('google_oauth_client_id') || '').trim()
    const secretEnc = this.getConfig('google_oauth_client_secret_enc') || ''
    const clientSecret = secretEnc ? decryptSecret(secretEnc).trim() : ''

    if (!clientId || !clientSecret) {
      throw new Error(
        'Google OAuth is not configured. Please enter your Client ID and Client Secret in Settings -> Google Drive Backup.'
      )
    }

    return { clientId, clientSecret }
  }

  // ─── Account & Tokens ───────────────────────────────────────────────────────

  getAccount(): GoogleAccount {
    const raw = this.getConfig('google_oauth_account_data')
    if (!raw) return { userEmail: '', connected: false }
    try {
      const parsed = JSON.parse(raw)
      return {
        userEmail: parsed.userEmail || '',
        connected: !!parsed.tokens,
        connectedAt: parsed.connectedAt,
      }
    } catch {
      return { userEmail: '', connected: false }
    }
  }

  private saveTokens(tokens: any, email: string): void {
    const accountData = {
      tokens,
      userEmail: email,
      connectedAt: new Date().toISOString(),
    }
    this.setConfig('google_oauth_account_data', JSON.stringify(accountData), 'Google Drive Account Tokens')
  }

  disconnectAccount(): void {
    this.setConfig('google_oauth_account_data', '', 'Google Drive Account Tokens')
  }

  createOAuth2Client(): any {
    const { clientId, clientSecret } = this.getCredentials()
    const raw = this.getConfig('google_oauth_account_data')
    if (!raw) return null

    let tokens: any = null
    let email = ''
    try {
      const parsed = JSON.parse(raw)
      tokens = parsed.tokens
      email = parsed.userEmail
    } catch {
      return null
    }

    if (!tokens) return null

    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
    oauth2Client.setCredentials(tokens)

    oauth2Client.on('tokens', (newTokens) => {
      const updatedTokens = { ...tokens, ...newTokens }
      this.saveTokens(updatedTokens, email)
    })

    return oauth2Client
  }

  // ─── Interactive Connect Flow ───────────────────────────────────────────────

  async connectAccount(): Promise<{ success: boolean; email?: string; message?: string }> {
    const { clientId, clientSecret } = this.getCredentials()
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
      prompt: 'consent',
    })

    return new Promise((resolve, reject) => {
      let server: http.Server | null = null

      const cleanup = () => {
        try {
          server?.close()
        } catch {
          // ignore
        }
      }

      const timeout = setTimeout(() => {
        cleanup()
        reject(new Error('Google Drive authentication timed out after 5 minutes.'))
      }, 5 * 60 * 1000)

      server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url || '', `http://localhost:${REDIRECT_PORT}`)
          const code = reqUrl.searchParams.get('code')
          const error = reqUrl.searchParams.get('error')

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(
              '<html><body style="font-family:sans-serif;text-align:center;padding:50px"><h2>❌ Authentication Failed</h2><p>' +
                error +
                '</p><p>You can close this window.</p></body></html>'
            )
            clearTimeout(timeout)
            cleanup()
            reject(new Error(`Google OAuth error: ${error}`))
            return
          }

          if (code) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(
              '<html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0fdf4"><h2 style="color:#16a34a">✅ Connected Successfully!</h2><p>Google Drive backup is now connected. You can close this browser tab and return to Teli Attendance.</p></body></html>'
            )
            clearTimeout(timeout)
            cleanup()

            const { tokens } = await oauth2Client.getToken(code)
            oauth2Client.setCredentials(tokens)

            const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
            const userInfo = await oauth2.userinfo.get()
            const email = userInfo.data.email || 'Connected Account'

            this.saveTokens(tokens, email)
            resolve({ success: true, email })
          }
        } catch (err) {
          clearTimeout(timeout)
          cleanup()
          reject(err)
        }
      })

      server.on('error', (err) => {
        clearTimeout(timeout)
        reject(new Error(`Failed to start local auth callback server: ${err.message}`))
      })

      server.listen(REDIRECT_PORT, () => {
        shell.openExternal(authUrl)
      })
    })
  }
}
