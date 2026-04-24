-- ============================================================
-- 💎 النسخة الموحدة والنهائية لقاعدة البيانات (Master SQL V3.2)
-- تاريخ التحديث: 08-04-2026
-- تدمج: (نظام الطلبات V3.0 + الملف الشخصي V3.2 + نظام الرقابة والأمان)
-- ============================================================

-- 1. بناء الجداول الأساسية (requests, responses, messages)
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
  image_url text, -- لدعم صور العرض
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
  image_url text, -- لدعم صور الدردشة
  file_url text,  -- لدعم ملفات الدردشة V3.0
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. إعدادات التطبيق والماركات
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

-- 3. نظام البروفايلات المتطور (الهوية الرقمية)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email text,
  role text DEFAULT 'Buyer', -- 'Admin', 'Seller', 'Buyer'
  display_name text,
  phone text, -- V3.3: Missing column fixed
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
  action text NOT NULL, -- 'BLOCK_USER', 'DELETE_REQUEST', etc.
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. تفعيل الوقت الفعلي (Realtime) والخصوصية
BEGIN; 
  DROP PUBLICATION IF EXISTS supabase_realtime; 
  CREATE PUBLICATION supabase_realtime FOR TABLE messages; 
COMMIT;

-- V3.3: Enable RLS for all tables
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_brands ENABLE ROW LEVEL SECURITY;

-- 5.1 Policies for Profiles
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 5.2 Policies for Requests
CREATE POLICY "Requests are viewable by everyone" ON public.requests
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own requests" ON public.requests
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Users can update/delete own requests" ON public.requests
  FOR ALL USING (auth.uid() = buyer_id);

-- 5.3 Policies for Responses
CREATE POLICY "Responses are viewable by everyone" ON public.responses
  FOR SELECT USING (true);

CREATE POLICY "Sellers can insert responses" ON public.responses
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

-- 5.4 Policies for Messages (CRITICAL ISOLATION)
CREATE POLICY "Users can see messages they sent or received" ON public.messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can insert messages in their chats" ON public.messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 5.5 App Settings and Brands (ReadOnly for public)
CREATE POLICY "Everyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Everyone can read brands" ON public.car_brands FOR SELECT USING (true);

-- 6. وظائف النظام (Functions)
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

-- 7. نظام المزامنة التلقائي للمستخدمين
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- إنشاء بروفايل عام للمستخدم الجديد
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'role', 'Buyer'))
  ON CONFLICT (id) DO NOTHING;
  
  -- إذا كان بائعاً، ننشئ له بروفايل بائع متخصص
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

-- 8. مزامنة البيانات السابقة والترقية (Migration)
INSERT INTO public.profiles (id, email, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'role', 'Buyer')
FROM auth.users
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.seller_profiles (id, handled_brands, is_online)
SELECT id, ARRAY[]::text[], true
FROM auth.users
WHERE COALESCE(raw_user_meta_data->>'role', 'Buyer') = 'Seller'
ON CONFLICT (id) DO NOTHING;
