import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { createErrorResponse } from '@/lib/errors';
import { sendEmail, inviteNewUserTemplate, inviteExistingUserTemplate } from '@/services/email';
import { z } from 'zod';

const createInviteSchema = z.object({
  email: z.string().email('Email invalido'),
  role: z.enum(['viewer', 'editor', 'admin']).default('viewer'),
  permissions: z.object({
    dashboard: z.union([z.boolean(), z.object({ view: z.boolean() })]).optional(),
    transactions: z.object({
      view: z.boolean(),
      create: z.boolean(),
      edit: z.boolean(),
      delete: z.boolean(),
    }).optional(),
    budgets: z.object({
      view: z.boolean(),
      edit: z.boolean(),
    }).optional(),
    goals: z.union([z.boolean(), z.object({ view: z.boolean(), edit: z.boolean() })]).optional(),
    debts: z.union([z.boolean(), z.object({ view: z.boolean(), edit: z.boolean() })]).optional(),
    investments: z.union([z.boolean(), z.object({ view: z.boolean(), edit: z.boolean() })]).optional(),
    assets: z.union([z.boolean(), z.object({ view: z.boolean(), edit: z.boolean() })]).optional(),
    reports: z.union([z.boolean(), z.object({ view: z.boolean() })]).optional(),
    settings: z.boolean().optional(),
    integrations: z.boolean().optional(),
  }).optional(),
});

// GET - List pending invites for the current user
export async function GET() {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = await createClient();

    const { data: invites, error } = await supabase
      .from('account_invites')
      .select('*')
      .eq('owner_id', userId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: invites });
  } catch (error) {
    console.error('[Sharing/Invites] GET error:', error);
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}

// POST - Create a new invite and send email
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = createInviteSchema.parse(body);

    const supabase = await createClient();

    // Get owner profile
    const { data: ownerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', userId)
      .single();

    if (profileError) throw profileError;

    // Check if user is trying to invite themselves
    if (validatedData.email.toLowerCase() === ownerProfile.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Voce nao pode convidar a si mesmo' },
        { status: 400 }
      );
    }

    // Check if there's already a pending invite for this email
    const { data: existingInvite } = await supabase
      .from('account_invites')
      .select('id')
      .eq('owner_id', userId)
      .eq('email', validatedData.email.toLowerCase())
      .eq('status', 'pending')
      .single();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'Ja existe um convite pendente para este email' },
        { status: 400 }
      );
    }

    // Check if this user is already a member
    const { data: existingMember } = await supabase
      .from('account_members')
      .select('id, member_id')
      .eq('owner_id', userId)
      .single();

    // Check if the email belongs to an existing user
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', validatedData.email.toLowerCase())
      .single();

    if (existingUser && existingMember?.member_id === existingUser.id) {
      return NextResponse.json(
        { error: 'Este usuario ja tem acesso a sua conta' },
        { status: 400 }
      );
    }

    // Default permissions based on role
    const defaultPermissions = getDefaultPermissions(validatedData.role);
    const permissions = validatedData.permissions || defaultPermissions;

    // Create the invite
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const { data: invite, error: insertError } = await supabase
      .from('account_invites')
      .insert({
        owner_id: userId,
        email: validatedData.email.toLowerCase(),
        role: validatedData.role,
        permissions,
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Generate invite link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const inviteLink = existingUser
      ? `${baseUrl}/app/sharing/accept?token=${invite.token}`
      : `${baseUrl}/signup?invite=${invite.token}`;

    // Send email
    const emailTemplate = existingUser
      ? inviteExistingUserTemplate({
          ownerName: ownerProfile.full_name || 'Usuario',
          ownerEmail: ownerProfile.email,
          inviteLink,
          role: validatedData.role,
          expiresAt: expiresAt.toLocaleDateString('pt-BR'),
        })
      : inviteNewUserTemplate({
          ownerName: ownerProfile.full_name || 'Usuario',
          ownerEmail: ownerProfile.email,
          inviteLink,
          role: validatedData.role,
          expiresAt: expiresAt.toLocaleDateString('pt-BR'),
        });

    try {
      await sendEmail({
        to: validatedData.email,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
      });
      console.log('[Sharing] Invite email sent successfully to:', validatedData.email);
    } catch (emailError) {
      console.error('[Sharing] Failed to send invite email:', emailError);
      
      // Check if it's a configuration error
      const errorMessage = emailError instanceof Error ? emailError.message : String(emailError);
      if (errorMessage.includes('SMTP not configured') || errorMessage.includes('not configured')) {
        return NextResponse.json(
          { 
            error: 'SMTP nao configurado. Por favor, configure as configuracoes de email no painel administrativo antes de enviar convites.',
            details: 'O convite foi criado, mas o email nao foi enviado. Configure o SMTP e tente novamente.'
          },
          { status: 500 }
        );
      }

      // For other email errors, return error but keep the invite created
      return NextResponse.json(
        { 
          error: 'Erro ao enviar email de convite',
          details: errorMessage,
          invite: invite, // Return invite so user can manually share the link
          inviteLink: inviteLink
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: invite });
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

// DELETE - Cancel an invite
export async function DELETE(request: NextRequest) {
  try {
    const userId = await getUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const inviteId = searchParams.get('id');

    if (!inviteId) {
      return NextResponse.json({ error: 'ID do convite e obrigatorio' }, { status: 400 });
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from('account_invites')
      .update({ status: 'cancelled' })
      .eq('id', inviteId)
      .eq('owner_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json({ error: errorResponse.error }, { status: errorResponse.statusCode });
  }
}

function getDefaultPermissions(role: string): Record<string, unknown> {
  switch (role) {
    case 'admin':
      return {
        dashboard: true,
        transactions: { view: true, create: true, edit: true, delete: true },
        budgets: { view: true, edit: true },
        goals: { view: true, edit: true },
        debts: { view: true, edit: true },
        investments: { view: true, edit: true },
        assets: { view: true, edit: true },
        reports: true,
        settings: false,
        integrations: false,
      };
    case 'editor':
      return {
        dashboard: true,
        transactions: { view: true, create: true, edit: true, delete: false },
        budgets: { view: true, edit: true },
        goals: { view: true, edit: false },
        debts: { view: true, edit: false },
        investments: { view: true, edit: false },
        assets: { view: true, edit: false },
        reports: true,
        settings: false,
        integrations: false,
      };
    case 'viewer':
    default:
      return {
        dashboard: true,
        transactions: { view: true, create: false, edit: false, delete: false },
        budgets: { view: true, edit: false },
        goals: { view: true, edit: false },
        debts: { view: true, edit: false },
        investments: { view: true, edit: false },
        assets: { view: true, edit: false },
        reports: true,
        settings: false,
        integrations: false,
      };
  }
}
