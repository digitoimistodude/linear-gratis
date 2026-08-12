import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// GET - Fetch branding settings for a specific user (public access)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Fetch branding settings
    // Explicit column list: this endpoint is unauthenticated, so it must return
    // only what a branded public page renders.
    const { data, error } = await supabase
      .from('branding_settings')
      .select(
        'user_id, logo_url, logo_svg, logo_width, logo_height, favicon_url, brand_name, tagline, ' +
        'primary_color, secondary_color, accent_color, background_color, text_color, border_color, ' +
        'font_family, heading_font_family, footer_text, footer_links, show_powered_by, social_links, custom_css'
      )
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching branding settings:', error);
      return NextResponse.json({ error: 'Failed to fetch branding settings' }, { status: 500 });
    }

    return NextResponse.json({ branding: data || null });
  } catch (error) {
    console.error('Error in GET /api/branding/[userId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
