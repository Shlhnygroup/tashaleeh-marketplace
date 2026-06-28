import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gucetfqcitbssrzdtdfw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Y2V0ZnFjaXRic3NyemR0ZGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTYwOTYsImV4cCI6MjA5MDk5MjA5Nn0.L47qPTWQJqbMG8OXk1oVw7I1UzDvZHYdT-WVF4c-29A';

// إعداد التخزين للجوال (AsyncStorage) لحفظ جلسة الدخول — ضروري في React Native
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
