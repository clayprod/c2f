/**
 * Logo configuration for c2Finance
 * 
 * Use:
 * - logoLight: For dark backgrounds (white/light logo)
 * - logoDark: For light backgrounds (black/dark logo)
 * - logoPrimary: Main brand logo (HELLO styled)
 */

export const logoConfig = {
  // Light logo (white) - for dark backgrounds
  light: '/assets/logos/logo-light.png',
  
  // Dark logo (black) - for light backgrounds
  dark: '/assets/logos/logo-dark.png',
  
  // Vertical logos (for specific use cases)
  verticalLight: '/assets/logos/logo-vertical-light.png',
  verticalDark: '/assets/logos/logo-vertical-dark.png',
  
  // Fallback to simple text logo (if logos not available)
  fallback: '/logo-simple.svg',
} as const;

/**
 * Get logo based on theme
 * Returns appropriate logo for the theme or fallback
 */
export function getLogo(theme: 'light' | 'dark' | 'auto' = 'auto'): string {
  if (theme === 'auto') {
    const documentTheme =
      typeof document !== 'undefined' ? document.documentElement.dataset.theme : null;
    return documentTheme === 'light' ? logoConfig.dark : logoConfig.light;
  }

  // For light theme, use dark logo (for light backgrounds)
  if (theme === 'light') {
    return logoConfig.dark;
  }

  // For dark theme, use light logo (for dark backgrounds)
  return logoConfig.light;
}

