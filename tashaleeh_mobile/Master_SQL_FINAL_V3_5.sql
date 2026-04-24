-- ============================================================
-- 💎 النسخة الموحدة والنهائية لقاعدة البيانات
-- Master SQL V3.5 — تاريخ التحديث: 13-04-2026
-- تدمج:
--   ✅ نظام الطلبات V3.0
--   ✅ الملف الشخصي V3.2
--   ✅ نظام الرقابة والأمان V3.3
--   ✅ إصلاح الحظر والحذف V3.4
--   ✅ إصلاح seller_profiles RLS V3.5
-- ============================================================


-- ============================================================
-- 1. بناء الجداول الأساسية
-- ============================================================

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
  condition text,
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


-- ============================================================
-- 2. إعدادات التطبيق والماركات
-- ============================================================

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


-- ============================================================
-- 3. نظام البروفايلات
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  role text DEFAULT 'Buyer',
  display_name text,
  phone text,
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


-- ============================================================
-- 4. جداول الرقابة وسجل العمليات
-- ============================================================

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  reporter_id uuid REFERENCES auth.users(id),
  reported_id uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  status text DEFAULT 'pending',
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


-- ============================================================
-- 5. تفعيل Realtime
-- ============================================================

BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE messages;
COMMIT;


-- ============================================================
-- 6. تفعيل RLS على جميع الجداول
-- ============================================================

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_brands ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 7. دالة فحص الحظر (V3.4)
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_user_blocked(user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND is_blocked = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.is_user_blocked IS 'Checks if a user is blocked. Used for RLS enforcement.';


-- ============================================================
-- 8. سياسات Profiles
-- ============================================================

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);


-- ============================================================
-- 9. سياسات Seller Profiles (V3.5 Fix)
-- ============================================================

DROP POLICY IF EXISTS "Seller profiles are viewable by everyone" ON public.seller_profiles;
CREATE POLICY "Seller profiles are viewable by everyone" ON public.seller_profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers can insert own profile" ON public.seller_profiles;
CREATE POLICY "Sellers can insert own profile" ON public.seller_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Sellers can update own profile" ON public.seller_profiles;
CREATE POLICY "Sellers can update own profile" ON public.seller_profiles
  FOR UPDATE USING (auth.uid() = id);


-- ============================================================
-- 10. سياسات Requests (V3.4 — مع فحص الحظر)
-- ============================================================

DROP POLICY IF EXISTS "Requests are viewable by everyone" ON public.requests;
CREATE POLICY "Requests are viewable by everyone" ON public.requests
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can create their own requests" ON public.requests;
CREATE POLICY "Users can create their own requests" ON public.requests
  FOR INSERT WITH CHECK (
    auth.uid() = buyer_id AND NOT public.is_user_blocked(auth.uid())
  );

DROP POLICY IF EXISTS "Users can update/delete own requests" ON public.requests;
CREATE POLICY "Users can update/delete own requests" ON public.requests
  FOR ALL USING (
    auth.uid() = buyer_id AND NOT public.is_user_blocked(auth.uid())
  );


-- ============================================================
-- 11. سياسات Responses (V3.4 — مع فحص الحظر)
-- ============================================================

DROP POLICY IF EXISTS "Responses are viewable by everyone" ON public.responses;
CREATE POLICY "Responses are viewable by everyone" ON public.responses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers can insert responses" ON public.responses;
CREATE POLICY "Sellers can insert responses" ON public.responses
  FOR INSERT WITH CHECK (
    auth.uid() = seller_id AND NOT public.is_user_blocked(auth.uid())
  );


-- ============================================================
-- 12. سياسات Messages (V3.4 — مع فحص الحظر)
-- ============================================================

DROP POLICY IF EXISTS "Users can see messages they sent or received" ON public.messages;
CREATE POLICY "Users can see messages they sent or received" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

DROP POLICY IF EXISTS "Users can insert messages in their chats" ON public.messages;
CREATE POLICY "Users can insert messages in their chats" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND NOT public.is_user_blocked(auth.uid())
  );


-- ============================================================
-- 13. سياسات App Settings و Car Brands
-- ============================================================

DROP POLICY IF EXISTS "Everyone can read settings" ON public.app_settings;
CREATE POLICY "Everyone can read settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Everyone can read brands" ON public.car_brands;
CREATE POLICY "Everyone can read brands" ON public.car_brands FOR SELECT USING (true);


-- ============================================================
-- 14. وظائف النظام
-- ============================================================

CREATE OR REPLACE FUNCTION public.increment_request_views(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.requests SET views = COALESCE(views, 0) + 1 WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_request_rejections(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.requests SET rejections = COALESCE(rejections, 0) + 1 WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.archive_old_requests()
RETURNS void AS $$
BEGIN
  UPDATE public.requests SET status = 'closed'
  WHERE status = 'open' AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- 15. Cascade Deletion — ضمان الحذف النظيف (V3.4)
-- ============================================================

ALTER TABLE IF EXISTS public.responses
  DROP CONSTRAINT IF EXISTS responses_request_id_fkey,
  ADD CONSTRAINT responses_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.messages
  DROP CONSTRAINT IF EXISTS messages_request_id_fkey,
  ADD CONSTRAINT messages_request_id_fkey
    FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


-- ============================================================
-- 16. نظام المزامنة التلقائي للمستخدمين الجدد
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'role', 'Buyer'))
  ON CONFLICT (id) DO NOTHING;

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


-- ============================================================
-- 17. مزامنة المستخدمين الموجودين (Migration)
-- ============================================================

INSERT INTO public.profiles (id, email, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'role', 'Buyer')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seller_profiles (id, handled_brands, is_online)
SELECT id, ARRAY[]::text[], true
FROM auth.users
WHERE COALESCE(raw_user_meta_data->>'role', 'Buyer') = 'Seller'
ON CONFLICT (id) DO NOTHING;


-- ============================================================
-- ✅ اكتمل التطبيق بنجاح!
-- ============================================================
SELECT 'Master SQL V3.5 applied successfully! ✅' AS status;
