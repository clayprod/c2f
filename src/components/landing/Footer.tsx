import Link from 'next/link';
import Image from 'next/image';
import { getLogo } from '@/lib/logo';

const footerLinks = {
  produto: [
    { label: 'Recursos', href: '#features' },
    { label: 'Preços', href: '/pricing' },
    { label: 'Demo', href: '#demo' },
    { label: 'Integrações', href: '#integrations' },
  ],
  empresa: [
    { label: 'Sobre', href: '#' },
    { label: 'Blog', href: '#' },
    { label: 'Carreiras', href: '#' },
    { label: 'Contato', href: 'mailto:contato@c2finance.com' },
  ],
  legal: [
    { label: 'Termos de Uso', href: '/terms-of-service' },
    { label: 'Política de Privacidade', href: '/privacy-policy' },
  ],
};

const Footer = () => {
  return (
    <footer className="border-t border-border/50 bg-card/30">
      <div className="container-custom py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {/* Logo */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center mb-4">
              <Image
                src={getLogo('auto')}
                alt="c2Finance" 
                width={120}
                height={40}
                className="h-8 w-auto"
                style={{ objectFit: 'contain' }}
                priority
              />
            </Link>
            <p className="text-muted-foreground text-sm mb-4">
              Controle financeiro inteligente com AI Advisor.
            </p>
            <div className="flex gap-4">
              <a href="https://twitter.com/c2finance" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Twitter">
                <i className='bxl bx-twitter text-xl'></i>
              </a>
              <a href="https://linkedin.com/company/c2finance" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="LinkedIn">
                <i className='bxl bx-linkedin text-xl'></i>
              </a>
              <a href="https://instagram.com/c2finance" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Instagram">
                <i className='bxl bx-instagram text-xl'></i>
              </a>
            </div>
          </div>

          {/* Produto */}
          <div>
            <h4 className="font-display font-semibold mb-4">Produto</h4>
            <ul className="space-y-2">
              {footerLinks.produto.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Empresa */}
          <div>
            <h4 className="font-display font-semibold mb-4">Empresa</h4>
            <ul className="space-y-2">
              {footerLinks.empresa.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-display font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-border/50 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} c2Finance. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <i className='bx bx-shield text-primary'></i>
            <span>Seus dados protegidos com criptografia de ponta</span>
          </div>
        </div>
        <p className="mt-4 text-muted-foreground text-xs">
          As marcas comerciais citadas são de propriedade de seus respectivos donos.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
