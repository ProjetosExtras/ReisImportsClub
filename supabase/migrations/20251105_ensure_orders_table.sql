-- Ensure orders table exists with expected schema and RLS/policies
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  total numeric(10,2) not null,
  payment_method payment_method not null,
  status order_status not null default 'pending',
  delivery_address text not null,
  phone text not null,
  notes text,
  cpf text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Indexes helpful for queries
create index if not exists idx_orders_user_id_created_at on public.orders (user_id, created_at);
create index if not exists idx_orders_cpf_created_at on public.orders (cpf, created_at);

-- Policies: drop/recreate to avoid duplicates and ensure correctness
drop policy if exists "Users can view own orders" on public.orders;
drop policy if exists "Users can create own orders" on public.orders;
drop policy if exists "Admins can view all orders" on public.orders;
drop policy if exists "Admins can update all orders" on public.orders;

create policy "Users can view own orders"
  on public.orders for select
  using (auth.uid() = user_id);

create policy "Users can create own orders"
  on public.orders for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all orders"
  on public.orders for select
  using (public.has_role(auth.uid(), 'admin'));

create policy "Admins can update all orders"
  on public.orders for update
  using (public.has_role(auth.uid(), 'admin'));