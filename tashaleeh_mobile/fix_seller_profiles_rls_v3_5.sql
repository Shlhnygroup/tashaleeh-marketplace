-- ============================================================
-- 🔧 Patch V3.5: Missing RLS Policies for seller_profiles
-- يجب تطبيق هذا الكود في Supabase SQL Editor
-- ============================================================

-- 1. سياسة القراءة: أي شخص مسجل يقدر يشوف بيانات البائعين (للعرض العام)
DROP POLICY IF EXISTS "Seller profiles are viewable by everyone" ON public.seller_profiles;
CREATE POLICY "Seller profiles are viewable by everyone" ON public.seller_profiles
  FOR SELECT USING (true);

-- 2. سياسة الإنشاء: البائع يقدر ينشئ بروفايله بنفسه
DROP POLICY IF EXISTS "Sellers can insert own profile" ON public.seller_profiles;
CREATE POLICY "Sellers can insert own profile" ON public.seller_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 3. سياسة التعديل: البائع يقدر يعدّل بروفايله فقط
DROP POLICY IF EXISTS "Sellers can update own profile" ON public.seller_profiles;
CREATE POLICY "Sellers can update own profile" ON public.seller_profiles
  FOR UPDATE USING (auth.uid() = id);

-- تأكيد نجاح التطبيق
SELECT 'seller_profiles RLS policies applied successfully ✅' AS status;
