-- ============================================================
-- 💎 ترقية هيكلة البيانات V4.0 (الإدارة والمحتوى المطلق)
-- ============================================================

-- 1. إضافة الأعمدة الجديدة للبائعين (إدارة البائعين واشتراطاتهم)
ALTER TABLE public.seller_profiles 
  ADD COLUMN IF NOT EXISTS cr_document_url text,
  ADD COLUMN IF NOT EXISTS store_location text,
  ADD COLUMN IF NOT EXISTS manager_name text;

-- 2. إخفاء المحتوى القسري في الطلبات والعروض (Content Moderation)
ALTER TABLE public.requests
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

ALTER TABLE public.responses
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;

-- 3. الإعدادات المتقدمة (App Settings)
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS privacy_policy text DEFAULT 'تطبق هنا سياسة الخصوصية...',
  ADD COLUMN IF NOT EXISTS terms_conditions text DEFAULT 'الشروط والأحكام الخاصة بالتطبيق...',
  ADD COLUMN IF NOT EXISTS commission_rate numeric DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS subscription_fee numeric DEFAULT 0.0;

-- ============================================================
-- 4. الجداول الجديدة (البنرات والمالية)
-- ============================================================

-- جدول البنرات (الإعلانات)
CREATE TABLE IF NOT EXISTS public.app_banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL,
  link_url text, -- توجيه إما لطلب معين أو موقع خارجي
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- جدول المالية (العمليات والمبيعات)
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id uuid REFERENCES public.requests(id) ON DELETE SET NULL,
  seller_id uuid REFERENCES auth.users(id),
  buyer_id uuid REFERENCES auth.users(id),
  sale_amount numeric NOT NULL,
  commission_amount numeric NOT NULL,
  status text DEFAULT 'pending', -- pending, paid
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ============================================================
-- 5. تفعيل واستكمال قواعد RLS الجديدة
-- ============================================================
ALTER TABLE public.app_banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- حماية جدول البنرات (الجميع يرى النشط، والأدمن يدير كل شيء)
DROP POLICY IF EXISTS "Public can view active banners" ON public.app_banners;
CREATE POLICY "Public can view active banners" ON public.app_banners
  FOR SELECT USING (is_active = true OR public.is_admin());

DROP POLICY IF EXISTS "Admins can manage banners" ON public.app_banners;
CREATE POLICY "Admins can manage banners" ON public.app_banners
  FOR ALL USING (public.is_admin());

-- حماية جدول المالية والتداولات (المدير فقط يرى العمليات المالية ويديرها)
DROP POLICY IF EXISTS "Admins manage transactions" ON public.transactions;
CREATE POLICY "Admins manage transactions" ON public.transactions
  FOR ALL USING (public.is_admin());

-- للمستقبل: بإمكان البائع رؤية التداولات الخاصة به التي يتم تحميل عمولتها عليه
DROP POLICY IF EXISTS "Sellers view own transactions" ON public.transactions;
CREATE POLICY "Sellers view own transactions" ON public.transactions
  FOR SELECT USING (auth.uid() = seller_id);


-- ============================================================
-- 6. تعديل سياسات قراءة الطلبات والردود لتراعي الإخفاء (is_hidden)
-- ============================================================
DROP POLICY IF EXISTS "Requests are viewable by everyone" ON public.requests;
CREATE POLICY "Requests are viewable by everyone" ON public.requests
  FOR SELECT USING (is_hidden = false OR public.is_admin() OR auth.uid() = buyer_id);

DROP POLICY IF EXISTS "Responses are viewable by everyone" ON public.responses;
CREATE POLICY "Responses are viewable by everyone" ON public.responses
  FOR SELECT USING (is_hidden = false OR public.is_admin() OR auth.uid() = seller_id);

-- ============================================================
-- ✅ النظام مهيأ للمرحلة 4.0
-- ============================================================
SELECT 'Migration V4.0 applied successfully! ✅' AS status;
