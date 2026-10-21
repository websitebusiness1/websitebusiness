import { ReactNode, useEffect, useRef } from 'react';
import type { StoreStatus } from '@/lib/types';

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

export function PageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sand-500">
      <Spinner className="h-6 w-6" />
    </div>
  );
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'success' | 'info'; children: ReactNode }) {
  const styles = {
    error: 'border-red-300 bg-red-50 text-red-900',
    success: 'border-emerald-300 bg-emerald-50 text-emerald-900',
    info: 'border-sand-300 bg-sand-50 text-sand-700',
  }[kind];
  return (
    <div role={kind === 'error' ? 'alert' : 'status'} className={`rounded border px-3 py-2.5 text-sm ${styles}`}>
      {children}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded border border-dashed border-sand-300 px-6 py-12 text-center">
      <p className="font-display text-xl">{title}</p>
      {children && <p className="mx-auto mt-2 max-w-md text-sm text-sand-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl leading-tight sm:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-xl text-sm text-sand-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const statusStyles: Record<StoreStatus, string> = {
  active: 'bg-emerald-50 text-emerald-900 border-emerald-200',
  suspended: 'bg-amber-50 text-amber-900 border-amber-200',
  archived: 'bg-sand-100 text-sand-700 border-sand-200',
};

export function StatusBadge({ status }: { status: StoreStatus }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[status]}`}>
      {status}
    </span>
  );
}

export function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-sand-500">{label}</p>
      <p className="mt-1 font-display text-3xl">{value}</p>
      {note && <p className="mt-1 text-xs text-sand-500">{note}</p>}
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel, danger, busy, onConfirm, onCancel }: ConfirmProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="confirm-title" className="font-display text-2xl">{title}</h2>
        <div className="mt-2 text-sm text-sand-500">{message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button ref={cancelRef} type="button" className="btn-quiet" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>
            {busy && <Spinner />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
