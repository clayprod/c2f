'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import AdvisorDialog from './AdvisorDialog';
import CompleteProfileForm from './CompleteProfileForm';
import { UpgradeModal } from './UpgradeModal';
import { NotificationDropdown } from './NotificationDropdown';
import { useTheme } from '@/hooks/useTheme';
import { useAccountContext } from '@/hooks/useAccountContext';
import type { PlanFeatures } from '@/services/admin/globalSettings';
import { PLAN_MODULES } from '@/lib/planFeatures';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { PremiumUpgradeTooltip } from '@/components/ui/PremiumUpgradeTooltip';
import { buildBrandfetchLogoProxyUrl } from '@/lib/brandfetch';


interface AppLayoutProps {
  children: React.ReactNode;
}

interface UserProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  plan: 'free' | 'pro' | 'premium';
  role?: string;
}

interface BankAccount {
  id: string;
  name: string;
  current_balance: number;
  type: string;
  icon?: string | null;
  color?: string | null;
  institution?: string | null;
  institution_domain?: string | null;
  institution_primary_color?: string | null;
}

interface CreditCard {
  id: string;
  name: string;
  current_balance: number;
  credit_limit: number;
  icon?: string | null;
  color?: string | null;
  institution_domain?: string | null;
  institution_primary_color?: string | null;
}

interface CreditCardBill {
  account_id: string;
  total_cents: number;
  paid_cents: number;
}

interface AccountSummary {
  bankAccounts: BankAccount[];
  creditCards: CreditCard[];
  creditCardBills: CreditCardBill[];
}

const planLabels: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-muted text-muted-foreground' },
  pro: { label: 'Pro', color: 'bg-primary/20 text-primary' },
  premium: { label: 'Premium', color: 'bg-amber-500/20 text-amber-500' },
};

const menuItems = [
  { icon: 'bx-home', label: 'Dashboard', path: '/app', minPlan: 'free' },
  { icon: 'bx-arrow-right-left', label: 'Transações', path: '/app/transactions', minPlan: 'free' },
  { icon: 'bx-wallet', label: 'Contas', path: '/app/accounts', minPlan: 'free' },
  { icon: 'bx-credit-card', label: 'Cartões', path: '/app/credit-cards', minPlan: 'free' },
  { icon: 'bx-categories', label: 'Categorias', path: '/app/categories', minPlan: 'free' },
  { icon: 'bx-wallet-alt', label: 'Orçamentos', path: '/app/budgets', minPlan: 'pro' },
  { icon: 'bx-note', label: 'Dívidas', path: '/app/debts', minPlan: 'pro' },
  { icon: 'bx-receipt', label: 'Recebíveis', path: '/app/receivables', minPlan: 'pro' },
  { icon: 'bx-trending-up', label: 'Investimentos', path: '/app/investments', minPlan: 'pro' },
  { icon: 'bx-home-alt', label: 'Patrimônio', path: '/app/assets', minPlan: 'pro' },
  { icon: 'bx-bullseye', label: 'Objetivos', path: '/app/goals', minPlan: 'pro' },
  { icon: 'bx-bar-chart', label: 'Relatórios', path: '/app/reports', minPlan: 'premium' },
  { icon: 'bx-share', label: 'Integrações', path: '/app/integrations', minPlan: 'premium' },
];

const moduleByRoute = PLAN_MODULES.reduce<Record<string, string>>((acc, module) => {
  acc[module.route] = module.id;
  return acc;
}, {});

