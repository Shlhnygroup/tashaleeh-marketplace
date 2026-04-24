-- ============================================================
-- ملف قاعدة البيانات المدمج والشامل (V3.0 Final Master SQL) - تصحيح أخير
-- يدمج الكود الأساسي للمستخدم مع ميزة الملفات "المفقودة" V3.0
-- ============================================================

-- 1. بناء الجداول الأساسية (requests, responses, messages)
CREATE TABLE IF NOT EXISTS requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  car_brand text NOT NULL,
  model_year text NOT NULL,
  part_details text NOT NULL,
  image_url text,
  status text DEFAULT 'open',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS responses (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  price numeric,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- انتبه هنا: إضافة العمودين (الصورة والملف) في جدول الرسائل
CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  receiver_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  image_url text, -- لدعم صور الدردشة V2.5
  file_url text,  -- لدعم ملفات الدردشة V3.0 (جديد)
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==========================================
-- 2. ترقية الجداول بالأعمدة الاحترافية
-- ==========================================
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS region text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS rejections integer DEFAULT 0;

ALTER TABLE responses ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS warranty_duration text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS condition text;

-- إذا كان الجدول موجوداً مسبقاً، نضمن إضافة العمود للرسائل يدوياً هنا للتأكيد
ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS file_url text;

-- ==========================================
-- 3. بناء جداول الإعدادات والماركات والملفات
-- ==========================================
CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  whatsapp_number text NOT NULL DEFAULT '966500000000',
  app_policy text NOT NULL DEFAULT 'التطبيق يضمن القطعة ومطابقتها. الخدمة مجانية حالياً دون مسؤليات وتبعات مالية.'
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS car_brands (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);
INSERT INTO car_brands (name) VALUES 
('تويوتا'), ('هيونداي'), ('نيسان'), ('فورد'), ('شيفروليه'), ('كيا'),
('جي إم سي'), ('مازدا'), ('هوندا'), ('لكزس'), ('شانجان'), ('جيلي')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS seller_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handled_brands text[],
  is_online boolean DEFAULT true,
  rating numeric DEFAULT 5.0
);

-- ==========================================
-- 4. إعدادات الوقت الفعلي والأمان (Realtime & Security)
-- ==========================================
BEGIN; 
  DROP PUBLICATION IF EXISTS supabase_realtime; 
  CREATE PUBLICATION supabase_realtime FOR TABLE messages; 
COMMIT;

ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE car_brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 5. وظائف الإحصائيات والأرشفة - (محدثة V3.0)
-- ==========================================
CREATE OR REPLACE FUNCTION increment_request_views(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE requests SET views = COALESCE(views, 0) + 1 WHERE id = request_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION increment_request_rejections(request_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE requests SET rejections = COALESCE(rejections, 0) + 1 WHERE id = request_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION archive_old_requests() 
RETURNS void AS $$
BEGIN
  UPDATE requests SET status = 'closed' 
  WHERE status = 'open' AND created_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
