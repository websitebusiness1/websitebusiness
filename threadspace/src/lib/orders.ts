export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export const PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const METHOD_LABELS: Record<string, string> = { cod: 'Cash on delivery', bank_transfer: 'Bank transfer', gcash: 'GCash' };
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const orderStyles: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-900',
  confirmed: 'border-sky-200 bg-sky-50 text-sky-900',
  processing: 'border-indigo-200 bg-indigo-50 text-indigo-900',
  shipped: 'border-violet-200 bg-violet-50 text-violet-900',
  delivered: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  cancelled: 'border-sand-200 bg-sand-100 text-sand-700',
};
const paymentStyles: Record<string, string> = {
  pending: 'border-amber-200 bg-amber-50 text-amber-900',
  paid: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  failed: 'border-red-200 bg-red-50 text-red-900',
  refunded: 'border-sand-200 bg-sand-100 text-sand-700',
};

export const orderStatusClass = (s: string) => orderStyles[s] ?? orderStyles.pending;
export const paymentStatusClass = (s: string) => paymentStyles[s] ?? paymentStyles.pending;
