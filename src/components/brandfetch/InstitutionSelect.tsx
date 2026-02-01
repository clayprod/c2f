'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { buildBrandfetchLogoProxyUrl } from '@/lib/brandfetch';

type BrandfetchResult = {
  name: string;
  domain: string;
  brandId?: string | null;
};

export type InstitutionSelection = {
  name: string;
  domain?: string;
  brandId?: string | null;
  primaryColor?: string | null;
  isManual?: boolean;
};

type InstitutionSelectProps = {
  label: string;
  placeholder?: string;
  value: InstitutionSelection;
  onChange: (selection: InstitutionSelection) => void;
  disabled?: boolean;
};

export default function InstitutionSelect({
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: InstitutionSelectProps) {
  const [query, setQuery] = useState(value.name || '');
  const [results, setResults] = useState<BrandfetchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [manualMode, setManualMode] = useState(!!value.isManual);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value.name || '');
    setManualMode(!!value.isManual);
  }, [value.name, value.isManual]);

  useEffect(() => {
    if (manualMode) return;
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/brandfetch/search?query=${encodeURIComponent(query.trim())}`);
        const data = await response.json();
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (error) {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [query, manualMode]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectManual = (name: string) => {
    setManualMode(true);
    onChange({
      name,
      domain: undefined,
      brandId: null,
      primaryColor: null,
      isManual: true,
    });
    setOpen(false);
  };

  const handleSelectResult = async (result: BrandfetchResult) => {
    try {
      const response = await fetch(`/api/brandfetch/brand?domain=${encodeURIComponent(result.domain)}`);
      const brandData = response.ok ? await response.json() : null;
      const primaryColor = brandData?.primaryColor || null;
      setManualMode(false);
      onChange({
        name: result.name || result.domain,
        domain: result.domain,
        brandId: result.brandId || brandData?.brandId || null,
        primaryColor,
        isManual: false,
      });
      setOpen(false);
    } catch (error) {
      setManualMode(false);
      onChange({
        name: result.name || result.domain,
        domain: result.domain,
        brandId: result.brandId || null,
        primaryColor: null,
        isManual: false,
      });
      setOpen(false);
    }
  };

  const hint = useMemo(() => {
    if (manualMode) return 'Digite o nome da instituição.';
    return 'Digite para buscar e selecione uma opção.';
  }, [manualMode]);

  return (
    <div className="space-y-2" ref={containerRef}>
      <label className="text-sm font-medium">{label}</label>
      <div className="relative">
        <Input
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            if (!manualMode) {
              setOpen(true);
            }
            if (manualMode) {
              onChange({
                name: nextValue,
                domain: undefined,
                brandId: null,
                primaryColor: null,
                isManual: true,
              });
            }
          }}
          onFocus={() => !manualMode && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
        />
        {!manualMode && open && (
          <div className="absolute z-50 mt-2 w-full rounded-lg border border-border bg-background shadow-lg max-h-72 overflow-y-auto">
            <div className="px-3 py-2 text-xs text-muted-foreground">
              {loading ? 'Buscando instituições...' : 'Resultados'}
            </div>
            {!loading && results.length === 0 && (
              <div className="px-3 py-3 text-sm text-muted-foreground">
                Nenhuma instituição encontrada.
              </div>
            )}
            {!loading && results.map((result) => {
              const logoUrl = result.domain
                ? buildBrandfetchLogoProxyUrl({
                    identifier: `domain/${result.domain}`,
                    size: 32,
                    theme: 'dark',
                    type: 'icon',
                  })
                : null;
              return (
                <button
                  key={`${result.domain}-${result.name}`}
                  type="button"
                  className="w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
                  onClick={() => handleSelectResult(result)}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt=""
                      className="w-6 h-6 object-contain"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-muted" />
                  )}
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">{result.name || result.domain}</span>
                    {result.domain && (
                      <span className="text-xs text-muted-foreground">{result.domain}</span>
                    )}
                  </div>
                </button>
              );
            })}
            <div className="border-t border-border">
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-muted/50"
                onClick={() => selectManual(query)}
              >
                Outra (informar manualmente)
              </button>
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {manualMode && (
        <button
          type="button"
          className="text-xs text-primary hover:underline"
          onClick={() => {
            setManualMode(false);
            setOpen(true);
            setResults([]);
          }}
        >
          Buscar na lista de instituições
        </button>
      )}
    </div>
  );
}
