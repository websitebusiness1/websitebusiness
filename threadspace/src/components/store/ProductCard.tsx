import { Link } from 'react-router-dom';
import { formatPHP } from '@/lib/format';
import { publicImageUrl } from '@/lib/storage';
import type { Product, ProductImage } from '@/lib/types';

export default function ProductCard({ product, images, soldOut, storeSlug }: { product: Product; images: ProductImage[]; soldOut: boolean; storeSlug: string }) {
  const sorted = [...images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order);
  const main = publicImageUrl(sorted[0]?.storage_path);
  const second = publicImageUrl(sorted[1]?.storage_path);
  const onSale = product.compare_at_price != null && product.compare_at_price > product.price;
  return (
    <Link to={`/store/${storeSlug}/product/${product.slug}`} className="group block">
      <div className="s-soft relative aspect-[3/4] overflow-hidden">
        {main ? (
          <>
            <img src={main} alt={product.name} loading="lazy" className={`h-full w-full object-cover transition-opacity duration-300 ${second ? 'group-hover:opacity-0' : ''}`} />
            {second && <img src={second} alt="" loading="lazy" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100" />}
          </>
        ) : (
          <div className="s-muted flex h-full items-center justify-center px-4 text-center font-display text-xl">{product.name}</div>
        )}
        <div className="absolute left-2 top-2 flex gap-1">
          {soldOut ? <span className="s-badge" style={{ background: 'var(--b-text)', color: 'var(--b-bg)' }}>Sold out</span> : onSale && <span className="s-badge">Sale</span>}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-sm font-medium group-hover:underline group-hover:underline-offset-4">{product.name}</p>
        <p className="mt-0.5 text-sm">
          {formatPHP(product.price)}
          {onSale && <span className="s-muted ml-2 line-through">{formatPHP(product.compare_at_price as number)}</span>}
        </p>
      </div>
    </Link>
  );
}
