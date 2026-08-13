// Dispatches encryption and decryption by version prefix.
// New writes always use v2 (AES-256-GCM). Reads transparently handle v1
// (CryptoJS) and v2 so existing rows keep working until they are rotated to v2
// on first authenticated decrypt via decryptAndRotateTokenIfNeeded.
// Ported from upstream c3dff90.

import CryptoJS from 'crypto-js'
import { encryptTokenV2, decryptTokenV2, isV2Ciphertext } from './encryption-v2'

function getLegacyKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -base64 32'
    )
  }
  return key
}

export async function encryptToken(plaintext: string): Promise<string> {
  if (!plaintext) return ''
  return encryptTokenV2(plaintext)
}

export async function decryptToken(ciphertext: string): Promise<string> {
  if (!ciphertext) return ''

  if (isV2Ciphertext(ciphertext)) {
    return decryptTokenV2(ciphertext)
  }

  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, getLegacyKey())
    const plaintext = bytes.toString(CryptoJS.enc.Utf8)
    if (!plaintext) {
      throw new Error('Decryption produced empty result')
    }
    return plaintext
  } catch (error) {
    console.error('Error decrypting token:', error instanceof Error ? error.name : 'unknown')
    throw new Error('Failed to decrypt token')
  }
}

/**
 * Returns true if the given ciphertext is a legacy (v1) encoding that should be
 * re-encrypted as v2 on next access. Callers holding a row id and an admin
 * client should use decryptAndRotateTokenIfNeeded instead of calling this
 * directly.
 */
export function isLegacyCiphertext(ciphertext: string): boolean {
  return !isV2Ciphertext(ciphertext)
}
