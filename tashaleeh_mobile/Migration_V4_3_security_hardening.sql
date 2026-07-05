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
-- security_invoker=false (السلوك الافتراضي): الـ view يكشف الأعمدة الثلاثة فقط لكل الصفوف
-- (email/phone/location غير موجودة فيه فلا تُكشف). القراءة للمسجّلين فقط (لا anon) واستثناء المحظورين.
CREATE OR REPLACE VIEW public.public_profiles
  WITH (security_invoker = false) AS
  SELECT id, display_name, avatar_url FROM public.profiles
  WHERE COALESCE(is_blocked, false) = false;
REVOKE ALL ON public.public_profiles FROM anon, PUBLIC;
GRANT SELECT ON public.public_profiles TO authenticated;

-- نفس المبدأ لملفات البائعين: إخفاء وثيقة السجل التجاري واسم المدير، وإتاحة حقول العرض
DROP POLICY IF EXISTS "Seller profiles are viewable by everyone" ON public.seller_profiles;
DROP POLICY IF EXISTS "Seller profiles viewable by self or admin" ON public.seller_profiles;
CREATE POLICY "Seller profiles viewable by self or admin" ON public.seller_profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

CREATE OR REPLACE VIEW public.public_seller_profiles
  WITH (security_invoker = false) AS
  SELECT id, handled_brands, is_online, rating, rating_count, store_location
  FROM public.seller_profiles;
REVOKE ALL ON public.public_seller_profiles FROM anon, PUBLIC;
GRANT SELECT ON public.public_seller_profiles TO authenticated;

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

  -- منع التقييمات الوهمية: لا تقييم إلا لمن أتمّ شراءً فعلياً من هذا البائع
  IF NOT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE buyer_id = auth.uid() AND seller_id = p_seller_id
  ) THEN
    RAISE EXCEPTION 'لا يمكنك تقييم بائع لم تُتمّ معه عملية شراء';
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

-- ------------------------------------------------------------
-- 4) منع التسجيل بدور أدمن/بائع: كل حساب جديد يبدأ "مشتري" دائماً
--    (لا نثق بالدور القادم من المستخدم؛ الترقية من الإدارة فقط)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'Buyer')
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$;

-- ------------------------------------------------------------
-- 5) تقوية complete_purchase: اشتقاق البائع/السعر من العرض الفعلي (لا نثق بقيمة العميل)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_purchase(
  p_request_id uuid,
  p_seller_id  uuid,
  p_sale_amount numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_buyer      uuid;
  v_price      numeric;
  v_commission numeric;
  v_txn        uuid;
BEGIN
  SELECT buyer_id INTO v_buyer FROM public.requests WHERE id = p_request_id;
  IF v_buyer IS NULL OR v_buyer <> auth.uid() THEN
    RAISE EXCEPTION 'غير مصرّح: لست صاحب هذا الطلب';
  END IF;

  IF public.is_user_blocked(auth.uid()) THEN
    RAISE EXCEPTION 'حسابك محظور';
  END IF;

  -- تحقّق أن للبائع عرضاً فعلياً على هذا الطلب، واشتق السعر منه
  SELECT price INTO v_price FROM public.responses
   WHERE request_id = p_request_id AND seller_id = p_seller_id
   ORDER BY created_at DESC LIMIT 1;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'لا يوجد عرض من هذا البائع على هذا الطلب';
  END IF;

  SELECT id INTO v_txn FROM public.transactions WHERE request_id = p_request_id LIMIT 1;
  IF v_txn IS NOT NULL THEN
    UPDATE public.requests SET status = 'bought' WHERE id = p_request_id;
    RETURN v_txn;
  END IF;

  SELECT COALESCE(commission_rate, 0) INTO v_commission FROM public.app_settings WHERE id = 1;

  INSERT INTO public.transactions (request_id, seller_id, buyer_id, sale_amount, commission_amount, status)
  VALUES (p_request_id, p_seller_id, auth.uid(), v_price, COALESCE(v_commission, 0), 'pending')
  RETURNING id INTO v_txn;

  UPDATE public.requests SET status = 'bought' WHERE id = p_request_id;
  RETURN v_txn;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_purchase(uuid, uuid, numeric) TO authenticated;

-- ------------------------------------------------------------
-- 6) تثبيت search_path للدوال الأمنية (حماية من التلاعب بمسار البحث)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin');
END; $$;

CREATE OR REPLACE FUNCTION public.is_user_blocked(user_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND is_blocked = true);
END; $$;

CREATE OR REPLACE FUNCTION public.increment_request_views(request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.requests SET views = COALESCE(views, 0) + 1 WHERE id = request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.increment_request_rejections(request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.requests SET rejections = COALESCE(rejections, 0) + 1 WHERE id = request_id;
END; $$;

NOTIFY pgrst, 'reload schema';
SELECT '✅ Migration V4.3: حماية شاملة (صلاحيات + PII + تقييم موثّق + تسجيل آمن + بيع موثّق).' AS status;
