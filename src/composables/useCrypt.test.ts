/**
 * Phase 4 – Web Crypto cycle for the `crypt` note type.
 *
 * jsdom does not ship SubtleCrypto so we install Node's webcrypto on the
 * global before the module under test reads it. This mirrors what a real
 * Chrome MV3 extension context already provides natively.
 */
import { webcrypto } from 'node:crypto'

if (!globalThis.crypto?.subtle) {
  // @ts-expect-error – installing the platform Web Crypto into the test global
  globalThis.crypto = webcrypto
}

import { describe, it, expect } from 'vitest'
import {
  encryptNote,
  decryptNote,
  parseCryptPayload,
  serialiseCryptPayload,
  b64encode,
  b64decode,
  PBKDF2_ITERATIONS,
} from './useCrypt'

describe('useCrypt – base64 helpers', () => {
  it('round-trips arbitrary byte arrays', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255])
    expect(b64decode(b64encode(bytes))).toEqual(bytes)
  })
})

describe('useCrypt – encryptNote / decryptNote', () => {
  it('round-trips plaintext through the full crypto cycle', async () => {
    const plaintext  = 'The quick brown fox jumps over the lazy dog. 🦊'
    const passphrase = 'correct horse battery staple'

    const payload   = await encryptNote(plaintext, passphrase)
    const recovered = await decryptNote(payload, passphrase)

    expect(recovered).toBe(plaintext)
  })

  it('produces a payload that matches the persisted schema exactly', async () => {
    const payload = await encryptNote('secret', 'pass')

    expect(payload.version).toBe(1)
    expect(payload.algorithm).toBe('AES-GCM')
    expect(payload.kdf).toBe('PBKDF2-SHA256')
    expect(payload.iterations).toBe(PBKDF2_ITERATIONS)
    expect(typeof payload.salt).toBe('string')
    expect(typeof payload.iv).toBe('string')
    expect(typeof payload.ciphertext).toBe('string')

    // Salt is 16 bytes → 24 chars base64; IV is 12 bytes → 16 chars base64
    expect(b64decode(payload.salt).length).toBe(16)
    expect(b64decode(payload.iv).length).toBe(12)
  })

  it('rejects decryption with the wrong passphrase', async () => {
    const payload = await encryptNote('top secret', 'correct')
    await expect(decryptNote(payload, 'wrong')).rejects.toThrow()
  })

  it('produces a fresh salt and IV on every encrypt call', async () => {
    const a = await encryptNote('same input', 'same pass')
    const b = await encryptNote('same input', 'same pass')

    expect(a.salt).not.toBe(b.salt)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ciphertext).not.toBe(b.ciphertext)
  })

  it('handles unicode and very long plaintext', async () => {
    const big = 'σπ\u00e9c\u00ee\u00e1l ' + 'lorem '.repeat(5_000)
    const out = await encryptNote(big, 'p')
    expect(await decryptNote(out, 'p')).toBe(big)
  })
})

describe('useCrypt – payload (de)serialisation', () => {
  it('serialises and re-parses without losing fidelity', async () => {
    const payload = await encryptNote('hi', 'pw')
    const json    = serialiseCryptPayload(payload)
    expect(JSON.parse(json)).toEqual(payload)
    expect(parseCryptPayload(json)).toEqual(payload)
  })

  it('rejects malformed payload JSON', () => {
    expect(() => parseCryptPayload('{}')).toThrow(/Invalid crypt payload/)
    expect(() => parseCryptPayload(JSON.stringify({
      version: 2, algorithm: 'AES-GCM', kdf: 'PBKDF2-SHA256',
      iterations: 1, salt: 'x', iv: 'y', ciphertext: 'z',
    }))).toThrow()
    expect(() => parseCryptPayload(JSON.stringify({
      version: 1, algorithm: 'XOR', kdf: 'PBKDF2-SHA256',
      iterations: 1, salt: 'x', iv: 'y', ciphertext: 'z',
    }))).toThrow()
  })

  it('rejects payloads with the wrong version on decrypt', async () => {
    const payload = await encryptNote('x', 'p')
    // @ts-expect-error – deliberately set an unsupported version
    payload.version = 99
    await expect(decryptNote(payload, 'p')).rejects.toThrow(/Unsupported crypt version/)
  })
})
