-- Migration: Create whatsapp_verifications table
-- Stores verified WhatsApp numbers for users (premium feature)

-- Create table for WhatsApp number verifications
CREATE TABLE IF NOT EXISTS public.whatsapp_verifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  phone_number TEXT NOT NULL, -- Format: +5511999999999
  phone_number_normalized TEXT NOT NULL, -- Format: 5511999999999 (without +)
  verification_code TEXT, -- 6-digit code
  verification_code_expires_at TIMESTAMP WITH TIME ZONE,
  verified_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired', 'revoked')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id), -- Each user can have only one verified number
  UNIQUE(phone_number_normalized) -- Each number can belong to only one user
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_user_id ON public.whatsapp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_phone ON public.whatsapp_verifications(phone_number_normalized);
CREATE INDEX IF NOT EXISTS idx_whatsapp_verifications_status ON public.whatsapp_verifications(status);

-- Enable RLS
ALTER TABLE public.whatsapp_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only view/manage their own verification
CREATE POLICY "Users can view own verification" ON public.whatsapp_verifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own verification" ON public.whatsapp_verifications
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own verification" ON public.whatsapp_verifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own verification" ON public.whatsapp_verifications
  FOR DELETE USING (user_id = auth.uid());

-- Admin can view all verifications
CREATE POLICY "Admins can view all verifications" ON public.whatsapp_verifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_whatsapp_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_whatsapp_verifications_updated_at ON public.whatsapp_verifications;
CREATE TRIGGER update_whatsapp_verifications_updated_at
  BEFORE UPDATE ON public.whatsapp_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_whatsapp_verifications_updated_at();
