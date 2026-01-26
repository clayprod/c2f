'use client';

import AppLayout from '@/components/app/AppLayout';
import { AppThemeProvider } from '@/components/app/ThemeProvider';
import { ProfileCompletionCheck } from '@/components/auth/ProfileCompletionCheck';

export default function AppLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppThemeProvider>
      <AppLayout>{children}</AppLayout>
      <ProfileCompletionCheck />
    </AppThemeProvider>
  );
}

