import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { blogPostSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateSlug } from '@/lib/blog/utils';

/**
 * GET /api/blog
 * Public: returns published posts
 * Admin (with ?admin=true): returns all posts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const isAdminRequest = searchParams.get('admin') === 'true';
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = (page - 1) * limit;

    // For admin requests, verify authentication and admin role
    if (isAdminRequest) {
      const userId = await getUserId(request);
      if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const { supabase } = createClientFromRequest(request);
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }

      // Admin can see all posts
      let query = supabase
        .from('blog_posts')
        .select('*, author:profiles!author_id(id, full_name, avatar_url)', { count: 'exact' });

      if (category) {
        query = query.eq('category', category);
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
      }

      const { data, error, count } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return NextResponse.json({
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit),
        },
      });
    }

    // Public request - only published posts
    const supabase = await createClient();
    let query = supabase
      .from('blog_posts')
      .select('*, author:profiles!author_id(id, full_name, avatar_url)', { count: 'exact' })
      .eq('published', true);

    if (category) {
      query = query.eq('category', category);
    }
    if (featured === 'true') {
      query = query.eq('featured', true);
    }
    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%`);
    }

    const { data, error, count } = await query
      .order('published_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

/**
 * POST /api/blog
 * Create a new blog post (admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase } = createClientFromRequest(request);

    // Check if user is admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validated = blogPostSchema.parse(body);

    // Generate slug if not provided
    const slug = validated.slug || generateSlug(validated.title);

    // Check if slug is unique
    const { data: existing } = await supabase
      .from('blog_posts')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Slug ja existe. Escolha outro titulo ou defina um slug unico.' },
        { status: 400 }
      );
    }

    // Prepare data for insertion
    const insertData: Record<string, unknown> = {
      title: validated.title,
      slug,
      excerpt: validated.excerpt,
      content: validated.content,
      cover_image: validated.cover_image || null,
      author_id: userId,
      published: validated.published,
      featured: validated.featured,
      category: validated.category || null,
      tags: validated.tags || [],
      meta_title: validated.meta_title || null,
      meta_description: validated.meta_description || null,
    };

    // Set published_at if publishing
    if (validated.published) {
      insertData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('blog_posts')
      .insert(insertData)
      .select('*, author:profiles!author_id(id, full_name, avatar_url)')
      .single();

    if (error) throw error;

    return NextResponse.json({ data }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Validation error', details: error },
        { status: 400 }
      );
    }
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
