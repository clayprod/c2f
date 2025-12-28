import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import logo from '@/assets/logo.png';

interface AppLayoutProps {
  children: React.ReactNode;
}

const menuItems = [
  { icon: 'bx-home-alt', label: 'Dashboard', path: '/app' },
  { icon: 'bx-transfer', label: 'Transações', path: '/app/transactions' },
  { icon: 'bx-wallet', label: 'Orçamentos', path: '/app/budgets' },
  { icon: 'bx-bot', label: 'Advisor', path: '/app/advisor' },
];

const AppLayout = ({ children }: AppLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-300 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-border">
            <Link to="/" className="flex items-center">
              <img 
                src={logo} 
                alt="c2Finance" 
                className="h-8 w-auto invert"
              />
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4">
            <ul className="space-y-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
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

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-4 py-3">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <i className='bx bx-user text-primary text-xl'></i>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">Usuário Demo</p>
                <p className="text-xs text-muted-foreground truncate">demo@c2finance.com</p>
              </div>
              <button className="text-muted-foreground hover:text-foreground">
                <i className='bx bx-log-out text-xl'></i>
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
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
            <button className="p-2 text-muted-foreground hover:text-foreground transition-colors">
              <i className='bx bx-cog text-xl'></i>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
