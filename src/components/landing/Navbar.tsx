import { useState } from 'react';
import { Link } from 'react-router-dom';
import logo from '@/assets/logo.png';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { label: 'Produto', href: '#features' },
    { label: 'Preços', href: '/pricing' },
    { label: 'Segurança', href: '#security' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="container-custom">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <Link to="/" className="flex items-center">
            <img 
              src={logo} 
              alt="c2Finance" 
              className="h-8 md:h-10 w-auto invert"
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
            <Link
              to="/login"
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Entrar
            </Link>
            <Link to="/signup" className="btn-primary text-sm py-2 px-5">
              Começar grátis
            </Link>
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
                <Link
                  to="/login"
                  className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium py-2"
                >
                  Entrar
                </Link>
                <Link to="/signup" className="btn-primary text-sm py-2.5 text-center">
                  Começar grátis
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
