// AES-256-GCM encryption for Linear API tokens and OAuth secrets.
// The "v2:" version prefix lets decryptToken in src/lib/encryption.ts fall back
// to the legacy CryptoJS (v1) path for rows written before this module existed.
// Ported from upstream c3dff90.

const VERSION_PREFIX = 'v2:'
const IV_BYTES = 12

let cachedKey: CryptoKey | null = null

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY
  if (!key) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is required. ' +
      'Generate one with: openssl rand -base64 32'
    )
  }
  return key
}

// The key is read lazily rather than at module scope: on Workers the
// environment is only bound once a request is in flight.
async function getKey(): Promise<CryptoKey> {
  if (cachedKey) return cachedKey

  const keyMaterial = new TextEncoder().encode(getEncryptionKey())
  const keyBytes = await crypto.subtle.digest('SHA-256', keyMaterial)

  cachedKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )

  return cachedKey
}

function toBase64(bytes: Uint8Array): string {
  // Compact base64 conversion that works in Workers and Node.
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function isV2Ciphertext(value: string): boolean {
  return typeof value === 'string' && value.startsWith(VERSION_PREFIX)
}

export async function encryptTokenV2(plaintext: string): Promise<string> {
  if (!plaintext) throw new Error('Plaintext cannot be empty')

  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES))
  const encoded = new TextEncoder().encode(plaintext)

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded),
  )

  const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength)
  combined.set(iv, 0)
  combined.set(ciphertext, iv.byteLength)

  return VERSION_PREFIX + toBase64(combined)
}

export async function decryptTokenV2(payload: string): Promise<string> {
  if (!isV2Ciphertext(payload)) {
    throw new Error('Not a v2 ciphertext')
  }

  const combined = fromBase64(payload.slice(VERSION_PREFIX.length))
  if (combined.byteLength <= IV_BYTES) {
    throw new Error('v2 ciphertext is truncated')
  }

  const iv = combined.slice(0, IV_BYTES)
  const ciphertext = combined.slice(IV_BYTES)
  const key = await getKey()

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext,
  )

  return new TextDecoder().decode(plaintext)
}
