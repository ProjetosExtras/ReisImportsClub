-- Sales goals table for daily targets and monthly planning
create table if not exists public.sales_goals (
  id uuid primary key default gen_random_uuid(),
  goal_date date not null unique,
  target_amount numeric(10,2) not null,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.sales_goals enable row level security;

-- Policies: only admins can view/manage
drop policy if exists "Admins can view sales goals" on public.sales_goals;
drop policy if exists "Admins can insert sales goals" on public.sales_goals;
drop policy if exists "Admins can update sales goals" on public.sales_goals;
drop policy if exists "Admins can delete sales goals" on public.sales_goals;

create policy "Admins can view sales goals"
  on public.sales_goals for select
  using (has_role(auth.uid(), 'admin'));

create policy "Admins can insert sales goals"
  on public.sales_goals for insert
  with check (has_role(auth.uid(), 'admin'));

create policy "Admins can update sales goals"
  on public.sales_goals for update
  using (has_role(auth.uid(), 'admin'));

create policy "Admins can delete sales goals"
  on public.sales_goals for delete
  using (has_role(auth.uid(), 'admin'));