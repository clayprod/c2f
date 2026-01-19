-- Migration: Account Sharing
-- Description: Tables for sharing accounts between users with granular permissions

-- 1. Account Members table - stores active sharing relationships
CREATE TABLE IF NOT EXISTS public.account_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  permissions JSONB NOT NULL DEFAULT '{
    "dashboard": true,
    "transactions": { "view": true, "create": false, "edit": false, "delete": false },
    "budgets": { "view": true, "edit": false },
    "goals": { "view": true, "edit": false },
    "debts": { "view": true, "edit": false },
    "investments": { "view": true, "edit": false },
    "assets": { "view": true, "edit": false },
    "reports": true,
    "settings": false,
    "integrations": false
  }'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(owner_id, member_id)
);

-- 2. Account Invites table - stores pending invitations
CREATE TABLE IF NOT EXISTS public.account_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('viewer', 'editor', 'admin')),
  permissions JSONB NOT NULL DEFAULT '{
    "dashboard": true,
    "transactions": { "view": true, "create": false, "edit": false, "delete": false },
    "budgets": { "view": true, "edit": false },
    "goals": { "view": true, "edit": false },
    "debts": { "view": true, "edit": false },
    "investments": { "view": true, "edit": false },
    "assets": { "view": true, "edit": false },
    "reports": true,
    "settings": false,
    "integrations": false
  }'::jsonb,
  token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Add assigned_to field to transactions
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_account_members_owner_id ON public.account_members(owner_id);
CREATE INDEX IF NOT EXISTS idx_account_members_member_id ON public.account_members(member_id);
CREATE INDEX IF NOT EXISTS idx_account_invites_owner_id ON public.account_invites(owner_id);
CREATE INDEX IF NOT EXISTS idx_account_invites_email ON public.account_invites(email);
CREATE INDEX IF NOT EXISTS idx_account_invites_token ON public.account_invites(token);
CREATE INDEX IF NOT EXISTS idx_account_invites_status ON public.account_invites(status) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_transactions_assigned_to ON public.transactions(assigned_to) WHERE assigned_to IS NOT NULL;

-- Enable RLS
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;

-- Helper function to get owner IDs that a user can access (including their own)
CREATE OR REPLACE FUNCTION public.get_accessible_owner_ids(p_user_id UUID)
RETURNS SETOF UUID AS $$
BEGIN
  -- Return own ID
  RETURN NEXT p_user_id;
  
  -- Return owner IDs where user is a member
  RETURN QUERY
  SELECT owner_id FROM public.account_members WHERE member_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Helper function to check if user has specific permission on an owner's data
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id UUID,
  p_owner_id UUID,
  p_resource TEXT,
  p_action TEXT DEFAULT 'view'
)
RETURNS BOOLEAN AS $$
DECLARE
  v_permissions JSONB;
  v_resource_perms JSONB;
BEGIN
  -- User always has full access to their own data
  IF p_user_id = p_owner_id THEN
    RETURN TRUE;
  END IF;
  
  -- Get permissions from account_members
  SELECT permissions INTO v_permissions
  FROM public.account_members
  WHERE owner_id = p_owner_id AND member_id = p_user_id;
  
  IF v_permissions IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- Check resource permission
  v_resource_perms := v_permissions -> p_resource;
  
  IF v_resource_perms IS NULL THEN
    RETURN FALSE;
  END IF;
  
  -- If it's a boolean, return it directly
  IF jsonb_typeof(v_resource_perms) = 'boolean' THEN
    RETURN v_resource_perms::boolean;
  END IF;
  
  -- If it's an object, check the specific action
  IF jsonb_typeof(v_resource_perms) = 'object' THEN
    RETURN COALESCE((v_resource_perms ->> p_action)::boolean, FALSE);
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- RLS Policies for account_members

-- Owners can view their shared members
DROP POLICY IF EXISTS "Owners can view their shared members" ON public.account_members;
CREATE POLICY "Owners can view their shared members" ON public.account_members
  FOR SELECT USING (owner_id = auth.uid());

-- Members can view their own membership
DROP POLICY IF EXISTS "Members can view their own membership" ON public.account_members;
CREATE POLICY "Members can view their own membership" ON public.account_members
  FOR SELECT USING (member_id = auth.uid());

-- Owners can insert members
DROP POLICY IF EXISTS "Owners can insert members" ON public.account_members;
CREATE POLICY "Owners can insert members" ON public.account_members
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Owners can update member permissions
DROP POLICY IF EXISTS "Owners can update member permissions" ON public.account_members;
CREATE POLICY "Owners can update member permissions" ON public.account_members
  FOR UPDATE USING (owner_id = auth.uid());

-- Owners can delete members, members can remove themselves
DROP POLICY IF EXISTS "Owners can delete members or members can leave" ON public.account_members;
CREATE POLICY "Owners can delete members or members can leave" ON public.account_members
  FOR DELETE USING (owner_id = auth.uid() OR member_id = auth.uid());

-- RLS Policies for account_invites

-- Owners can view their invites
DROP POLICY IF EXISTS "Owners can view their invites" ON public.account_invites;
CREATE POLICY "Owners can view their invites" ON public.account_invites
  FOR SELECT USING (owner_id = auth.uid());

-- Anyone can view invite by token (for accepting)
DROP POLICY IF EXISTS "Anyone can view invite by token" ON public.account_invites;
CREATE POLICY "Anyone can view invite by token" ON public.account_invites
  FOR SELECT USING (TRUE);

-- Owners can create invites
DROP POLICY IF EXISTS "Owners can create invites" ON public.account_invites;
CREATE POLICY "Owners can create invites" ON public.account_invites
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- Owners can update invites (cancel)
DROP POLICY IF EXISTS "Owners can update invites" ON public.account_invites;
CREATE POLICY "Owners can update invites" ON public.account_invites
  FOR UPDATE USING (owner_id = auth.uid() OR status = 'pending');

-- Owners can delete invites
DROP POLICY IF EXISTS "Owners can delete invites" ON public.account_invites;
CREATE POLICY "Owners can delete invites" ON public.account_invites
  FOR DELETE USING (owner_id = auth.uid());

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_account_members_updated_at ON public.account_members;
CREATE TRIGGER update_account_members_updated_at BEFORE UPDATE ON public.account_members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE public.account_members IS 'Stores sharing relationships between account owners and members with granular permissions';
COMMENT ON TABLE public.account_invites IS 'Stores pending invitations to share account access';
COMMENT ON COLUMN public.account_members.role IS 'Role type: viewer (read-only), editor (can modify), admin (full access except settings)';
COMMENT ON COLUMN public.account_members.permissions IS 'Granular permissions per feature/page';
COMMENT ON COLUMN public.account_invites.token IS 'Unique token for invite acceptance link';
COMMENT ON COLUMN public.account_invites.expires_at IS 'Invite expires after 7 days by default';
COMMENT ON COLUMN public.transactions.assigned_to IS 'User responsible for this transaction (for shared accounts)';
