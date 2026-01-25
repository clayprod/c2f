'use client';

import { useEffect, useState } from 'react';
import { logoConfig } from '@/lib/logo';

/**
 * Hook that returns the correct logo based on current theme
 * and reacts to theme changes.
 * 
 * This hook must be used in client components only.
 * 
 * @returns The logo URL appropriate for the current theme
 */
export function useLogo(): string {
  // Default to light logo (for dark theme) - most common default
  const [logo, setLogo] = useState<string>(logoConfig.light);

  useEffect(() => {
    // Function to update logo based on current theme
    const updateLogo = () => {
      const theme = document.documentElement.dataset.theme;
      setLogo(theme === 'light' ? logoConfig.dark : logoConfig.light);
    };

    // Initial update
    updateLogo();

    // Create a MutationObserver to watch for theme changes on the html element
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          updateLogo();
        }
      });
    });

    // Start observing the document element for attribute changes
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Cleanup observer on unmount
    return () => observer.disconnect();
  }, []);

  return logo;
}

/**
 * Hook that returns the vertical logo based on current theme
 * and reacts to theme changes.
 */
export function useVerticalLogo(): string {
  const [logo, setLogo] = useState<string>(logoConfig.verticalLight);

  useEffect(() => {
    const updateLogo = () => {
      const theme = document.documentElement.dataset.theme;
      setLogo(theme === 'light' ? logoConfig.verticalDark : logoConfig.verticalLight);
    };

    updateLogo();

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (
          mutation.type === 'attributes' &&
          mutation.attributeName === 'data-theme'
        ) {
          updateLogo();
        }
      });
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    return () => observer.disconnect();
  }, []);

  return logo;
}
