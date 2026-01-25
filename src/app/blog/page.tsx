import { Metadata } from 'next';
import { createClient } from '@/lib/supabase/server';
import BlogCard from '@/components/blog/BlogCard';
import { BlogPost } from '@/lib/blog/utils';

// Force dynamic rendering to avoid build-time errors
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Blog | c2Finance - Dicas de Financas Pessoais e Investimentos',
  description:
    'Artigos, dicas e insights sobre financas pessoais, investimentos, controle financeiro e como usar inteligencia artificial para gerenciar seu dinheiro.',
  keywords: [
    'blog financas pessoais',
    'dicas de investimento',
    'controle financeiro',
    'educacao financeira',
    'ai financeiro',
    'gestor financeiro inteligente',
  ],
  openGraph: {
    title: 'Blog | c2Finance',
    description: 'Artigos e dicas sobre financas pessoais e investimentos',
    type: 'website',
    url: '/blog',
  },
};

interface BlogPageProps {
  searchParams: Promise<{ page?: string; category?: string }>;
}

export default async function BlogPage({ searchParams }: BlogPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1');
  const category = params.category;
  const limit = 9;
  const offset = (page - 1) * limit;

  const supabase = await createClient();

  // Get featured posts
  const { data: featuredPosts } = await supabase
    .from('blog_posts')
    .select('*, author:profiles!author_id(id, full_name, avatar_url)')
    .eq('published', true)
    .eq('featured', true)
    .order('published_at', { ascending: false })
    .limit(3);

  // Get all posts with pagination
  let query = supabase
    .from('blog_posts')
    .select('*, author:profiles!author_id(id, full_name, avatar_url)', { count: 'exact' })
    .eq('published', true);

  if (category) {
    query = query.eq('category', category);
  }

  const { data: posts, count } = await query
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const totalPages = Math.ceil((count || 0) / limit);

  // Get unique categories
  const { data: allPosts } = await supabase
    .from('blog_posts')
    .select('category')
    .eq('published', true)
    .not('category', 'is', null);

  const categories = [...new Set(allPosts?.map((p) => p.category).filter(Boolean) || [])];

  return (
    <div className="container-custom py-12">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold font-display mb-4">
          Blog <span className="gradient-text">c2Finance</span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Dicas, artigos e insights sobre financas pessoais, investimentos e como usar
          inteligencia artificial para gerenciar seu dinheiro.
        </p>
      </div>

      {/* Featured Posts */}
      {featuredPosts && featuredPosts.length > 0 && !category && page === 1 && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <i className="bx bxs-star text-yellow-500"></i>
            Destaques
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            {(featuredPosts as BlogPost[]).map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>
        </section>
      )}

      {/* Category Filter */}
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-8">
          <a
            href="/blog"
            className={`px-4 py-2 rounded-full text-sm transition-colors ${
              !category
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted hover:bg-muted/80'
            }`}
          >
            Todos
          </a>
          {categories.map((cat) => (
            <a
              key={cat}
              href={`/blog?category=${encodeURIComponent(cat!)}`}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                category === cat
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted hover:bg-muted/80'
              }`}
            >
              {cat}
            </a>
          ))}
        </div>
      )}

      {/* Posts Grid */}
      {posts && posts.length > 0 ? (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(posts as BlogPost[]).map((post) => (
              <BlogCard key={post.id} post={post} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-4 mt-12">
              {page > 1 && (
                <a
                  href={`/blog?page=${page - 1}${category ? `&category=${category}` : ''}`}
                  className="px-4 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                >
                  <i className="bx bx-chevron-left mr-1"></i>
                  Anterior
                </a>
              )}
              <span className="text-muted-foreground">
                Pagina {page} de {totalPages}
              </span>
              {page < totalPages && (
                <a
                  href={`/blog?page=${page + 1}${category ? `&category=${category}` : ''}`}
                  className="px-4 py-2 bg-muted rounded-md hover:bg-muted/80 transition-colors"
                >
                  Proximo
                  <i className="bx bx-chevron-right ml-1"></i>
                </a>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <i className="bx bx-file-blank text-6xl text-muted-foreground mb-4"></i>
          <h3 className="text-xl font-semibold mb-2">Nenhum post encontrado</h3>
          <p className="text-muted-foreground">
            {category
              ? `Nao ha posts na categoria "${category}" ainda.`
              : 'Em breve teremos conteudo incrivel para voce!'}
          </p>
          {category && (
            <a href="/blog" className="text-primary hover:underline mt-4 inline-block">
              Ver todos os posts
            </a>
          )}
        </div>
      )}
    </div>
  );
}
