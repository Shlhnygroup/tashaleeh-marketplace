// centralized Shared Constants and Helpers for Tashaleeh V3.3

export const COLORS = {
  primary_buyer: '#FF8C00',
  primary_seller: '#00D8FF',
  background: '#070707',
  card_bg: '#0A0A0A',
  text_primary: '#FFFFFF',
  text_secondary: '#888888',
  danger: '#FF3B30',
  success: '#25D366'
};

export const SAUDI_CITIES = [
  "الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", 
  "الطائف", "بريدة", "تبوك", "أبها", "خميس مشيط", "الخبر",
  "حائل", "حفر الباطن", "الجبيل", "الخرج", "ينبع", "الظهران",
  "الهفوف", "القطيف", "نجران", "سكاكا", "عرعر", 
  "جازان", "الباحة", "عنيزة", "الرس", "الدوادمي"
].sort();

export const formatArDate = (timestamp) => {
  return new Date(timestamp).toLocaleDateString('ar-SA');
};

export const formatArTime = (timestamp) => {
  return new Date(timestamp).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
};
