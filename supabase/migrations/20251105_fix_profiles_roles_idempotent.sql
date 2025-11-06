-- Idempotent fix for profiles, user_roles and RLS policies
-- Safely creates missing types, tables, columns, function and policies

-- Types (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    CREATE TYPE user_role AS ENUM ('customer', 'admin');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'order_status') THEN
    CREATE TYPE order_status AS ENUM ('pending', 'approved', 'in_route', 'delivered', 'cancelled');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method') THEN
    CREATE TYPE payment_method AS ENUM ('cash', 'pix', 'card');
  END IF;
END$$;

-- Tables (create only if missing)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  address TEXT,
  role user_role NOT NULL DEFAULT 'customer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Ensure columns added by later migrations exist
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rg_url TEXT;

CREATE TABLE IF NOT EXISTS user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- Helper function (replace to ensure availability)
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles
    WHERE user_id = _user_id
      AND role = _role
  );
$$;

-- Profiles policies (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON profiles FOR SELECT
      USING (auth.uid() = id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON profiles FOR UPDATE
      USING (auth.uid() = id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Admins can view all profiles'
  ) THEN
    CREATE POLICY "Admins can view all profiles"
      ON profiles FOR SELECT
      USING (has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- user_roles policies
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Users can view own roles'
  ) THEN
    CREATE POLICY "Users can view own roles"
      ON user_roles FOR SELECT
      USING (auth.uid() = user_id);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_roles' AND policyname = 'Admins can manage all roles'
  ) THEN
    CREATE POLICY "Admins can manage all roles"
      ON user_roles FOR ALL
      USING (has_role(auth.uid(), 'admin'));
  END IF;
END$$;

-- updated_at trigger function (optional for profiles)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Ensure trigger exists on profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at'
  ) THEN
    CREATE TRIGGER update_profiles_updated_at
      BEFORE UPDATE ON profiles
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END$$;