'use client';

import { ReactNode } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PlanGuardProps {
    children: ReactNode;
    minPlan: 'free' | 'pro' | 'premium';
    fallback?: ReactNode;
    showFallback?: boolean;
}

export function PlanGuard({
    children,
    minPlan,
    fallback,
    showFallback = true
}: PlanGuardProps) {
    const { userProfile, loading } = useProfile();

    if (loading) {
        return <div className="animate-pulse bg-muted h-20 w-full rounded-xl" />;
    }

    const planOrder = { free: 0, pro: 1, premium: 2 };
    const userPlanLevel = planOrder[userProfile?.plan || 'free'];
    const minPlanLevel = planOrder[minPlan];

    if (userPlanLevel >= minPlanLevel) {
        return <>{children}</>;
    }

    if (!showFallback) {
        return null;
    }

    if (fallback) {
        return <>{fallback}</>;
    }

    return (
        <div className="glass-card p-8 text-center space-y-4 border-2 border-dashed border-primary/20 bg-primary/5">
            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className='bx bx-lock text-3xl text-primary'></i>
            </div>
            <h3 className="text-xl font-display font-bold">Recurso Premium</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
                Esta funcionalidade está disponível apenas para usuários dos planos <strong>Pro</strong> ou <strong>Premium</strong>.
                Atualize sua conta para ter acesso total ao c2Finance.
            </p>
            <div className="pt-4">
                <Link href="/pricing">
                    <Button className="btn-primary px-8">
                        Ver Planos e Preços
                    </Button>
                </Link>
            </div>
        </div>
    );
}
