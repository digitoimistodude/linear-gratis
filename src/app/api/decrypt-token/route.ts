import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { decryptToken } from '@/lib/encryption';

// Decrypts a token for the authenticated user. The user can only decrypt their own
// stored linear_api_token from the profiles table — they cannot pass arbitrary
// ciphertext. This prevents the route being abused as a public decryption oracle.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Look up the user's own encrypted token from profiles.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('linear_api_token')
      .eq('id', user.id)
      .single();

    if (!profile?.linear_api_token) {
      return NextResponse.json(
        { success: false, error: 'No token configured for this user' },
        { status: 404 }
      );
    }

    const decryptedToken = decryptToken(profile.linear_api_token);

    return NextResponse.json({
      success: true,
      token: decryptedToken,
    });
  } catch (error) {
    console.error('Decryption API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    );
  }
}
