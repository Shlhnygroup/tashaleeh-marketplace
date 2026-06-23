import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert, Image, Dimensions, Platform, Modal, Keyboard } from 'react-native';
import { supabase } from './supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { SAUDI_CITIES, COLORS } from './utils';

const { width } = Dimensions.get('window');

export default function ProfileScreen({ navigate, currentUser }) {
  const [profile, setProfile] = useState({
    display_name: '',
    bio: '',
    location: '',
    avatar_url: '',
    phone: ''
  });
  const [originalProfile, setOriginalProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single();
      
      if (data) {
        const pData = {
          display_name: data.display_name || '',
          bio: data.bio || '',
          location: data.location || '',
          avatar_url: data.avatar_url || '',
          phone: data.phone || ''
        };
        setProfile(pData);
        setOriginalProfile({ ...pData });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true, // ✅ لازم للرفع المضمون
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadAvatar(result.assets[0].uri, result.assets[0].base64);
    }
  };

  const uploadAvatar = async (uri, base64Data) => {
    setProfile(prev => ({ ...prev, avatar_url: uri })); // ✅ Preview فوري
    setImageUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fileName = `uploads/${user.id}/pro_${Date.now()}.jpg`;
      
      // ✅ استخدام base64 مباشرة — حل نهائي لمشكلة اختفاء الصورة
      const { data, error } = await supabase.storage
        .from('parts_images')
        .upload(fileName, decode(base64Data), {
          contentType: 'image/jpeg',
          upsert: true
        });

      if (error) {
        console.log("Avatar upload error details:", error);
        Alert.alert('فشل الرفع للمخزن', error.message);
        // ✅ فقط نعيد avatar_url للقديمة — لا نمس باقي الحقول
        setProfile(prev => ({ ...prev, avatar_url: originalProfile?.avatar_url || '' }));
      } else {
        const { data: { publicUrl } } = supabase.storage
          .from('parts_images')
          .getPublicUrl(fileName);

        // ✅ cache-buster لضمان ظهور الصورة الجديدة فوراً
        const freshUrl = `${publicUrl}?t=${Date.now()}`;
        setProfile(prev => ({ ...prev, avatar_url: freshUrl }));
      }
    } catch (error) {
      console.log("Avatar processing error:", error);
      Alert.alert('خطأ في معالجة الصورة', error.message);
      setProfile(prev => ({ ...prev, avatar_url: originalProfile?.avatar_url || '' }));
    } finally {
      setImageUploading(false);
    }
  };

  const handleSave = async () => {
    // ✅ FIX: إزالة focus من TextInput قبل الحفظ (يصلح بق الضغط الأول في الويب)
    Keyboard.dismiss();

    if (profile.display_name.length < 3) {
      Alert.alert('تنبيه', 'الاسم المستعار يجب أن يكون 3 حروف على الأقل');
      return;
    }
    
    if (!profile.phone || profile.phone.length < 10) {
      Alert.alert('مطلوب', 'يرجى إدخال رقم جوال صحيح (10 أرقام على الأقل) للمتابعة');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          display_name: profile.display_name,
          bio: profile.bio,
          location: profile.location,
          avatar_url: profile.avatar_url,
          phone: profile.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', currentUser.id);

      if (error) throw error;

      setOriginalProfile({ ...profile });
      setSuccessVisible(true);
      setTimeout(() => {
        setSuccessVisible(false);
        navigate('Home');
      }, 2000);
    } catch (error) {
      setProfile({ ...originalProfile }); 
      Alert.alert('فشل التحديث', 'حدث خطأ. تم استعادة البيانات الأصلية.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalProfile) setProfile({ ...originalProfile });
    navigate('Home');
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00D8FF" />
      </View>
    );
  }

  const getInitials = () => {
    if (!profile.display_name) return "U";
    return profile.display_name.charAt(0).toUpperCase();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButton}>
          <Ionicons name="close-outline" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>الملف الشخصي</Text>
        <View style={{width: 40}} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} style={styles.avatarWrapper}>
            {profile.avatar_url ? (
              <Image source={{ uri: profile.avatar_url }} style={styles.avatar} />
            ) : (
              <View style={styles.initialsContainer}>
                <Text style={styles.initialsText}>{getInitials()}</Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <Ionicons name="camera" size={20} color="#000" />
            </View>
            {imageUploading && (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#00D8FF" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.avatarHint}>اضغط لتغيير الصورة الشخصية</Text>
        </View>

        {/* Form Section */}
        <View style={styles.glassCard}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>الاسم المستعار (Alias)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={profile.display_name}
                onChangeText={(t) => setProfile({...profile, display_name: t})}
                placeholder="كيف تود أن نناديك؟"
                placeholderTextColor="#444"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>النبذة التعريفية (Bio)</Text>
            <View style={[styles.inputWrapper, { height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
              <Ionicons name="create-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput 
                style={[styles.input, { height: '100%' }]}
                value={profile.bio}
                onChangeText={(t) => setProfile({...profile, bio: t})}
                placeholder="أخبر المستخدمين قليلاً عنك..."
                placeholderTextColor="#444"
                multiline
                numberOfLines={4}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>رقم الجوال (إلزامي للطلبات)</Text>
            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={20} color="#00D8FF" style={styles.inputIcon} />
              <TextInput 
                style={styles.input}
                value={profile.phone}
                onChangeText={(t) => setProfile({...profile, phone: t})}
                placeholder="05xxxxxxxx"
                placeholderTextColor="#444"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>المنطقة (Location)</Text>
            <View style={styles.regionGrid}>
              {SAUDI_CITIES.map((city) => (
                <TouchableOpacity 
                  key={city}
                  style={[styles.regionChip, profile.location === city && styles.regionChipActive]}
                  onPress={() => setProfile({...profile, location: city})}
                >
                  <Text style={[styles.regionText, profile.location === city && styles.regionTextActive]}>{city}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionSection}>
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>إلغاء</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.saveBtn, saving && {opacity: 0.7}]} 
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.saveBtnText}>حفظ التغييرات</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Success Modal */}
        <Modal visible={successVisible} transparent={true} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.successBox}>
              <View style={styles.checkCircle}>
                <Ionicons name="checkmark" size={50} color="#000" />
              </View>
              <Text style={styles.successTitle}>تم حفظ التغييرات</Text>
              <Text style={styles.successSub}>تم تحديث ملفك الشخصي بنجاح</Text>
            </View>
          </View>
        </Modal>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070707' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#070707' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A'
  },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  backButton: { padding: 5 },
  container: { padding: 20, paddingBottom: 50 },
  avatarSection: { alignItems: 'center', marginBottom: 30 },
  avatarWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#111',
    borderWidth: 2,
    borderColor: '#00D8FF',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#00D8FF',
    shadowOpacity: 0.4,
    shadowRadius: 15,
    elevation: 8,
  },
  avatar: { width: '100%', height: '100%' },
  initialsContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  initialsText: { color: '#00D8FF', fontSize: 50, fontWeight: 'bold' },
  cameraOverlay: {
    position: 'absolute',
    bottom: 5,
    right: 5,
    backgroundColor: '#00D8FF',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHint: { color: '#666', fontSize: 13, marginTop: 12 },
  glassCard: {
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  inputGroup: { marginBottom: 25 },
  label: { color: '#888', fontSize: 14, marginBottom: 10, textAlign: 'right' },
  inputWrapper: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: '#0A0A0A',
    borderWidth: 1,
    borderColor: '#222',
    borderRadius: 16,
    paddingHorizontal: 15,
  },
  inputIcon: { marginLeft: 10 },
  input: { flex: 1, paddingVertical: 15, color: '#FFF', fontSize: 15, textAlign: 'right' },
  regionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  regionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#222',
    backgroundColor: '#0A0A0A'
  },
  regionChipActive: { borderColor: '#00D8FF', backgroundColor: 'rgba(0, 216, 255, 0.1)' },
  regionText: { color: '#666', fontSize: 13 },
  regionTextActive: { color: '#00D8FF', fontWeight: 'bold' },
  actionSection: { flexDirection: 'row', gap: 15, marginTop: 30 },
  saveBtn: {
    flex: 2,
    backgroundColor: '#00D8FF',
    height: 56,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00D8FF',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5
  },
  saveBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#111',
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#333',
    justifyContent: 'center',
    alignItems: 'center'
  },
  cancelBtnText: { color: '#888', fontSize: 16 },
  
  // Success Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  successBox: {
    backgroundColor: '#111',
    width: '80%',
    padding: 30,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#00D8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#00D8FF',
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  successTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  successSub: {
    color: '#888',
    fontSize: 14,
    textAlign: 'center',
  }
});
