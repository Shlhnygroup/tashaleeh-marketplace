import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, SafeAreaView, KeyboardAvoidingView, Platform, Alert, Dimensions } from 'react-native';
import { supabase } from './supabase';
import { Ionicons } from '@expo/vector-icons';
import { FLAVOR_META, IS_SELLER_APP } from './appConfig';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [userRole, setUserRole] = useState('Buyer'); // Buyer or Seller

  const handleAuth = async () => {
    if (!email || !password) {
      Alert.alert('خطأ', 'الرجاء تعبئة البريد وكلمة المرور');
      return;
    }

    setLoading(true);
    
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) Alert.alert('فشل الدخول', error.message);
      } else {
        // لا نرسل الدور — كل حساب جديد يبدأ "مشتري" من القاعدة، والترقية من الإدارة فقط (حماية من تصعيد الصلاحيات)
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) Alert.alert('خطأ التسجيل', error.message);
        else Alert.alert('نجاح 🎊', 'تم إنشاء حسابك بنجاح! نورتنا.');
      }
    } catch (error) {
      Alert.alert('خطأ في الاتصال', 'تعذر الاتصال بالخادم. تأكد من اتصالك بالإنترنت والمحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const primaryColor = FLAVOR_META.primary; // لون التطبيق حسب النكهة (مشتري برتقالي / تاجر سماوي)

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        {/* Header Icon */}
        <View style={styles.iconContainer}>
          <View style={[styles.iconGlow, { shadowColor: isLogin ? '#FFF' : primaryColor }]}>
            <Ionicons name="car-sport" size={60} color={isLogin ? '#FFF' : primaryColor} />
          </View>
        </View>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>{FLAVOR_META.name}</Text>
          <Text style={styles.headerSubtitle}>{isLogin ? FLAVOR_META.subtitleLogin : FLAVOR_META.subtitleSignup}</Text>
        </View>

        <View style={styles.glassCard}>
          {!isLogin && (
            <View style={styles.roleSelection}>
              <Text style={styles.label}>{IS_SELLER_APP ? 'تسجيل تاجر جديد:' : 'إنشاء حساب مشتري:'}</Text>
              <Text style={{color: '#888', fontSize: 13, textAlign: 'right', marginBottom: 10}}>
                {FLAVOR_META.signupNote}
              </Text>
            </View>
          )}

          <View style={styles.formSection}>
            <View style={[styles.inputWrapper, { borderColor: isLogin ? '#333' : primaryColor }]}>
               <Ionicons name="mail" size={20} color={isLogin ? "#666" : primaryColor} style={styles.inputIcon} />
               <TextInput 
                 style={styles.input}
                 placeholder="البريد الإلكتروني"
                 placeholderTextColor="#555"
                 autoCapitalize="none"
                 keyboardType="email-address"
                 value={email}
                 onChangeText={setEmail}
               />
            </View>

            <View style={[styles.inputWrapper, { borderColor: isLogin ? '#333' : primaryColor }]}>
               <Ionicons name="lock-closed" size={20} color={isLogin ? "#666" : primaryColor} style={styles.inputIcon} />
               <TextInput 
                 style={styles.input}
                 placeholder="كلمة المرور"
                 placeholderTextColor="#555"
                 secureTextEntry
                 value={password}
                 onChangeText={setPassword}
               />
            </View>
          </View>

          <TouchableOpacity 
            style={[styles.submitButton, { backgroundColor: isLogin ? '#FFF' : primaryColor, shadowColor: isLogin ? '#FFF' : primaryColor }]} 
            onPress={handleAuth} 
            disabled={loading}
          >
            <Text style={[styles.submitButtonText, { color: '#000' }]}>
              {loading ? 'جاري التحميل...' : (isLogin ? 'دخول' : 'تأكيد وإنشاء الحساب')}
            </Text>
            {!loading && <Ionicons name="arrow-back" size={20} color="#000" style={{marginRight: 10}}/>}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.switchModeButton} onPress={() => setIsLogin(!isLogin)}>
          <Text style={styles.switchModeText}>
            {isLogin ? 'مستخدم جديد؟ ابدأ من هنا' : 'لديك حساب بالفعل؟ ارجع لتسجيل الدخول'}
          </Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070707' },
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  iconContainer: { alignItems: 'center', marginBottom: 20 },
  iconGlow: { shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 20, elevation: 10 },
  header: { marginBottom: 35, alignItems: 'center' },
  headerTitle: { fontSize: 40, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  headerSubtitle: { fontSize: 15, color: '#888', marginTop: 8 },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  roleSelection: { marginBottom: 25 },
  label: { fontSize: 16, fontWeight: '700', color: '#FFF', marginBottom: 12, textAlign: 'right' },
  roleButtons: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: 10 },
  roleButton: { flex: 1, borderWidth: 1, borderColor: '#333', paddingVertical: 18, borderRadius: 16, alignItems: 'center' },
  roleText: { color: '#888', fontWeight: 'bold' },
  roleTextActive: { color: '#000', fontWeight: 'bold' },
  formSection: { marginBottom: 20 },
  inputWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0A0A0A', borderWidth: 1, borderRadius: 16, marginBottom: 15, paddingHorizontal: 15 },
  inputIcon: { marginLeft: 10 },
  input: { flex: 1, paddingVertical: 18, color: '#FFF', fontSize: 15, textAlign: 'right' },
  submitButton: { flexDirection: 'row-reverse', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 10, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 10, elevation: 5 },
  submitButtonText: { fontSize: 18, fontWeight: 'bold' },
  switchModeButton: { marginTop: 30, alignItems: 'center' },
  switchModeText: { color: '#777', fontSize: 14, textDecorationLine: 'underline' }
});
