-- ============================================================
-- 💎 ترقيعات وإصلاحات الصلاحيات (V3.6 Fixes)
-- ============================================================

-- 1. دالة المشرف الآمنة (بصلاحيات Security Definer لتخطي منع RLS)
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
-- 2. إعطاء الصلاحيات لمدراء النظام في جدول (Profiles) و (Seller_Profiles)
-- ============================================================

-- السماح للإدارة بترقية أو حظر أي مستخدم في Profiles
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_admin());

-- السماح للإدارة بإنشاء/تعديل بائع جديد
DROP POLICY IF EXISTS "Admins can manage seller profiles" ON public.seller_profiles;
CREATE POLICY "Admins can manage seller profiles" ON public.seller_profiles
  FOR ALL USING (public.is_admin());

-- ============================================================
-- 3. تفعيل وإعداد الحماية على جداول التقارير وسجلات الإدارة (Security Expose Fix)
-- ============================================================

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;

-- التقارير (Reports): أي مستخدم يرفع، والأدمن يقرأ
DROP POLICY IF EXISTS "Users can insert reports" ON public.reports;
CREATE POLICY "Users can insert reports" ON public.reports 
FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admins can view reports" ON public.reports;
CREATE POLICY "Admins can view reports" ON public.reports 
FOR SELECT USING (public.is_admin());

-- سجلات النشاطات (Action Logs): الأدمن يكتب ويقرأ
DROP POLICY IF EXISTS "Admins can insert action logs" ON public.action_logs;
CREATE POLICY "Admins can insert action logs" ON public.action_logs 
FOR INSERT WITH CHECK (public.is_admin() AND auth.uid() = admin_id);

DROP POLICY IF EXISTS "Admins can view action logs" ON public.action_logs;
CREATE POLICY "Admins can view action logs" ON public.action_logs 
FOR SELECT USING (public.is_admin());

-- ============================================================
-- 4. إعدادات التطبيق وماركات السيارات للأدمن (Missing Policy Fix)
-- ============================================================

-- السماح للإدارة بتعديل الإعدادات (رقم الواتساب والسياسة)
DROP POLICY IF EXISTS "Admins can update settings" ON public.app_settings;
CREATE POLICY "Admins can update settings" ON public.app_settings 
FOR ALL USING (public.is_admin());

-- السماح للإدارة بحذف وإضافة ماركات جديدة
DROP POLICY IF EXISTS "Admins can manage car brands" ON public.car_brands;
CREATE POLICY "Admins can manage car brands" ON public.car_brands 
FOR ALL USING (public.is_admin());

-- رسالة للتأكيد
SELECT 'Fixes V3.6 applied successfully! ✅' AS status;
