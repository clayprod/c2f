'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getLogo } from '@/lib/logo';
import Image from 'next/image';

interface AppLayoutProps {
  children: React.ReactNode;
}

interface UserProfile {
  full_name: string | null;
  email: string;
}

const menuItems = [
  { icon: 'bx-home', label: 'Dashboard', path: '/app' },
  { icon: 'bx-swap-horizontal', label: 'Transações', path: '/app/transactions' },
  { icon: 'bx-wallet-alt', label: 'Orçamentos', path: '/app/budgets' },
  { icon: 'bx-credit-card', label: 'Dívidas', path: '/app/debts' },
  { icon: 'bx-line-chart', label: 'Investimentos', path: '/app/investments' },
  { icon: 'bx-bullseye', label: 'Objetivos', path: '/app/goals' },
  { icon: 'bx-brain', label: 'Advisor', path: '/app/advisor' },
  { icon: 'bx-plug', label: 'Integrações', path: '/app/integrations' },
];

export default function AppLayout({ children }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          setUserProfile({
            full_name: profile.full_name,
            email: profile.email || user.email || '',
          });
        } else {
          setUserProfile({
            full_name: null,
            email: user.email || '',
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

  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-border">
            <Link href="/" className="flex items-center">
              <Image
                src={getLogo('auto')}
                alt="c2Finance" 
                width={120}
                height={32}
                className="h-8 w-auto"
                style={{ objectFit: 'contain' }}
                priority
              />
            </Link>
          </div>

          <nav className="flex-1 p-4">
            <ul className="space-y-2">
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
            </ul>
          </nav>

          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <i className='bx bx-user text-primary text-xl'></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">
                  {userProfile?.full_name || 'Usuário'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {userProfile?.email || 'Carregando...'}
                </p>
              </div>
              <button 
                onClick={handleLogout}
                className="text-muted-foreground hover:text-foreground"
                title="Sair"
              >
                <i className='bx bx-door-open text-xl'></i>
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-border flex items-center px-4 lg:px-6 bg-card/50 backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-foreground mr-4"
          >
            <i className='bx bx-menu text-2xl'></i>
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
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
    </div>
  );
}
