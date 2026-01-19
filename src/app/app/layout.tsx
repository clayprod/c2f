'use client';

import AppLayout from '@/components/app/AppLayout';
import { AppThemeProvider } from '@/components/app/ThemeProvider';

export default function AppLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppThemeProvider>
      <AppLayout>{children}</AppLayout>
    </AppThemeProvider>
  );
}

