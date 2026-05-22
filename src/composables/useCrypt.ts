import type { CryptPayload } from '@/types/db'

// ─── Crypto parameters (constants, exported for tests) ────────────────────────

/** PBKDF2 iteration count – OWASP 2023 recommendation for SHA-256. */
export const PBKDF2_ITERATIONS = 310_000
/** AES-GCM key length in bits. */
export const AES_KEY_BITS = 256
/** Salt length in bytes (128 bits is conventional for PBKDF2). */
export const SALT_BYTES = 16
/** IV length in bytes (96 bits is the AES-GCM recommendation). */
export const IV_BYTES = 12

// ─── Subtle accessor ──────────────────────────────────────────────────────────

function getSubtle(): SubtleCrypto {
  const c = globalThis.crypto
  if (!c?.subtle) throw new Error('Web Crypto API unavailable in this environment')
  return c.subtle
}

// ─── Base64 helpers (binary-safe, no Buffer dependency) ───────────────────────

export function b64encode(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}

export function b64decode(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

// ─── Key derivation ───────────────────────────────────────────────────────────

/**
 * Derive a non-extractable AES-GCM key from the user passphrase.
 * The returned CryptoKey cannot be exported (extractable=false), so the raw
 * 32-byte key material never reaches JavaScript memory – nothing to "wipe".
 * Callers wipe the *passphrase string* and drop their reference to the key.
 */
async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const subtle  = getSubtle()
  const baseKey = await subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_BITS },
    false,
    ['encrypt', 'decrypt'],
  )
}

// ─── Public encrypt / decrypt ─────────────────────────────────────────────────

/**
 * Encrypt `plaintext` with `passphrase`. Returns the storage payload exactly
 * as it is persisted in `notes.content` (a JSON-serialisable object).
 */
export async function encryptNote(plaintext: string, passphrase: string): Promise<CryptPayload> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(SALT_BYTES))
  const iv   = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const key  = await deriveKey(passphrase, salt)
  const ct   = await getSubtle().encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    version:    1,
    algorithm:  'AES-GCM',
    kdf:        'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    salt:       b64encode(salt),
    iv:         b64encode(iv),
    ciphertext: b64encode(new Uint8Array(ct)),
  }
}

/**
 * Decrypt a stored payload with `passphrase`. Throws if the passphrase is
 * wrong (AES-GCM authentication tag fails) or the payload is malformed.
 */
export async function decryptNote(payload: CryptPayload, passphrase: string): Promise<string> {
  if (payload.version !== 1) throw new Error(`Unsupported crypt version: ${payload.version}`)
  if (payload.algorithm !== 'AES-GCM') throw new Error(`Unsupported algorithm: ${payload.algorithm}`)
  const salt = b64decode(payload.salt)
  const iv   = b64decode(payload.iv)
  const ct   = b64decode(payload.ciphertext)
  const key  = await deriveKey(passphrase, salt)
  const pt   = await getSubtle().decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource)
  return new TextDecoder().decode(pt)
}

// ─── Payload (de)serialisation helpers ────────────────────────────────────────

/** Parse a JSON string from `notes.content` into a typed CryptPayload. */
export function parseCryptPayload(json: string): CryptPayload {
  const obj = JSON.parse(json) as Partial<CryptPayload>
  if (
    obj.version    !== 1 ||
    obj.algorithm  !== 'AES-GCM' ||
    obj.kdf        !== 'PBKDF2-SHA256' ||
    typeof obj.iterations !== 'number' ||
    typeof obj.salt       !== 'string' ||
    typeof obj.iv         !== 'string' ||
    typeof obj.ciphertext !== 'string'
  ) {
    throw new Error('Invalid crypt payload')
  }
  return obj as CryptPayload
}

/** Serialise a CryptPayload for `notes.content`. */
export function serialiseCryptPayload(p: CryptPayload): string {
  return JSON.stringify(p)
}
