'use client';

import { useContext } from 'react';
import { ThemeContext } from '@/components/app/ThemeProvider';

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within AppThemeProvider');
  }
  return context;
}
