/**
 * Blog utility functions
 */

/**
 * Generate a URL-friendly slug from a title
 */
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Calculate estimated read time in minutes
 */
export function calculateReadTime(content: string): number {
  const wordsPerMinute = 200;
  // Strip HTML tags and count words
  const text = content.replace(/<[^>]*>/g, '');
  const words = text.split(/\s+/).filter(word => word.length > 0).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Format date for display in Portuguese
 */
export function formatPublishedDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Format date for display with time
 */
export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Truncate text to a maximum length with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

/**
 * Extract plain text from HTML content
 */
export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Generate excerpt from content if not provided
 */
export function generateExcerpt(content: string, maxLength: number = 160): string {
  const plainText = stripHtml(content);
  return truncateText(plainText, maxLength);
}

/**
 * Validate slug format
 */
export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]+$/.test(slug) && !slug.startsWith('-') && !slug.endsWith('-');
}

/**
 * Blog post type definition
 */
export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  cover_image?: string | null;
  author_id?: string | null;
  published: boolean;
  featured: boolean;
  category?: string | null;
  tags: string[];
  meta_title?: string | null;
  meta_description?: string | null;
  created_at: string;
  updated_at: string;
  published_at?: string | null;
  edited_at?: string | null;
  // Joined fields
  author?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Blog post form data (for create/update)
 */
export interface BlogPostFormData {
  title: string;
  slug?: string;
  excerpt: string;
  content: string;
  cover_image?: string;
  published: boolean;
  featured: boolean;
  category?: string;
  tags: string[];
  meta_title?: string;
  meta_description?: string;
}
