import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="text-center">
        <h1 className="font-display text-6xl font-bold mb-4">404</h1>
        <h2 className="font-display text-2xl font-semibold mb-4">Página não encontrada</h2>
        <p className="text-muted-foreground mb-8">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link href="/" className="btn-primary">
          Voltar para home
        </Link>
      </div>
    </div>
  );
}