const orderedModules = [...PLAN_MODULES].sort((a, b) => b.route.length - a.route.length);

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [planFeatures, setPlanFeatures] = useState<PlanFeatures | null>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [accountSummary, setAccountSummary] = useState<AccountSummary>({
    bankAccounts: [],
    creditCards: [],
    creditCardBills: [],
  });
  const [accountSummaryLoading, setAccountSummaryLoading] = useState(false);
  const [showSummaryScrollUp, setShowSummaryScrollUp] = useState(false);
  const [showSummaryScrollDown, setShowSummaryScrollDown] = useState(false);
  const menuListRef = useRef<HTMLUListElement>(null);
  const summaryListRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();
  const logo = useLogo();
  const { context: accountContext, activeAccountId, setActiveAccountId, isViewingSharedAccount, hasPermission } = useAccountContext();

  const persistActiveAccountNow = (id: string | null) => {
    try {
      if (id) {
        localStorage.setItem('c2f_active_account', id);
      } else {
        localStorage.removeItem('c2f_active_account');
      }
    } catch {
      // ignore
    }

    // Persist to cookie so server routes can read it immediately (before reload).
    if (!id) {
      document.cookie = `c2f_active_account=; path=/; max-age=0; samesite=lax`;
      return;
    }
    document.cookie = `c2f_active_account=${encodeURIComponent(id)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  };

  // Persist active account to cookie so server routes can read it.
  useEffect(() => {
    if (!activeAccountId) {
      document.cookie = `c2f_active_account=; path=/; max-age=0; samesite=lax`;
      return;
    }
    // 30 days
    document.cookie = `c2f_active_account=${encodeURIComponent(activeAccountId)}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  }, [activeAccountId]);

  useEffect(() => {
    fetchUserProfile();
    fetchAccountSummary();

    // Listen for profile updates from other components
    const handleProfileUpdate = () => {
      fetchUserProfile();
    };

    window.addEventListener('profile-updated', handleProfileUpdate);
    return () => {
      window.removeEventListener('profile-updated', handleProfileUpdate);
    };
  }, [activeAccountId]); // Reload profile when active account changes

  // Desabilitar scroll restoration automática do navegador
  useEffect(() => {
    if (typeof window !== 'undefined' && 'scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
  }, []);

  // Reset scroll position when navigating to a new page
  useEffect(() => {
    // Reset scroll após navegação estar completa
    const mainElement = document.querySelector('main');
    if (mainElement) {
      mainElement.scrollTop = 0;
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  // Filter menu items:
  // - Own account: based on user's plan (current behavior)
  // - Shared account: ignore invited user's plan and respect shared permissions instead
  const visibleMenuItems = menuItems.filter((item) => {
    if (isViewingSharedAccount) {
      const resource = (() => {
        switch (item.path) {
          case '/app':
            return 'dashboard';
          case '/app/transactions':
            return 'transactions';
          case '/app/accounts':
            return 'transactions';
          case '/app/credit-cards':
            return 'transactions';
          case '/app/categories':
            return 'transactions';
          case '/app/budgets':
            return 'budgets';
          case '/app/goals':
            return 'goals';
          case '/app/debts':
            return 'debts';
          case '/app/receivables':
            return 'transactions';
          case '/app/investments':
            return 'investments';
          case '/app/assets':
            return 'assets';
          case '/app/reports':
            return 'reports';
          case '/app/integrations':
            return 'integrations';
          default:
            return null;
        }
      })();

      if (!resource) return true;
      return hasPermission(resource, 'view');
    }

    // Na conta própria, mostramos os menus fixos.
    // Enquanto o perfil carrega, mostramos apenas o básico (free) para evitar flickers.
    if (!userProfile && !isViewingSharedAccount) return item.minPlan === 'free';

    return true;
  });

  useEffect(() => {
    if (isViewingSharedAccount || !planFeatures) return;

    const currentPath = pathname ?? '';
    const match = orderedModules.find((module) =>
      currentPath === module.route || currentPath.startsWith(`${module.route}/`)
    );

    if (!match) return;
    const enabled = planFeatures[match.id]?.enabled;
    if (enabled === false && currentPath !== '/app') {
      router.replace('/app');
    }
  }, [isViewingSharedAccount, planFeatures, pathname, router]);

  useEffect(() => {
    const checkScroll = () => {
      const list = menuListRef.current;
      if (!list) return;

      const { scrollTop, scrollHeight, clientHeight } = list;
      const hasOverflow = scrollHeight > clientHeight;

      setShowScrollUp(hasOverflow && scrollTop > 10);
      setShowScrollDown(hasOverflow && scrollTop < scrollHeight - clientHeight - 10);
    };

    // Aguardar um pouco para garantir que o DOM está renderizado
    const timeoutId = setTimeout(() => {
      checkScroll();
    }, 100);

    const list = menuListRef.current;
    if (list) {
      list.addEventListener('scroll', checkScroll);
      // Verificar também quando a janela redimensiona
      window.addEventListener('resize', checkScroll);

      return () => {
        clearTimeout(timeoutId);
        list.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }
  }, [visibleMenuItems, sidebarOpen]);

  useEffect(() => {
    const checkScroll = () => {
      const list = summaryListRef.current;
      if (!list) return;

      const { scrollTop, scrollHeight, clientHeight } = list;
      const hasOverflow = scrollHeight > clientHeight;

      setShowSummaryScrollUp(hasOverflow && scrollTop > 10);
      setShowSummaryScrollDown(hasOverflow && scrollTop < scrollHeight - clientHeight - 10);
    };

    const timeoutId = setTimeout(() => {
      checkScroll();
    }, 100);

    const list = summaryListRef.current;
    if (list) {
      list.addEventListener('scroll', checkScroll);
      window.addEventListener('resize', checkScroll);

      return () => {
        clearTimeout(timeoutId);
        list.removeEventListener('scroll', checkScroll);
        window.removeEventListener('resize', checkScroll);
      };
    }

    return () => clearTimeout(timeoutId);
  }, [accountSummary, accountSummaryLoading, sidebarOpen]);

  const fetchUserProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Buscar perfil e plano em paralelo
        // Use /api/billing/plan to get the correct plan (owner's plan when viewing shared account)
        const [profileResult, planResponse] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, email, avatar_url, role, city, state, monthly_income_cents')
            .eq('id', user.id)
            .single(),
          fetch('/api/billing/plan')
        ]);

        const profile = profileResult.data;
        let plan: 'free' | 'pro' | 'premium' = 'free';
        let fetchedFeatures: PlanFeatures | null = null;
        if (planResponse.ok) {
          const planData = await planResponse.json();
          plan = (planData?.plan || 'free') as 'free' | 'pro' | 'premium';
          fetchedFeatures = (planData?.features as PlanFeatures) || null;
        }
        setPlanFeatures(fetchedFeatures);

        const isProfileIncomplete = !profile?.city || !profile?.state;
        setShowCompleteProfile(!!isProfileIncomplete);

        if (profile) {
          setUserProfile({
            full_name: profile.full_name,
            email: profile.email || user.email || '',
            avatar_url: profile.avatar_url,
            plan,
            role: profile.role,
          });
        } else {
          setUserProfile({
            full_name: null,
            email: user.email || '',
            avatar_url: null,
            plan,
          });
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Use window.location instead of router to ensure a clean navigation
    // without triggering React Server Component refreshes that cause 401 errors
    window.location.href = '/login';
  };

  const fetchAccountSummary = async () => {
    setAccountSummaryLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setAccountSummary({
          bankAccounts: [],
          creditCards: [],
          creditCardBills: [],
        });
        setAccountSummaryLoading(false);
        return;
      }

      let ownerId = user.id;
      if (activeAccountId && activeAccountId !== user.id) {
        ownerId = activeAccountId;
      }

      const { data: bankAccounts } = await supabase
        .from('accounts')
        .select('id, name, current_balance, type, icon, color, institution, institution_domain, institution_primary_color')
        .eq('user_id', ownerId)
        .neq('type', 'credit_card')
        .order('current_balance', { ascending: false });

      const { data: creditCards } = await supabase
        .from('accounts')
        .select('id, name, current_balance, credit_limit, icon, color, institution_domain, institution_primary_color')
        .eq('user_id', ownerId)
        .eq('type', 'credit_card')
        .order('current_balance', { ascending: false });

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString();

      const { data: bills } = await supabase
        .from('credit_card_bills')
        .select('account_id, total_cents, paid_cents')
        .eq('user_id', ownerId)
        .gte('closing_date', startOfMonth)
        .lte('closing_date', endOfMonth)
        .not('status', 'eq', 'paid');

      const bankAccountsSorted = [...(bankAccounts || [])].sort(
        (a, b) => (b.current_balance ?? 0) - (a.current_balance ?? 0)
      );

      const billAmountByAccountId = new Map(
        (bills || []).map((bill) => [
          bill.account_id,
          (bill.total_cents ?? 0) - (bill.paid_cents ?? 0),
        ])
      );

      const creditCardsSorted = [...(creditCards || [])].sort(
        (a, b) =>
          (billAmountByAccountId.get(b.id) ?? 0) -
          (billAmountByAccountId.get(a.id) ?? 0)
      );

      setAccountSummary({
        bankAccounts: bankAccountsSorted,
        creditCards: creditCardsSorted,
        creditCardBills: bills || [],
      });
    } catch (error) {
      console.error('Error fetching account summary:', error);
      setAccountSummary({
        bankAccounts: [],
        creditCards: [],
        creditCardBills: [],
      });
    } finally {
      setAccountSummaryLoading(false);
    }
  };

  const scrollMenu = (direction: 'up' | 'down') => {
    const list = menuListRef.current;
    if (!list) return;

    const scrollAmount = 100; // pixels por clique
    const currentScroll = list.scrollTop;
    const newScroll = direction === 'up'
      ? currentScroll - scrollAmount
      : currentScroll + scrollAmount;

    list.scrollTo({
      top: newScroll,
      behavior: 'smooth'
    });
  };

  const scrollSummary = (direction: 'up' | 'down') => {
    const list = summaryListRef.current;
    if (!list) return;

    const scrollAmount = 100;
    const currentScroll = list.scrollTop;
    const newScroll = direction === 'up'
      ? currentScroll - scrollAmount
      : currentScroll + scrollAmount;

    list.scrollTo({
      top: newScroll,
      behavior: 'smooth'
    });
  };

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-background flex overflow-hidden max-w-full">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-[280px] bg-sidebar border-r border-sidebar-border transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 border-b border-border flex items-center px-6">
            <Link href="/app" onClick={() => setSidebarOpen(false)} className="flex items-center">
              <Image
                src={logo}
                alt="c2Finance"
                width={150}
                height={40}
                className="h-10 w-auto"
                style={{ objectFit: 'contain' }}
                priority
              />
            </Link>
          </div>

          <nav className="p-4 flex-1 overflow-hidden relative">
            {/* Botão scroll up */}
            {showScrollUp && (
              <button
                onClick={() => scrollMenu('up')}
                className="absolute top-6 right-4 z-10 w-8 h-8 rounded-full bg-card border border-border/50 flex items-center justify-center text-primary hover:bg-primary/10 hover:border-primary/50 transition-all shadow-lg"
                aria-label="Rolar para cima"
              >
                <i className="bx bx-chevron-up text-lg"></i>
              </button>
            )}

            {/* Botão scroll down */}
            {showScrollDown && (
              <button
                onClick={() => scrollMenu('down')}
                className="absolute bottom-6 right-4 z-10 w-8 h-8 rounded-full bg-card border border-border/50 flex items-center justify-center text-primary hover:bg-primary/10 hover:border-primary/50 transition-all shadow-lg"
                aria-label="Rolar para baixo"
              >
                <i className="bx bx-chevron-down text-lg"></i>
              </button>
            )}

            <ul
              ref={menuListRef}
              className="space-y-2 h-full overflow-y-auto scrollbar-hide"
            >
              {visibleMenuItems.map((item) => {
                const isActive = pathname === item.path;

                // Verificar se o item está bloqueado pelo plano
                const isLocked = !isViewingSharedAccount && (
                  (item.minPlan === 'pro' && userProfile?.plan === 'free') ||
                  (item.minPlan === 'premium' && (userProfile?.plan === 'free' || userProfile?.plan === 'pro')) ||
                  (planFeatures && moduleByRoute[item.path] && planFeatures[moduleByRoute[item.path]]?.enabled === false)
                );

                if (isLocked) {
                  const itemPlanLabel = item.minPlan === 'premium' ? 'Premium' : 'Pro';
                  return (
                    <li key={item.path} className="relative group">
                      <PremiumUpgradeTooltip planLabel={itemPlanLabel} isLocked={true}>
                        <div
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground/40 cursor-not-allowed hover:bg-muted/30 transition-colors w-full text-left"
                        >
                          <i className={`bx ${item.icon} text-xl`}></i>
                          <span className="font-medium">{item.label}</span>
                          <div className="ml-auto flex items-center gap-1">
                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase ${item.minPlan === 'premium'
                              ? 'bg-amber-500/10 text-amber-500/70 border border-amber-500/20'
                              : 'bg-primary/10 text-primary/70 border border-primary/20'
                              }`}>
                              {item.minPlan === 'premium' ? 'PREMIUM' : 'PRO'}
                            </span>
                            <i className="bx bx-lock-alt text-xs"></i>
                          </div>
                        </div>
                      </PremiumUpgradeTooltip>
                    </li>
                  );
                }

                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                        }`}
                    >
                      <i className={`bx ${item.icon} text-xl`}></i>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
              {/* Admin menu - only for admins */}
              {userProfile?.role === 'admin' && (
                <li>
                  <Link
                    href="/app/admin"
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${pathname === '/app/admin'
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'text-amber-500/70 hover:bg-amber-500/10 hover:text-amber-500'
                      }`}
                  >
                    <i className="bx bx-shield text-xl"></i>
                    <span className="font-medium">Admin</span>
                  </Link>
                </li>
              )}
            </ul>
          </nav>

          {/* Account Summary Section */}
          <div className="border-t border-border mt-auto h-[50vh] overflow-hidden relative">
            {showSummaryScrollUp && (
              <button
                onClick={() => scrollSummary('up')}
                className="absolute top-2 right-3 z-10 w-7 h-7 rounded-full bg-card border border-border/50 flex items-center justify-center text-primary hover:bg-primary/10 hover:border-primary/50 transition-all shadow-lg"
                aria-label="Rolar para cima"
              >
                <i className="bx bx-chevron-up text-base"></i>
              </button>
            )}
            {showSummaryScrollDown && (
              <button
                onClick={() => scrollSummary('down')}
                className="absolute bottom-2 right-3 z-10 w-7 h-7 rounded-full bg-card border border-border/50 flex items-center justify-center text-primary hover:bg-primary/10 hover:border-primary/50 transition-all shadow-lg"
                aria-label="Rolar para baixo"
              >
                <i className="bx bx-chevron-down text-base"></i>
              </button>
            )}
            <div ref={summaryListRef} className="h-full overflow-y-auto scrollbar-hide">
              {accountSummaryLoading && (
                <div className="px-4 py-4 text-center text-xs text-muted-foreground">
                  Carregando saldos...
                </div>
              )}
              {/* Bank Accounts */}
              {accountSummary.bankAccounts.length > 0 && (
                <div className="border-b border-border/50">
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Contas
                  </div>
                  {accountSummary.bankAccounts.map((account) => (
                    <Link
                      key={account.id}
                      href="/app/accounts"
                      onClick={() => setSidebarOpen(false)}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors"
                    >
                      {(() => {
                        const logo = account.institution_domain
                          ? buildBrandfetchLogoProxyUrl({
                              identifier: `domain/${account.institution_domain}`,
                              size: 28,
                              theme: 'dark',
                              type: 'icon',
                            })
                          : null;
                        const hasLogo = !!logo;
                        return (
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                              hasLogo ? 'overflow-hidden' : ''
                            }`}
                            style={{
                              backgroundColor: hasLogo
                                ? 'transparent'
                                : `${account.institution_primary_color || account.color || '#10b981'}20`,
                            }}
                          >
                            {logo ? (
                              <img src={logo} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-sm">{account.icon || '🏦'}</span>
                            )}
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{account.name}</p>
                        {account.institution && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {account.institution}
                          </p>
                        )}
                        <p className={`text-xs ${account.current_balance < 0 ? 'text-negative' : 'text-positive'}`}>
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL'
                          }).format(account.current_balance || 0)}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* Credit Cards */}
              {accountSummary.creditCards.length > 0 && (
                <div>
                  <div className="px-4 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Cartões
                  </div>
                  {accountSummary.creditCards.map((card) => {
                    const bill = accountSummary.creditCardBills.find(b => b.account_id === card.id);
                    const billAmount = bill ? (bill.total_cents - bill.paid_cents) / 100 : 0;

                    return (
                      <Link
                        key={card.id}
                        href="/app/credit-cards"
                        onClick={() => setSidebarOpen(false)}
                        className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 transition-colors"
                      >
                        {(() => {
                          const logo = card.institution_domain
                            ? buildBrandfetchLogoProxyUrl({
                                identifier: `domain/${card.institution_domain}`,
                                size: 28,
                                theme: 'dark',
                                type: 'icon',
                              })
                            : null;
                          const hasLogo = !!logo;
                          return (
                            <div
                              className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                                hasLogo ? 'overflow-hidden' : ''
                              }`}
                              style={{
                                backgroundColor: hasLogo
                                  ? 'transparent'
                                  : `${card.institution_primary_color || card.color || '#ef4444'}20`,
                              }}
                            >
                              {logo ? (
                                <img src={logo} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <span className="text-sm">{card.icon || '💳'}</span>
                              )}
                            </div>
                          );
                        })()}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{card.name}</p>
                          <p className={`text-xs ${billAmount > 0 ? 'text-rose-500' : 'text-muted-foreground'}`}>
                            {billAmount > 0
                              ? new Intl.NumberFormat('pt-BR', {
                                  style: 'currency',
                                  currency: 'BRL'
                                }).format(billAmount)
                              : 'Fatura paga'}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}

              {/* Empty State */}
              {!accountSummaryLoading && accountSummary.bankAccounts.length === 0 && accountSummary.creditCards.length === 0 && (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada</p>
                  <Link
                    href="/app/accounts"
                    onClick={() => setSidebarOpen(false)}
                    className="text-xs text-primary hover:underline mt-1 inline-block"
                  >
                    Cadastrar conta
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full lg:ml-[280px] overflow-hidden max-w-full min-w-0">
        <header className="min-h-14 md:min-h-16 border-b border-border flex items-center px-3 md:px-4 lg:px-6 bg-card/50 backdrop-blur-xl sticky top-0 z-40 min-w-0 max-w-full overflow-x-hidden pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 md:p-2 text-foreground mr-2 md:mr-4 flex-shrink-0"
          >
            <i className='bx bx-menu text-xl md:text-2xl'></i>
          </button>

          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            {userProfile && (
              <div className="p-[1px] rounded-md transition-all duration-300 group"
                style={{
                  background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                  boxShadow: '0 0 0 0 rgba(99, 102, 241, 0)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 10px 2px rgba(99, 102, 241, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(99, 102, 241, 0)';
                }}>
                <button
                  onClick={() => setAdvisorOpen(true)}
                  className="px-2 md:px-3 py-1 rounded-md flex items-center gap-1.5 md:gap-2 bg-background text-xs md:text-sm transition-all duration-300"
                >
                  <i
                    className='bx bx-sparkles text-sm md:text-base'
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  ></i>
                  <span
                    className="hidden sm:inline font-medium"
                    style={{
                      background: 'linear-gradient(135deg, #6366F1, #818CF8)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  >Advisor I.A</span>
                </button>
              </div>
            )}
            <div className="flex-1 min-w-0" />
            <div className="flex items-center gap-0.5 md:gap-2 flex-shrink-0">
              {accountContext && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors"
                      title="Selecionar conta"
                      aria-label="Selecionar conta"
                    >
                      {(() => {
                        const isOwn =
                          !activeAccountId || activeAccountId === accountContext.currentUserId;
                        const shared = isOwn
                          ? null
                          : accountContext.sharedAccounts.find((sa) => sa.ownerId === activeAccountId);

                        const avatarUrl = isOwn
                          ? userProfile?.avatar_url
                          : shared?.ownerAvatarUrl;

                        const label = isOwn
                          ? 'Minha conta'
                          : shared?.ownerName || shared?.ownerEmail || 'Conta compartilhada';

                        return (
                          <>
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={label}
                                className="w-6 h-6 rounded-full object-cover border border-border"
                              />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center border border-border">
                                <i
                                  className={`bx ${isOwn ? 'bx-user' : 'bx-group'} text-base text-muted-foreground`}
                                />
                              </div>
                            )}
                            <span className="hidden sm:inline-flex items-center gap-1.5 text-xs md:text-sm font-medium max-w-[220px]">
                              <span className="truncate max-w-[160px]">{label}</span>
                              {isOwn && userProfile?.plan && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${planLabels[userProfile.plan].color}`}>
                                  {planLabels[userProfile.plan].label}
                                </span>
                              )}
                            </span>
                          </>
                        );
                      })()}
                      <i className="bx bx-chevron-down text-muted-foreground text-sm" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>
                      <span>Conta ativa</span>
                    </DropdownMenuLabel>
                    <DropdownMenuItem
                      onClick={() => {
                        const id = accountContext.currentUserId;
                        persistActiveAccountNow(id);
                        setActiveAccountId(id);
                        window.location.reload();
                      }}
                    >
                      {userProfile?.avatar_url ? (
                        <img
                          src={userProfile.avatar_url}
                          alt="Minha conta"
                          className="w-5 h-5 rounded-full object-cover border border-border mr-2"
                        />
                      ) : (
                        <i className="bx bx-user mr-2 text-muted-foreground" />
                      )}
                      Minha conta
                    </DropdownMenuItem>
                    {accountContext.sharedAccounts.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel>Contas compartilhadas comigo</DropdownMenuLabel>
                        {accountContext.sharedAccounts.map((sa) => (
                          <DropdownMenuItem
                            key={sa.ownerId}
                            onClick={() => {
                              persistActiveAccountNow(sa.ownerId);
                              setActiveAccountId(sa.ownerId);
                              window.location.reload();
                            }}
                          >
                            {sa.ownerAvatarUrl ? (
                              <img
                                src={sa.ownerAvatarUrl}
                                alt={sa.ownerName || sa.ownerEmail || 'Conta compartilhada'}
                                className="w-5 h-5 rounded-full object-cover border border-border mr-2"
                              />
                            ) : (
                              <i className="bx bx-group mr-2 text-muted-foreground" />
                            )}
                            <span className="truncate">{sa.ownerName || sa.ownerEmail || 'Conta compartilhada'}</span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => router.push('/app/settings?tab=sharing')}
                    >
                      <i className="bx bx-share-alt mr-2 text-muted-foreground" />
                      Gerenciar compartilhamento
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
              <button
                onClick={toggleTheme}
                className="flex items-center justify-center p-1.5 md:p-2 text-muted-foreground hover:text-foreground transition-colors"
                title={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
                aria-label="Alternar tema"
              >
                <i className={`bx ${theme === 'dark' ? 'bx-sun' : 'bx-moon'} text-lg md:text-xl`}></i>
              </button>
              <Link
                href="/app/help"
                className="hidden sm:flex items-center justify-center p-1.5 md:p-2 text-muted-foreground hover:text-foreground transition-colors relative"
                title="Central de Ajuda"
              >
                <i className='bx bx-help-circle text-lg md:text-xl'></i>
              </Link>
              <NotificationDropdown />
              <Link
                href="/app/settings"
                className="flex items-center justify-center p-1.5 md:p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Configurações"
              >
                <i className='bx bx-cog text-lg md:text-xl'></i>
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center justify-center p-1.5 md:p-2 text-muted-foreground hover:text-foreground transition-colors flex-shrink-0"
                title="Sair"
                aria-label="Sair"
              >
                <i className='bx bx-door-open text-lg md:text-xl'></i>
              </button>
            </div>
          </div>
        </header>

        <main className="app-content-scaled flex-1 p-3 md:p-4 lg:p-6 overflow-y-auto overflow-x-hidden max-w-full min-w-0">{children}</main>
      </div>

      <Dialog
        open={showCompleteProfile}
        onOpenChange={setShowCompleteProfile}
      >
        <DialogContent className="max-w-2xl p-0 overflow-hidden [&>button]:hidden border-none bg-transparent shadow-none">
          <CompleteProfileForm
            useCard={true}
            className="w-full max-h-[90vh] overflow-y-auto scrollbar-thin shadow-2xl"
            redirectTo=""
            redirectIfComplete={false}
            requireAuthRedirect={false}
            onCompleted={() => setShowCompleteProfile(false)}
          />
        </DialogContent>
      </Dialog>

      <AdvisorDialog open={advisorOpen} onOpenChange={setAdvisorOpen} />
      <UpgradeModal />
    </div>
  );
}
