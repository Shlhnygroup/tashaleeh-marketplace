const { Client } = require('pg');

const { databaseUrl } = require('./db_config.cjs');

const client = new Client({
  connectionString: databaseUrl,
});

const sql = `
  -- 1. Profiles Table for Roles and Block Status
  CREATE TABLE IF NOT EXISTS public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email text,
    role text DEFAULT 'Buyer',
    is_blocked boolean DEFAULT false,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- Trigger to sync profiles with auth.users
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger AS $$
  BEGIN
    INSERT INTO public.profiles (id, email, role)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'role', 'Buyer'))
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
    RETURN new;
  END;
  $$ LANGUAGE plpgsql SECURITY DEFINER;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

  -- 2. User Reports Table
  CREATE TABLE IF NOT EXISTS public.reports (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    reporter_id uuid REFERENCES auth.users(id),
    reported_id uuid REFERENCES auth.users(id),
    reason text NOT NULL,
    status text DEFAULT 'pending',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- 3. Action Logs Table
  CREATE TABLE IF NOT EXISTS public.action_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    admin_id uuid REFERENCES auth.users(id),
    action text NOT NULL,
    target_type text,
    target_id text,
    details jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- DISABLE RLS FOR MVP
  ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
  ALTER TABLE public.action_logs DISABLE ROW LEVEL SECURITY;
  
  -- Sync existing users to profiles table
  INSERT INTO public.profiles (id, email, role)
  SELECT id, email, COALESCE(raw_user_meta_data->>'role', 'Buyer')
  FROM auth.users
  ON CONFLICT DO NOTHING;
`;

async function setupV3_1() {
  try {
    console.log("Connecting to database for V3.1 setup...");
    await client.connect();
    console.log("Connected. Executing SQL for roles, reports, and logs...");
    await client.query(sql);
    console.log("✅ V3.1 Database Tables Ready!");
  } catch (err) {
    console.error("❌ Database Error:", err.message);
  } finally {
    await client.end();
  }
}

setupV3_1();
