'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { helpArticles, type HelpArticle } from '@/lib/help/content';

interface HelpSearchProps {
  onSearchResults: (results: HelpArticle[]) => void;
}

export function HelpSearch({ onSearchResults }: HelpSearchProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (searchQuery: string) => {
    setQuery(searchQuery);
    
    if (!searchQuery.trim()) {
      onSearchResults([]);
      return;
    }

    const lowerQuery = searchQuery.toLowerCase();
    const results = helpArticles.filter(article => 
      article.title.toLowerCase().includes(lowerQuery) ||
      article.content.toLowerCase().includes(lowerQuery) ||
      article.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
    );

    onSearchResults(results);
  };

  return (
    <div className="relative">
      <i className="bx bx-search absolute left-4 top-1/2 -translate-y-1/2 text-xl text-muted-foreground"></i>
      <Input
        type="text"
        placeholder="Buscar na documentação..."
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        className="pl-12 pr-4 py-3 text-base"
      />
      {query && (
        <button
          onClick={() => {
            setQuery('');
            onSearchResults([]);
          }}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          <i className="bx bx-x text-xl"></i>
        </button>
      )}
    </div>
  );
}
