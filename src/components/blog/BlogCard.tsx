import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { BlogPost, formatPublishedDate, calculateReadTime } from '@/lib/blog/utils';

interface BlogCardProps {
  post: BlogPost;
}

export default function BlogCard({ post }: BlogCardProps) {
  const readTime = calculateReadTime(post.content);

  return (
    <Link href={`/blog/${post.slug}`}>
      <Card className="group h-full overflow-hidden hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        {post.cover_image && (
          <div className="aspect-video overflow-hidden">
            <img
              src={post.cover_image}
              alt={post.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
            />
          </div>
        )}
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-3">
            {post.category && (
              <Badge variant="secondary" className="text-xs">
                {post.category}
              </Badge>
            )}
            {post.featured && (
              <Badge variant="default" className="text-xs">
                <i className="bx bxs-star mr-1"></i>
                Destaque
              </Badge>
            )}
          </div>

          <h3 className="text-xl font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
            {post.title}
          </h3>

          <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              {post.author && (
                <div className="flex items-center gap-1">
                  {post.author.avatar_url ? (
                    <img
                      src={post.author.avatar_url}
                      alt={post.author.full_name || 'Autor'}
                      className="w-5 h-5 rounded-full"
                    />
                  ) : (
                    <i className="bx bx-user"></i>
                  )}
                  <span>{post.author.full_name || 'Admin'}</span>
                </div>
              )}
              {post.published_at && (
                <div className="flex items-center gap-1">
                  <i className="bx bx-calendar"></i>
                  <span>{formatPublishedDate(post.published_at)}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-1">
              <i className="bx bx-time"></i>
              <span>{readTime} min de leitura</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
