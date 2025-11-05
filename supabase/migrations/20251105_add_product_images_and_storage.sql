insert into storage.buckets (id, name, public)
values ('products', 'products', true)
on conflict (id) do update
  set name = excluded.name,
      public = excluded.public;

-- Create product_images table to store multiple images per product
create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.product_images enable row level security;

-- Policies: public can view images of active products; admins can manage
drop policy if exists "Public can view images of active products" on public.product_images;
drop policy if exists "Admins can insert product images" on public.product_images;
drop policy if exists "Admins can update product images" on public.product_images;
drop policy if exists "Admins can delete product images" on public.product_images;

create policy "Public can view images of active products"
  on public.product_images for select
  using (
    exists (
      select 1 from public.products p
      where p.id = public.product_images.product_id
        and (p.is_active = true or has_role(auth.uid(), 'admin'))
    )
  );

create policy "Admins can insert product images"
  on public.product_images for insert
  with check (has_role(auth.uid(), 'admin'));

create policy "Admins can update product images"
  on public.product_images for update
  using (has_role(auth.uid(), 'admin'));

create policy "Admins can delete product images"
  on public.product_images for delete
  using (has_role(auth.uid(), 'admin'));

-- Storage policies for the products bucket
drop policy if exists "Public read products" on storage.objects;
drop policy if exists "Admins can upload to products" on storage.objects;
drop policy if exists "Admins can update products" on storage.objects;
drop policy if exists "Admins can delete products" on storage.objects;

create policy "Public read products"
  on storage.objects for select
  using (bucket_id = 'products');

create policy "Admins can upload to products"
  on storage.objects for insert
  with check (bucket_id = 'products' and has_role(auth.uid(), 'admin'));

create policy "Admins can update products"
  on storage.objects for update
  using (bucket_id = 'products' and has_role(auth.uid(), 'admin'));

create policy "Admins can delete products"
  on storage.objects for delete
  using (bucket_id = 'products' and has_role(auth.uid(), 'admin'));