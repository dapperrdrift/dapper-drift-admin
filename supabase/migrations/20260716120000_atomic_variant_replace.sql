-- Product variant saves previously ran as: delete existing variants for a product,
-- then insert/update the new set in a client-side loop across separate network
-- round-trips. Any failure partway through (e.g. the sku UNIQUE constraint being
-- violated by a duplicate SKU) left the delete committed but some/all inserts
-- never applied, silently wiping a product's variants. This wraps delete+upsert
-- in one DB transaction so it's all-or-nothing.
create or replace function public.replace_product_variants(
  p_product_id uuid,
  p_variants jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  keep_ids uuid[];
begin
  select coalesce(array_agg((elem->>'id')::uuid), '{}')
  into keep_ids
  from jsonb_array_elements(p_variants) elem
  where elem->>'id' is not null;

  delete from public.variants
  where product_id = p_product_id
    and not (id = any(keep_ids));

  insert into public.variants (
    id, product_id, color, size, sku, price_override, compare_at_price,
    stock_quantity, low_stock_threshold, barcode, weight, track_inventory
  )
  select
    coalesce((elem->>'id')::uuid, gen_random_uuid()),
    p_product_id,
    elem->>'color',
    elem->>'size',
    elem->>'sku',
    (elem->>'price_override')::numeric,
    (elem->>'compare_at_price')::numeric,
    (elem->>'stock_quantity')::int,
    (elem->>'low_stock_threshold')::int,
    elem->>'barcode',
    (elem->>'weight')::numeric,
    coalesce((elem->>'track_inventory')::boolean, true)
  from jsonb_array_elements(p_variants) elem
  on conflict (id) do update set
    color = excluded.color,
    size = excluded.size,
    sku = excluded.sku,
    price_override = excluded.price_override,
    compare_at_price = excluded.compare_at_price,
    stock_quantity = excluded.stock_quantity,
    low_stock_threshold = excluded.low_stock_threshold,
    barcode = excluded.barcode,
    weight = excluded.weight,
    track_inventory = excluded.track_inventory;
end;
$$;

grant execute on function public.replace_product_variants(uuid, jsonb) to authenticated;
