-- ============================================================
-- Migration V4.1 — إصلاح علاقات الجداول (Foreign Keys) لتمكين استعلامات الـ embed
-- ============================================================
-- المشكلة: أعمدة buyer_id / seller_id / reporter_id / reported_id كانت تشير إلى
--          auth.users، فلا يستطيع PostgREST عمل embed لجدول profiles منها، مما يجعل:
--            • تبويب "المالية" (FinancialsTab)  لا يعرض أسماء البائعين
--            • تبويب "المحتوى" (ContentTab)     لا يعرض أسماء المشترين
--            • تبويب "البلاغات" (ReportsTab)     لا يعرض إيميلات الأطراف
-- الحل: إعادة توجيه هذه الأعمدة لتشير إلى public.profiles(id)
--       (وهو نفسه id في auth.users لأن profiles.id يشير إلى auth.users(id)).
--
-- آمن وقابل لإعادة التشغيل عدة مرات. شغّله في:  Supabase Dashboard → SQL Editor
-- شغّله بعد Master_SQL_V4_0.sql.
-- ============================================================

-- 1) تعبئة أي مستخدم ليس له صف في profiles (حتى لا تفشل قيود المفاتيح الأجنبية)
INSERT INTO public.profiles (id, email, role)
SELECT u.id, u.email, COALESCE(u.raw_user_meta_data->>'role', 'Buyer')
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 2) إسقاط أي مفاتيح أجنبية حالية على هذه الأعمدة (مهما كان اسمها) ثم إعادة توجيهها لـ profiles
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT con.conname, rel.relname AS tbl
    FROM pg_constraint con
    JOIN pg_class rel       ON rel.oid = con.conrelid
    JOIN pg_namespace ns    ON ns.oid = rel.relnamespace
    JOIN unnest(con.conkey) AS k(attnum) ON true
    JOIN pg_attribute att   ON att.attrelid = rel.oid AND att.attnum = k.attnum
    WHERE con.contype = 'f'
      AND ns.nspname = 'public'
      AND (rel.relname, att.attname) IN (
        ('requests','buyer_id'),
        ('transactions','seller_id'),
        ('transactions','buyer_id'),
        ('reports','reporter_id'),
        ('reports','reported_id')
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

-- 3) إضافة المفاتيح الأجنبية الجديدة التي تشير إلى profiles
ALTER TABLE public.requests
  ADD CONSTRAINT requests_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_seller_id_fkey
  FOREIGN KEY (seller_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_buyer_id_fkey
  FOREIGN KEY (buyer_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reporter_id_fkey
  FOREIGN KEY (reporter_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.reports
  ADD CONSTRAINT reports_reported_id_fkey
  FOREIGN KEY (reported_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 4) شبكة أمان: التأكد أن RLS مُفعّل على كل الجداول (في حال شغّل أحد السكربتات القديمة التي تعطّله)
ALTER TABLE public.requests        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.responses       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.car_brands      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_banners     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions    ENABLE ROW LEVEL SECURITY;

-- 5) إعادة تحميل ذاكرة PostgREST للمخطط حتى تظهر العلاقات الجديدة فوراً
NOTIFY pgrst, 'reload schema';

SELECT '✅ Migration V4.1 طُبّقت: العلاقات أُعيد توجيهها إلى profiles و RLS مُفعّل.' AS status;
