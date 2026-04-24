const { Client } = require('pg');

const databaseUrl = 'postgresql://postgres:Yss123123@db.gucetfqcitbssrzdtdfw.supabase.co:5432/postgres';

const client = new Client({
  connectionString: databaseUrl,
});

const sql = `
  -- إنشاء جدول الطلبات
  CREATE TABLE IF NOT EXISTS requests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    buyer_id uuid REFERENCES auth.users(id),
    car_brand text NOT NULL,
    model_year text NOT NULL,
    part_details text NOT NULL,
    image_url text,
    status text DEFAULT 'open',
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- إنشاء جدول الردود والعروض
  CREATE TABLE IF NOT EXISTS responses (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
    seller_id uuid REFERENCES auth.users(id),
    price numeric,
    notes text,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- إنشاء جدول المحادثات
  CREATE TABLE IF NOT EXISTS messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    request_id uuid REFERENCES requests(id) ON DELETE CASCADE,
    sender_id uuid REFERENCES auth.users(id),
    receiver_id uuid REFERENCES auth.users(id),
    content text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
  );

  -- لا ننسى إيقاف RLS مؤقتاً لسهولة التطوير الآن
  ALTER TABLE requests DISABLE ROW LEVEL SECURITY;
  ALTER TABLE responses DISABLE ROW LEVEL SECURITY;
  ALTER TABLE messages DISABLE ROW LEVEL SECURITY;
`;

async function setupTables() {
  try {
    console.log("جارِ الاتصال بقاعدة البيانات...");
    await client.connect();
    console.log("تم الاتصال بنجاح. يتم الآن إنشاء الجداول...");
    
    await client.query(sql);
    console.log("🎉 تمت العملية بنجاح! تم إنشاء جميع الجداول وإيقاف RLS مؤقتاً.");
  } catch (err) {
    console.error("❌ حدث خطأ أثناء إعداد قاعدة البيانات:", err.message);
  } finally {
    await client.end();
  }
}

setupTables();
