import { supabaseAdmin } from './supabase';
import { decryptAndRotateTokenIfNeeded } from './encryption-rotation';

/**
 * Resolves the Linear API token to use for API calls.
 *
 * Prefers the workspace-shared token from `workspace_settings` if set,
 * otherwise falls back to the user's personal `linear_api_token` in `profiles`.
 *
 * Centralising token resolution here ensures every server-side caller goes
 * through one auditable path and never trusts client-supplied tokens. Legacy
 * v1 ciphertexts are rotated to AES-256-GCM on first read.
 */
export async function getLinearToken(userId: string | null | undefined): Promise<string | null> {
  // Try workspace-shared token first
  try {
    const { data: workspace } = await supabaseAdmin
      .from('workspace_settings')
      .select('id, linear_api_token')
      .limit(1)
      .single();

    if (workspace?.linear_api_token) {
      return decryptAndRotateTokenIfNeeded(workspace.linear_api_token, {
        admin: supabaseAdmin,
        id: workspace.id,
        table: 'workspace_settings',
      });
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

  return decryptAndRotateTokenIfNeeded(profile.linear_api_token, {
    admin: supabaseAdmin,
    id: userId,
  });
}
