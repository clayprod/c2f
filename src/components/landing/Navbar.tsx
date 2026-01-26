'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useLogo } from '@/hooks/useLogo';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const logo = useLogo();

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      setIsLoggedIn(!!user);
    };
    checkSession();
  }, []);

  const navLinks = [
    { label: 'IA', href: '/#ai-advisor' },
    { label: 'Recursos', href: '/#features' },
    { label: 'Bancos', href: '/#banks' },
    { label: 'Preços', href: '/#pricing' },
    { label: 'FAQ', href: '/#faq' },
    { label: 'Blog', href: '/blog' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link href={isLoggedIn ? "/app" : "/"} className="flex items-center">
            <Image
              src={logo}
              alt="c2Finance"
              width={120}
              height={40}
              className="h-8 md:h-10 w-auto"
              style={{ objectFit: 'contain' }}
              priority
            />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop CTAs */}
          <div className="hidden md:flex items-center gap-4">
            {isLoggedIn ? (
              <Link href="/app" className="btn-primary text-sm py-2 px-5">
                Acessar App
              </Link>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
                >
                  Entrar
                </Link>
                <Link href="/signup" className="btn-primary text-sm py-2 px-5">
                  Começar grátis
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-foreground"
          >
            <i className={`bx ${isOpen ? 'bx-x' : 'bx-menu'} text-2xl`}></i>
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-border/50 animate-fade-in">
            <div className="flex flex-col gap-4">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
              <div className="flex flex-col gap-3 pt-4 border-t border-border/50">
                {isLoggedIn ? (
                  <Link
                    href="/app"
                    className="btn-primary text-sm py-2.5 text-center"
                    onClick={() => setIsOpen(false)}
                  >
                    Acessar App
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2"
                      onClick={() => setIsOpen(false)}
                    >
                      Entrar
                    </Link>
                    <Link
                      href="/signup"
                      className="btn-primary text-sm py-2.5 text-center"
                      onClick={() => setIsOpen(false)}
                    >
                      Começar grátis
                    </Link>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
