import { createClient } from '@supabase/supabase-js';

// استخرجت الرابط تلقائياً من المفتاح الخاص بك
const supabaseUrl = 'https://gucetfqcitbssrzdtdfw.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd1Y2V0ZnFjaXRic3NyemR0ZGZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MTYwOTYsImV4cCI6MjA5MDk5MjA5Nn0.L47qPTWQJqbMG8OXk1oVw7I1UzDvZHYdT-WVF4c-29A';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
