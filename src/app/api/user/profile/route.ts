/**
 * User Profile API
 * 
 * GET: Get current user profile including role
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, role, city, state, birth_date, gender, monthly_income_cents, created_at')
      .eq('id', user.id)
      .single();

    if (error) {
      console.error('Error fetching profile:', error);
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    console.log('[Profile API] User profile:', {
      id: profile.id,
      email: profile.email,
      role: profile.role,
    });

    return NextResponse.json({
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email || user.email,
      role: profile.role || 'user',
      city: profile.city,
      state: profile.state,
      birth_date: profile.birth_date,
      gender: profile.gender,
      monthly_income_cents: profile.monthly_income_cents,
      created_at: profile.created_at,
    });
  } catch (error: any) {
    console.error('Error in profile API:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
