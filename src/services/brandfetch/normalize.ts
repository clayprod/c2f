const isHexColor = (value: string) => /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(value);

const normalizeHex = (value: string) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!isHexColor(trimmed)) return null;
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
};

const extractFromColorObject = (color: any) => {
  if (!color) return null;
  const possible = [color.hex, color.color, color.value].filter(Boolean);
  for (const candidate of possible) {
    const normalized = normalizeHex(String(candidate));
    if (normalized) return normalized;
  }
  return null;
};

export const extractPrimaryColor = (brand: any) => {
  if (!brand) return null;

  if (Array.isArray(brand.colors)) {
    const primary = brand.colors.find((color: any) =>
      ['primary', 'brand', 'main'].includes(String(color?.type || color?.role || '').toLowerCase())
    );
    return extractFromColorObject(primary) || extractFromColorObject(brand.colors[0]);
  }

  if (brand.colors && typeof brand.colors === 'object') {
    const primary = extractFromColorObject(brand.colors.primary);
    if (primary) return primary;
    const brandColor = extractFromColorObject(brand.colors.brand);
    if (brandColor) return brandColor;
    const firstValue = Object.values(brand.colors).find(Boolean);
    return extractFromColorObject(firstValue);
  }

  if (brand.color) {
    return extractFromColorObject(brand.color);
  }

  return null;
};
