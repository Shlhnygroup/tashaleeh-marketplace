-- 1. بناء الجداول الأساسية إذا لم تكن موجودة (MVP)
CREATE TABLE IF NOT EXISTS requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id uuid REFERENCES auth.users(id),
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
  seller_id uuid REFERENCES auth.users(id),
  price numeric,
  notes text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
  sender_id uuid REFERENCES auth.users(id),
  receiver_id uuid REFERENCES auth.users(id),
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. ترقية الجداول الأساسية للأعمدة الجديدة (V2)
-- لا تقلق، لن يؤثر على بياناتك السابقة
ALTER TABLE requests ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS rejections integer DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS region text;

ALTER TABLE responses ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS warranty_duration text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS condition text;

-- 3. بناء جداول V2 الجديدة (تنظيف إذا كانت موجودة بتصميم قديم أو تمت إضافتها بالخطأ)
DROP TABLE IF EXISTS app_settings CASCADE;
CREATE TABLE app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  whatsapp_number text NOT NULL DEFAULT '966500000000',
  app_policy text NOT NULL DEFAULT 'التطبيق يضمن القطعة ومطابقتها. الخدمة مجانية حالياً دون مسؤليات وتبعات مالية.'
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DROP TABLE IF EXISTS car_brands CASCADE;
CREATE TABLE car_brands (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);
INSERT INTO car_brands (name) VALUES 
('تويوتا'), ('هيونداي'), ('نيسان'), ('فورد'), ('شيفروليه'), ('كيا'),
('جي إم سي'), ('مازدا'), ('هوندا'), ('لكزس'), ('شانجان'), ('جيلي')
ON CONFLICT (name) DO NOTHING;

DROP TABLE IF EXISTS seller_profiles CASCADE;
CREATE TABLE seller_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handled_brands text[],
  is_online boolean DEFAULT true,
  rating numeric DEFAULT 5.0
);

-- 4. إغلاق قواعد الأمان مؤقتاً لتسهيل التطوير البرمجي
ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE car_brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles DISABLE ROW LEVEL SECURITY;
