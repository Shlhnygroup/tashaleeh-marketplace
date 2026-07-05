-- ============================================================
-- Migration V4.4 — بيانات دفع العمولة (آيبان + بنك + اسم الحساب)
-- ============================================================
-- يضيف حقول بيانات التحويل إلى app_settings (يعدّلها الأدمن من الإعدادات)،
-- ويضبط قيمة العمولة الافتراضية = 20 ريال.
-- شغّله في Supabase → SQL Editor.
-- ============================================================

ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS commission_iban text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS bank_name       text;
ALTER TABLE public.app_settings ADD COLUMN IF NOT EXISTS account_name    text;

-- تأكد من وجود صف الإعدادات وتعيين القيم الافتراضية (بدون دهس القيم الموجودة)
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

UPDATE public.app_settings
SET commission_rate = COALESCE(NULLIF(commission_rate, 0), 20),
    commission_iban = COALESCE(commission_iban, 'SA0000000000000000000000'),
    bank_name       = COALESCE(bank_name, 'اسم البنك'),
    account_name    = COALESCE(account_name, 'اسم صاحب الحساب')
WHERE id = 1;

NOTIFY pgrst, 'reload schema';
SELECT '✅ Migration V4.4: بيانات دفع العمولة جاهزة (عدّل الآيبان من إعدادات لوحة التحكم).' AS status;
