export type StoreStatus = 'active' | 'suspended' | 'archived';

export interface BrandColors {
  primary: string;
  accent: string;
  background: string;
  text: string;
}

export interface Store {
  id: string;
  name: string;
  slug: string;
  logo_path: string | null;
  banner_path: string | null;
  brand_colors: BrandColors;
  contact_email: string | null;
  contact_phone: string | null;
  contact_address: string | null;
  social_links: Record<string, string>;
  status: StoreStatus;
  created_at: string;
  updated_at: string;
}

export interface Membership {
  store_id: string;
  role: string;
  store: Store;
}

export interface MemberRow {
  store_id: string;
  store_name: string;
  store_slug: string;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  store_id: string;
  email: string;
  status: 'pending' | 'claimed' | 'revoked';
  created_at: string;
  stores?: { name: string } | null;
}

export interface DashboardStats {
  total_products: number;
  published_products: number;
  draft_products: number;
  total_orders: number;
  pending_orders: number;
  recorded_sales: number;
  paid_sales: number;
}

export type ProductStatus = 'draft' | 'published';

export interface Product {
  id: string;
  store_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  category: string;
  status: ProductStatus;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  store_id: string;
  storage_path: string;
  alt_text: string | null;
  sort_order: number;
  is_cover: boolean;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  store_id: string;
  size: string | null;
  color: string | null;
  sku: string | null;
  stock_quantity: number;
  is_active: boolean;
  created_at: string;
}

export interface StoreSettings {
  store_id: string;
  announcement: string | null;
  hero_heading: string | null;
  hero_subheading: string | null;
  shipping_fee: number;
  free_shipping_threshold: number | null;
  payment_methods: string[];
  payment_instructions: Record<string, string>;
}

export interface OrderConfirmationData {
  order_reference: string;
  order_number: number;
  status: string;
  payment_status: string;
  payment_method: string;
  subtotal: number;
  shipping_fee: number;
  discount: number;
  total: number;
  created_at: string;
  store: { name: string; slug: string; contact_email: string | null; contact_phone: string | null };
  payment_instructions: string | null;
  items: { product_name: string; variant_label: string | null; unit_price: number; quantity: number; line_total: number }[];
}
