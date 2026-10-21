-- PLACE ORDER: validates everything server-side, takes prices from the database,
-- locks stock rows, decrements stock and creates the order in one transaction.
create or replace function public.place_order(
  p_store_slug text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_delivery_address text,
  p_notes text,
  p_payment_method text,
  p_items jsonb
) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_store public.stores%rowtype;
  v_settings public.store_settings%rowtype;
  v_variant public.product_variants%rowtype;
  v_product public.products%rowtype;
  v_item jsonb;
  v_variant_id uuid;
  v_qty integer;
  v_label text;
  v_subtotal numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_order_id uuid := gen_random_uuid();
  v_ref text;
  v_number integer;
begin
  p_customer_name := btrim(coalesce(p_customer_name, ''));
  p_customer_email := lower(btrim(coalesce(p_customer_email, '')));
  p_customer_phone := btrim(coalesce(p_customer_phone, ''));
  p_delivery_address := btrim(coalesce(p_delivery_address, ''));
  p_notes := nullif(left(btrim(coalesce(p_notes, '')), 1000), '');

  if char_length(p_customer_name) < 2 or char_length(p_customer_name) > 120 then
    raise exception 'Please enter your full name.';
  end if;
  if p_customer_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(p_customer_email) > 200 then
    raise exception 'Please enter a valid email address.';
  end if;
  if char_length(p_customer_phone) < 7 or char_length(p_customer_phone) > 25 then
    raise exception 'Please enter a valid phone number.';
  end if;
  if char_length(p_delivery_address) < 8 or char_length(p_delivery_address) > 500 then
    raise exception 'Please enter a complete delivery address.';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 50 then
    raise exception 'Your cart is empty or invalid.';
  end if;

  -- Lock the store row: serializes order numbering for this store
  select * into v_store from public.stores where slug = p_store_slug and status = 'active' for update;
  if not found then
    raise exception 'This store is not accepting orders.';
  end if;

  select * into v_settings from public.store_settings where store_id = v_store.id;
  if not found then
    raise exception 'Checkout is not configured for this store.';
  end if;
  if not (v_settings.payment_methods ? p_payment_method) then
    raise exception 'That payment method is not available for this store.';
  end if;

  select coalesce(max(o.order_number), 0) + 1 into v_number from public.orders o where o.store_id = v_store.id;
  v_ref := 'ORD-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));

  insert into public.orders (
    id, store_id, order_number, order_reference, customer_name, customer_email, customer_phone,
    delivery_address, notes, subtotal, shipping_fee, discount, total, payment_method
  ) values (
    v_order_id, v_store.id, v_number, v_ref, p_customer_name, p_customer_email, p_customer_phone,
    p_delivery_address, p_notes, 0, 0, 0, 0, p_payment_method
  );

  for v_item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(v_item) <> 'object'
       or (v_item->>'variant_id') is null
       or (v_item->>'variant_id') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       or (v_item->>'quantity') is null
       or (v_item->>'quantity') !~ '^[0-9]{1,3}$' then
      raise exception 'Your cart contains an invalid item.';
    end if;

    v_variant_id := (v_item->>'variant_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;
    if v_qty < 1 or v_qty > 100 then
      raise exception 'Your cart contains an invalid quantity.';
    end if;

    select * into v_variant from public.product_variants pv
     where pv.id = v_variant_id and pv.store_id = v_store.id and pv.is_active
     for update;
    if not found then
      raise exception 'An item in your cart is no longer available.';
    end if;

    select * into v_product from public.products p
     where p.id = v_variant.product_id and p.store_id = v_store.id and p.status = 'published';
    if not found then
      raise exception 'An item in your cart is no longer available.';
    end if;

    if v_variant.stock_quantity < v_qty then
      raise exception 'Not enough stock for % (% left).', v_product.name, v_variant.stock_quantity;
    end if;

    update public.product_variants pv
       set stock_quantity = pv.stock_quantity - v_qty
     where pv.id = v_variant.id;

    v_label := nullif(concat_ws(' / ', v_variant.size, v_variant.color), '');

    insert into public.order_items (
      order_id, store_id, product_id, variant_id, product_name, variant_label, unit_price, quantity, line_total
    ) values (
      v_order_id, v_store.id, v_product.id, v_variant.id, v_product.name, v_label,
      v_product.price, v_qty, v_product.price * v_qty
    );

    v_subtotal := v_subtotal + (v_product.price * v_qty);
  end loop;

  if v_settings.free_shipping_threshold is not null and v_subtotal >= v_settings.free_shipping_threshold then
    v_shipping := 0;
  else
    v_shipping := v_settings.shipping_fee;
  end if;

  update public.orders o
     set subtotal = v_subtotal, shipping_fee = v_shipping, total = v_subtotal + v_shipping
   where o.id = v_order_id;

  return v_ref;
end $$;

-- ORDER CONFIRMATION: looked up by the unguessable reference; returns no address, phone or email
create or replace function public.get_order_confirmation(p_order_reference text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'order_reference', o.order_reference,
    'order_number', o.order_number,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'subtotal', o.subtotal,
    'shipping_fee', o.shipping_fee,
    'discount', o.discount,
    'total', o.total,
    'created_at', o.created_at,
    'store', jsonb_build_object(
      'name', s.name, 'slug', s.slug,
      'contact_email', s.contact_email, 'contact_phone', s.contact_phone),
    'payment_instructions', ss.payment_instructions -> o.payment_method,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_name', i.product_name, 'variant_label', i.variant_label,
        'unit_price', i.unit_price, 'quantity', i.quantity, 'line_total', i.line_total)
        order by i.created_at)
      from public.order_items i where i.order_id = o.id), '[]'::jsonb)
  )
  from public.orders o
  join public.stores s on s.id = o.store_id
  left join public.store_settings ss on ss.store_id = o.store_id
  where o.order_reference = upper(btrim(p_order_reference))
