'use client';

import { useEffect, useRef } from 'react';
import DOMPurify from 'dompurify';

interface BlogContentProps {
  html: string;
  className?: string;
}

export default function BlogContent({ html, className = '' }: BlogContentProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && contentRef.current) {
      // Configure DOMPurify
      const clean = DOMPurify.sanitize(html, {
        ALLOWED_TAGS: [
          'p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
          'div', 'span', 'hr',
          'ul', 'ol', 'li',
          'strong', 'em', 'u', 's', 'b', 'i',
          'a', 'img',
          'blockquote', 'code', 'pre',
          'table', 'thead', 'tbody', 'tr', 'th', 'td',
        ],
        ALLOWED_ATTR: [
          'href', 'title', 'target', 'rel',
          'alt', 'src', 'width', 'height',
          'class', 'id',
          'colspan', 'rowspan', 'scope',
        ],
        ADD_ATTR: ['target'],
        FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      });

      // Set sanitized content
      contentRef.current.innerHTML = clean;

      // Post-process: add target="_blank" and rel="noopener noreferrer" to external links
      const links = contentRef.current.querySelectorAll('a[href^="http"]');
      links.forEach((link) => {
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      });

      // Post-process: add loading="lazy" to images
      const images = contentRef.current.querySelectorAll('img');
      images.forEach((img) => {
        img.setAttribute('loading', 'lazy');
      });
    }
  }, [html]);

  return (
    <div
      ref={contentRef}
      className={`prose prose-lg max-w-none blog-content ${className}`}
    />
  );
}
