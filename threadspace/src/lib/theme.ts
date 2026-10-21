import type { BrandColors } from './types';

const HEX = /^#[0-9a-f]{6}$/i;
const DEFAULTS: BrandColors = { primary: '#111111', accent: '#b08d57', background: '#faf8f5', text: '#111111' };

function channel(v: number) {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}
export function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
export const readableOn = (hex: string) => (contrast(hex, '#ffffff') >= contrast(hex, '#000000') ? '#ffffff' : '#000000');

/**
 * Turns a store's saved colors into CSS variables. Only strict #rrggbb values are accepted
 * (nothing else from the database ever reaches a style attribute), and body text is forced
 * to stay readable even if a brand picks colors that clash.
 */
export function buildTheme(colors: Partial<BrandColors> | null | undefined): Record<string, string> {
  const c: BrandColors = { ...DEFAULTS };
  (Object.keys(DEFAULTS) as (keyof BrandColors)[]).forEach((k) => {
    const v = colors?.[k];
    if (typeof v === 'string' && HEX.test(v)) c[k] = v.toLowerCase();
  });
  if (contrast(c.text, c.background) < 4.5) c.text = readableOn(c.background);
  return {
    '--b-primary': c.primary,
    '--b-on-primary': readableOn(c.primary),
    '--b-accent': c.accent,
    '--b-on-accent': readableOn(c.accent),
    '--b-bg': c.background,
    '--b-text': c.text,
  };
}

/** Only http(s) links are ever rendered from store-provided URLs. */
export const safeUrl = (u: string | undefined | null) => (u && /^https?:\/\//i.test(u) ? u : null);
