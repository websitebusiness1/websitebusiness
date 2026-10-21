import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import type { Product, ProductImage, ProductVariant } from '@/lib/types';
import { useAuth } from '@/auth/AuthProvider';
import ProductForm, { Flash } from '@/components/ProductForm';
import { Alert, EmptyState, PageHeader, PageLoader } from '@/components/ui';

interface Loaded { product: Product; images: ProductImage[]; variants: ProductVariant[] }

export default function ProductEditor({ mode }: { mode: 'new' | 'edit' }) {
  const { id } = useParams();
  const { activeStore } = useAuth();
  const storeId = activeStore?.store_id;
  const readOnly = activeStore?.store.status !== 'active';
  const navState = useLocation().state as Flash | null;

  const [data, setData] = useState<Loaded | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [flash, setFlash] = useState<Flash | undefined>(navState ?? undefined);

  const load = useCallback(async () => {
    if (!storeId) return;
    const cats = await supabase.from('products').select('category').eq('store_id', storeId);
    setCategories(Array.from(new Set(((cats.data ?? []) as { category: string }[]).map((c) => c.category))).sort());
    if (mode === 'edit') {
      const [p, i, v] = await Promise.all([
        supabase.from('products').select('*').eq('id', id ?? '').eq('store_id', storeId).maybeSingle(),
        supabase.from('product_images').select('*').eq('product_id', id ?? '').eq('store_id', storeId),
        supabase.from('product_variants').select('*').eq('product_id', id ?? '').eq('store_id', storeId),
      ]);
      const err = p.error ?? i.error ?? v.error;
      if (err) setError(errorMessage(err));
      setData(p.data ? { product: p.data as Product, images: (i.data ?? []) as ProductImage[], variants: (v.data ?? []) as ProductVariant[] } : null);
    }
    setLoading(false);
  }, [mode, id, storeId]);

  useEffect(() => { setLoading(true); load(); }, [load]);

  if (!storeId) return null;
  if (loading) return <PageLoader />;
  if (mode === 'edit' && !data) {
    return (
      <EmptyState title="Product not found" action={<Link to="/dashboard/products" className="btn-outline">Back to products</Link>}>
        It may have been deleted, or it belongs to a different store.
      </EmptyState>
    );
  }

  return (
    <div>
      <PageHeader
        title={mode === 'new' ? 'New product' : data!.product.name}
        description={mode === 'new' ? 'Start with the basics. New products are saved as drafts until you publish them.' : undefined}
      />
      {error && <div className="mb-6"><Alert>{error}</Alert></div>}
      <ProductForm
        key={`${mode}-${id ?? 'new'}-${version}`}
        storeId={storeId}
        readOnly={readOnly}
        categories={categories}
        initial={data ?? undefined}
        flash={flash}
        onSaved={async (f) => { setFlash(f); await load(); setVersion((v) => v + 1); }}
      />
    </div>
  );
}
