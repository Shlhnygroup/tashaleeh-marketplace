// تحميل سلسلة اتصال قاعدة البيانات بأمان من ملف .env (غير مرفوع على git)
// لا يعتمد على أي مكتبة خارجية — يقرأ .env يدوياً ثم يقع على متغيرات البيئة.
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue; // متغير البيئة له الأولوية
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

loadEnv();

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('\n❌ المتغير DATABASE_URL غير معرّف.');
  console.error('أنشئ ملف .env في هذا المجلد (tashaleeh_dashboard) وضع فيه السطر التالي بكلمة السر الجديدة:');
  console.error('DATABASE_URL=postgresql://postgres:YOUR_NEW_PASSWORD@db.gucetfqcitbssrzdtdfw.supabase.co:5432/postgres\n');
  process.exit(1);
}

module.exports = { databaseUrl };
