-- Runs as the caller (SECURITY INVOKER), so RLS decides what is counted.
create or replace function public.store_dashboard_stats(p_store_id uuid)
returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'total_products',     (select count(*) from public.products where store_id = p_store_id),
    'published_products', (select count(*) from public.products where store_id = p_store_id and status = 'published'),
    'draft_products',     (select count(*) from public.products where store_id = p_store_id and status = 'draft'),
    'total_orders',       (select count(*) from public.orders where store_id = p_store_id),
    'pending_orders',     (select count(*) from public.orders where store_id = p_store_id and status = 'pending'),
    'recorded_sales',     coalesce((select sum(total) from public.orders where store_id = p_store_id and status <> 'cancelled'), 0),
    'paid_sales',         coalesce((select sum(total) from public.orders where store_id = p_store_id and payment_status = 'paid'), 0)
  )
$$;
revoke all on function public.store_dashboard_stats(uuid) from public, anon, authenticated;
grant execute on function public.store_dashboard_stats(uuid) to authenticated;
