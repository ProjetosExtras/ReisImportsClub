-- Ensure `order_items` table exists for sales aggregation (best-sellers)
-- Safe to run multiple times; uses IF NOT EXISTS and DROP POLICY IF EXISTS

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- Helper: ensure has_role(user_id, role_name) exists
create or replace function public.has_role(user_id uuid, role_name text)
returns boolean language sql stable as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = user_id
      and ur.role::text = role_name
  );
$$;

-- Create table if missing
create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  price numeric(10,2) not null,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.order_items enable row level security;

-- Policies: drop/recreate to avoid duplicates and ensure correctness
drop policy if exists "Users can view own order items" on public.order_items;
drop policy if exists "Users can create order items" on public.order_items;
drop policy if exists "Admins can view all order items" on public.order_items;

create policy "Users can view own order items"
  on public.order_items for select
  using (
    exists (
      select 1 from public.orders o
      where o.id = public.order_items.order_id
        and o.user_id = auth.uid()
    )
  );

create policy "Users can create order items"
  on public.order_items for insert
  with check (
    exists (
      select 1 from public.orders o
      where o.id = public.order_items.order_id
        and o.user_id = auth.uid()
    )
  );

create policy "Admins can view all order items"
  on public.order_items for select
  using (public.has_role(auth.uid(), 'admin'));