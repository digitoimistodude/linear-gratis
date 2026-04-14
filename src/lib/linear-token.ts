import { supabaseAdmin } from './supabase';
import { decryptToken } from './encryption';

/**
 * Resolves the Linear API token to use for API calls.
 *
 * Prefers the workspace-shared token from `workspace_settings` if set,
 * otherwise falls back to the user's personal `linear_api_token` in `profiles`.
 *
 * Returns the decrypted plaintext token, or null if none is configured.
 */
export async function getLinearToken(userId: string | null | undefined): Promise<string | null> {
  // Try workspace-shared token first
  try {
    const { data: workspace } = await supabaseAdmin
      .from('workspace_settings')
      .select('linear_api_token')
      .limit(1)
      .single();

    if (workspace?.linear_api_token) {
      return decryptToken(workspace.linear_api_token);
    }
  } catch {
    // workspace_settings table may not exist yet, or no row yet
  }

  // Fall back to user's personal token
  if (!userId) return null;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('linear_api_token')
    .eq('id', userId)
    .single();

  if (!profile?.linear_api_token) return null;

  return decryptToken(profile.linear_api_token);
}
