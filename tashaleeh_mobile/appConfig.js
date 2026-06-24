// ============================================================
// إعداد "النكهة" (Flavor) — كود واحد ينتج تطبيقين من نفس المصدر:
//   • تطبيق المشتري  (buyer)
//   • تطبيق التاجر/البائع (seller)
// يُحدَّد عبر متغيّر البيئة EXPO_PUBLIC_APP_FLAVOR = 'buyer' | 'seller'
// الافتراضي: buyer. (كلاهما يستخدمان نفس قاعدة البيانات ونفس الحساب.)
// ============================================================

const RAW = (process.env.EXPO_PUBLIC_APP_FLAVOR || 'buyer').toLowerCase();
const FLAVOR = RAW === 'seller' ? 'seller' : 'buyer';

export const APP_FLAVOR = FLAVOR;
export const IS_SELLER_APP = FLAVOR === 'seller';
export const IS_BUYER_APP = FLAVOR === 'buyer';

const META = {
  buyer: {
    name: 'سبيد تشاليح',
    subtitleLogin: 'أهلاً بعودتك، سجّل دخولك لتطلب قطعتك',
    subtitleSignup: 'مرحباً! أنشئ حسابك وابدأ بطلب قطع الغيار',
    signupNote: 'سجّل الآن واطلب القطعة التي تبحث عنها، وستصلك عروض التجار مباشرة.',
    primary: '#FF8C00',
  },
  seller: {
    name: 'سبيد تشاليح للتجار',
    subtitleLogin: 'أهلاً بعودتك، سجّل دخول متجرك',
    subtitleSignup: 'سجّل متجرك واستقبل طلبات المشترين',
    signupNote: 'بعد إنشاء حسابك سيراجعه فريق الإدارة لتفعيله كتاجر. يمكنك تسريع ذلك بالتواصل عبر الواتساب.',
    primary: '#00D8FF',
  },
};

export const FLAVOR_META = META[FLAVOR];
