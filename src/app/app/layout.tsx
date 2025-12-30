'use client';

import AppLayout from '@/components/app/AppLayout';

export default function AppLayoutWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppLayout>{children}</AppLayout>;
}

