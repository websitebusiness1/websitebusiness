-- Applied to project clothing-store-platform. Extends the existing stores / store_members / products tables.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create table if not exists public.platform_owners (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.stores
  add column if not exists logo_path text,
  add column if not exists banner_path text,
  add column if not exists brand_colors jsonb not null default '{"primary":"#111111","accent":"#b08d57","background":"#faf8f5","text":"#111111"}'::jsonb,
  add column if not exists contact_email text,
  add column if not exists contact_phone text,
  add column if not exists contact_address text,
  add column if not exists social_links jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

alter table public.stores
  add constraint stores_status_check check (status in ('active','suspended','archived')),
  add constraint stores_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 2 and 60),
  add constraint stores_name_length check (char_length(btrim(name)) between 1 and 100),
  add constraint stores_brand_colors_object check (jsonb_typeof(brand_colors) = 'object'),
  add constraint stores_social_links_object check (jsonb_typeof(social_links) = 'object');

alter table public.products
  add column if not exists slug text,
  add column if not exists compare_at_price numeric(12,2),
  add column if not exists status text not null default 'draft',
  add column if not exists is_featured boolean not null default false;

alter table public.products alter column slug set not null;

alter table public.products
  add constraint products_status_check check (status in ('draft','published')),
  add constraint products_compare_at_check check (compare_at_price is null or compare_at_price >= price),
  add constraint products_name_length check (char_length(btrim(name)) between 1 and 200),
  add constraint products_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  add constraint products_store_slug_key unique (store_id, slug),
  add constraint products_id_store_key unique (id, store_id);

create table public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  announcement text,
  hero_heading text,
  hero_subheading text,
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  free_shipping_threshold numeric(12,2) check (free_shipping_threshold is null or free_shipping_threshold >= 0),
  payment_methods jsonb not null default '["cod"]'::jsonb,
  payment_instructions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint store_settings_payment_methods_valid check (
    jsonb_typeof(payment_methods) = 'array'
    and jsonb_array_length(payment_methods) >= 1
    and payment_methods <@ '["cod","bank_transfer","gcash"]'::jsonb),
  constraint store_settings_payment_instructions_object check (jsonb_typeof(payment_instructions) = 'object')
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  store_id uuid not null,
  storage_path text not null,
  alt_text text,
  sort_order integer not null default 0,
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint product_images_product_fk foreign key (product_id, store_id)
    references public.products(id, store_id) on delete cascade,
  constraint product_images_path_in_store check (
    storage_path like (store_id::text || '/%') and storage_path !~ '\.\.')
);
create unique index product_images_one_cover on public.product_images(product_id) where is_cover;
create index product_images_product_idx on public.product_images(product_id, sort_order);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null,
  store_id uuid not null,
  size text,
  color text,
  sku text,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_variants_product_fk foreign key (product_id, store_id)
    references public.products(id, store_id) on delete cascade,
  constraint product_variants_text_length check (
    char_length(coalesce(size,'')) <= 40 and char_length(coalesce(color,'')) <= 40 and char_length(coalesce(sku,'')) <= 80)
);
create unique index product_variants_combo_key on public.product_variants (product_id, coalesce(size,''), coalesce(color,''));
create unique index product_variants_sku_key on public.product_variants (store_id, sku) where sku is not null;
create index product_variants_product_idx on public.product_variants(product_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id),
  order_number integer not null,
  order_reference text not null unique,
  customer_name text not null,
  customer_email text not null,
  customer_phone text not null,
  delivery_address text not null,
  notes text,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  shipping_fee numeric(12,2) not null default 0 check (shipping_fee >= 0),
  discount numeric(12,2) not null default 0 check (discount >= 0),
  total numeric(12,2) not null check (total >= 0),
  status text not null default 'pending' check (status in ('pending','confirmed','processing','shipped','delivered','cancelled')),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded')),
  payment_method text not null check (payment_method in ('cod','bank_transfer','gcash')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_store_number_key unique (store_id, order_number),
  constraint orders_id_store_key unique (id, store_id)
);
create index orders_store_created_idx on public.orders(store_id, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  store_id uuid not null,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_label text,
  unit_price numeric(12,2) not null check (unit_price >= 0),
  quantity integer not null check (quantity > 0),
  line_total numeric(12,2) not null check (line_total >= 0),
  created_at timestamptz not null default now(),
  constraint order_items_order_fk foreign key (order_id, store_id)
    references public.orders(id, store_id) on delete cascade
);
create index order_items_order_idx on public.order_items(order_id);

