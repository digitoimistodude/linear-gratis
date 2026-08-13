import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptToken, encryptToken, isLegacyCiphertext } from './encryption'

/**
 * Where the ciphertext lives, so a rotated value can be written back.
 * Defaults cover the common case: profiles.linear_api_token keyed by id.
 */
export type RotationTarget = {
  admin: SupabaseClient
  id: string
  table?: string
  idColumn?: string
  column?: string
}

/**
 * Decrypt a token and, if it was a v1 CryptoJS ciphertext, re-encrypt it as v2
 * and write it back. Failures to rotate are logged but swallowed: the decrypted
 * plaintext is still returned so the caller can proceed with whatever Linear
 * request they were making.
 *
 * Log format: single-line JSON with an event tag. Alert on a non-zero rate of
 * `encryption.rotation.failure` in the log drain to catch silent regressions
 * (for example a schema change that breaks the UPDATE).
 *
 * Ported from upstream c3dff90 and f28a240.
 */
export async function decryptAndRotateTokenIfNeeded(
  ciphertext: string,
  target: RotationTarget,
): Promise<string> {
  const plaintext = await decryptToken(ciphertext)

  if (!isLegacyCiphertext(ciphertext)) {
    return plaintext
  }

  const table = target.table ?? 'profiles'
  const idColumn = target.idColumn ?? 'id'
  const column = target.column ?? 'linear_api_token'

  try {
    const v2 = await encryptToken(plaintext)
    const { error } = await target.admin
      .from(table)
      .update({ [column]: v2 })
      .eq(idColumn, target.id)

    if (error) {
      console.warn(
        JSON.stringify({
          event: 'encryption.rotation.failure',
          level: 'warn',
          stage: 'update',
          table,
          column,
          id: target.id,
          error: error.message,
        }),
      )
    }
  } catch (error) {
    console.warn(
      JSON.stringify({
        event: 'encryption.rotation.failure',
        level: 'warn',
        stage: 'encrypt',
        table,
        column,
        id: target.id,
        error: error instanceof Error ? error.name : 'unknown',
      }),
    )
  }

  return plaintext
}
