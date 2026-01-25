'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';
import 'react-quill/dist/quill.snow.css';

// Dynamic import to avoid SSR issues
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false,
  loading: () => (
    <div className="h-64 bg-muted rounded-md flex items-center justify-center">
      <span className="text-muted-foreground">Carregando editor...</span>
    </div>
  ),
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Escreva seu conteudo aqui...',
  className = '',
}: RichTextEditorProps) {
  const modules = useMemo(
    () => ({
      toolbar: {
        container: [
          [{ header: [1, 2, 3, 4, 5, 6, false] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          [{ indent: '-1' }, { indent: '+1' }],
          [{ align: [] }],
          ['blockquote', 'code-block'],
          ['link', 'image'],
          [{ color: [] }, { background: [] }],
          ['clean'],
        ],
      },
      clipboard: {
        matchVisual: false,
      },
    }),
    []
  );

  const formats = [
    'header',
    'bold',
    'italic',
    'underline',
    'strike',
    'list',
    'bullet',
    'indent',
    'align',
    'blockquote',
    'code-block',
    'link',
    'image',
    'color',
    'background',
  ];

  return (
    <div className={`rich-text-editor ${className}`}>
      <ReactQuill
        theme="snow"
        value={value}
        onChange={onChange}
        modules={modules}
        formats={formats}
        placeholder={placeholder}
        className="bg-background"
      />
      <style jsx global>{`
        /* Base Editor Styles */
        .rich-text-editor .ql-toolbar {
          border-top-left-radius: 0.5rem;
          border-top-right-radius: 0.5rem;
          background: hsl(var(--muted));
          border-color: hsl(var(--border));
        }
        .rich-text-editor .ql-container {
          min-height: 300px;
          font-size: 1rem;
          border-bottom-left-radius: 0.5rem;
          border-bottom-right-radius: 0.5rem;
          border-color: hsl(var(--border));
          background: hsl(var(--background));
        }
        .rich-text-editor .ql-editor {
          min-height: 250px;
          padding: 1.5rem;
          line-height: 1.8;
          color: hsl(var(--foreground) / 0.9);
        }
        .rich-text-editor .ql-editor.ql-blank::before {
          color: hsl(var(--muted-foreground));
          font-style: normal;
        }

        /* Toolbar Icons */
        .rich-text-editor .ql-stroke {
          stroke: hsl(var(--foreground));
        }
        .rich-text-editor .ql-fill {
          fill: hsl(var(--foreground));
        }
        .rich-text-editor .ql-picker-label {
          color: hsl(var(--foreground));
        }
        .rich-text-editor .ql-picker-options {
          background: hsl(var(--background));
          border-color: hsl(var(--border));
        }
        .rich-text-editor .ql-picker-item {
          color: hsl(var(--foreground));
        }
        .rich-text-editor .ql-picker-item:hover {
          color: hsl(var(--primary));
        }
        .rich-text-editor .ql-active .ql-stroke {
          stroke: hsl(var(--primary));
        }
        .rich-text-editor .ql-active .ql-fill {
          fill: hsl(var(--primary));
        }
        .rich-text-editor button:hover .ql-stroke {
          stroke: hsl(var(--primary));
        }
        .rich-text-editor button:hover .ql-fill {
          fill: hsl(var(--primary));
        }

        /* WYSIWYG - Content Preview Styles (match blog display) */
        .rich-text-editor .ql-editor h1,
        .rich-text-editor .ql-editor h2,
        .rich-text-editor .ql-editor h3,
        .rich-text-editor .ql-editor h4,
        .rich-text-editor .ql-editor h5,
        .rich-text-editor .ql-editor h6 {
          color: hsl(var(--foreground));
          font-weight: 600;
          margin-top: 1.5em;
          margin-bottom: 0.75em;
        }
        .rich-text-editor .ql-editor h2 {
          font-size: 1.75rem;
          border-bottom: 1px solid hsl(var(--border));
          padding-bottom: 0.5rem;
        }
        .rich-text-editor .ql-editor h3 {
          font-size: 1.375rem;
        }
        .rich-text-editor .ql-editor p {
          margin-bottom: 1.25em;
        }
        .rich-text-editor .ql-editor strong {
          color: hsl(var(--foreground));
          font-weight: 600;
        }
        .rich-text-editor .ql-editor a {
          color: hsl(var(--primary));
          text-decoration: none;
        }
        .rich-text-editor .ql-editor a:hover {
          text-decoration: underline;
        }
        .rich-text-editor .ql-editor ul,
        .rich-text-editor .ql-editor ol {
          padding-left: 1.5em;
          margin: 1em 0;
        }
        .rich-text-editor .ql-editor li {
          margin: 0.5em 0;
        }
        .rich-text-editor .ql-editor blockquote {
          border-left: 4px solid hsl(var(--primary));
          padding-left: 1.25em;
          margin: 1.5em 0;
          color: hsl(var(--muted-foreground));
          font-style: italic;
        }
        .rich-text-editor .ql-editor pre {
          background-color: hsl(var(--muted));
          border-radius: 0.5rem;
          padding: 1rem;
          margin: 1.5em 0;
          overflow-x: auto;
        }
        .rich-text-editor .ql-editor code {
          color: hsl(var(--primary));
          background-color: hsl(var(--muted));
          padding: 0.125em 0.375em;
          border-radius: 0.25rem;
          font-size: 0.875em;
        }
        .rich-text-editor .ql-editor img {
          border-radius: 0.5rem;
          max-width: 100%;
        }

        /* Snow theme color picker fix */
        .rich-text-editor .ql-snow .ql-color-picker .ql-picker-label,
        .rich-text-editor .ql-snow .ql-icon-picker .ql-picker-label {
          padding: 2px 4px;
        }
        .rich-text-editor .ql-snow .ql-picker.ql-expanded .ql-picker-options {
          border-radius: 0.375rem;
          box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
        }
      `}</style>
    </div>
  );
}
