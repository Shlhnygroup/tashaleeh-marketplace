const { Client } = require('pg');

const { databaseUrl } = require('./db_config.cjs');

const client = new Client({
  connectionString: databaseUrl,
});

const sql = `
  -- 1. ترقية جدول الملفات الشخصية بالأعمدة المطلوبة
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location text;
  ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

  -- 2. ضمان وجود جدول البروفايلات لجميع المستخدمين السابقين
  INSERT INTO public.profiles (id, email, role)
  SELECT id, email, COALESCE(raw_user_meta_data->>'role', 'Buyer')
  FROM auth.users
  ON CONFLICT (id) DO NOTHING;
`;

async function updateSchema() {
  try {
    console.log("Connecting to database for Profile Schema Update (V3.2)...");
    await client.connect();
    console.log("Connected. Executing SQL...");
    await client.query(sql);
    console.log("✅ Database Schema updated successfully!");
  } catch (err) {
    console.error("❌ Schema Update Error:", err.message);
  } finally {
    await client.end();
  }
}

updateSchema();
