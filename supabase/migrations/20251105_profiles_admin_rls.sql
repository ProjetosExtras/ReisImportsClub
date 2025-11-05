-- Allow admins to SELECT all profiles. Assumes RLS is enabled on profiles and user_roles table exists.
DO $$
BEGIN
  -- Enable RLS on profiles if not already enabled
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'profiles'
  ) THEN
    RAISE NOTICE 'Table public.profiles does not exist';
  END IF;

  -- Create policy for admins to read all profiles
  BEGIN
    CREATE POLICY admin_read_all_profiles
    ON public.profiles
    FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = 'admin'
      )
    );
  EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists
    NULL;
  END;
END
$$;