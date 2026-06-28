// مشغّل خادم Expo لتجربة التطبيق على الجوال عبر تطبيق "Expo Go" (شبكة محلية LAN).
// الاستخدام:  node phone-dev.cjs
// النكهة الافتراضية: buyer (المشتري). للتاجر:  EXPO_PUBLIC_APP_FLAVOR=seller node phone-dev.cjs
const path = require('path');
const fs = require('fs');

process.chdir(__dirname);
const nodeDir = path.dirname(process.execPath);
if (!(process.env.PATH || '').split(path.delimiter).includes(nodeDir)) {
  process.env.PATH = nodeDir + path.delimiter + (process.env.PATH || '');
}

// إصلاح ذاتي لتعارض Node 24 مع Expo SDK 50 (node:sea على ويندوز)
try {
  const ext = path.join(__dirname, 'node_modules/@expo/cli/build/src/start/server/metro/externals.js');
  if (fs.existsSync(ext)) {
    let src = fs.readFileSync(ext, 'utf8');
    if (!src.includes('!x.includes(":")')) {
      src = src.replace('!/^_|^(internal|v8|node-inspect)\\/|\\//.test(x) &&', '!/^_|^(internal|v8|node-inspect)\\/|\\//.test(x) && !x.includes(":") &&');
      fs.writeFileSync(ext, src);
    }
  }
} catch (e) {}

// لا نستخدم offline حتى تتحمّل الأصول (الخطوط/الأيقونات)؛ ونتجاوز مشكلة شهادات TLS في هذه الشبكة
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
process.env.EXPO_PUBLIC_APP_FLAVOR = process.env.EXPO_PUBLIC_APP_FLAVOR || 'buyer';
const cli = require.resolve('expo/bin/cli');
process.argv = [process.argv[0], cli, 'start'];
require(cli);
