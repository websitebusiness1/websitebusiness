alter table public.platform_owners enable row level security;
alter table public.store_settings enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.store_invitations enable row level security;

drop policy if exists "Public can view stores" on public.stores;
drop policy if exists "Public can view products" on public.products;
drop policy if exists "Members can add products" on public.products;
drop policy if exists "Members can update products" on public.products;
drop policy if exists "Members can delete products" on public.products;

revoke all on public.platform_owners from anon;
revoke all on public.store_members from anon;
revoke all on public.orders from anon;
revoke all on public.order_items from anon;
revoke all on public.store_invitations from anon;
revoke insert, delete, truncate on public.orders from authenticated;
revoke insert, update, delete, truncate on public.order_items from authenticated;
revoke update on public.orders from authenticated;
grant update (status, payment_status) on public.orders to authenticated;
revoke insert, update, delete, truncate on public.platform_owners from authenticated;

create policy platform_owners_read_self on public.platform_owners
  for select to authenticated using (user_id = (select auth.uid()));

create policy stores_public_read on public.stores
  for select to anon, authenticated using (status = 'active');
create policy stores_member_read on public.stores
  for select to authenticated using (private.is_store_member(id) or (select private.is_platform_owner()));
create policy stores_owner_insert on public.stores
  for insert to authenticated with check ((select private.is_platform_owner()));
create policy stores_manage_update on public.stores
  for update to authenticated
  using (private.can_manage_store(id)) with check (private.can_manage_store(id));
-- No delete policy on purpose: stores are archived, not deleted.

create policy store_members_owner_read on public.store_members
  for select to authenticated using ((select private.is_platform_owner()));
create policy store_members_owner_insert on public.store_members
  for insert to authenticated with check ((select private.is_platform_owner()));
create policy store_members_owner_update on public.store_members
  for update to authenticated
  using ((select private.is_platform_owner())) with check ((select private.is_platform_owner()));
create policy store_members_owner_delete on public.store_members
  for delete to authenticated using ((select private.is_platform_owner()));

create policy store_settings_read on public.store_settings
  for select to anon, authenticated
  using (exists (select 1 from public.stores s where s.id = store_settings.store_id));
create policy store_settings_insert on public.store_settings
  for insert to authenticated with check (private.can_manage_store(store_id));
create policy store_settings_update on public.store_settings
  for update to authenticated
  using (private.can_manage_store(store_id)) with check (private.can_manage_store(store_id));

create policy products_public_read on public.products
  for select to anon, authenticated
  using (status = 'published'
         and exists (select 1 from public.stores s where s.id = products.store_id and s.status = 'active'));
create policy products_member_read on public.products
  for select to authenticated
  using (private.is_store_member(store_id) or (select private.is_platform_owner()));
create policy products_manage_insert on public.products
  for insert to authenticated with check (private.can_manage_store(store_id));
create policy products_manage_update on public.products
  for update to authenticated
  using (private.can_manage_store(store_id)) with check (private.can_manage_store(store_id));
create policy products_manage_delete on public.products
  for delete to authenticated using (private.can_manage_store(store_id));

create policy product_images_read on public.product_images
  for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_images.product_id));
create policy product_images_insert on public.product_images
  for insert to authenticated with check (private.can_manage_store(store_id));
create policy product_images_update on public.product_images
  for update to authenticated
  using (private.can_manage_store(store_id)) with check (private.can_manage_store(store_id));
create policy product_images_delete on public.product_images
  for delete to authenticated using (private.can_manage_store(store_id));

create policy product_variants_public_read on public.product_variants
  for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_variants.product_id));
create policy product_variants_member_read on public.product_variants
  for select to authenticated
  using (private.is_store_member(store_id) or (select private.is_platform_owner()));
create policy product_variants_insert on public.product_variants
  for insert to authenticated with check (private.can_manage_store(store_id));
create policy product_variants_update on public.product_variants
  for update to authenticated
  using (private.can_manage_store(store_id)) with check (private.can_manage_store(store_id));
create policy product_variants_delete on public.product_variants
  for delete to authenticated using (private.can_manage_store(store_id));

create policy orders_member_read on public.orders
  for select to authenticated
  using (private.is_store_member(store_id) or (select private.is_platform_owner()));
create policy orders_manage_update on public.orders
  for update to authenticated
  using (private.can_manage_store(store_id)) with check (private.can_manage_store(store_id));
create policy order_items_member_read on public.order_items
  for select to authenticated
  using (private.is_store_member(store_id) or (select private.is_platform_owner()));

create policy store_invitations_owner_all on public.store_invitations
  for all to authenticated
  using ((select private.is_platform_owner())) with check ((select private.is_platform_owner()));
