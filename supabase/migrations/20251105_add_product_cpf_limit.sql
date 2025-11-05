-- Add CPF purchase limit per product
-- Allows admins to set how many units a single CPF can buy

alter table public.products
  add column if not exists cpf_limit_per_cpf integer check (cpf_limit_per_cpf >= 0);

-- Null means no limit; 0 means blocked; positive integers enforce max per CPF