'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import AdvisorDialog from './AdvisorDialog';
import CompleteProfileForm from './CompleteProfileForm';
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
  const menuListRef = useRef<HTMLUListElement>(null);
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
            // Not present in permissions JSON; tie to transactions visibility.
            return 'transactions';
          case '/app/credit-cards':
            // Not present in permissions JSON; tie to transactions visibility.
            return 'transactions';
          case '/app/categories':
            // Not present in permissions JSON; tie to transactions visibility.
            return 'transactions';
          case '/app/budgets':
            return 'budgets';
          case '/app/goals':
            return 'goals';
          case '/app/debts':
            return 'debts';
          case '/app/receivables':
            // Not present in permissions JSON; tie to transactions visibility.
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
      // For object-shaped permissions, check "view" explicitly.
      return hasPermission(resource, 'view');
    }

    if (planFeatures) {
      const featureId = moduleByRoute[item.path];
      if (featureId) {
        const enabled = planFeatures[featureId]?.enabled;
        if (enabled !== undefined) return enabled;
      }
    }

    if (!userProfile) return item.minPlan === 'free';
    if (item.minPlan === 'free') return true;
    if (item.minPlan === 'pro') return userProfile.plan === 'pro' || userProfile.plan === 'premium';
    if (item.minPlan === 'premium') return userProfile.plan === 'premium';
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

        const identities = user.identities || [];
        const isOAuthUser = identities.some((identity: any) => identity.provider === 'google');
        const isProfileIncomplete = !profile?.city || !profile?.state || !profile?.monthly_income_cents;
        setShowCompleteProfile(isOAuthUser && isProfileIncomplete);

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

  return (
    <div className="min-h-[100dvh] h-[100dvh] bg-background flex overflow-hidden max-w-full">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
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
              className="space-y-2 h-full overflow-y-auto max-h-[calc(100vh-200px)] scrollbar-hide"
            >
              {visibleMenuItems.map((item) => {
                const isActive = pathname === item.path;
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

          <div className="p-4 border-t border-border mt-auto">
            <div className="flex items-center gap-3 px-4 py-3">
              <Link
                href="/app/settings"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 flex-1 min-w-0 rounded-xl hover:bg-muted transition-colors cursor-pointer group"
              >
                <div className="flex flex-col items-center gap-1 flex-shrink-0">
                  {userProfile?.avatar_url ? (
                    <img
                      src={userProfile.avatar_url}
                      alt={userProfile.full_name || 'Usuário'}
                      className="w-10 h-10 rounded-full object-cover border border-border"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <i className='bx bx-user text-primary text-xl'></i>
                    </div>
                  )}
                  {userProfile?.plan && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${planLabels[userProfile.plan].color}`}>
                      {planLabels[userProfile.plan].label}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">
                    {userProfile?.full_name || 'Usuário'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate group-hover:text-foreground transition-colors">
                    {userProfile?.email || 'Carregando...'}
                  </p>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground flex-shrink-0 p-2 rounded-lg hover:bg-muted transition-colors"
                title="Sair"
                aria-label="Sair"
              >
                <i className='bx bx-door-open text-xl'></i>
              </button>
            </div>

            {/* Links to legal pages */}
            <div className="flex flex-col gap-1 mt-3 px-4 text-xs text-muted-foreground">
              <Link href="/app/terms-of-service" onClick={() => setSidebarOpen(false)} className="hover:text-foreground transition-colors">
                Termos de Uso
              </Link>
              <Link href="/app/privacy-policy" onClick={() => setSidebarOpen(false)} className="hover:text-foreground transition-colors">
                Política de Privacidade
              </Link>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-full lg:ml-64 overflow-hidden max-w-full min-w-0">
        <header className="min-h-14 md:min-h-16 border-b border-border flex items-center px-3 md:px-4 lg:px-6 bg-card/50 backdrop-blur-xl sticky top-0 z-40 min-w-0 max-w-full overflow-x-hidden pt-[env(safe-area-inset-top)]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-1.5 md:p-2 text-foreground mr-2 md:mr-4 flex-shrink-0"
          >
            <i className='bx bx-menu text-xl md:text-2xl'></i>
          </button>

          <div className="flex items-center gap-2 md:gap-4 flex-1 min-w-0">
            {userProfile && userProfile.plan !== 'free' && (
              <div className="p-[1px] rounded-md transition-all duration-300 group"
                style={{
                  background: 'linear-gradient(to right, #9333ea, #3b82f6)',
                  boxShadow: '0 0 0 0 rgba(147, 51, 234, 0)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 10px 2px rgba(147, 51, 234, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.boxShadow = '0 0 0 0 rgba(147, 51, 234, 0)';
                }}>
                <button
                  onClick={() => setAdvisorOpen(true)}
                  className="px-2 md:px-3 py-1 rounded-md flex items-center gap-1.5 md:gap-2 bg-background text-xs md:text-sm transition-all duration-300"
                >
                  <i
                    className='bx bx-sparkles text-sm md:text-base'
                    style={{
                      background: 'linear-gradient(to right, #9333ea, #3b82f6)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                    }}
                  ></i>
                  <span
                    className="hidden sm:inline font-medium"
                    style={{
                      background: 'linear-gradient(to right, #9333ea, #3b82f6)',
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
                          </>
                        );
                      })()}
                      <span className="hidden sm:inline text-xs md:text-sm font-medium max-w-[180px] truncate">
                        {(() => {
                          if (!activeAccountId) return 'Minha conta';
                          if (activeAccountId === accountContext.currentUserId) return 'Minha conta';
                          const shared = accountContext.sharedAccounts.find((sa) => sa.ownerId === activeAccountId);
                          return shared?.ownerName || shared?.ownerEmail || 'Conta compartilhada';
                        })()}
                      </span>
                      <i className="bx bx-chevron-down text-muted-foreground text-sm" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-72">
                    <DropdownMenuLabel>Conta ativa</DropdownMenuLabel>
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
            </div>

            <Link
              href="/app/settings"
              className="flex items-center justify-center p-1.5 md:p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Configurações"
            >
              <i className='bx bx-cog text-lg md:text-xl'></i>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-3 md:p-4 lg:p-6 overflow-y-auto overflow-x-hidden max-w-full min-w-0">{children}</main>
      </div>

      <Dialog
        open={showCompleteProfile}
        onOpenChange={(open) => {
          if (open) {
            setShowCompleteProfile(true);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto [&>button]:hidden">
          <CompleteProfileForm
            useCard={false}
            className="p-0"
            redirectTo=""
            redirectIfComplete={false}
            requireAuthRedirect={false}
            onCompleted={() => setShowCompleteProfile(false)}
          />
        </DialogContent>
      </Dialog>

      <AdvisorDialog open={advisorOpen} onOpenChange={setAdvisorOpen} />
    </div>
  );
}