$$;

-- OWNER: list members with their login email
create or replace function public.owner_list_members()
returns table (store_id uuid, store_name text, store_slug text, user_id uuid, email text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_platform_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  return query
    select m.store_id, s.name, s.slug, m.user_id, u.email::text, m.role, m.created_at
      from public.store_members m
      join public.stores s on s.id = m.store_id
      join auth.users u on u.id = m.user_id
     order by s.name, m.created_at;
end $$;

-- OWNER: assign an existing confirmed user, or prepare an invitation for an email with no account yet
create or replace function public.owner_assign_member(p_email text, p_store_id uuid)
returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_user uuid;
begin
  if not private.is_platform_owner() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Please enter a valid email address.';
  end if;
  if not exists (select 1 from public.stores s where s.id = p_store_id) then
    raise exception 'Store not found.';
  end if;

  select u.id into v_user from auth.users u
   where lower(u.email) = v_email and u.email_confirmed_at is not null
   limit 1;

  if v_user is not null then
    insert into public.store_members (store_id, user_id, role)
    values (p_store_id, v_user, 'admin')
    on conflict (store_id, user_id) do nothing;
    return 'assigned';
  end if;

  insert into public.store_invitations (store_id, email, role, invited_by)
  values (p_store_id, v_email, 'admin', auth.uid())
  on conflict (store_id, lower(email)) where status = 'pending' do nothing;
  return 'invited';
end $$;

-- Any signed-in user: claim invitations addressed to their own confirmed email
create or replace function public.claim_my_invitations()
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_count integer := 0;
begin
  if v_uid is null then return 0; end if;
  select lower(u.email) into v_email from auth.users u
   where u.id = v_uid and u.email_confirmed_at is not null;
  if v_email is null then return 0; end if;

  with claimed as (
    update public.store_invitations i
       set status = 'claimed', claimed_at = now(), claimed_by = v_uid
     where i.status = 'pending' and i.email = v_email
    returning i.store_id
  ), added as (
    insert into public.store_members (store_id, user_id, role)
    select c.store_id, v_uid, 'admin' from claimed c
    on conflict (store_id, user_id) do nothing
    returning 1
  )
  select count(*)::integer into v_count from claimed;

  return v_count;
end $$;

revoke all on function public.place_order(text,text,text,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.place_order(text,text,text,text,text,text,text,jsonb) to anon, authenticated;
revoke all on function public.get_order_confirmation(text) from public, anon, authenticated;
grant execute on function public.get_order_confirmation(text) to anon, authenticated;
revoke all on function public.owner_list_members() from public, anon, authenticated;
grant execute on function public.owner_list_members() to authenticated;
revoke all on function public.owner_assign_member(text, uuid) from public, anon, authenticated;
grant execute on function public.owner_assign_member(text, uuid) to authenticated;
revoke all on function public.claim_my_invitations() from public, anon, authenticated;
grant execute on function public.claim_my_invitations() to authenticated;
