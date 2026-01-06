import { AppLayout } from '@/components/app/AppLayout';

export default function PrivacyPolicyAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AppLayout>
      {children}
    </AppLayout>
  );
}