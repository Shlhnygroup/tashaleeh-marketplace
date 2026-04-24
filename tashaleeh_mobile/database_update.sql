-- 1. جدول إعدادات التطبيق (للتحكم الديناميكي من لوحة الإدارة)
CREATE TABLE IF NOT EXISTS app_settings (
  id integer PRIMARY KEY DEFAULT 1,
  whatsapp_number text NOT NULL DEFAULT '966500000000',
  app_policy text NOT NULL DEFAULT 'التطبيق يضمن القطعة ومطابقتها. الخدمة مجانية حالياً دون مسؤليات وتبعات مالية.'
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 2. جدول الماركات الديناميكية
CREATE TABLE IF NOT EXISTS car_brands (
  id serial PRIMARY KEY,
  name text UNIQUE NOT NULL
);

INSERT INTO car_brands (name) VALUES 
('تويوتا'), ('هيونداي'), ('نيسان'), ('فورد'), ('شيفروليه'), ('كيا'),
('جي إم سي'), ('مازدا'), ('هوندا'), ('لكزس'), ('شانجان'), ('جيلي')
ON CONFLICT DO NOTHING;

-- 3. تحديث جدول الطلبات لدعم الإحصائيات والأرشفة
ALTER TABLE requests ADD COLUMN IF NOT EXISTS views integer DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS rejections integer DEFAULT 0;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS vin_number text;
ALTER TABLE requests ADD COLUMN IF NOT EXISTS region text;

-- 4. تحديث جدول العروض لدعم تفاصيل التسعير المتطورة
ALTER TABLE responses ADD COLUMN IF NOT EXISTS warranty_duration text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS condition text;
ALTER TABLE responses ADD COLUMN IF NOT EXISTS image_url text;

-- 5. إعدادات المتجر للبائع
CREATE TABLE IF NOT EXISTS seller_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  handled_brands text[],
  is_online boolean DEFAULT true,
  rating numeric DEFAULT 5.0
);

-- إلغاء RLS مؤقتاً لتسهيل التطوير في المرحلة الحالية
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE car_brands DISABLE ROW LEVEL SECURITY;
ALTER TABLE seller_profiles DISABLE ROW LEVEL SECURITY;
