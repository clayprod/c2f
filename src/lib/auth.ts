import { createClient, createClientFromRequest } from './supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function getUser(request?: NextRequest) {
  let supabase;
  
  if (request) {
    // For Route Handlers, use request cookies
    const { supabase: client } = createClientFromRequest(request);
    supabase = client;
  } else {
    // For Server Components, use cookies() from next/headers
    supabase = await createClient();
  }
  
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function requireUser(request?: NextRequest) {
  const user = await getUser(request);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function getUserId(request?: NextRequest): Promise<string | null> {
  const user = await getUser(request);
  return user?.id ?? null;
}

export async function requireAuth() {
  const user = await getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  return null;
}

/**
 * Check if a user is an admin
 */
export async function isAdmin(userId: string, request?: NextRequest): Promise<boolean> {
  try {
    const supabase = request 
      ? (await createClientFromRequest(request)).supabase 
      : await createClient();
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (error || !profile) {
      return false;
    }

    return profile.role === 'admin';
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

/**
 * Require admin role, throw error if not admin
 */
export async function requireAdmin(request?: NextRequest) {
  const user = await requireUser(request);
  
  const admin = await isAdmin(user.id, request);
  
  if (!admin) {
    throw new Error('Forbidden: Admin access required');
  }

  return user;
}

