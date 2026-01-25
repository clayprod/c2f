'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import RichTextEditor from '@/components/blog/RichTextEditor';
import { BlogPost, BlogPostFormData, generateSlug, formatPublishedDate } from '@/lib/blog/utils';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function BlogManagement() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Modal states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<BlogPost | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState<BlogPostFormData>({
    title: '',
    slug: '',
    excerpt: '',
    content: '',
    cover_image: '',
    published: false,
    featured: false,
    category: '',
    tags: [],
    meta_title: '',
    meta_description: '',
  });
  const [tagsInput, setTagsInput] = useState('');

  // Image upload state
  const [imageMode, setImageMode] = useState<'url' | 'upload'>('url');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        admin: 'true',
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      if (searchQuery) {
        params.append('search', searchQuery);
      }

      const res = await fetch(`/api/blog?${params}`);
      if (!res.ok) throw new Error('Failed to fetch posts');

      const data = await res.json();
      setPosts(data.data || []);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching posts:', error);
      toast.error('Erro ao carregar posts');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, searchQuery]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const openNewPostEditor = () => {
    setEditingPost(null);
    setFormData({
      title: '',
      slug: '',
      excerpt: '',
      content: '',
      cover_image: '',
      published: false,
      featured: false,
      category: '',
      tags: [],
      meta_title: '',
      meta_description: '',
    });
    setTagsInput('');
    setImageMode('url');
    setIsEditorOpen(true);
  };

  const openEditPostEditor = (post: BlogPost) => {
    setEditingPost(post);
    setFormData({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      cover_image: post.cover_image || '',
      published: post.published,
      featured: post.featured,
      category: post.category || '',
      tags: post.tags || [],
      meta_title: post.meta_title || '',
      meta_description: post.meta_description || '',
    });
    setTagsInput((post.tags || []).join(', '));
    // Detect if image was uploaded (contains supabase URL) or external URL
    setImageMode(post.cover_image?.includes('supabase') ? 'upload' : 'url');
    setIsEditorOpen(true);
  };

  const handleTitleChange = (title: string) => {
    setFormData((prev) => ({
      ...prev,
      title,
      slug: editingPost ? prev.slug : generateSlug(title),
    }));
  };

  const handleTagsChange = (value: string) => {
    setTagsInput(value);
    const tags = value
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
    setFormData((prev) => ({ ...prev, tags }));
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo nao permitido. Use JPG, PNG, GIF ou WebP.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande. Tamanho maximo: 5MB.');
      return;
    }

    setUploading(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);
      formDataUpload.append('folder', 'blog');
      formDataUpload.append('public', 'true');

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formDataUpload,
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const data = await res.json();
      setFormData((prev) => ({ ...prev, cover_image: data.url }));
      toast.success('Imagem enviada com sucesso!');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar imagem');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveImage = () => {
    setFormData((prev) => ({ ...prev, cover_image: '' }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.excerpt || !formData.content) {
      toast.error('Preencha todos os campos obrigatorios');
      return;
    }

    setSaving(true);
    try {
      const url = editingPost ? `/api/blog/${editingPost.id}` : '/api/blog';
      const method = editingPost ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to save post');
      }

      toast.success(editingPost ? 'Post atualizado!' : 'Post criado!');
      setIsEditorOpen(false);
      fetchPosts();
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar post');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    try {
      const res = await fetch(`/api/blog/${post.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ published: !post.published }),
      });

      if (!res.ok) throw new Error('Failed to update post');

      toast.success(post.published ? 'Post despublicado' : 'Post publicado!');
      fetchPosts();
    } catch (error) {
      console.error('Error toggling publish:', error);
      toast.error('Erro ao atualizar post');
    }
  };

  const handleDelete = async () => {
    if (!deletingPost) return;

    try {
      const res = await fetch(`/api/blog/${deletingPost.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete post');

      toast.success('Post excluido!');
      setIsDeleteDialogOpen(false);
      setDeletingPost(null);
      fetchPosts();
    } catch (error) {
      console.error('Error deleting post:', error);
      toast.error('Erro ao excluir post');
    }
  };

  const confirmDelete = (post: BlogPost) => {
    setDeletingPost(post);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Gerenciamento do Blog</CardTitle>
              <CardDescription>
                Crie e gerencie posts do blog ({pagination.total} total)
              </CardDescription>
            </div>
            <Button onClick={openNewPostEditor}>
              <i className="bx bx-plus mr-2"></i>
              Novo Post
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Search */}
          <div className="mb-4">
            <Input
              placeholder="Buscar posts..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {/* Posts Table */}
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground">Carregando posts...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum post encontrado
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Titulo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Publicado em</TableHead>
                    <TableHead>Editado em</TableHead>
                    <TableHead className="text-right">Acoes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {posts.map((post) => (
                    <TableRow key={post.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {post.featured && (
                            <i className="bx bxs-star text-yellow-500" title="Destaque"></i>
                          )}
                          <span className="max-w-[300px] truncate">{post.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={post.published ? 'default' : 'secondary'}>
                          {post.published ? 'Publicado' : 'Rascunho'}
                        </Badge>
                      </TableCell>
                      <TableCell>{post.category || '-'}</TableCell>
                      <TableCell>
                        {post.published_at ? formatPublishedDate(post.published_at) : '-'}
                      </TableCell>
                      <TableCell>
                        {post.edited_at ? formatPublishedDate(post.edited_at) : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleTogglePublish(post)}
                            title={post.published ? 'Despublicar' : 'Publicar'}
                          >
                            <i className={`bx ${post.published ? 'bx-hide' : 'bx-show'}`}></i>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditPostEditor(post)}
                            title="Editar"
                          >
                            <i className="bx bx-edit"></i>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => confirmDelete(post)}
                            title="Excluir"
                            className="text-destructive hover:text-destructive"
                          >
                            <i className="bx bx-trash"></i>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Pagina {pagination.page} de {pagination.totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === 1}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page - 1 }))}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page === pagination.totalPages}
                  onClick={() => setPagination((prev) => ({ ...prev, page: prev.page + 1 }))}
                >
                  Proximo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editor Dialog */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPost ? 'Editar Post' : 'Novo Post'}</DialogTitle>
            <DialogDescription>
              {editingPost
                ? 'Edite os campos abaixo para atualizar o post'
                : 'Preencha os campos abaixo para criar um novo post'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">Titulo *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Titulo do post"
              />
            </div>

            {/* Slug */}
            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                placeholder="url-do-post"
              />
              <p className="text-xs text-muted-foreground">
                URL: /blog/{formData.slug || 'slug-do-post'}
              </p>
            </div>

            {/* Excerpt */}
            <div className="space-y-2">
              <Label htmlFor="excerpt">Resumo *</Label>
              <Textarea
                id="excerpt"
                value={formData.excerpt}
                onChange={(e) => setFormData((prev) => ({ ...prev, excerpt: e.target.value }))}
                placeholder="Breve descricao do post (aparece na listagem)"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {formData.excerpt.length}/500 caracteres
              </p>
            </div>

            {/* Content */}
            <div className="space-y-2">
              <Label>Conteudo *</Label>
              <RichTextEditor
                value={formData.content}
                onChange={(value) => setFormData((prev) => ({ ...prev, content: value }))}
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label>Imagem de Capa</Label>
              <Tabs value={imageMode} onValueChange={(v) => setImageMode(v as 'url' | 'upload')}>
                <TabsList className="grid w-full grid-cols-2 max-w-xs">
                  <TabsTrigger value="url">
                    <i className="bx bx-link mr-2"></i>
                    URL
                  </TabsTrigger>
                  <TabsTrigger value="upload">
                    <i className="bx bx-upload mr-2"></i>
                    Upload
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="url" className="mt-3">
                  <Input
                    id="cover_image"
                    value={formData.cover_image}
                    onChange={(e) => setFormData((prev) => ({ ...prev, cover_image: e.target.value }))}
                    placeholder="https://exemplo.com/imagem.jpg"
                  />
                </TabsContent>
                <TabsContent value="upload" className="mt-3">
                  <div className="flex items-center gap-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="cover_image_upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <>
                          <i className="bx bx-loader-alt animate-spin mr-2"></i>
                          Enviando...
                        </>
                      ) : (
                        <>
                          <i className="bx bx-image-add mr-2"></i>
                          Escolher imagem
                        </>
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      JPG, PNG, GIF ou WebP (max 5MB)
                    </span>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Image Preview */}
              {formData.cover_image && (
                <div className="mt-3 relative inline-block">
                  <img
                    src={formData.cover_image}
                    alt="Preview"
                    className="max-w-xs max-h-48 rounded-md border object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6"
                    onClick={handleRemoveImage}
                    title="Remover imagem"
                  >
                    <i className="bx bx-x text-sm"></i>
                  </Button>
                </div>
              )}
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                placeholder="Ex: Financas Pessoais, Investimentos, Dicas"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <Label htmlFor="tags">Tags (separadas por virgula)</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => handleTagsChange(e.target.value)}
                placeholder="financas, economia, investimentos"
              />
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {formData.tags.map((tag, i) => (
                    <Badge key={i} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* SEO Fields */}
            <div className="border-t pt-4 mt-4">
              <h4 className="font-medium mb-3">SEO (Opcional)</h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="meta_title">Meta Title</Label>
                  <Input
                    id="meta_title"
                    value={formData.meta_title}
                    onChange={(e) => setFormData((prev) => ({ ...prev, meta_title: e.target.value }))}
                    placeholder="Titulo para SEO (max 70 caracteres)"
                    maxLength={70}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(formData.meta_title || '').length}/70 caracteres
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="meta_description">Meta Description</Label>
                  <Textarea
                    id="meta_description"
                    value={formData.meta_description}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, meta_description: e.target.value }))
                    }
                    placeholder="Descricao para SEO (max 160 caracteres)"
                    maxLength={160}
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    {(formData.meta_description || '').length}/160 caracteres
                  </p>
                </div>
              </div>
            </div>

            {/* Switches */}
            <div className="flex items-center gap-6 pt-4 border-t">
              <div className="flex items-center gap-2">
                <Switch
                  id="published"
                  checked={formData.published}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, published: checked }))
                  }
                />
                <Label htmlFor="published">Publicar</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="featured"
                  checked={formData.featured}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, featured: checked }))
                  }
                />
                <Label htmlFor="featured">Destaque</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditorOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <>
                  <span className="animate-spin mr-2">
                    <i className="bx bx-loader-alt"></i>
                  </span>
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Post</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o post &quot;{deletingPost?.title}&quot;? Esta acao nao pode ser
              desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingPost(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
