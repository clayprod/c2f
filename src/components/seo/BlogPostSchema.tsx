import { BlogPost } from '@/lib/blog/utils';

interface BlogPostSchemaProps {
  post: BlogPost;
  baseUrl: string;
}

export default function BlogPostSchema({ post, baseUrl }: BlogPostSchemaProps) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.cover_image || undefined,
    datePublished: post.published_at,
    dateModified: post.edited_at || post.updated_at,
    author: {
      '@type': 'Person',
      name: post.author?.full_name || 'c2Finance',
    },
    publisher: {
      '@type': 'Organization',
      name: 'c2Finance',
      url: baseUrl,
      logo: {
        '@type': 'ImageObject',
        url: `${baseUrl}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${baseUrl}/blog/${post.slug}`,
    },
    keywords: post.tags?.join(', '),
    articleSection: post.category || 'Blog',
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
