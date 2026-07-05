-- ============================================================
-- سياسات أمن التخزين (Storage) لبكت parts_images
-- ============================================================
-- المشكلة: حالياً أي مستخدم مصادق قد يكتب فوق ملفات غيره (لا توجد سياسة كتابة
--          تقيّد المسار). هذه السياسات تقصر الكتابة/التعديل/الحذف على ملفات
--          المستخدم نفسه فقط (المسارات تبدأ بمعرّفه)، والبنرات للأدمن فقط.
--
-- ⚠️ طبّقه بحذر واختبر الرفع بعده (من المشتري/البائع/الدردشة/البروفايل).
--    إن وُجدت سياسة قديمة فضفاضة (مثل "allow all authenticated") احذفها من
--    Supabase → Storage → parts_images → Policies حتى لا تتعارض.
-- شغّله في Supabase → SQL Editor.
-- ============================================================

-- تأكد أن RLS مفعّل على كائنات التخزين (مفعّل افتراضياً في Supabase)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- قراءة عامة للصور (لعرض صور القطع والبنرات والأفتارات داخل التطبيق)
DROP POLICY IF EXISTS "tashaleeh public read" ON storage.objects;
CREATE POLICY "tashaleeh public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'parts_images');

-- الرفع: فقط إلى مسارات يملكها المستخدم (تبدأ بمعرّفه)، والبنرات للأدمن
DROP POLICY IF EXISTS "tashaleeh own insert" ON storage.objects;
CREATE POLICY "tashaleeh own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'parts_images' AND (
      name LIKE ('uploads/'    || auth.uid()::text || '/%') OR
      name LIKE ('chat_files/' || auth.uid()::text || '_%') OR
      (public.is_admin() AND name LIKE 'banners/%')
    )
  );

-- التعديل/الحذف: فقط على ملفات المستخدم نفسه (أو الأدمن)
DROP POLICY IF EXISTS "tashaleeh own update" ON storage.objects;
CREATE POLICY "tashaleeh own update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'parts_images' AND (owner = auth.uid() OR public.is_admin()));

DROP POLICY IF EXISTS "tashaleeh own delete" ON storage.objects;
CREATE POLICY "tashaleeh own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'parts_images' AND (owner = auth.uid() OR public.is_admin()));

-- ============================================================
-- بكت خاص لملفات الدردشة (غير عام) — تُقرأ عبر روابط موقّتة (createSignedUrl) فقط
-- (التطبيق يرفع ملفات الدردشة هنا ويولّد رابطاً موقّتاً عند فتح الملف)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "chat-files own insert" ON storage.objects;
CREATE POLICY "chat-files own insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-files' AND name LIKE (auth.uid()::text || '/%'));

DROP POLICY IF EXISTS "chat-files auth read" ON storage.objects;
CREATE POLICY "chat-files auth read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-files');

DROP POLICY IF EXISTS "chat-files own delete" ON storage.objects;
CREATE POLICY "chat-files own delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-files' AND (owner = auth.uid() OR public.is_admin()));

SELECT '✅ سياسات التخزين طُبّقت (parts_images + chat-files الخاص) — اختبر الرفع.' AS status;

-- ملاحظة للأمان الكامل (مرحلة لاحقة): الوثائق الحسّاسة (السجل التجاري) وملفات
-- الدردشة يُفضّل وضعها في بكت "خاص" (غير عام) واستخدام createSignedUrl لروابط
-- موقّتة، بدل getPublicUrl. هذا يتطلب تعديلات كود إضافية ننفّذها عند الحاجة.
