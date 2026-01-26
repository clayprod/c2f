'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CompleteProfileDialog } from './CompleteProfileDialog';

export function ProfileCompletionCheck() {
  const [showDialog, setShowDialog] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkProfile = async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          setIsChecking(false);
          return;
        }

        // Verificar se e usuario OAuth (Google)
        const identities = user.identities || [];
        const isOAuthUser = identities.some((identity: any) => identity.provider === 'google');

        if (!isOAuthUser) {
          setIsChecking(false);
          return;
        }

        // Verificar se perfil esta incompleto
        const { data: profile } = await supabase
          .from('profiles')
          .select('city, state, monthly_income_cents')
          .eq('id', user.id)
          .single();

        const isProfileIncomplete = !profile ||
          !profile.city ||
          !profile.state ||
          !profile.monthly_income_cents;

        if (isProfileIncomplete) {
          setShowDialog(true);
        }
      } catch (error) {
        console.error('Erro ao verificar perfil:', error);
      } finally {
        setIsChecking(false);
      }
    };

    checkProfile();
  }, []);

  const handleComplete = () => {
    setShowDialog(false);
  };

  if (isChecking) {
    return null;
  }

  return (
    <CompleteProfileDialog
      open={showDialog}
      onComplete={handleComplete}
    />
  );
}
