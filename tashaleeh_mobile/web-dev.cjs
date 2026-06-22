// ============================================================
// مشغّل نسخة الويب من تطبيق الجوال (Expo Web) لأغراض المعاينة/الفحص السريع.
// الاستخدام:  node web-dev.cjs      (المنفذ الافتراضي 8082، أو حدّده عبر PORT)
//
// يعالج هذا المشغّل ثلاث نقاط خاصة بهذه البيئة (ويندوز + Node 24 + Expo SDK 50):
//   1) يضبط مجلد المشروع تلقائياً (process.chdir).
//   2) يضيف مجلد node إلى PATH حتى تجده عمليات Metro الفرعية.
//   3) يشغّل Expo في وضع offline لتجنّب فشل شهادات TLS عند الاتصال بـ api.expo.dev.
//   4) يصلّح تلقائياً تعارض Node 24 مع Expo SDK 50 (الوحدة node:sea — الرمز ":" ممنوع في أسماء ملفات ويندوز).
// ============================================================
const path = require('path');
const fs = require('fs');

process.chdir(__dirname);

// (2) مجلد node ضمن PATH
const nodeDir = path.dirname(process.execPath);
if (!(process.env.PATH || '').split(path.delimiter).includes(nodeDir)) {
  process.env.PATH = nodeDir + path.delimiter + (process.env.PATH || '');
}

// (4) إصلاح ذاتي لتعارض node:sea مع Expo SDK 50 على ويندوز (يبقى فعّالاً حتى بعد إعادة npm install)
try {
  const ext = path.join(__dirname, 'node_modules/@expo/cli/build/src/start/server/metro/externals.js');
  if (fs.existsSync(ext)) {
    let src = fs.readFileSync(ext, 'utf8');
    if (!src.includes('!x.includes(":")')) {
      src = src.replace('!/^_|^(internal|v8|node-inspect)\\/|\\//.test(x) &&', '!/^_|^(internal|v8|node-inspect)\\/|\\//.test(x) && !x.includes(":") &&');
      fs.writeFileSync(ext, src);
    }
  }
} catch (e) { /* تجاهل: لو فشل الإصلاح يظهر الخطأ الأصلي عند التشغيل */ }

// (1)+(3) تشغيل Expo Web
process.env.CI = process.env.CI || '1';
process.env.EXPO_OFFLINE = '1';
const port = process.env.PORT || '8082';
const cli = require.resolve('expo/bin/cli');
process.argv = [process.argv[0], cli, 'start', '--web', '--offline', '--port', port];
require(cli);
