-- Migration: Fix account invite acceptance with RLS
-- Description:
--  - Prevent broad read/update access to account_invites
--  - Add SECURITY DEFINER RPCs to preview/accept invites safely under RLS

-- 1) Tighten account_invites RLS (the acceptance flow will use SECURITY DEFINER RPC)
DO $$
BEGIN
  -- Restrict "view by token" (previously FOR SELECT USING (TRUE))
  EXECUTE 'DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.account_invites';

  -- Restrict updates to the owner only (previously allowed updating ANY pending invite)
  EXECUTE 'DROP POLICY IF EXISTS "Owners can update invites" ON public.account_invites';
  EXECUTE '
    CREATE POLICY "Owners can update invites" ON public.account_invites
      FOR UPDATE
      USING (owner_id = auth.uid())
      WITH CHECK (owner_id = auth.uid())
  ';
EXCEPTION
  WHEN undefined_table THEN
    -- If table does not exist in this environment, ignore.
    NULL;
END $$;

-- 2) RPC: preview invite by token (for accept page UI)
CREATE OR REPLACE FUNCTION public.get_account_invite_preview(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_invite public.account_invites%ROWTYPE;
  v_owner_full_name TEXT;
  v_owner_email TEXT;
  v_owner_avatar_url TEXT;
BEGIN
  SELECT * INTO v_invite
  FROM public.account_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 404, 'error', 'Convite nao encontrado');
  END IF;

  SELECT p.full_name, p.email, p.avatar_url
    INTO v_owner_full_name, v_owner_email, v_owner_avatar_url
  FROM public.profiles p
  WHERE p.id = v_invite.owner_id;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'data', jsonb_build_object(
      'id', v_invite.id,
      'email', v_invite.email,
      'role', v_invite.role,
      'permissions', v_invite.permissions,
      'status', v_invite.status,
      'expires_at', v_invite.expires_at,
      'owner_id', v_invite.owner_id,
      'profiles', jsonb_build_object(
        'full_name', v_owner_full_name,
        'email', v_owner_email,
        'avatar_url', v_owner_avatar_url
      )
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_account_invite_preview(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_account_invite_preview(UUID) TO anon, authenticated;

-- 3) RPC: accept invite (inserts account_members, updates invite status, and creates notification)
CREATE OR REPLACE FUNCTION public.accept_account_invite(p_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_invite public.account_invites%ROWTYPE;
  v_user_email TEXT;
  v_user_full_name TEXT;
  v_owner_full_name TEXT;
  v_owner_email TEXT;
  v_already_member BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 401, 'error', 'Unauthorized');
  END IF;

  SELECT * INTO v_invite
  FROM public.account_invites
  WHERE token = p_token;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 404, 'error', 'Convite nao encontrado');
  END IF;

  IF v_invite.status <> 'pending' THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 400,
      'error', 'Este convite ja foi usado ou cancelado'
    );
  END IF;

  IF v_invite.expires_at < NOW() THEN
    UPDATE public.account_invites
      SET status = 'expired'
    WHERE id = v_invite.id;

    RETURN jsonb_build_object('ok', FALSE, 'status', 400, 'error', 'Este convite expirou');
  END IF;

  SELECT p.email, p.full_name
    INTO v_user_email, v_user_full_name
  FROM public.profiles p
  WHERE p.id = v_user_id;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'status', 400, 'error', 'Perfil nao encontrado');
  END IF;

  IF lower(v_user_email) <> lower(v_invite.email) THEN
    RETURN jsonb_build_object(
      'ok', FALSE,
      'status', 403,
      'error', 'Este convite foi enviado para outro email'
    );
  END IF;

  SELECT p.full_name, p.email
    INTO v_owner_full_name, v_owner_email
  FROM public.profiles p
  WHERE p.id = v_invite.owner_id;

  IF EXISTS (
    SELECT 1
    FROM public.account_members am
    WHERE am.owner_id = v_invite.owner_id
      AND am.member_id = v_user_id
  ) THEN
    v_already_member := TRUE;
  ELSE
    BEGIN
      INSERT INTO public.account_members (owner_id, member_id, role, permissions)
      VALUES (v_invite.owner_id, v_user_id, v_invite.role, v_invite.permissions);
    EXCEPTION
      WHEN unique_violation THEN
        v_already_member := TRUE;
    END;
  END IF;

  UPDATE public.account_invites
    SET status = 'accepted'
  WHERE id = v_invite.id;

  -- Create a notification for the invited user (best-effort)
  BEGIN
    INSERT INTO public.notifications (user_id, title, message, type, link, read, metadata)
    VALUES (
      v_user_id,
      'Conta compartilhada adicionada',
      'Você agora tem acesso à conta de ' || COALESCE(v_owner_full_name, v_owner_email, 'uma conta')
        || '. Use o seletor de conta no topo do app para alternar entre as contas.',
      'info',
      '/app',
      FALSE,
      jsonb_build_object('owner_id', v_invite.owner_id, 'role', v_invite.role)
    );
  EXCEPTION
    WHEN undefined_table THEN
      NULL;
    WHEN others THEN
      NULL;
  END;

  RETURN jsonb_build_object(
    'ok', TRUE,
    'already_member', v_already_member,
    'owner_id', v_invite.owner_id,
    'owner_email', v_owner_email,
    'owner_full_name', v_owner_full_name,
    'member_email', v_user_email,
    'member_full_name', v_user_full_name,
    'role', v_invite.role
  );
END;
$$;

REVOKE ALL ON FUNCTION public.accept_account_invite(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_account_invite(UUID) TO authenticated;

