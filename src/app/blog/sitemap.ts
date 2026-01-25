import { MetadataRoute } from 'next';
import { createClient } from '@/lib/supabase/server';

// Revalidate every hour to pick up new blog posts
export const revalidate = 3600;

// Ensure this runs dynamically, not at build time only
export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = await createClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://c2finance.com';

  // Fetch all published blog posts
  const { data: posts } = await supabase
    .from('blog_posts')
    .select('slug, updated_at, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false });

  if (!posts || posts.length === 0) {
    return [];
  }

  return posts.map((post) => ({
    url: `${baseUrl}/blog/${post.slug}`,
    lastModified: post.updated_at || post.published_at || new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));
}
