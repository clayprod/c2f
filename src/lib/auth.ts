import { createClient } from './supabase/server';
import { NextResponse } from 'next/server';

export async function getUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function requireUser() {
  const user = await getUser();
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export async function getUserId(): Promise<string | null> {
  const user = await getUser();
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

