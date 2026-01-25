import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest, createClient } from '@/lib/supabase/server';
import { getUserId } from '@/lib/auth';
import { blogPostUpdateSchema } from '@/lib/validation/schemas';
import { createErrorResponse } from '@/lib/errors';
import { generateSlug } from '@/lib/blog/utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/blog/[id]
 * Get a single blog post by ID or slug
 * Public: only published posts
 * Admin (with ?admin=true): any post
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const isAdminRequest = searchParams.get('admin') === 'true';

    // Determine if ID is UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

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

      // Admin can see any post
      let query = supabase
        .from('blog_posts')
        .select('*, author:profiles!author_id(id, full_name, avatar_url)');

      if (isUUID) {
        query = query.eq('id', id);
      } else {
        query = query.eq('slug', id);
      }

      const { data, error } = await query.single();

      if (error) {
        if (error.code === 'PGRST116') {
          return NextResponse.json({ error: 'Post not found' }, { status: 404 });
        }
        throw error;
      }

      return NextResponse.json({ data });
    }

    // Public request - only published posts
    const supabase = await createClient();
    let query = supabase
      .from('blog_posts')
      .select('*, author:profiles!author_id(id, full_name, avatar_url)')
      .eq('published', true);

    if (isUUID) {
      query = query.eq('id', id);
    } else {
      query = query.eq('slug', id);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}

/**
 * PUT /api/blog/[id]
 * Update a blog post (admin only)
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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
    const validated = blogPostUpdateSchema.parse(body);

    // Get current post
    const { data: currentPost, error: fetchError } = await supabase
      .from('blog_posts')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }
      throw fetchError;
    }

    // Prepare update data
    const updateData: Record<string, unknown> = {};

    if (validated.title !== undefined) {
      updateData.title = validated.title;
    }

    if (validated.slug !== undefined && validated.slug !== '') {
      // Check if new slug is unique (excluding current post)
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', validated.slug)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: 'Slug ja existe. Escolha outro.' },
          { status: 400 }
        );
      }
      updateData.slug = validated.slug;
    } else if (validated.title && !validated.slug) {
      // Auto-generate new slug from new title
      const newSlug = generateSlug(validated.title);
      const { data: existing } = await supabase
        .from('blog_posts')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', id)
        .maybeSingle();

      if (!existing) {
        updateData.slug = newSlug;
      }
    }

    if (validated.excerpt !== undefined) {
      updateData.excerpt = validated.excerpt;
    }
    if (validated.content !== undefined) {
      updateData.content = validated.content;
    }
    if (validated.cover_image !== undefined) {
      updateData.cover_image = validated.cover_image || null;
    }
    if (validated.featured !== undefined) {
      updateData.featured = validated.featured;
    }
    if (validated.category !== undefined) {
      updateData.category = validated.category || null;
    }
    if (validated.tags !== undefined) {
      updateData.tags = validated.tags;
    }
    if (validated.meta_title !== undefined) {
      updateData.meta_title = validated.meta_title || null;
    }
    if (validated.meta_description !== undefined) {
      updateData.meta_description = validated.meta_description || null;
    }

    // Handle publishing logic
    if (validated.published !== undefined) {
      updateData.published = validated.published;

      // If publishing for the first time, set published_at
      if (validated.published && !currentPost.published_at) {
        updateData.published_at = new Date().toISOString();
      }
    }

    // Note: edited_at is handled automatically by database trigger
    // when title or content changes on a published post

    const { data, error } = await supabase
      .from('blog_posts')
      .update(updateData)
      .eq('id', id)
      .select('*, author:profiles!author_id(id, full_name, avatar_url)')
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
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

/**
 * DELETE /api/blog/[id]
 * Delete a blog post (admin only)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
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

    const { error } = await supabase
      .from('blog_posts')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    const errorResponse = createErrorResponse(error);
    return NextResponse.json(
      { error: errorResponse.error },
      { status: errorResponse.statusCode }
    );
  }
}
