-- ============================================================
-- Migration V4.3 — تأمين أمني وحماية بيانات العملاء
-- ============================================================
-- يعالج ثغرات حرجة:
--   1) تصعيد الصلاحيات: كان أي مستخدم يقدر يغيّر role لنفسه (يرقّي نفسه أدمن)
--      أو is_blocked (يفك حظره) عبر تحديث ملفه الشخصي. الآن ممنوع لغير الأدمن.
--   2) تسريب بيانات العملاء (PII): كان email/phone/location لكل العملاء مقروءاً
--      للجميع. الآن يُقرأ الجدول الأساسي للمالك والأدمن فقط، ويُعرض الاسم/الصورة
--      للعرض عبر view عام محدود.
--   3) البائع كان يقدر يعدّل تقييمه (rating) يدوياً. الآن التقييم فقط عبر rate_seller.
-- شغّله في Supabase → SQL Editor بعد V4.2.
-- ============================================================

-- ------------------------------------------------------------
-- 1) منع تصعيد الصلاحيات على profiles (role / is_blocked)
--    RLS لا يقارن القيمة القديمة، فنستخدم trigger.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_sensitive_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.role := OLD.role;             -- لا يغيّر رتبته
    NEW.is_blocked := OLD.is_blocked; -- لا يفك حظره
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_sensitive_columns();

-- ------------------------------------------------------------
-- 2) حماية PII: قصر قراءة profiles على المالك والأدمن + view عام للعرض فقط
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles viewable by self or admin" ON public.profiles;
CREATE POLICY "Profiles viewable by self or admin" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- view عام يكشف فقط حقول العرض (الاسم والصورة) — بدون email/phone/location/bio
CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, display_name, avatar_url FROM public.profiles;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- نفس المبدأ لملفات البائعين: إخفاء وثيقة السجل التجاري واسم المدير، وإتاحة حقول العرض
DROP POLICY IF EXISTS "Seller profiles are viewable by everyone" ON public.seller_profiles;
DROP POLICY IF EXISTS "Seller profiles viewable by self or admin" ON public.seller_profiles;
CREATE POLICY "Seller profiles viewable by self or admin" ON public.seller_profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE OR REPLACE VIEW public.public_seller_profiles AS
  SELECT id, handled_brands, is_online, rating, rating_count, store_location
  FROM public.seller_profiles;
GRANT SELECT ON public.public_seller_profiles TO anon, authenticated;

-- ------------------------------------------------------------
-- 3) منع البائع من تعديل تقييمه يدوياً (rating / rating_count)
--    يُسمح بالتعديل فقط للأدمن أو من داخل دالة rate_seller (عبر علم داخلي).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_seller_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_admin() OR COALESCE(current_setting('app.rating_ctx', true), '') = 'on' THEN
    RETURN NEW; -- مسموح
  END IF;
  NEW.rating := OLD.rating;
  NEW.rating_count := OLD.rating_count;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_seller_rating ON public.seller_profiles;
CREATE TRIGGER trg_protect_seller_rating
  BEFORE UPDATE ON public.seller_profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_seller_rating();

-- إعادة تعريف rate_seller لتضبط العلم الداخلي قبل التحديث (حتى يسمح لها الـ trigger)
CREATE OR REPLACE FUNCTION public.rate_seller(p_seller_id uuid, p_rating numeric)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rating numeric;
  v_count  integer;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'التقييم يجب أن يكون بين 1 و 5';
  END IF;

  SELECT COALESCE(rating, 5.0), COALESCE(rating_count, 0)
    INTO v_rating, v_count
    FROM public.seller_profiles WHERE id = p_seller_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  PERFORM set_config('app.rating_ctx', 'on', true); -- علم محلي للمعاملة يسمح بتحديث التقييم
  UPDATE public.seller_profiles
  SET rating       = ROUND(((v_rating * v_count) + p_rating) / (v_count + 1), 2),
      rating_count = v_count + 1
  WHERE id = p_seller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rate_seller(uuid, numeric) TO authenticated;

NOTIFY pgrst, 'reload schema';
SELECT '✅ Migration V4.3: حماية الصلاحيات + بيانات العملاء (PII) + التقييم جاهزة.' AS status;
