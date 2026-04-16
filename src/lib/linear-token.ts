import { supabaseAdmin } from './supabase';
import { decryptToken } from './encryption';

/**
 * Resolves the Linear API token for the given user.
 *
 * Reads the user's `linear_api_token` from the `profiles` table and returns
 * the decrypted plaintext, or null if none is configured.
 *
 * Centralising token resolution here ensures every server-side caller goes
 * through one auditable path and never trusts client-supplied tokens.
 */
export async function getLinearToken(userId: string | null | undefined): Promise<string | null> {
  if (!userId) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('linear_api_token')
    .eq('id', userId)
    .single();

  if (!profile?.linear_api_token) return null;

  return decryptToken(profile.linear_api_token);
}
