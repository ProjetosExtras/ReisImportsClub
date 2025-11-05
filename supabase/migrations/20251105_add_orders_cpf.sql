-- Add CPF to orders to enforce per-CPF daily limits

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cpf TEXT;

-- Index to speed daily queries by CPF
CREATE INDEX IF NOT EXISTS idx_orders_cpf_created_at
  ON public.orders (cpf, created_at);