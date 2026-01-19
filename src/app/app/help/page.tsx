'use client';

import { useState, useMemo } from 'react';
import { helpCategories, helpArticles, getArticlesByCategory, type HelpArticle } from '@/lib/help/content';
import { HelpSearch } from '@/components/help/HelpSearch';
import { HelpSection } from '@/components/help/HelpSection';
import { ContactSupport } from '@/components/help/ContactSupport';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function HelpPage() {
  const [searchResults, setSearchResults] = useState<HelpArticle[]>([]);
  const [selectedArticle, setSelectedArticle] = useState<HelpArticle | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const isSearching = searchResults.length > 0;
  const hasSearchQuery = searchResults.length > 0 || selectedCategory !== null;

  // Agrupar resultados de busca por categoria
  const searchResultsByCategory = useMemo(() => {
    if (!isSearching) return {};
    
    const grouped: Record<string, HelpArticle[]> = {};
    searchResults.forEach(article => {
      if (!grouped[article.category]) {
        grouped[article.category] = [];
      }
      grouped[article.category].push(article);
    });
    return grouped;
  }, [searchResults, isSearching]);

  const handleArticleClick = (article: HelpArticle) => {
    setSelectedArticle(article);
  };

  const formatContent = (content: string) => {
    // Converter markdown básico para HTML
    let formatted = content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '</p><p>')
      .replace(/\n/g, '<br/>');
    
    return `<p>${formatted}</p>`;
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-bold flex items-center gap-2">
          <i className="bx bx-help-circle text-primary"></i>
          Central de Ajuda
        </h1>
        <p className="text-muted-foreground mt-2">
          Encontre respostas para suas dúvidas e aprenda a usar todas as funcionalidades do c2Finance
        </p>
      </div>

      {/* Busca */}
      <div className="glass-card p-6">
        <HelpSearch onSearchResults={setSearchResults} />
      </div>

      {/* Conteúdo Principal */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar de Navegação */}
        <aside className="lg:col-span-1">
          <div className="glass-card p-4 sticky top-24">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <i className="bx bx-menu text-primary"></i>
              Categorias
            </h2>
            <nav className="space-y-2">
              <button
                onClick={() => {
                  setSearchResults([]);
                  setSelectedCategory(null);
                }}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  !hasSearchQuery
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted/50'
                }`}
              >
                <i className="bx bx-home text-lg"></i>
                Todas as categorias
              </button>
              {helpCategories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => {
                    setSelectedCategory(category.id);
                    setSearchResults(getArticlesByCategory(category.id));
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    selectedCategory === category.id
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/50'
                  }`}
                >
                  <i className={`bx ${category.icon} text-lg`}></i>
                  {category.name}
                </button>
              ))}
            </nav>
          </div>
        </aside>

        {/* Área de Conteúdo */}
        <div className="lg:col-span-3 space-y-6">
          {isSearching ? (
            // Resultados de busca
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-lg">
                  Resultados da busca ({searchResults.length})
                </h2>
                <button
                  onClick={() => {
                    setSearchResults([]);
                    setSelectedCategory(null);
                  }}
                  className="text-sm text-primary hover:underline"
                >
                  Limpar busca
                </button>
              </div>
              {Object.entries(searchResultsByCategory).map(([categoryId, articles]) => {
                const category = helpCategories.find(c => c.id === categoryId);
                if (!category) return null;
                return (
                  <HelpSection
                    key={categoryId}
                    category={category}
                    articles={articles}
                    onArticleClick={handleArticleClick}
                  />
                );
              })}
              {searchResults.length === 0 && (
                <div className="glass-card p-12 text-center">
                  <i className="bx bx-search text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground">
                    Nenhum resultado encontrado. Tente outros termos de busca.
                  </p>
                </div>
              )}
            </>
          ) : (
            // Todas as categorias
            <>
              {helpCategories.map((category) => {
                const articles = getArticlesByCategory(category.id);
                if (articles.length === 0) return null;
                return (
                  <HelpSection
                    key={category.id}
                    category={category}
                    articles={articles}
                    onArticleClick={handleArticleClick}
                  />
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* Contato com Suporte */}
      <div className="max-w-3xl mx-auto">
        <ContactSupport />
      </div>

      {/* Dialog para exibir artigo completo */}
      <Dialog open={!!selectedArticle} onOpenChange={() => setSelectedArticle(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedArticle && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <i className="bx bx-book text-primary"></i>
                  {selectedArticle.title}
                </DialogTitle>
                <DialogDescription>
                  {helpCategories.find(c => c.id === selectedArticle.category)?.name}
                </DialogDescription>
              </DialogHeader>
              <div className="prose prose-sm max-w-none mt-4">
                <div
                  dangerouslySetInnerHTML={{
                    __html: formatContent(selectedArticle.content)
                  }}
                  className="text-foreground space-y-4"
                />
                {selectedArticle.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-border">
                    {selectedArticle.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 rounded-full bg-muted text-xs text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
