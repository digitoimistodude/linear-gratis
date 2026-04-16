/**
 * Client-side helpers that round-trip through authenticated server routes.
 *
 * IMPORTANT: encryption keys never live in the browser. These helpers exist so
 * legacy client flows can still encrypt the user's own token before saving it
 * to Supabase, and read it back. The server-side decrypt route only returns
 * the *current authenticated user's* token — arbitrary ciphertext cannot be
 * decrypted via this path.
 */

export async function encryptTokenClient(token: string): Promise<string> {
  if (!token) return '';

  try {
    const response = await fetch('/api/encrypt-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json() as {
      success: boolean
      encryptedToken?: string
      error?: string
    };

    if (!data.success) {
      throw new Error(data.error || 'Failed to encrypt token');
    }

    return data.encryptedToken || '';
  } catch (error) {
    console.error('Error encrypting token:', error);
    throw error;
  }
}

/**
 * Decrypts the *current authenticated user's* linear_api_token from their
 * profiles row. The `encryptedToken` argument is ignored by the server — kept
 * here only for backwards compatibility of the call site signature.
 */
export async function decryptTokenClient(_encryptedToken?: string): Promise<string> {
  try {
    const response = await fetch('/api/decrypt-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({})
    });

    if (!response.ok) {
      if (response.status === 404) return '';
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json() as {
      success: boolean
      token?: string
      error?: string
    };

    if (!data.success) {
      throw new Error(data.error || 'Failed to decrypt token');
    }

    return data.token || '';
  } catch (error) {
    console.error('Error decrypting token:', error);
    throw error;
  }
}
