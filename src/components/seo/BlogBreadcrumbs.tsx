import Link from 'next/link';
import { BlogPost } from '@/lib/blog/utils';

interface BlogBreadcrumbsProps {
  post?: BlogPost;
}

export default function BlogBreadcrumbs({ post }: BlogBreadcrumbsProps) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://c2finance.com';

  // Build breadcrumb items
  const items = [
    { name: 'Home', url: baseUrl },
    { name: 'Blog', url: `${baseUrl}/blog` },
  ];

  if (post) {
    items.push({
      name: post.title,
      url: `${baseUrl}/blog/${post.slug}`,
    });
  }

  // JSON-LD BreadcrumbList schema
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <>
      {/* JSON-LD Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />

      {/* Visual Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-muted-foreground">
          <li>
            <Link href="/" className="hover:text-foreground transition-colors">
              <i className="bx bx-home"></i>
              <span className="sr-only">Home</span>
            </Link>
          </li>
          <li className="flex items-center gap-2">
            <i className="bx bx-chevron-right"></i>
            <Link href="/blog" className="hover:text-foreground transition-colors">
              Blog
            </Link>
          </li>
          {post && (
            <li className="flex items-center gap-2">
              <i className="bx bx-chevron-right"></i>
              <span className="text-foreground font-medium truncate max-w-[200px] md:max-w-md">
                {post.title}
              </span>
            </li>
          )}
        </ol>
      </nav>
    </>
  );
}
