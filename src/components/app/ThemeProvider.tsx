'use client';

import { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export type AppTheme = 'dark' | 'light';

export interface ThemeContextValue {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
}

const STORAGE_KEY = 'c2f-theme';

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const applyThemeToDocument = (theme: AppTheme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
};

// Lê o tema inicial do DOM (já aplicado pelo script inline no layout)
const getInitialTheme = (): AppTheme => {
  if (typeof document === 'undefined') return 'dark';
  const current = document.documentElement.dataset.theme;
  return current === 'light' ? 'light' : 'dark';
};

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  // Inicializa com o tema já aplicado pelo script inline (evita FOUC)
  const [theme, setThemeState] = useState<AppTheme>(() => getInitialTheme());

  useEffect(() => {
    // Sincroniza o estado React com o tema atual do DOM
    const currentTheme = getInitialTheme();
    setThemeState(currentTheme);
  }, []);

  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
    }
    applyThemeToDocument(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  }, [setTheme, theme]);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    setTheme,
    toggleTheme,
  }), [setTheme, theme, toggleTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
