// مشغّل نسخة الويب من تطبيق "التاجر" (نكهة seller).
// يعيد استخدام web-dev.cjs نفسه مع ضبط النكهة والمنفذ.
// الاستخدام:  node web-dev-seller.cjs   (المنفذ الافتراضي 8083)
process.env.EXPO_PUBLIC_APP_FLAVOR = 'seller';
process.env.PORT = process.env.PORT || '8083';
require('./web-dev.cjs');
