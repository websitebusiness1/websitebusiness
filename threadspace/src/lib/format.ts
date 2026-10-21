const peso = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });
const date = new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' });

export const formatPHP = (n: number | string) => peso.format(Number(n));
export const formatDate = (iso: string) => date.format(new Date(iso));

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'message' in e) return String((e as { message: unknown }).message);
  return 'Something went wrong. Please try again.';
}
