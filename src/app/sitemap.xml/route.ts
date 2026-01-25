import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// Force dynamic rendering - regenerate on every request
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://c2finance.com';
  const supabase = await createClient();

  // Static pages
  const staticPages = [
    { url: baseUrl, changefreq: 'daily', priority: '1.0' },
    { url: `${baseUrl}/blog`, changefreq: 'daily', priority: '0.9' },
    { url: `${baseUrl}/pricing`, changefreq: 'weekly', priority: '0.8' },
    { url: `${baseUrl}/login`, changefreq: 'monthly', priority: '0.5' },
    { url: `${baseUrl}/signup`, changefreq: 'monthly', priority: '0.5' },
    { url: `${baseUrl}/terms-of-service`, changefreq: 'yearly', priority: '0.3' },
    { url: `${baseUrl}/privacy-policy`, changefreq: 'yearly', priority: '0.3' },
  ];

  // Fetch blog posts
  let blogPosts: Array<{ slug: string; updated_at: string | null; published_at: string | null }> = [];
  try {
    const { data: posts } = await supabase
      .from('blog_posts')
      .select('slug, updated_at, published_at')
      .eq('published', true)
      .order('published_at', { ascending: false });

    if (posts) {
      blogPosts = posts;
    }
  } catch (error) {
    console.error('Error fetching blog posts for sitemap:', error);
  }

  // Generate XML
  const now = new Date().toISOString();
  
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
`;

  // Add static pages
  for (const page of staticPages) {
    xml += `  <url>
    <loc>${escapeXml(page.url)}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>
`;
  }

  // Add blog posts
  for (const post of blogPosts) {
    const lastmod = post.updated_at || post.published_at || now;
    xml += `  <url>
    <loc>${escapeXml(`${baseUrl}/blog/${post.slug}`)}</loc>
    <lastmod>${new Date(lastmod).toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
`;
  }

  xml += `</urlset>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
