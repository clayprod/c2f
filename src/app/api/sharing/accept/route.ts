import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail, inviteAcceptedTemplate } from '@/services/email';

// GET - Get invite details by token (for preview)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token e obrigatorio' }, { status: 400 });
    }

    const { supabase } = createClientFromRequest(request);

    // Prefer the SECURITY DEFINER RPC (works even when RLS is restrictive).
    // If the function doesn't exist yet (migration not applied), fallback to direct SELECT.
    let invite: any | null = null;
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_account_invite_preview', {
      p_token: token,
    });

    if (rpcError) {
      const msg = String((rpcError as any)?.message || '');
      const isMissingFn =
        msg.includes('get_account_invite_preview') && (msg.includes('Could not find') || msg.includes('function'));

      if (!isMissingFn) throw rpcError;

      const { data: directInvite, error } = await supabase
        .from('account_invites')
        .select(`
          id,
          email,
          role,
          permissions,
          status,
          expires_at,
          owner_id,
          profiles:owner_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq('token', token)
        .single();

      if (error || !directInvite) {
        return NextResponse.json({ error: 'Convite nao encontrado' }, { status: 404 });
      }

      invite = directInvite;
    } else {
      if (!rpcData?.ok) {
        return NextResponse.json(
          { error: rpcData?.error || 'Convite nao encontrado' },
          { status: Number(rpcData?.status) || 404 }
        );
      }

      invite = rpcData.data;
    }

    if (invite.status !== 'pending') {
      return NextResponse.json(
        { error: 'Este convite ja foi usado ou cancelado' },
        { status: 400 }
      );
    }

    if (new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Este convite expirou' }, { status: 400 });
    }

    // profiles table RLS only allows a user to view their own profile.
    // If we didn't get inviter profile (common), enrich it using service-role.
    if (!invite?.profiles?.email || (!invite?.profiles?.full_name && !invite?.profiles?.avatar_url)) {
      try {
        const admin = createAdminClient();
        const { data: ownerProfile } = await admin
          .from('profiles')
          .select('full_name, email, avatar_url')
          .eq('id', invite.owner_id)
          .single();

        if (ownerProfile?.email) {
          invite.profiles = ownerProfile;
        }
      } catch {
        // ignore - invite can still be accepted without showing inviter details
      }
    }

    return NextResponse.json({ data: invite });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}

// POST - Accept an invite
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token e obrigatorio' }, { status: 400 });
    }

    const { supabase } = createClientFromRequest(request);

    // Prefer SECURITY DEFINER RPC. If migration isn't applied yet, fallback to service-role client.
    const { data: rpcData, error: rpcError } = await supabase.rpc('accept_account_invite', {
      p_token: token,
    });

    let ownerEmail: string | undefined;
    let ownerName: string | undefined;
    let memberEmail: string | undefined;
    let memberName: string | undefined;

    if (rpcError) {
      const msg = String((rpcError as any)?.message || '');
      const isMissingFn =
        msg.includes('accept_account_invite') && (msg.includes('Could not find') || msg.includes('function'));

      if (!isMissingFn) throw rpcError;

      const admin = createAdminClient();

      const { data: invite, error: inviteError } = await admin
        .from('account_invites')
        .select('*')
        .eq('token', token)
        .single();

      if (inviteError || !invite) {
        return NextResponse.json({ error: 'Convite nao encontrado' }, { status: 404 });
      }

      if (invite.status !== 'pending') {
        return NextResponse.json(
          { error: 'Este convite ja foi usado ou cancelado' },
          { status: 400 }
        );
      }

      if (new Date(invite.expires_at) < new Date()) {
        await admin.from('account_invites').update({ status: 'expired' }).eq('id', invite.id);
        return NextResponse.json({ error: 'Este convite expirou' }, { status: 400 });
      }

      const { data: userProfile, error: profileError } = await admin
        .from('profiles')
        .select('email, full_name')
        .eq('id', userId)
        .single();

      if (profileError || !userProfile?.email) {
        return NextResponse.json({ error: 'Perfil nao encontrado' }, { status: 400 });
      }

      if (userProfile.email.toLowerCase() !== String(invite.email).toLowerCase()) {
        return NextResponse.json(
          { error: 'Este convite foi enviado para outro email' },
          { status: 403 }
        );
      }

      // Insert member relationship (idempotent)
      const { error: memberError } = await admin.from('account_members').insert({
        owner_id: invite.owner_id,
        member_id: userId,
        role: invite.role,
        permissions: invite.permissions,
      });

      // Ignore duplicates (can happen due to retries)
      if (memberError && String((memberError as any)?.code || '') !== '23505') {
        throw memberError;
      }

      await admin.from('account_invites').update({ status: 'accepted' }).eq('id', invite.id);

      // Create notification for invited user (best-effort)
      try {
        const { data: ownerProfile } = await admin
          .from('profiles')
          .select('email, full_name')
          .eq('id', invite.owner_id)
          .single();

        const ownerDisplay = ownerProfile?.full_name || ownerProfile?.email || 'uma conta';
        await admin.from('notifications').insert({
          user_id: userId,
          title: 'Conta compartilhada adicionada',
          message: `Você agora tem acesso à conta de ${ownerDisplay}. Use o seletor de conta no topo do app para alternar entre as contas.`,
          type: 'info',
          link: '/app',
          read: false,
          metadata: { owner_id: invite.owner_id, role: invite.role },
        });

        ownerEmail = ownerProfile?.email || undefined;
        ownerName = ownerProfile?.full_name || undefined;
      } catch {
        // ignore notification failures
      }

      memberEmail = userProfile.email;
      memberName = userProfile.full_name || undefined;
    } else {
      if (!rpcData?.ok) {
        return NextResponse.json(
          { error: rpcData?.error || 'Não foi possível aceitar o convite.' },
          { status: Number(rpcData?.status) || 400 }
        );
      }

      ownerEmail = rpcData?.owner_email || undefined;
      ownerName = rpcData?.owner_full_name || undefined;
      memberEmail = rpcData?.member_email || undefined;
      memberName = rpcData?.member_full_name || undefined;
    }

    // Notify owner by email (best-effort).
    if (ownerEmail && memberEmail) {
      try {
        const emailTemplate = inviteAcceptedTemplate({
          memberName: memberName || 'Usuario',
          memberEmail,
        });
        await sendEmail({
          to: ownerEmail,
          subject: emailTemplate.subject,
          html: emailTemplate.html,
        });
      } catch (emailError) {
        console.error('[Sharing] Failed to send acceptance email:', emailError);
      }
    } else if (!ownerEmail) {
      console.warn('[Sharing] Owner email not available for acceptance email', {
        ownerName,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}
