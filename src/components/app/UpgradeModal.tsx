'use client';

import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { OPEN_UPGRADE_MODAL_EVENT } from '@/hooks/useUpgradeModal';

interface PlanFeature {
    id: string;
    text: string;
    enabled: boolean;
}

interface Plan {
    id: string;
    name: string;
    price: number | null;
    priceFormatted: string;
    description: string;
    features: PlanFeature[];
}

interface UserPlan {
    plan: string;
    status: string;
    current_period_end?: string;
}

export function UpgradeModal() {
    const [open, setOpen] = useState(false);
    const [upgrading, setUpgrading] = useState(false);
    const [plans, setPlans] = useState<Record<string, Plan>>({});
    const [plan, setPlan] = useState<UserPlan | null>(null);
    const { toast } = useToast();

    useEffect(() => {
        const handleOpen = () => setOpen(true);
        window.addEventListener(OPEN_UPGRADE_MODAL_EVENT, handleOpen);
        return () => window.removeEventListener(OPEN_UPGRADE_MODAL_EVENT, handleOpen);
    }, []);

    useEffect(() => {
        if (open) {
            fetchPlan();
            fetchPlanPrices();
        }
    }, [open]);

    const fetchPlanPrices = () => {
        fetch('/api/public/pricing?refresh=true')
            .then((res) => {
                if (res.ok) {
                    return res.json();
                }
                throw new Error('Failed to fetch pricing');
            })
            .then((data) => {
                const plansMap: Record<string, Plan> = {};
                (data.plans || []).forEach((p: Plan) => {
                    if (p.id === 'pro' || p.id === 'premium') {
                        plansMap[p.id] = p;
                    }
                });
                setPlans(plansMap);
            })
            .catch((error) => {
                console.error('Error fetching plan prices:', error);
                // Fallback com dados básicos
                setPlans({
                    pro: {
                        id: 'pro',
                        name: 'Pro',
                        price: 2900,
                        priceFormatted: 'R$29',
                        description: 'O poder da IA para suas finanças',
                        features: [
                            { id: 'all_free', text: 'Tudo do plano Free', enabled: true },
                            { id: 'transactions', text: 'Lançamentos ilimitados', enabled: true },
                            { id: 'budgets', text: 'Orçamentos mensais por categoria', enabled: true },
                            { id: 'debts', text: 'Controle e negociação de dívidas', enabled: true },
                            { id: 'investments', text: 'Acompanhamento de investimentos', enabled: true },
                            { id: 'goals', text: 'Metas financeiras com projeções', enabled: true },
                            { id: 'ai_advisor', text: 'AI Advisor (10 consultas/mês)', enabled: true },
                        ],
                    },
                    premium: {
                        id: 'premium',
                        name: 'Premium',
                        price: 7900,
                        priceFormatted: 'R$79',
                        description: 'Análise avançada e IA ilimitada',
                        features: [
                            { id: 'all_pro', text: 'Tudo do plano Pro', enabled: true },
                            { id: 'reports', text: 'Relatórios detalhados e exportação', enabled: true },
                            { id: 'integrations', text: 'WhatsApp + Open Finance*', enabled: true },
                            { id: 'assets', text: 'Gestão de patrimônio e bens', enabled: true },
                            { id: 'ai_advisor', text: 'AI Advisor ilimitado', enabled: true },
                        ],
                    },
                });
            });
    };

    const fetchPlan = async () => {
        try {
            const res = await fetch('/api/billing/plan');
            const data = await res.json();
            setPlan(data);
        } catch (error) {
            console.error('Error fetching plan:', error);
        }
    };

    const handleUpgrade = async (planType: 'pro' | 'premium') => {
        try {
            setUpgrading(true);
            const res = await fetch('/api/billing/checkout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ plan: planType }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || 'Erro ao criar sessão de checkout');
            }

            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            }
        } catch (error: any) {
            toast({
                title: 'Falha ao iniciar upgrade',
                description: error.message || 'Não foi possível iniciar o processo de upgrade. Tente novamente mais tarde.',
                variant: 'destructive',
            });
            setUpgrading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl font-display font-bold">
                        <i className='bx bx-rocket text-primary'></i>
                        Escolha seu novo Plano
                    </DialogTitle>
                    <DialogDescription>
                        Desbloqueie o poder da IA e tenha controle total das suas finanças
                    </DialogDescription>
                </DialogHeader>

                <div className="grid md:grid-cols-2 gap-6 py-4">
                    {/* Pro Plan Card */}
                    <div className={`p-6 rounded-2xl border-2 transition-all ${plan?.plan === 'pro' ? 'border-primary/20 bg-primary/5 opacity-60 cursor-default' : 'border-border hover:border-primary/50'}`}>
                        <div className="mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                {plans.pro?.name || 'Plano Pro'}
                                {plan?.plan === 'pro' && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase">Atual</span>}
                            </h3>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-3xl font-bold">{plans.pro?.priceFormatted || 'R$29'}</span>
                                <span className="text-muted-foreground">/mês</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{plans.pro?.description || 'O poder da IA para suas finanças'}</p>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {(plans.pro?.features || []).map((feature) => (
                                <li key={feature.id} className="flex items-start gap-2 text-sm">
                                    <i className='bx bx-check text-primary text-lg flex-shrink-0 mt-0.5'></i>
                                    <span className="text-foreground/80">{feature.text}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            onClick={() => handleUpgrade('pro')}
                            disabled={upgrading || plan?.plan === 'pro' || plan?.plan === 'premium'}
                            className="w-full btn-primary"
                        >
                            {plan?.plan === 'pro' ? 'Seu Plano Atual' : upgrading ? 'Processando...' : 'Assinar Pro'}
                        </Button>
                    </div>

                    {/* Premium Plan Card */}
                    <div className={`p-6 rounded-2xl border-2 border-amber-500/30 bg-amber-500/5 transition-all hover:border-amber-500/60 relative ${plan?.plan === 'premium' ? 'opacity-60 cursor-default' : ''}`}>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                            <span className="badge-pill text-[10px] bg-amber-500 text-white border-amber-500">
                                RECOMENDADO
                            </span>
                        </div>
                        <div className="mb-6">
                            <h3 className="text-xl font-bold flex items-center gap-2">
                                {plans.premium?.name || 'Plano Premium'}
                                {plan?.plan === 'premium' && <span className="text-xs bg-amber-500/20 text-amber-500 px-2 py-0.5 rounded-full uppercase">Atual</span>}
                            </h3>
                            <div className="flex items-baseline gap-1 mt-2">
                                <span className="text-3xl font-bold font-display">{plans.premium?.priceFormatted || 'R$79'}</span>
                                <span className="text-muted-foreground">/mês</span>
                            </div>
                            <p className="text-sm text-muted-foreground mt-2">{plans.premium?.description || 'Análise avançada e IA ilimitada'}</p>
                        </div>

                        <ul className="space-y-3 mb-8">
                            {(plans.premium?.features || []).map((feature) => (
                                <li key={feature.id} className="flex items-start gap-2 text-sm">
                                    <i className='bx bx-check text-amber-500 text-lg flex-shrink-0 mt-0.5'></i>
                                    <span className="text-foreground/80">{feature.text}</span>
                                </li>
                            ))}
                        </ul>

                        <Button
                            onClick={() => handleUpgrade('premium')}
                            disabled={upgrading || plan?.plan === 'premium'}
                            className="w-full bg-amber-500 hover:bg-amber-600 text-white"
                        >
                            {plan?.plan === 'premium' ? 'Seu Plano Atual' : upgrading ? 'Processando...' : 'Assinar Premium'}
                        </Button>
                    </div>
                </div>

                <div className="text-center mt-4">
                    <p className="text-xs text-muted-foreground">
                        Cancele a qualquer momento direto pelo portal de cobrança.
                        Ao clicar em assinar, você será redirecionado para o Checkout seguro da Stripe.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
