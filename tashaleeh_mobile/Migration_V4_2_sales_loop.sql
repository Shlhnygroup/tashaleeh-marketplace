-- ============================================================
-- Migration V4.2 — حلقة البيع المالية + التقييم الصحيح
-- ============================================================
-- يضيف:
--   • complete_purchase: تسجّل عملية بيع (transaction) وتغلق الطلب — تُستدعى عند تأكيد الشراء
--   • rate_seller: تقييم تراكمي صحيح للبائع (بدل المتوسط الخاطئ)
--   • عمود rating_count في seller_profiles
-- ملاحظة: قيمة العمولة في الإعدادات هي مبلغ ثابت بالريال (app_settings.commission_rate).
-- شغّله في Supabase → SQL Editor بعد Migration_V4_1.
-- ============================================================

ALTER TABLE public.seller_profiles ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

-- ------------------------------------------------------------
-- تسجيل عملية بيع وإغلاق الطلب (تُستدعى من تطبيق المشتري عند تأكيد الشراء)
-- SECURITY DEFINER: تتجاوز RLS بأمان لأنها تتحقق أن المُنادي هو صاحب الطلب.
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
  v_commission numeric;
  v_txn        uuid;
BEGIN
  -- تحقّق أن المُنادي هو صاحب الطلب
  SELECT buyer_id INTO v_buyer FROM public.requests WHERE id = p_request_id;
  IF v_buyer IS NULL OR v_buyer <> auth.uid() THEN
    RAISE EXCEPTION 'غير مصرّح: لست صاحب هذا الطلب';
  END IF;

  -- منع التكرار: إن وُجدت عملية لنفس الطلب أعِدها بدل إنشاء جديدة
  SELECT id INTO v_txn FROM public.transactions WHERE request_id = p_request_id LIMIT 1;
  IF v_txn IS NOT NULL THEN
    UPDATE public.requests SET status = 'bought' WHERE id = p_request_id;
    RETURN v_txn;
  END IF;

  -- قيمة العمولة الثابتة من الإعدادات (بالريال)
  SELECT COALESCE(commission_rate, 0) INTO v_commission FROM public.app_settings WHERE id = 1;

  INSERT INTO public.transactions (request_id, seller_id, buyer_id, sale_amount, commission_amount, status)
  VALUES (p_request_id, p_seller_id, auth.uid(), p_sale_amount, COALESCE(v_commission, 0), 'pending')
  RETURNING id INTO v_txn;

  UPDATE public.requests SET status = 'bought' WHERE id = p_request_id;
  RETURN v_txn;
END;
$$;

-- ------------------------------------------------------------
-- تقييم تراكمي صحيح للبائع
-- ------------------------------------------------------------
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
    RETURN; -- لا يوجد بائع بهذا المعرّف
  END IF;

  UPDATE public.seller_profiles
  SET rating       = ROUND(((v_rating * v_count) + p_rating) / (v_count + 1), 2),
      rating_count = v_count + 1
  WHERE id = p_seller_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_purchase(uuid, uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rate_seller(uuid, numeric) TO authenticated;

-- ------------------------------------------------------------
-- إصلاح علاقة action_logs.admin_id → profiles
-- (حتى يعرض سجل العمليات في لوحة الأدمن اسم الموظف بدل أن يفشل)
-- ------------------------------------------------------------
DO $$
DECLARE c record;
BEGIN
  FOR c IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel       ON rel.oid = con.conrelid
    JOIN pg_namespace ns    ON ns.oid = rel.relnamespace
    JOIN unnest(con.conkey) AS k(attnum) ON true
    JOIN pg_attribute att   ON att.attrelid = rel.oid AND att.attnum = k.attnum
    WHERE con.contype = 'f' AND ns.nspname = 'public'
      AND rel.relname = 'action_logs' AND att.attname = 'admin_id'
  LOOP
    EXECUTE format('ALTER TABLE public.action_logs DROP CONSTRAINT %I', c.conname);
  END LOOP;
END $$;

ALTER TABLE public.action_logs
  ADD CONSTRAINT action_logs_admin_id_fkey
  FOREIGN KEY (admin_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
SELECT '✅ Migration V4.2: حلقة البيع المالية + التقييم الصحيح + علاقة سجل العمليات جاهزة.' AS status;
