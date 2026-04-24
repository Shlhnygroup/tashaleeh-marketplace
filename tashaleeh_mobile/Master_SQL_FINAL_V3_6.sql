-- ============================================================
-- 💎 النسخة الموحدة والنهائية المطلقة لقاعدة البيانات
-- Master SQL V3.6 — تاريخ التحديث: إبريل 2026
-- تدمج:
--   ✅ نظام الطلبات والمحادثات
--   ✅ الملف الشخصي والتقييمات
--   ✅ إصلاح سياسات RLS للأدمن (حظر المستخدمين وترقيتهم)
--   ✅ حماية جداول التقارير وسجلات النظام
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
-- 6. تفعيل RLS على جميع الجداول بقوة
-- ============================================================

ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 7. الدوال المساعدة والأمان
-- ============================================================

-- فحص الحظر
CREATE OR REPLACE FUNCTION public.is_user_blocked(user_id UUID)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = user_id AND is_blocked = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- فحص حساب المشرف (دالة محصنة تتخطى الـ RLS لمنع التعارض)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'Admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================================
-- 8. سياسات Profiles
-- ============================================================

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_admin());


-- ============================================================
-- 9. سياسات Seller Profiles
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

DROP POLICY IF EXISTS "Admins can manage seller profiles" ON public.seller_profiles;
CREATE POLICY "Admins can manage seller profiles" ON public.seller_profiles
  FOR ALL USING (public.is_admin());


-- ============================================================
-- 10. سياسات Requests
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

DROP POLICY IF EXISTS "Admins can manage requests" ON public.requests;
CREATE POLICY "Admins can manage requests" ON public.requests
  FOR ALL USING (public.is_admin());


-- ============================================================
-- 11. سياسات Responses
-- ============================================================

DROP POLICY IF EXISTS "Responses are viewable by everyone" ON public.responses;
CREATE POLICY "Responses are viewable by everyone" ON public.responses
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Sellers can insert responses" ON public.responses;
CREATE POLICY "Sellers can insert responses" ON public.responses
  FOR INSERT WITH CHECK (
    auth.uid() = seller_id AND NOT public.is_user_blocked(auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage responses" ON public.responses;
CREATE POLICY "Admins can manage responses" ON public.responses
  FOR ALL USING (public.is_admin());


-- ============================================================
-- 12. سياسات Messages
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
-- 13. سياسات التقارير وسجلات النشاط (Reports & Action Logs)
-- ============================================================

DROP POLICY IF EXISTS "Users can insert reports" ON public.reports;
CREATE POLICY "Users can insert reports" ON public.reports 
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
CREATE POLICY "Admins can view reports" ON public.reports 
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can insert action logs" ON public.action_logs;
CREATE POLICY "Admins can insert action logs" ON public.action_logs 
  FOR INSERT WITH CHECK (public.is_admin() AND auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can view action logs" ON public.action_logs;
CREATE POLICY "Admins can view action logs" ON public.action_logs 
  FOR SELECT USING (public.is_admin());


-- ============================================================
-- 14. سياسات App Settings و Car Brands
-- ============================================================

DROP POLICY IF EXISTS "Everyone can read settings" ON public.app_settings;
CREATE POLICY "Everyone can read settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
CREATE POLICY "Admins can update settings" ON public.app_settings FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Everyone can read brands" ON public.car_brands;
CREATE POLICY "Everyone can read brands" ON public.car_brands FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage car brands" ON public.car_brands;
CREATE POLICY "Admins can manage car brands" ON public.car_brands FOR ALL USING (public.is_admin());


-- ============================================================
-- 15. دوال مساعدة إضافية
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
-- 16. Cascade Deletion — الحذف النظيف (V3.4)
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
-- 17. نظام المزامنة التلقائي للمستخدمين الجدد
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
-- 18. مزامنة المستخدمين الموجودين (Migration)
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
-- ✅ اكتمل تحديث التطبيق بنجاح (النسخة 3.6 الفولاذية) !
-- ============================================================
SELECT 'Master SQL V3.6 applied successfully with full admin controls! ✅' AS status;
