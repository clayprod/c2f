import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import BlogContent from '@/components/blog/BlogContent';
import BlogPostSchema from '@/components/seo/BlogPostSchema';
import BlogBreadcrumbs from '@/components/seo/BlogBreadcrumbs';
import { Badge } from '@/components/ui/badge';
import { BlogPost, formatPublishedDate, calculateReadTime } from '@/lib/blog/utils';

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

// Generate metadata for SEO
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (!post) {
    return {
      title: 'Post nao encontrado | c2Finance Blog',
    };
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://c2finance.com';

  return {
    title: post.meta_title || `${post.title} | c2Finance Blog`,
    description: post.meta_description || post.excerpt,
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: 'article',
      url: `${baseUrl}/blog/${post.slug}`,
      images: post.cover_image ? [{ url: post.cover_image }] : [],
      publishedTime: post.published_at,
      modifiedTime: post.edited_at || post.updated_at,
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.excerpt,
      images: post.cover_image ? [post.cover_image] : [],
    },
    alternates: {
      canonical: `${baseUrl}/blog/${post.slug}`,
    },
  };
}

// Dynamic rendering - pages are generated on-demand
export const dynamic = 'force-dynamic';

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: post, error } = await supabase
    .from('blog_posts')
    .select('*, author:profiles!author_id(id, full_name, avatar_url)')
    .eq('slug', slug)
    .eq('published', true)
    .single();

  if (error || !post) {
    notFound();
  }

  const typedPost = post as BlogPost;
  const readTime = calculateReadTime(typedPost.content);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://c2finance.com';

  return (
    <>
      {/* JSON-LD Structured Data */}
      <BlogPostSchema post={typedPost} baseUrl={baseUrl} />

      <article className="container-custom py-12">
        {/* Breadcrumbs */}
        <BlogBreadcrumbs post={typedPost} />

        {/* Hero Section - Title + Image side by side */}
        <header className="mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 items-start">
            {/* Left side - Title and meta */}
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                {typedPost.category && (
                  <Link href={`/blog?category=${encodeURIComponent(typedPost.category)}`}>
                    <Badge variant="secondary" className="hover:bg-secondary/80">
                      {typedPost.category}
                    </Badge>
                  </Link>
                )}
                {typedPost.featured && (
                  <Badge variant="default">
                    <i className="bx bxs-star mr-1"></i>
                    Destaque
                  </Badge>
                )}
              </div>

              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold font-display mb-6 text-foreground">
                {typedPost.title}
              </h1>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground mb-6">
                {typedPost.author && (
                  <div className="flex items-center gap-2">
                    {typedPost.author.avatar_url ? (
                      <img
                        src={typedPost.author.avatar_url}
                        alt={typedPost.author.full_name || 'Autor'}
                        className="w-6 h-6 rounded-full"
                      />
                    ) : (
                      <i className="bx bx-user"></i>
                    )}
                    <span>Por {typedPost.author.full_name || 'Admin'}</span>
                  </div>
                )}

                {typedPost.published_at && (
                  <div className="flex items-center gap-2">
                    <i className="bx bx-calendar"></i>
                    <span>{formatPublishedDate(typedPost.published_at)}</span>
                  </div>
                )}
              </div>

              <p className="text-lg text-muted-foreground leading-relaxed">
                {typedPost.excerpt}
              </p>

              {/* Edited info */}
              {typedPost.edited_at && (
                <div className="flex items-center gap-2 mt-4 text-sm text-yellow-600 dark:text-yellow-500">
                  <i className="bx bx-edit"></i>
                  <span>Editado em {formatPublishedDate(typedPost.edited_at)}</span>
                </div>
              )}
            </div>

            {/* Right side - Cover Image */}
            {typedPost.cover_image && (
              <figure className="lg:mt-0">
                <img
                  src={typedPost.cover_image}
                  alt={typedPost.title}
                  className="w-full rounded-xl shadow-lg object-cover aspect-[4/3]"
                  loading="eager"
                />
              </figure>
            )}
          </div>
        </header>

        {/* Content */}
        <div className="max-w-4xl">
          <BlogContent html={typedPost.content} className="mb-8" />

          {/* Tags */}
          {typedPost.tags && typedPost.tags.length > 0 && (
            <div className="pt-6 border-t border-border">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Tags:</h3>
              <div className="flex flex-wrap gap-2">
                {typedPost.tags.map((tag, index) => (
                  <Badge key={index} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Reading time + Back to blog */}
          <div className="mt-12 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <i className="bx bx-time"></i>
              <span>{readTime} min de leitura</span>
            </div>
            <Link
              href="/blog"
              className="inline-flex items-center gap-2 text-primary hover:underline"
            >
              <i className="bx bx-arrow-back"></i>
              Voltar para o Blog
            </Link>
          </div>
        </div>
      </article>
    </>
  );
}
