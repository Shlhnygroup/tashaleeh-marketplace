-- ============================================================
-- 🚀 الملف الشامل لقاعدة بيانات تشاليح (Master SQL V3.2)
-- يجمع بين (المستودع، المشتري، البائع، الإدارة، وحماية البروفايلات)
-- ============================================================

-- 1. إنشاء جداول الطلبات والعروض والرسائل
CREATE TABLE IF NOT EXISTS public.requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  car_brand text NOT NULL,
  model_year text NOT NULL,
  part_details text NOT NULL,
  image_url text,
  vin_number text,
  region text,
  views integer DEFAULT 0,
  rejections integer DEFAULT 0,
  status text DEFAULT 'open',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric,
  notes text,
  image_url text,
  warranty_duration text,
  condition text, -- 'used', 'new', 'refurbished'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text,
  file_url text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. جداول الإعدادات والماركات
CREATE TABLE IF NOT EXISTS public.app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  whatsapp_number text NOT NULL DEFAULT '966500000000',
  app_policy text NOT NULL DEFAULT 'التطبيق يضمن القطعة ومطابقتها. الخدمة مجانية حالياً دون مسؤليات وتبعات مالية.'
);
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.car_brands (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);
INSERT INTO public.car_brands (name) VALUES 
('تويوتا'), ('هيونداي'), ('نيسان'), ('فورد'), ('شيفروليه'), ('كيا'),
('جي إم سي'), ('مازدا'), ('هوندا'), ('لكزس'), ('شانجان'), ('جيلي')
ON CONFLICT (name) DO NOTHING;

-- 3. جداول البروفايلات (للمشتري والبائع والأدمن)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  role text DEFAULT 'Buyer', -- 'Admin', 'Seller', 'Buyer'
  display_name text,
  bio text,
  location text,
  avatar_url text,
  is_blocked boolean DEFAULT false,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.seller_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handled_brands text[],
  is_online boolean DEFAULT true,
  rating numeric DEFAULT 5.0
);

-- 4. جداول الرقابة والبلاغات وسجل العمليات
CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id),
  reported_id uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  status text DEFAULT 'pending', -- 'pending', 'resolved'
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.action_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. تفعيل مزامنة البروفايلات تلقائياً
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'role', 'Buyer'))
  ON CONFLICT (id) DO NOTHING;
  
  -- في حال كان بائعاً، ننشئ له بروفايل بائع أيضاً
  IF COALESCE(new.raw_user_meta_data->>'role', 'Buyer') = 'Seller' THEN
    INSERT INTO public.seller_profiles (id, handled_brands, is_online)
    VALUES (new.id, ARRAY[]::text[], true)
    ON CONFLICT (id) DO NOTHING;
  END IF;
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 6. وظائف الإحصائيات (Views & Rejections)
CREATE OR REPLACE FUNCTION public.increment_request_views(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.requests SET views = COALESCE(views, 0) + 1 WHERE id = request_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.increment_request_rejections(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.requests SET rejections = COALESCE(rejections, 0) + 1 WHERE id = request_id;
END;
$$ LANGUAGE plpgsql;

-- 7. تعطيل RLS لتسهيل العمل في المرحلة الحالية
ALTER TABLE public.requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs DISABLE ROW LEVEL SECURITY;

-- 8. مزامنة المستخدمين الحاليين (إن وجدوا)
INSERT INTO public.profiles (id, email, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'role', 'Buyer')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seller_profiles (id, handled_brands, is_online)
SELECT id, ARRAY[]::text[], true
FROM auth.users
WHERE COALESCE(raw_user_meta_data->>'role', 'Buyer') = 'Seller'
ON CONFLICT (id) DO NOTHING;
