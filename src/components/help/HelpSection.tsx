'use client';

import { useState } from 'react';
import { type HelpArticle, type HelpCategory } from '@/lib/help/content';

interface HelpSectionProps {
  category: HelpCategory;
  articles: HelpArticle[];
  onArticleClick?: (article: HelpArticle) => void;
}

export function HelpSection({ category, articles, onArticleClick }: HelpSectionProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (articles.length === 0) return null;

  return (
    <div className="glass-card overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <i className={`bx ${category.icon} text-2xl text-primary`}></i>
          <div>
            <h3 className="font-display font-semibold text-lg">{category.name}</h3>
            <p className="text-sm text-muted-foreground">{category.description}</p>
          </div>
        </div>
        <i
          className={`bx bx-chevron-down text-2xl text-muted-foreground transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        ></i>
      </button>
      {isOpen && (
        <div className="px-6 pb-6 space-y-2">
          {articles.map((article) => (
            <button
              key={article.id}
              onClick={() => onArticleClick?.(article)}
              className="w-full text-left p-4 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
            >
              <div className="flex items-start gap-3">
                <i className="bx bx-book text-lg text-primary mt-0.5 flex-shrink-0"></i>
                <div className="flex-1">
                  <h4 className="font-medium text-foreground mb-1">{article.title}</h4>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {article.content.replace(/\*\*/g, '').substring(0, 120)}...
                  </p>
                </div>
                <i className="bx bx-chevron-right text-xl text-muted-foreground flex-shrink-0"></i>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
