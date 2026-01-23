import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, accessRemovedTemplate } from '@/services/email';
import { z } from 'zod';

const updateMemberSchema = z.object({
  memberId: z.string().uuid(),
  role: z.enum(['viewer', 'editor', 'admin']).optional(),
  permissions: z.record(z.unknown()).optional(),
});

// GET - List members of the current user's account
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);

    // Get members who have access to this user's account
    const { data: members, error } = await supabase
      .from('account_members')
      .select(`
        id,
        member_id,
        role,
        permissions,
        created_at,
        updated_at,
        profiles:member_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('owner_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Also get accounts this user has access to
    const { data: sharedAccounts, error: sharedError } = await supabase
      .from('account_members')
      .select(`
        id,
        owner_id,
        role,
        permissions,
        created_at,
        profiles:owner_id (
          id,
          full_name,
          email,
          avatar_url
        )
      `)
      .eq('member_id', userId);

    if (sharedError) throw sharedError;

    // profiles table RLS only allows "view own profile", so joins for other users can be null.
    // Enrich member/owner profile fields via service-role (server-side).
    let profilesById = new Map<string, any>();
    try {
      const ids = Array.from(
        new Set([
          ...(members || [])
            .filter((m: any) => !m.profiles)
            .map((m: any) => m.member_id)
            .filter(Boolean),
          ...(sharedAccounts || [])
            .filter((sa: any) => !sa.profiles)
            .map((sa: any) => sa.owner_id)
            .filter(Boolean),
        ])
      );

      if (ids.length > 0) {
        const admin = createAdminClient();
        const { data: profilesData } = await admin
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', ids);

        profilesById = new Map<string, any>((profilesData || []).map((p: any) => [p.id, p]));
      }
    } catch {
      // ignore enrichment failures; UI will fallback
    }

    const enrichedMembers = (members || []).map((m: any) => ({
      ...m,
      profiles: m.profiles || profilesById.get(m.member_id) || null,
    }));

    const enrichedSharedAccounts = (sharedAccounts || []).map((sa: any) => ({
      ...sa,
      profiles: sa.profiles || profilesById.get(sa.owner_id) || null,
    }));

    return NextResponse.json({
      data: {
        members: enrichedMembers,
        sharedAccounts: enrichedSharedAccounts,
      },
    });
  } catch (error) {
    console.error('[Sharing/Members] GET error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}

// PUT - Update member permissions
export async function PUT(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = updateMemberSchema.parse(body);

    const { supabase } = createClientFromRequest(request);

    const updateData: Record<string, unknown> = {};
    if (validatedData.role) updateData.role = validatedData.role;
    if (validatedData.permissions) updateData.permissions = validatedData.permissions;

    const { data: member, error } = await supabase
      .from('account_members')
      .update(updateData)
      .eq('owner_id', userId)
      .eq('member_id', validatedData.memberId)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data: member });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados invalidos', details: error.errors },
        { status: 400 }
      );
    }
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}

// DELETE - Remove a member or leave a shared account
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    const ownerId = searchParams.get('ownerId'); // For leaving a shared account

    if (!memberId && !ownerId) {
      return NextResponse.json(
        { error: 'memberId ou ownerId e obrigatorio' },
        { status: 400 }
      );
    }

    const { supabase } = createClientFromRequest(request);

    if (memberId) {
      // Owner removing a member
      // Get member info for email notification
      const { data: memberInfo } = await supabase
        .from('account_members')
        .select(`
          member_id,
          profiles:member_id (email)
        `)
        .eq('owner_id', userId)
        .eq('member_id', memberId)
        .single();

      const { error } = await supabase
        .from('account_members')
        .delete()
        .eq('owner_id', userId)
        .eq('member_id', memberId);

      if (error) throw error;

      // Get owner info for email
      const { data: ownerProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();

      // Send notification email
      if (memberInfo?.profiles && ownerProfile) {
        const memberEmail = (memberInfo.profiles as any).email;
        if (memberEmail) {
          try {
            const emailTemplate = accessRemovedTemplate({
              ownerName: ownerProfile.full_name || 'Usuário',
              ownerEmail: ownerProfile.email,
            });
            await sendEmail({
              to: memberEmail,
              subject: emailTemplate.subject,
              html: emailTemplate.html,
            });
          } catch (emailError) {
            console.error('[Sharing] Failed to send removal email:', emailError);
          }
        }
      }
    } else if (ownerId) {
      // Member leaving a shared account
      const { error } = await supabase
        .from('account_members')
        .delete()
        .eq('owner_id', ownerId)
        .eq('member_id', userId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}
