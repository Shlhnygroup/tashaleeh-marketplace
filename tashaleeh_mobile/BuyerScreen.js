import React, { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, ActivityIndicator, Alert, Dimensions, Modal, Image, RefreshControl, Linking, Keyboard, Platform } from 'react-native';
import { supabase } from './supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { SAUDI_CITIES, formatArDate, COLORS } from './utils';

const { width } = Dimensions.get('window');

export default function BuyerScreen({ navigate }) {
  const [activeTab, setActiveTab] = useState('new'); 
  
  const [carBrandsList, setCarBrandsList] = useState([]);
  const [brandModalVisible, setBrandModalVisible] = useState(false);
  const [brandSearchQuery, setBrandSearchQuery] = useState("");

  const [selectedBrand, setSelectedBrand] = useState("");
  const [modelYear, setModelYear] = useState("");
  const [partDetails, setPartDetails] = useState("");
  const [vinNumber, setVinNumber] = useState(""); 
  const [selectedRegion, setSelectedRegion] = useState(""); 
  const [cityModalVisible, setCityModalVisible] = useState(false); 
  
  // V2 Dynamic Settings
  const [appSettings, setAppSettings] = useState({ whatsapp_number: '', terms_conditions: '', privacy_policy: '' });
  const [policyModalVisible, setPolicyModalVisible] = useState(false);  
  
  // V4 Banners
  const [banners, setBanners] = useState([]);
  // Image Upload State
  const [imageUri, setImageUri] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [publicImageUrl, setPublicImageUrl] = useState("");

  const [submitLoading, setSubmitLoading] = useState(false);

  const [myRequests, setMyRequests] = useState([]);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Full Screen Image Viewing
  const [fullImageModal, setFullImageModal] = useState(false);
  const [selectedFullImage, setSelectedFullImage] = useState(null);

  // V2 Closing & Rating
  const [closingModal, setClosingModal] = useState(false);
  const [activeRequestForClosing, setActiveRequestForClosing] = useState(null);
  const [ratingModal, setRatingModal] = useState(false);
  const [sellerToRate, setSellerToRate] = useState(null);
  const [userRating, setUserRating] = useState(5);

  useEffect(() => {
    fetchBrandsFromDB();
    fetchSettingsFromDB();
  }, []);

  const fetchBrandsFromDB = async () => {
    const { data } = await supabase.from('car_brands').select('*').order('id', { ascending: true });
    if (data) setCarBrandsList(data);
  };

  const fetchSettingsFromDB = async () => {
    const { data } = await supabase.from('app_settings').select('*').eq('id', 1).single();
    if (data) setAppSettings(data);

    // Fetch active banners for V4
    const { data: bData } = await supabase.from('app_banners').select('*').eq('is_active', true).order('sort_order', { ascending: true });
    if (bData) setBanners(bData);
  };

  useEffect(() => {
    if (activeTab === 'my_requests') {
      fetchMyRequests();
    }
  }, [activeTab]);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      Alert.alert('خطأ', 'تعذر تسجيل الخروج. تأكد من اتصالك.');
    }
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true, // ✅ نحتاج base64 للرفع المضمون
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadImage(result.assets[0].uri, result.assets[0].base64);
    }
  };

  const uploadImage = async (uri, base64Data) => {
    setImageUri(uri); // Immediate preview
    setImageUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `uploads/${user.id}/buyer_${Date.now()}.jpg`;

      // ✅ استخدام base64 مباشرة — أكثر موثوقية من blob في React Native
      const { data, error } = await supabase.storage
        .from('parts_images')
        .upload(filePath, decode(base64Data), { contentType: 'image/jpeg', upsert: true });
        
      if (error) {
         console.log("Buyer upload error:", error);
         Alert.alert("خطأ في الرفع", error.message);
         setImageUri(null);
         setPublicImageUrl("");
      } else {
         const { data: { publicUrl } } = supabase.storage.from('parts_images').getPublicUrl(filePath);
         // ✅ cache-buster لضمان تحديث الصورة
         setPublicImageUrl(`${publicUrl}?t=${Date.now()}`);
      }
    } catch (e) {
      console.log("Buyer catch error:", e);
      setImageUri(null);
      setPublicImageUrl("");
    } finally {
      setImageUploading(false);
    }
  };

  const handleSubmitNewRequest = async () => {
    // ✅ FIX: إزالة focus من أي TextInput قبل المعالجة (يصلح بق الضغط في الويب)
    Keyboard.dismiss();

    if (!selectedBrand || !modelYear || !partDetails || !selectedRegion) {
      Alert.alert("تنبيه", "الرجاء تعبئة جميع الحقول الأساسية بما فيها المدينة!");
      return;
    }
    
    setSubmitLoading(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        setSubmitLoading(false);
        Alert.alert("خطأ", "يجب تسجيل الدخول أولاً.");
        navigate('Auth');
        return;
      }

      // Check profile with a simple approach to avoid hangs
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone, is_blocked')
        .eq('id', user.id)
        .single();
      
      if (profileError || !profile) {
        setSubmitLoading(false);
        Alert.alert("تنبيه", "تعذر التحقق من بياناتك حالياً (ربما بسبب مشكلة في الاتصال).");
        return;
      }

      if (profile.is_blocked) {
        setSubmitLoading(false);
        Alert.alert("تنبيه 🚫", "لا يمكنك إرسال طلبات لأن حسابك محظور. يرجى مراجعة الإدارة.");
        return;
      }

      if (!profile.phone) {
        setSubmitLoading(false);
        Alert.alert("تنبيه 📞", "يجب إضافة رقم الجوال في ملفك الشخصي أولاً للتواصل مع البائعين.", [
          { text: "تراجع", style: "cancel" },
          { text: "تعبئة الآن", onPress: () => navigate('Profile') }
        ]);
        return;
      }

      const { error } = await supabase
        .from('requests')
        .insert([
          { 
            buyer_id: user.id, 
            car_brand: selectedBrand, 
            model_year: modelYear, 
            part_details: partDetails,
            vin_number: vinNumber, 
            region: selectedRegion,
            image_url: publicImageUrl,
            status: 'open'
          }
        ]);

      setSubmitLoading(false); // Reset BEFORE alert

      if (error) {
        Alert.alert('حدث خطأ أثناء الإرسال', error.message);
      } else {
        Alert.alert('نجاح 🚀', 'تم نشر طلبك في سوق التشاليح بنجاح!');
        setSelectedBrand("");
        setModelYear("");
        setPartDetails("");
        setVinNumber("");
        setSelectedRegion("");
        setImageUri(null);
        setPublicImageUrl("");
        setActiveTab('my_requests'); 
      }
    } catch (err) {
      console.error(err);
      setSubmitLoading(false);
      Alert.alert("خطأ تقني", "حدث خطأ غير متوقع، يرجى التحقق من اتصال الإنترنت.");
    }
  };

  const fetchMyRequests = async () => {
    setFetchLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if(userError || !user) return;

      const { data, error } = await supabase
        .from('requests')
        .select('*, responses(*)')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) Alert.alert('خطأ', error.message);
      else setMyRequests(data || []);
    } catch (err) {
      Alert.alert('خطأ في الاتصال', 'تعذر جلب الطلبات. تأكد من توفر الإنترنت والمحاولة مجدداً.');
    } finally {
      setFetchLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    fetchMyRequests();
    fetchSettingsFromDB();
  }, []);

  const openWhatsAppSupport = () => {
    if (!appSettings.whatsapp_number) {
       Alert.alert("تنبيه", "رقم الدعم الفني غير متاح حالياً.");
       return;
    }
    const url = `https://wa.me/${appSettings.whatsapp_number}`;
    Linking.openURL(url).catch(() => {
       Alert.alert("خطأ", "يجب تثبيت تطبيق واتساب على جهازك للتواصل مع الدعم.");
    });
  };

  const deleteRequest = async (id) => {
    const executeDelete = async () => {
      try {
        const { error } = await supabase.from('requests').delete().eq('id', id);
        
        if (error) {
          if (Platform.OS === 'web') alert("لا يمكن حذف الطلب حالياً: " + error.message);
          else Alert.alert("فشل الحذف", "لا يمكن حذف الطلب حالياً: " + error.message);
        } else {
          setMyRequests(prev => prev.filter(req => req.id !== id));
          if (Platform.OS === 'web') alert("تم حذف الطلب بنجاح ✅");
          else Alert.alert("نجاح ✅", "تم حذف الطلب بنجاح.");
        }
      } catch (err) {
        if (Platform.OS === 'web') alert("حدث خطأ أثناء محاولة الحذف.");
        else Alert.alert("خطأ", "حدث خطأ أثناء محاولة الحذف.");
      }
    };

    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm("هل أنت متأكد من سحب طلبك من السوق؟\n\nاضغط موافق للحذف نهائياً.");
      if (confirmDelete) {
        executeDelete();
      }
    } else {
      Alert.alert(
        "إلغاء الطلب", 
        "هل أنت متأكد من سحب طلبك من السوق؟",
        [
          { text: "تراجع", style: "cancel" },
          { 
             text: "نعم، احذف 🗑️", 
             style: "destructive",
             onPress: executeDelete
          }
        ]
      );
    }
  };

  const calculateDate = (timestamp) => formatArDate(timestamp);

  const closeRequest = async (status) => {
    if (!activeRequestForClosing) return;
    setSubmitLoading(true);
    
    // If "Bought", we might want to trigger rating for a specific seller
    // For now, we'll just close the request.
    const { error } = await supabase
      .from('requests')
      .update({ status: status })
      .eq('id', activeRequestForClosing.id);

    setSubmitLoading(false);
    setClosingModal(false);
    
    if (!error) {
      if (status === 'bought') {
        // Find if there's a winner (last person chatted with or first offer?)
        // For MVP simplicity, we'll ask who to rate if they have offers.
        if (activeRequestForClosing.responses?.length > 0) {
           setSellerToRate(activeRequestForClosing.responses[0].seller_id);
           setRatingModal(true);
        }
      }
      fetchMyRequests();
    }
  };

  const submitRating = async () => {
    setSubmitLoading(true);
    // Fetch current rating to average it (Simple mock for now)
    const { data: profile } = await supabase.from('seller_profiles').select('rating').eq('id', sellerToRate).single();
    const newRating = profile ? (profile.rating + userRating) / 2 : userRating;
    
    await supabase.from('seller_profiles').update({ rating: newRating }).eq('id', sellerToRate);
    setSubmitLoading(false);
    setRatingModal(false);
    Alert.alert("شكراً لك", "تم تقييم البائع بنجاح، شكراً لمساهمتك في موثوقية التطبيق.");
  };

  const openClosingMenu = (req) => {
    setActiveRequestForClosing(req);
    setClosingModal(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={handleLogout} style={styles.iconButton}>
            <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigate('Profile')} style={[styles.iconButton, {marginRight: 10}]}>
            <Ionicons name="person-circle-outline" size={26} color="#00D8FF" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setPolicyModalVisible(true)} style={styles.iconButton}>
            <Ionicons name="help-circle-outline" size={24} color="#FF8C00" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerTitle}>بوابة المشتري</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity style={[styles.tabButton, activeTab === 'my_requests' && styles.tabButtonActive]} onPress={() => setActiveTab('my_requests')}>
          <Ionicons name="list" size={20} color={activeTab === 'my_requests' ? '#000' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'my_requests' && styles.tabTextActive]}>طلباتي والعروض</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.tabButton, activeTab === 'new' && styles.tabButtonActive]} onPress={() => setActiveTab('new')}>
          <Ionicons name="add-circle" size={20} color={activeTab === 'new' ? '#000' : '#888'} />
          <Text style={[styles.tabText, activeTab === 'new' && styles.tabTextActive]}>إرسال طلب جديد</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'new' ? (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          
          {/* V4 Banners Slider */}
          {banners.length > 0 && (
            <View style={{marginBottom: 20}}>
               <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexDirection: 'row-reverse'}}>
                  {banners.map((b, i) => (
                    <TouchableOpacity key={b.id || i} onPress={() => b.link_url && Linking.openURL(b.link_url)}>
                      <Image source={{uri: b.image_url}} style={{width: 300, height: 120, borderRadius: 16, marginLeft: 15, borderWidth: 1, borderColor: '#333'}} />
                    </TouchableOpacity>
                  ))}
               </ScrollView>
            </View>
          )}

          <View style={styles.glassCard}>
            
            <View style={styles.formSection}>
              <Text style={styles.label}>المدينة (موقع استلام القطعة)</Text>
              <TouchableOpacity style={[styles.inputWrapper, {paddingVertical: 18}]} onPress={() => setCityModalVisible(true)}>
                <Ionicons name="location-outline" size={20} color="#FF8C00" style={styles.inputIcon}/>
                <Text style={[styles.input, {color: selectedRegion ? '#FFF' : '#555', paddingVertical: 0}]}>
                  {selectedRegion || "اضغط لاختيار مدينتك من القائمة"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>ماركة السيارة</Text>
              <TouchableOpacity style={[styles.inputWrapper, {paddingVertical: 18}]} onPress={() => setBrandModalVisible(true)}>
                <Ionicons name="car-outline" size={20} color="#FF8C00" style={styles.inputIcon}/>
                <Text style={[styles.input, {color: selectedBrand ? '#FFF' : '#555', paddingVertical: 0}]}>
                  {selectedBrand || "اضغط للبحث واختيار ماركة السيارة"}
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>الموديل (سنة الصنع)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="calendar-outline" size={20} color="#666" style={styles.inputIcon}/>
                <TextInput style={styles.input} placeholder="مثال: 2020" placeholderTextColor="#555" keyboardType="numeric" value={modelYear} onChangeText={setModelYear} maxLength={4}/>
              </View>
            </View>

            <View style={styles.formSection}>
              <Text style={styles.label}>القطعة المطلوبة بدقة</Text>
              <View style={[styles.inputWrapper, {alignItems: 'flex-start', paddingTop: 12}]}>
                <Ionicons name="document-text-outline" size={20} color="#666" style={{marginLeft: 10, marginTop: 4}}/>
                <TextInput style={[styles.input, styles.textArea]} placeholder="مثال: كمبروسر مكيف..." placeholderTextColor="#555" multiline={true} value={partDetails} onChangeText={setPartDetails}/>
              </View>
            </View>
            
            <View style={styles.formSection}>
              <Text style={styles.label}>رقم الهيكل VIN (اختياري)</Text>
              <View style={styles.inputWrapper}>
                <Ionicons name="barcode-outline" size={20} color="#666" style={styles.inputIcon}/>
                <TextInput style={styles.input} placeholder="أدخل رقم الهيكل لتطابق 100%" placeholderTextColor="#555" autoCapitalize="characters" value={vinNumber} onChangeText={setVinNumber}/>
              </View>
            </View>

            {/* Image Picker Section */}
            <View style={styles.formSection}>
               <Text style={styles.label}>إرفاق صورة للقطعة المكسورة (اختياري)</Text>
               <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} disabled={imageUploading}>
                  {imageUploading ? (
                     <ActivityIndicator size="small" color="#FF8C00" />
                  ) : imageUri ? (
                     <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Image source={{uri: imageUri}} style={{width: 40, height: 40, borderRadius: 8, marginLeft: 10}} />
                        <Text style={{color: '#FFF', fontWeight: 'bold'}}>تم إرفاق الصورة بنجاح ✅</Text>
                     </View>
                  ) : (
                     <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Ionicons name="camera" size={24} color="#FF8C00" style={{marginLeft: 10}}/>
                        <Text style={{color: '#888', fontWeight: 'bold'}}>اضغط لالتقاط أو اختيار صورة</Text>
                     </View>
                  )}
               </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.submitButton} onPress={handleSubmitNewRequest} disabled={submitLoading || imageUploading}>
              <Text style={styles.submitButtonText}>{submitLoading ? 'جاري الإرسال...' : 'نشر الطلب في السوق'}</Text>
              {!submitLoading && <Ionicons name="rocket" size={20} color="#000" style={{marginLeft: 10}}/>}
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.container}>
          {fetchLoading ? (
            <ActivityIndicator size="large" color="#FF8C00" style={{marginTop: 50}} />
          ) : (
            <ScrollView 
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF8C00" colors={['#FF8C00']} />
              }
            >
              {myRequests.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="cart-outline" size={50} color="#FF8C00" />
                  </View>
                  <Text style={styles.emptyTitle}>لا توجد طلبات نشطة</Text>
                  <Text style={styles.emptySub}>ابدأ بإرسال طلبك الأول وسيقوم البائعون بتسعيره لك فوراً.</Text>
                  <TouchableOpacity style={styles.emptyBtn} onPress={() => setActiveTab('new')}>
                    <Text style={styles.emptyBtnText}>أرسل طلب الآن</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                myRequests.map((req) => (
                  <View key={req.id} style={styles.requestCard}>
                    <View style={styles.reqHeader}>
                      <View style={{flexDirection: 'row', gap: 8}}>
                        <TouchableOpacity onPress={() => deleteRequest(req.id)} style={styles.deleteBtn}>
                           <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                        </TouchableOpacity>
                        {req.status === 'open' && (
                          <TouchableOpacity onPress={() => openClosingMenu(req)} style={[styles.deleteBtn, {backgroundColor: 'rgba(0, 216, 255, 0.1)'}]}>
                             <Ionicons name="checkmark-done" size={16} color="#00D8FF" />
                          </TouchableOpacity>
                        )}
                      </View>
                      <View style={{flexDirection: 'row', alignItems: 'center'}}>
                         <Text style={styles.reqDate}>{calculateDate(req.created_at)}</Text>
                         <Text style={styles.reqBrand}> {req.car_brand} • {req.model_year}</Text>
                      </View>
                    </View>

                    {/* V2 Stats Row */}
                    <View style={styles.statsRow}>
                       <View style={styles.statItem}><Text style={styles.statVal}>{req.views || 0}</Text><Text style={styles.statLab}>مشاهدة</Text></View>
                       <View style={styles.statItem}><Text style={styles.statVal}>{req.rejections || 0}</Text><Text style={styles.statLab}>اعتذار</Text></View>
                       <View style={styles.statItem}><Text style={styles.statVal}>{req.responses ? req.responses.length : 0}</Text><Text style={styles.statLab}>عروض</Text></View>
                    </View>
                    
                    <View style={{flexDirection: 'row-reverse', gap: 10, flexWrap: 'wrap'}}>
                      {req.region ? (
                         <View style={styles.infoBadge}><Ionicons name="location" size={12} color="#AAA" /><Text style={styles.infoBadgeText}>{req.region}</Text></View>
                      ) : null}
                      {req.vin_number ? (
                         <View style={styles.infoBadge}><Ionicons name="barcode" size={12} color="#AAA" /><Text style={styles.infoBadgeText}>{req.vin_number}</Text></View>
                      ) : null}
                    </View>

                    <Text style={styles.reqDetails}>{req.part_details}</Text>
                    
                    {/* Display Image if requested */}
                    {req.image_url ? (
                       <TouchableOpacity onPress={() => { setSelectedFullImage(req.image_url); setFullImageModal(true); }}>
                          <Image source={{uri: req.image_url}} style={{width: '100%', height: 180, borderRadius: 12, marginTop: 10, borderWidth: 1, borderColor: '#333'}} />
                       </TouchableOpacity>
                    ) : null}

                    <DashedLine />

                    <View style={{flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 10}}>
                      <Ionicons name="pricetags" size={16} color="#888" style={{marginLeft: 5}}/>
                      <Text style={styles.offersTitle}>عروض التسعير ({req.responses ? req.responses.length : 0})</Text>
                    </View>
                    
                    {req.responses && req.responses.length > 0 ? (
                      req.responses.map((resp) => (
                        <View key={resp.id} style={styles.offerCard}>
                           <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                              <TouchableOpacity style={styles.chatBtn} onPress={() => navigate('Chat', { request_id: req.id, receiver_id: resp.seller_id, other_party_name: 'البائع' })}>
                                <Ionicons name="chatbubbles" size={16} color="#000" style={{marginLeft: 5}}/>
                                <Text style={{color: '#000', fontSize: 13, fontWeight: 'bold'}}>دردش</Text>
                              </TouchableOpacity>
                              <View style={{flexDirection: 'row', alignItems: 'center'}}>
                                 {resp.image_url ? (
                                    <TouchableOpacity onPress={() => { setSelectedFullImage(resp.image_url); setFullImageModal(true); }}>
                                       <Ionicons name="image" size={24} color="#00D8FF" style={{marginRight: 10}} />
                                    </TouchableOpacity>
                                 ) : null}
                                 <Text style={styles.offerPrice}>{resp.price} <Text style={{fontSize: 12, color: '#888'}}>ريال</Text></Text>
                              </View>
                           </View>
                           {resp.notes ? <Text style={styles.offerNotes}>"{resp.notes}"</Text> : null}
                        </View>
                      ))
                    ) : (
                      <View style={styles.emptyOffers}>
                         <Ionicons name="time-outline" size={16} color="#555" style={{marginLeft: 8}} />
                         <Text style={{color: '#666', fontSize: 12, marginRight: 10}}>بانتظار تسعيرات البائعين...</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>
          )}
        </View>
      )}

      {/* Brands Selector Modal */}
      <Modal visible={brandModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15}}>
               <TouchableOpacity onPress={() => setBrandModalVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity>
               <Text style={styles.modalTitle}>اختر ماركة السيارة 🚘</Text>
            </View>
            
            <View style={{flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#1A1A1A', padding: 12, borderRadius: 12, marginBottom: 15}}>
               <Ionicons name="search" size={20} color="#888" style={{marginLeft: 10}}/>
               <TextInput 
                  style={{flex: 1, color: '#FFF', fontSize: 16, textAlign: 'right'}}
                  placeholder="ابحث عن الماركة..." 
                  placeholderTextColor="#666"
                  value={brandSearchQuery}
                  onChangeText={setBrandSearchQuery}
               />
            </View>

            <ScrollView showsVerticalScrollIndicator={true}>
               {carBrandsList
                 .filter(b => b.name.includes(brandSearchQuery))
                 .map((brand, idx) => (
                 <TouchableOpacity key={idx} style={styles.cityOption} onPress={() => { setSelectedBrand(brand.name); setBrandModalVisible(false); setBrandSearchQuery(""); }}>
                   <Text style={[styles.cityOptionText, selectedBrand === brand.name && {color: '#FF8C00', fontWeight: 'bold'}]}>{brand.name}</Text>
                   {selectedBrand === brand.name && <Ionicons name="checkmark-circle" size={24} color="#FF8C00"/>}
                 </TouchableOpacity>
               ))}
               
               {carBrandsList.filter(b => b.name.includes(brandSearchQuery)).length === 0 && (
                   <Text style={{color: '#888', textAlign: 'center', marginTop: 30}}>لا توجد نتائج مطابقة لبحثك</Text>
               )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Cities Selector Modal */}
      <Modal visible={cityModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
               <TouchableOpacity onPress={() => setCityModalVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity>
               <Text style={styles.modalTitle}>اختر المدينة 📍</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
               {SAUDI_CITIES.map((city, idx) => (
                 <TouchableOpacity key={idx} style={styles.cityOption} onPress={() => { setSelectedRegion(city); setCityModalVisible(false); }}>
                   <Text style={[styles.cityOptionText, selectedRegion === city && {color: '#FF8C00', fontWeight: 'bold'}]}>{city}</Text>
                   {selectedRegion === city && <Ionicons name="checkmark-circle" size={24} color="#FF8C00"/>}
                 </TouchableOpacity>
               ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Full Screen Image Viewer Modal */}
      <Modal visible={fullImageModal} transparent={true} animationType="fade">
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center'}}>
          <TouchableOpacity style={{position: 'absolute', top: 50, right: 20}} onPress={() => setFullImageModal(false)}>
             <Ionicons name="close" size={40} color="#FFF" />
          </TouchableOpacity>
          {selectedFullImage && <Image source={{uri: selectedFullImage}} style={{width: '95%', height: '70%', resizeMode: 'contain'}} />}
        </View>
      </Modal>

      {/* Closing Request Modal */}
      <Modal visible={closingModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height: 'auto', paddingBottom: 30}]}>
             <Text style={[styles.modalTitle, {marginBottom: 10}]}>إغلاق الطلب ✅</Text>
             <Text style={{color: '#888', textAlign: 'right', marginBottom: 20}}>هل وفقت في شراء القطعة أم ترغب في إلغاء الطلب؟</Text>
             
             <TouchableOpacity style={[styles.submitButton, {backgroundColor: '#6eff35', marginBottom: 15}]} onPress={() => closeRequest('bought')}>
                <Text style={styles.submitButtonText}>نعم، تم الشراء بنجاح 💸</Text>
             </TouchableOpacity>

             <TouchableOpacity style={[styles.submitButton, {backgroundColor: '#222', borderWidth: 1, borderColor: '#444'}]} onPress={() => closeRequest('cancelled')}>
                <Text style={[styles.submitButtonText, {color: '#FFF'}]}>إلغاء الطلب نهائياً</Text>
             </TouchableOpacity>

             <TouchableOpacity style={{marginTop: 20, alignItems: 'center'}} onPress={() => setClosingModal(false)}>
                <Text style={{color: '#666'}}>تراجع</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Seller Rating Modal */}
      <Modal visible={ratingModal} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
           <View style={[styles.modalContent, {height: 'auto', paddingBottom: 30}]}>
              <Text style={styles.modalTitle}>تقييم البائع ⭐</Text>
              <Text style={{color: '#888', textAlign: 'right', marginBottom: 20}}>يرجى تقييم أداء البائع لضمان جودة سوق التشاليح</Text>
              
              <View style={{flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 30}}>
                 {[1,2,3,4,5].map(star => (
                   <TouchableOpacity key={star} onPress={() => setUserRating(star)}>
                      <Ionicons name={star <= userRating ? "star" : "star-outline"} size={35} color="#FFD700" />
                   </TouchableOpacity>
                 ))}
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={submitRating} disabled={submitLoading}>
                  <Text style={styles.submitButtonText}>{submitLoading ? 'جاري التحميل...' : 'حفظ التقييم'}</Text>
              </TouchableOpacity>
           </View>
        </View>
      </Modal>

      {/* Policy and Support Modal */}
      <Modal visible={policyModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height: '60%'}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
               <TouchableOpacity onPress={() => setPolicyModalVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity>
               <Text style={styles.modalTitle}>الدعم والسياسات 🛡️</Text>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
               <View style={styles.policySection}>
                  <Text style={styles.policyHeading}>الشروط والأحكام (ملزم)</Text>
                  <Text style={styles.policyBody}>{appSettings.terms_conditions || "جاري جلب بنود السياسة..."}</Text>
               </View>
               <View style={styles.policySection}>
                  <Text style={styles.policyHeading}>سياسة الخصوصية</Text>
                  <Text style={styles.policyBody}>{appSettings.privacy_policy || "جاري التحديث..."}</Text>
               </View>

               <TouchableOpacity style={styles.whatsappBtn} onPress={openWhatsAppSupport}>
                  <Ionicons name="logo-whatsapp" size={24} color="#FFF" style={{marginLeft: 10}}/>
                  <Text style={styles.whatsappBtnText}>تواصل مع الدعم الفني مباشرة</Text>
               </TouchableOpacity>

               <Text style={{color: '#555', textAlign: 'center', marginTop: 20, fontSize: 12}}>نسخة التطبيق V2.0.0 (بيتا)</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Premium Glass Loading Overlay — only for submit, fetch has its own inline indicator */}
      {submitLoading && (
        <View style={styles.glassOverlay}>
           <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#FF8C00" />
              <Text style={styles.loaderText}>جاري إرسال طلبك...</Text>
              <Text style={styles.loaderSub}>يرجى الانتظار، نحن نربطك بأفضل التشاليح</Text>
           </View>
        </View>
      )}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const DashedLine = () => <View style={{height: 1, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', marginVertical: 15}} />;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070707' },
  header: { 
    flexDirection: 'row-reverse', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15,
    paddingTop: 50,
    backgroundColor: '#070707',
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A'
  },
  headerRight: { flexDirection: 'row-reverse', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#FFF' },
  iconButton: { backgroundColor: '#1A1A1A', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  tabsContainer: { flexDirection: 'row-reverse', backgroundColor: '#0A0A0A', padding: 15, paddingTop: 0, gap: 10 },
  tabButton: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row-reverse', borderRadius: 16, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  tabButtonActive: { backgroundColor: '#FF8C00', borderColor: '#FF8C00' },
  tabText: { color: '#888', fontWeight: 'bold', fontSize: 14, marginRight: 8 },
  tabTextActive: { color: '#000', fontWeight: 'bold' },
  container: { padding: 16, paddingBottom: 50 },
  glassCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  formSection: { marginBottom: 20 },
  label: { fontSize: 15, fontWeight: '700', color: '#FFF', marginBottom: 12, textAlign: 'right' },
  brandsContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  brandChip: { backgroundColor: '#111', borderWidth: 1, borderColor: '#333', paddingVertical: 12, paddingHorizontal: 16, borderRadius: 20 },
  brandChipSelected: { backgroundColor: 'rgba(255, 140, 0, 0.2)', borderColor: '#FF8C00' },
  brandText: { color: '#888', fontWeight: '600' },
  brandTextSelected: { color: '#FF8C00', fontWeight: '800' },
  inputWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#222', borderRadius: 16, paddingHorizontal: 15 },
  inputIcon: { marginLeft: 10 },
  input: { flex: 1, paddingVertical: 16, color: '#FFF', fontSize: 15, textAlign: 'right' },
  textArea: { height: 80, textAlignVertical: 'top' },
  
  imagePickerBtn: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 16, padding: 15, alignItems: 'center', justifyContent: 'center' },

  submitButton: { flexDirection: 'row', backgroundColor: '#FF8C00', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 15 },
  submitButtonText: { color: '#000', fontSize: 18, fontWeight: '900' },
  
  requestCard: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#222' },
  reqHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  reqBrand: { color: '#FF8C00', fontWeight: '900', fontSize: 18 },
  reqDate: { color: '#666', fontSize: 12, marginRight: 10 },
  deleteBtn: { backgroundColor: 'rgba(255, 59, 48, 0.1)', padding: 8, borderRadius: 10 },
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  infoBadgeText: { color: '#AAA', fontSize: 12, fontWeight: '600', marginLeft: 6 },
  reqDetails: { color: '#FFF', fontSize: 16, textAlign: 'right', lineHeight: 26 },
  
  offersTitle: { color: '#AAA', fontWeight: 'bold', textAlign: 'right' },
  offerCard: { backgroundColor: '#111', borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#333' },
  offerPrice: { color: '#00D8FF', fontWeight: '900', fontSize: 22, textAlign: 'right' },
  offerNotes: { color: '#888', textAlign: 'right', fontSize: 13, marginTop: 10, fontStyle: 'italic' },
  chatBtn: { flexDirection: 'row', backgroundColor: '#00D8FF', paddingVertical: 8, paddingHorizontal: 15, borderRadius: 12, alignItems: 'center' },
  emptyOffers: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', padding: 15, borderRadius: 16, borderWidth: 1, borderColor: '#222' },

  // Modal styling
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#111', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40, height: '70%', borderWidth: 1, borderColor: '#222' },
  modalTitle: { fontSize: 22, fontWeight: '900', color: '#FFF', textAlign: 'right' },
  cityOption: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#222' },
  cityOptionText: { color: '#FFF', fontSize: 18, textAlign: 'right' },

  // Policy Modal Specifics
  policySection: { backgroundColor: 'rgba(255, 140, 0, 0.05)', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(255, 140, 0, 0.2)', marginBottom: 20 },
  policyHeading: { fontSize: 18, fontWeight: '900', color: '#FF8C00', marginBottom: 10, textAlign: 'right' },
  policyBody: { color: '#CCC', fontSize: 15, lineHeight: 24, textAlign: 'right' },
  whatsappBtn: { flexDirection: 'row', backgroundColor: '#25D366', paddingVertical: 18, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  whatsappBtnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },

  // V2.1 Stats and Closing
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', backgroundColor: '#0A0A0A', padding: 12, borderRadius: 12, marginBottom: 15, borderWeight: 1, borderColor: '#222', borderWidth: 1 },
  statItem: { alignItems: 'center' },
  statVal: { color: '#FFF', fontSize: 16, fontWeight: '900' },
  statLab: { color: '#666', fontSize: 10, fontWeight: 'bold', marginTop: 2 },

  // V3.0 Premium UI Styles
  glassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  loaderBox: { backgroundColor: '#111', padding: 30, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  loaderText: { color: '#FFF', marginTop: 15, fontWeight: 'bold', fontSize: 17 },
  loaderSub: { color: '#666', marginTop: 8, fontSize: 12, textAlign: 'center' },
  
  emptyContainer: { alignItems: 'center', marginTop: 60, padding: 30 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255, 140, 0, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  emptySub: { color: '#777', textAlign: 'center', lineHeight: 22, fontSize: 14, marginBottom: 25 },
  emptyBtn: { backgroundColor: '#FF8C00', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 25 },
  emptyBtnText: { color: '#000', fontWeight: 'bold' }
});
