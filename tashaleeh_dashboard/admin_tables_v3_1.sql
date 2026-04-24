-- ==========================================
-- جداول الحماية والرقابة (Dashboard V3.1)
-- ==========================================

-- 1. جدول الحسابات (Profiles) لإدارة الرتب والحظر
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  role text DEFAULT 'Buyer', -- 'Admin', 'Seller', 'Buyer'
  is_blocked boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- دالة وتريجر لتلقائياً إضافة أي مستخدم جديد إلى جدول البروفايلات
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'role', 'Buyer'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. جدول البلاغات (Reports)
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id),
  reported_id uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'resolved'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. سجل عمليات الأدمن (Action Logs)
CREATE TABLE IF NOT EXISTS public.action_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES auth.users(id),
  action text NOT NULL, -- 'BLOCK_USER', 'DELETE_REQUEST', 'UPDATE_SETTINGS', etc.
  target_type text,    -- 'user', 'request', 'car_brand', etc.
  target_id text,
  details jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 4. صلاحيات الوصول وتعطيل RLS للتسهيل حالياً
-- ==========================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs DISABLE ROW LEVEL SECURITY;

-- ملاحظة للأدمن: لتحديد أول أدمن يدوياً، استخدم الاستعلام التالي في Supabase:
-- UPDATE public.profiles SET role = 'Admin' WHERE email = 'your-admin-email@example.com';
