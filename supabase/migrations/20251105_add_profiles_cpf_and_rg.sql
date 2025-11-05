-- Add CPF and RG URL columns to profiles if they do not exist
DO $$
BEGIN
    -- Add cpf column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cpf'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN cpf text;
    END IF;

    -- Add rg_url column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'rg_url'
    ) THEN
        ALTER TABLE public.profiles ADD COLUMN rg_url text;
    END IF;
END $$;

-- Optional: index CPF for faster lookups
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'profiles_cpf_idx'
    ) THEN
        CREATE INDEX profiles_cpf_idx ON public.profiles (cpf);
    END IF;
END $$;