create table public.store_invitations (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  email text not null check (email = lower(btrim(email))),
  role text not null default 'admin' check (role = 'admin'),
  status text not null default 'pending' check (status in ('pending','claimed','revoked')),
  invited_by uuid references auth.users(id) on delete set null,
  claimed_by uuid references auth.users(id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index store_invitations_pending_key on public.store_invitations (store_id, lower(email)) where status = 'pending';

create index if not exists store_members_user_idx on public.store_members(user_id);
create index if not exists products_store_status_idx on public.products(store_id, status);
create index if not exists products_store_created_idx on public.products(store_id, created_at desc);

create or replace function private.is_platform_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.platform_owners o where o.user_id = auth.uid())
$$;

create or replace function private.is_store_member(p_store_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.store_members m where m.store_id = p_store_id and m.user_id = auth.uid())
$$;

create or replace function private.can_manage_store(p_store_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_owner()
    or exists (
      select 1 from public.store_members m
      join public.stores s on s.id = m.store_id
      where m.store_id = p_store_id and m.user_id = auth.uid() and s.status = 'active')
$$;

create or replace function private.can_manage_store_folder(p_folder text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_platform_owner()
    or exists (
      select 1 from public.store_members m
      join public.stores s on s.id = m.store_id
      where m.store_id::text = p_folder and m.user_id = auth.uid() and s.status = 'active')
$$;

revoke all on function private.is_platform_owner() from public, anon;
revoke all on function private.is_store_member(uuid) from public, anon;
revoke all on function private.can_manage_store(uuid) from public, anon;
revoke all on function private.can_manage_store_folder(text) from public, anon;
grant execute on function private.is_platform_owner() to authenticated;
grant execute on function private.is_store_member(uuid) to authenticated;
grant execute on function private.can_manage_store(uuid) to authenticated;
grant execute on function private.can_manage_store_folder(text) to authenticated;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end $$;

create or replace function private.guard_store_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  -- Applies only to end-user sessions; direct admin/SQL changes have no auth.uid()
  if auth.uid() is not null and not private.is_platform_owner() then
    if new.id is distinct from old.id
       or new.slug is distinct from old.slug
       or new.status is distinct from old.status
       or new.created_at is distinct from old.created_at then
      raise exception 'Only the platform owner can change a store''s slug or status' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;

create or replace function private.guard_product_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.store_id is distinct from old.store_id then
    raise exception 'A product cannot be moved to another store' using errcode = '42501';
  end if;
  return new;
end $$;

create or replace function private.set_product_slug()
returns trigger language plpgsql set search_path = '' as $$
declare
  base text;
  candidate text;
begin
  if new.slug is null or btrim(new.slug) = '' then
    base := trim(both '-' from regexp_replace(lower(new.name), '[^a-z0-9]+', '-', 'g'));
    if base = '' then base := 'product'; end if;
    candidate := base;
    if exists (select 1 from public.products p where p.store_id = new.store_id and p.slug = candidate) then
      candidate := base || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    end if;
    new.slug := candidate;
  end if;
  return new;
end $$;

create or replace function private.handle_order_status_change()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'cancelled' and new.status <> 'cancelled' then
    raise exception 'A cancelled order cannot be reopened' using errcode = '22023';
  end if;
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    update public.product_variants v
       set stock_quantity = v.stock_quantity + s.qty
      from (select variant_id, sum(quantity)::integer as qty
              from public.order_items
             where order_id = new.id and variant_id is not null
             group by variant_id) s
     where s.variant_id = v.id;
  end if;
  return new;
end $$;

create or replace function private.create_default_store_settings()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.store_settings (store_id) values (new.id) on conflict do nothing;
  return new;
end $$;

revoke all on function private.set_updated_at() from public, anon, authenticated;
revoke all on function private.guard_store_update() from public, anon;
revoke all on function private.guard_product_update() from public, anon, authenticated;
revoke all on function private.set_product_slug() from public, anon;
revoke all on function private.handle_order_status_change() from public, anon, authenticated;
revoke all on function private.create_default_store_settings() from public, anon, authenticated;
grant execute on function private.guard_store_update() to authenticated;
grant execute on function private.set_product_slug() to authenticated;

create trigger stores_set_updated_at before update on public.stores for each row execute function private.set_updated_at();
create trigger stores_guard_update before update on public.stores for each row execute function private.guard_store_update();
create trigger stores_default_settings after insert on public.stores for each row execute function private.create_default_store_settings();
create trigger products_set_updated_at before update on public.products for each row execute function private.set_updated_at();
create trigger products_guard_update before update on public.products for each row execute function private.guard_product_update();
create trigger products_set_slug before insert on public.products for each row execute function private.set_product_slug();
create trigger store_settings_set_updated_at before update on public.store_settings for each row execute function private.set_updated_at();
create trigger product_variants_set_updated_at before update on public.product_variants for each row execute function private.set_updated_at();
create trigger orders_set_updated_at before update on public.orders for each row execute function private.set_updated_at();
create trigger orders_status_change before update of status on public.orders for each row execute function private.handle_order_status_change();

insert into public.store_settings (store_id) select id from public.stores on conflict do nothing;
