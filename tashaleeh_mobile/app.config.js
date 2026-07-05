// ============================================================
// إعداد التطبيق الديناميكي حسب النكهة (مشتري / تاجر).
// يقرأ EXPO_PUBLIC_APP_FLAVOR ويعطي كل تطبيق اسماً ومعرّفاً مستقلاً في المتجر.
// (يُستخدم عند البناء للنشر عبر EAS، وأثناء التطوير.)
// ============================================================
const FLAVOR = (process.env.EXPO_PUBLIC_APP_FLAVOR || 'buyer').toLowerCase() === 'seller'
  ? 'seller'
  : 'buyer';

const FLAVORS = {
  buyer: {
    name: 'سبيد تشاليح',
    slug: 'tashaleeh-buyer',
    scheme: 'tashaleehbuyer',
    bundleId: 'com.shlhnygroup.tashaleeh.buyer',
    accent: '#FF8C00',
  },
  seller: {
    name: 'سبيد تشاليح للتجار',
    slug: 'tashaleeh-seller',
    scheme: 'tashaleehseller',
    bundleId: 'com.shlhnygroup.tashaleeh.seller',
    accent: '#00D8FF',
  },
};

const f = FLAVORS[FLAVOR];

module.exports = {
  expo: {
    name: f.name,
    slug: f.slug,
    scheme: f.scheme,
    version: '1.0.0',
    orientation: 'portrait',
    userInterfaceStyle: 'dark',
    platforms: ['ios', 'android', 'web'],
    plugins: [
      ['expo-image-picker', {
        photosPermission: 'يستخدم التطبيق صورك لإرفاق صور القطع والملف الشخصي.',
        cameraPermission: 'يستخدم التطبيق الكاميرا لالتقاط صور القطع.'
      }],
    ],
    // ملاحظة: قبل النشر، أضِف الأيقونة وشاشة البداية في مجلد ./assets ثم فعّل السطور التالية:
    // icon: './assets/icon.png',
    // splash: { image: './assets/splash.png', resizeMode: 'contain', backgroundColor: '#070707' },
    ios: {
      bundleIdentifier: f.bundleId,
      supportsTablet: true,
    },
    android: {
      package: f.bundleId,
      // adaptiveIcon: { foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#070707' },
    },
    extra: {
      flavor: FLAVOR,
      accent: f.accent,
    },
  },
};
