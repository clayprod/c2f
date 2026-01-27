'use client';

/**
 * Componente para renderizar ícones de categoria (emoji ou BoxIcons)
 * @param icon - Nome do ícone (emoji ou classe BoxIcons como "bx-shopping-bag")
 * @param fallback - Ícone padrão caso icon seja undefined
 */
export function CategoryIcon({ 
  icon, 
  fallback = '📁' 
}: { 
  icon?: string; 
  fallback?: string;
}) {
  const iconValue = icon || fallback;
  
  // Check if it's a BoxIcons class (starts with bx- or bxs-)
  if (iconValue.startsWith('bx-') || iconValue.startsWith('bxs-')) {
    return <i className={`bx ${iconValue}`}></i>;
  }
  
  // Otherwise, render as emoji/text
  return <span>{iconValue}</span>;
}



