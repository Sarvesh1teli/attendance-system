import { safeStorage } from 'electron'
import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const KEY_LENGTH = 32   // 256 bits
const IV_LENGTH  = 12   // 96 bits — recommended for GCM
const TAG_LENGTH = 16   // 128-bit authentication tag

/**
 * EncryptionService
 *
 * Manages the institution's AES-256-GCM master key.
 *
 * Key lifecycle:
 *   1. On first run, generate a random 32-byte key.
 *   2. Encrypt the key using electron.safeStorage (OS keychain / DPAPI on Windows).
 *   3. Store the encrypted blob in institution_configuration under ENCRYPTION_KEY_BLOB.
 *   4. On subsequent runs, load the blob and decrypt it using safeStorage.
 *
 * The raw key is NEVER written to disk unencrypted.
 * The raw key lives in memory only for the duration of the process.
 */
export class EncryptionService {
  private static _key: Buffer | null = null

  /**
   * Initialize the encryption key from the database configuration.
   * Call this once during app startup, after the DB is ready.
   */
  static async initialize(
    getConfig: (key: string) => string | null,
    setConfig: (key: string, value: string, label?: string) => void
  ): Promise<void> {
    const blob = getConfig('ENCRYPTION_KEY_BLOB')

    if (blob) {
      // Decrypt the stored key blob using OS keychain
      const encryptedBuffer = Buffer.from(blob, 'base64')
      const decrypted = safeStorage.decryptString(encryptedBuffer)
      this._key = Buffer.from(decrypted, 'hex')
    } else {
      // First run — generate a new key
      const newKey = crypto.randomBytes(KEY_LENGTH)
      const encrypted = safeStorage.encryptString(newKey.toString('hex'))
      setConfig('ENCRYPTION_KEY_BLOB', encrypted.toString('base64'), 'Encryption Key (OS Protected)')
      this._key = newKey
    }
  }

  private static getKey(): Buffer {
    if (!this._key) {
      throw new Error('EncryptionService not initialized. Call initialize() first.')
    }
    return this._key
  }

  /**
   * Encrypt a Buffer using AES-256-GCM.
   * Returns: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext — all concatenated.
   */
  static encrypt(data: Buffer): Buffer {
    const key = this.getKey()
    const iv = crypto.randomBytes(IV_LENGTH)
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_LENGTH,
    } as crypto.CipherGCMOptions)

    const encrypted = Buffer.concat([cipher.update(data), cipher.final()])
    const tag = cipher.getAuthTag()

    // Layout: [IV(12)] [Tag(16)] [Ciphertext]
    return Buffer.concat([iv, tag, encrypted])
  }

  /**
   * Decrypt a Buffer previously encrypted by encrypt().
   * Expects: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
   */
  static decrypt(data: Buffer): Buffer {
    const key = this.getKey()
    const iv  = data.subarray(0, IV_LENGTH)
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
      authTagLength: TAG_LENGTH,
    } as crypto.CipherGCMOptions)
    decipher.setAuthTag(tag)

    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  }

  /**
   * Encrypt a Float32Array (face embedding vector) → encrypted Buffer → BLOB.
   */
  static encryptEmbedding(embedding: Float32Array): Buffer {
    const raw = Buffer.from(embedding.buffer)
    return this.encrypt(raw)
  }

  /**
   * Decrypt a face embedding BLOB back to Float32Array.
   */
  static decryptEmbedding(blob: Buffer): Float32Array {
    const raw = this.decrypt(blob)
    return new Float32Array(raw.buffer, raw.byteOffset, raw.byteLength / 4)
  }
}
