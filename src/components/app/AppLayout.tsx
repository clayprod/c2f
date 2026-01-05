'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getLogo } from '@/lib/logo';
import Image from 'next/image';
import AdvisorDialog from './AdvisorDialog';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface UserProfile {
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  plan: 'free' | 'pro' | 'business';
  role?: string;
}

const planLabels: Record<string, { label: string; color: string }> = {
  free: { label: 'Free', color: 'bg-muted text-muted-foreground' },
  pro: { label: 'Pro', color: 'bg-primary/20 text-primary' },
  business: { label: 'Business', color: 'bg-amber-500/20 text-amber-500' },
};

const menuItems = [
  { icon: 'bx-home', label: 'Dashboard', path: '/app' },
  { icon: 'bx-swap-horizontal', label: 'Transações', path: '/app/transactions' },
  { icon: 'bx-wallet', label: 'Contas', path: '/app/accounts' },
  { icon: 'bx-credit-card', label: 'Cartões', path: '/app/credit-cards' },
  { icon: 'bx-categories', label: 'Categorias', path: '/app/categories' },
  { icon: 'bx-wallet-alt', label: 'Orçamentos', path: '/app/budgets' },
  { icon: 'bx-file', label: 'Dívidas', path: '/app/debts' },
  { icon: 'bx-trending-up', label: 'Investimentos', path: '/app/investments' },
  { icon: 'bx-home-alt', label: 'Patrimônio', path: '/app/assets' },
  { icon: 'bx-bullseye', label: 'Objetivos', path: '/app/goals' },
  { icon: 'bx-bar-chart', label: 'Relatórios', path: '/app/reports' },
  { icon: 'bx-share', label: 'Integrações', path: '/app/integrations' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showScrollUp, setShowScrollUp] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const menuListRef = useRef<HTMLUListElement>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetchUserProfile();
  }, []);

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
  }, [menuItems, sidebarOpen]);

  const fetchUserProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Buscar perfil e plano em paralelo
        const [profileResult, subscriptionResult] = await Promise.all([
          supabase
            .from('profiles')
            .select('full_name, email, avatar_url, role')
            .eq('id', user.id)
            .single(),
          supabase
            .from('billing_subscriptions')
            .select('plan_id, status')
            .eq('user_id', user.id)
            .maybeSingle()
        ]);

        const profile = profileResult.data;
        const subscription = subscriptionResult.data;

        // Determinar o plano (free se não tiver assinatura ativa)
        let plan: 'free' | 'pro' | 'business' = 'free';
        if (subscription && subscription.status === 'active') {
          plan = subscription.plan_id as 'free' | 'pro' | 'business';
        }

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
    router.push('/login');
    router.refresh();
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
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="h-16 border-b border-border flex items-center px-6">
            <Link href="/" className="flex items-center">
              <Image
                src={getLogo('auto')}
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
              {menuItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      href={item.path}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                        isActive
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
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                      pathname === '/app/admin'
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
              {userProfile?.avatar_url ? (
                <img
                  src={userProfile.avatar_url}
                  alt={userProfile.full_name || 'Usuário'}
                  className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-border"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <i className='bx bx-user text-primary text-xl'></i>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">
                    {userProfile?.full_name || 'Usuário'}
                  </p>
                  {userProfile?.plan && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${planLabels[userProfile.plan].color}`}>
                      {planLabels[userProfile.plan].label}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {userProfile?.email || 'Carregando...'}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                title="Sair"
              >
                <i className='bx bx-door-open text-xl'></i>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-6 bg-card/50 backdrop-blur-xl sticky top-0 z-40">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-foreground mr-4"
          >
            <i className='bx bx-menu text-2xl'></i>
          </button>

          <div className="flex items-center gap-4 flex-1">
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
                className="px-3 py-1 rounded-md flex items-center gap-2 bg-background text-sm transition-all duration-300"
              >
                <i
                  className='bx bx-brain text-base'
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
            <div className="flex-1" />
            <button className="relative p-2 text-muted-foreground hover:text-foreground transition-colors">
              <i className='bx bx-bell text-xl'></i>
              <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
            </button>
            <Link
              href="/app/settings"
              className="p-2 text-muted-foreground hover:text-foreground transition-colors"
              title="Configurações"
            >
              <i className='bx bx-cog text-xl'></i>
            </Link>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>

      <AdvisorDialog open={advisorOpen} onOpenChange={setAdvisorOpen} />
    </div>
  );
}
