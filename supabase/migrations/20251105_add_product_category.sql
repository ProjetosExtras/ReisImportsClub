-- Add product category column to classify items on the home page
-- Allowed values: 'exclusivos' (Produtos Exclusivos) and 'decor' (Produtos Decoração de casa)

alter table public.products
  add column if not exists category text
  check (category in ('exclusivos', 'decor'));

-- Optional: index to speed up filtering by category on the home page
create index if not exists idx_products_category on public.products (category);

-- Note:
-- Existing rows will have category = NULL. The frontend defaults them to 'exclusivos'.
-- After this migration, set desired categories in Admin > Edit Product.