import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar, Modal, TextInput, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image, RefreshControl, Switch, Keyboard } from 'react-native';
import { supabase } from './supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { formatArDate, COLORS } from './utils';

export default function SellerScreen({ navigate }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState('requests'); // 'requests' | 'chats'
  const [conversations, setConversations] = useState([]);
  const [chatsLoading, setChatsLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Image Upload State for Seller
  const [imageUri, setImageUri] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [publicImageUrl, setPublicImageUrl] = useState("");

  // V2 Offer Details
  const [warranty, setWarranty] = useState('');
  const [condition, setCondition] = useState('used'); // used, new, refurbished

  // V2 Seller Profile & Settings
  const [sellerProfile, setSellerProfile] = useState({ handled_brands: [], is_online: true });
  const [allBrands, setAllBrands] = useState([]);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [brandsModalVisible, setBrandsModalVisible] = useState(false);

  // Full Screen Image Viewing
  const [fullImageModal, setFullImageModal] = useState(false);
  const [selectedFullImage, setSelectedFullImage] = useState(null);

  useEffect(() => {
    initSeller();
  }, []);

  useEffect(() => {
    if (activeView === 'chats') fetchConversations();
  }, [activeView]);

  // جلب كل المحادثات (Inbox) — تُجمّع حسب الطلب والطرف الآخر (المشتري)
  const fetchConversations = async () => {
    setChatsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: msgs, error } = await supabase
        .from('messages')
        .select('*')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const map = {};
      for (const m of msgs || []) {
        const other = m.sender_id === user.id ? m.receiver_id : m.sender_id;
        const key = `${m.request_id}_${other}`;
        if (!map[key]) map[key] = { key, request_id: m.request_id, other_id: other, last: m };
      }
      const convs = Object.values(map);
      const otherIds = [...new Set(convs.map(c => c.other_id))].filter(Boolean);
      if (otherIds.length) {
        const { data: profs } = await supabase.from('profiles').select('id, display_name, email').in('id', otherIds);
        const pmap = {};
        (profs || []).forEach(p => { pmap[p.id] = p; });
        convs.forEach(c => { c.other = pmap[c.other_id]; });
      }
      setConversations(convs);
    } catch (err) {
      // عند الفشل نترك القائمة فارغة
    } finally {
      setChatsLoading(false);
    }
  };

  const initSeller = async () => {
    try {
      setLoading(true);
      
      // ✅ FIX: فحص الحظر أولاً قبل أي شيء
      const { data: authData } = await supabase.auth.getUser();
      const user = authData?.user;
      if (user) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('is_blocked')
          .eq('id', user.id)
          .single();
        
        if (profileData?.is_blocked) {
          Alert.alert(
            "تنبيه 🚫",
            "حسابك محظور من قبل الإدارة. تواصل معنا لمزيد من المعلومات.",
            [{ text: "تسجيل الخروج", onPress: () => supabase.auth.signOut() }]
          );
          return;
        }
      }
      
      // نلتقط البروفايل المُحدَّث مباشرة لتفادي قراءة الحالة القديمة عند التصفية
      const [profile] = await Promise.all([
        fetchSellerProfile(),
        fetchAllBrands()
      ]);
      await fetchRequests(profile?.handled_brands);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllBrands = async () => {
    const { data } = await supabase.from('car_brands').select('*').order('name', { ascending: true });
    if (data) setAllBrands(data);
  };

  const fetchSellerProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    let { data, error } = await supabase
      .from('seller_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist, create it
      const { data: newProfile } = await supabase
        .from('seller_profiles')
        .insert([{ id: user.id, handled_brands: [], is_online: true }])
        .select()
        .single();
      if (newProfile) setSellerProfile(newProfile);
      return newProfile;
    } else if (data) {
      setSellerProfile(data);
      return data;
    }
    return null;
  };

  const saveSellerProfile = async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const prevProfile = sellerProfile;
    const newProfile = { ...sellerProfile, ...updates };
    setSellerProfile(newProfile); // تحديث تفاؤلي

    const { error } = await supabase
      .from('seller_profiles')
      .update(updates)
      .eq('id', user.id);

    if (error) {
      setSellerProfile(prevProfile); // تراجع عند الفشل
      if (Platform.OS === 'web') alert('تعذّر حفظ الإعداد: ' + error.message);
      else Alert.alert('خطأ', 'تعذّر حفظ الإعداد: ' + error.message);
      return;
    }

    // إعادة الجلب بعد تغيير الفلاتر — نمرّر الماركات الجديدة مباشرة لتفادي الحالة القديمة
    fetchRequests(newProfile.handled_brands);
  };

  const fetchRequests = async (brandsOverride) => {
    // Allow passing brands directly to avoid stale state closure on refresh
    const activeBrands = brandsOverride ?? sellerProfile.handled_brands;
    try {
      const { data: { user } } = await supabase.auth.getUser();

      let query = supabase
        .from('requests')
        .select('*')
        .eq('status', 'open')
        .eq('is_hidden', false)
        .order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) {
        if (Platform.OS === 'web') alert('خطأ: ' + error.message);
        else Alert.alert('خطأ', error.message);
      } else {
        // استبعاد الطلبات التي سبق أن رفضها هذا البائع (محفوظة في القاعدة)
        let rejectedIds = new Set();
        if (user) {
          const { data: rej } = await supabase
            .from('request_rejections')
            .select('request_id')
            .eq('seller_id', user.id);
          if (rej) rejectedIds = new Set(rej.map(r => r.request_id));
        }
        let visibleData = data.filter(r => !rejectedIds.has(r.id));

        // Filter based on seller's handled brands if any are selected
        if (activeBrands && activeBrands.length > 0) {
          setRequests(visibleData.filter(r => activeBrands.includes(r.car_brand)));
        } else {
          setRequests(visibleData);
        }
      }
    } catch (err) {
      Alert.alert('خطأ في الاتصال', 'تعذر جلب الطلبات.');
    } finally {
      setRefreshing(false);
    }
  };

  const onRefresh = React.useCallback(() => {
    setRefreshing(true);
    // Re-fetch profile first to get fresh brands, then pass directly to fetch
    fetchSellerProfile().then((freshProfile) => {
      fetchRequests(freshProfile?.handled_brands);
    });
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      Alert.alert('خطأ', 'تعذر تسجيل الخروج. تأكد من اتصالك.');
    }
  };

  const openOfferModal = async (req) => {
    setSelectedRequestId(req.id);
    setOfferPrice('');
    setOfferNotes('');
    setWarranty('');
    setCondition('used');
    setImageUri(null);
    setPublicImageUrl("");
    setModalVisible(true);

    // V2: زيادة عداد المشاهدة لإعلام المشتري (مع فحص الخطأ بدل الفشل الصامت)
    const { error: viewErr } = await supabase.rpc('increment_request_views', { request_id: req.id });
    if (viewErr) console.log('increment_request_views error:', viewErr.message);
  };

  const rejectRequest = async (requestId) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    // سجّل الرفض في القاعدة (دائم وعبر كل الأجهزة). المفتاح الأساسي يمنع التكرار.
    const { error: insErr } = await supabase
      .from('request_rejections')
      .insert({ request_id: requestId, seller_id: user.id });
    // زِد عداد الاعتذار للمشتري مرة واحدة فقط (عند أول رفض = عند عدم وجود تعارض)
    if (!insErr) {
      const { error: rejErr } = await supabase.rpc('increment_request_rejections', { request_id: requestId });
      if (rejErr) console.log('increment_request_rejections error:', rejErr.message);
    }
    setRequests(requests.filter(r => r.id !== requestId));
    if (Platform.OS === 'web') alert("تم تسجيل اعتذارك للمشتري وإخفاء الطلب من عندك.");
    else Alert.alert("تم الاعتذار", "تم تسجيل اعتذارك للمشتري وإخفاء الطلب من عندك.");
  };

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true, // ✅ لازم للرفع المضمون
    });

    if (!result.canceled && result.assets[0].base64) {
      uploadImage(result.assets[0].uri, result.assets[0].base64);
    }
  };

  const uploadImage = async (uri, base64Data) => {
    setImageUri(uri); // Immediate visual feedback
    setImageUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `uploads/${user.id}/seller_${Date.now()}.jpg`;

      // ✅ استخدام base64 مباشرة — أكثر موثوقية
      const { data, error } = await supabase.storage
        .from('parts_images')
        .upload(filePath, decode(base64Data), { contentType: 'image/jpeg', upsert: true });
        
      if (error) {
         console.log("Seller upload error:", error);
         Alert.alert("خطأ في رفع الصورة", error.message);
         setImageUri(null);
         setPublicImageUrl("");
      } else {
         const { data: { publicUrl } } = supabase.storage.from('parts_images').getPublicUrl(filePath);
         // ✅ cache-buster لضمان ظهور الصورة
         setPublicImageUrl(`${publicUrl}?t=${Date.now()}`);
      }
    } catch (e) {
      console.log("Seller catch error:", e);
      setImageUri(null);
      setPublicImageUrl("");
    } finally {
      setImageUploading(false);
    }
  };

  const submitOffer = async () => {
    // ✅ FIX: إزالة focus قبل الإرسال
    Keyboard.dismiss();

    if (!offerPrice) {
      Alert.alert("تنبيه", "الرجاء إدخال السعر أولاً");
      return;
    }

    setSubmitting(true);
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes?.user;

      if (!user) {
        setSubmitting(false);
        Alert.alert("خطأ", "يجب تسجيل الدخول أولاً.");
        return;
      }

      // V3.4: Blocked check for sellers
      const { data: profile, error: profileError } = await supabase.from('profiles').select('is_blocked').eq('id', user.id).single();
      
      if (profileError || !profile) {
        setSubmitting(false);
        Alert.alert("تنبيه", "تعذر التحقق من حالة حسابك، حاول مجدداً.");
        return;
      }

      if (profile.is_blocked) {
        setSubmitting(false);
        Alert.alert("تنبيه 🚫", "حسابك محظور من قبل الإدارة، لا يمكنك تقديم عروض حالياً.");
        return;
      }

      const { error } = await supabase
        .from('responses')
        .insert([
          {
            request_id: selectedRequestId,
            seller_id: user.id,
            price: parseFloat(offerPrice),
            notes: offerNotes,
            image_url: publicImageUrl,
            warranty_duration: warranty,
            condition: condition
          }
        ]);

      setSubmitting(false); // Reset BEFORE alert

      if (error) {
        Alert.alert('خطأ', error.message);
      } else {
        Alert.alert('تم الإرسال 💸', 'تم إرسال تسعيرتك بنجاح!');
        setModalVisible(false);
      }
    } catch (err) {
      setSubmitting(false);
      Alert.alert("خطأ تقني", "فشل الاتصال بالسيرفر، يرجى المحاولة لاحقاً.");
    }
  };

  const calculateDate = (timestamp) => formatArDate(timestamp);

  const DashedLine = () => <View style={{height: 1, borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', marginVertical: 15}} />;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <View style={{flexDirection: 'row', gap: 10}}>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
               <Ionicons name="log-out-outline" size={24} color="#FF3B30" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigate('Profile')} style={[styles.logoutBtn, {marginRight: 10}]}>
               <Ionicons name="person-circle-outline" size={26} color="#00D8FF" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setSettingsModalVisible(true)} style={styles.logoutBtn}>
               <Ionicons name="settings-outline" size={24} color="#00D8FF" />
            </TouchableOpacity>
          </View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={styles.headerTitle}>طلبات السوق</Text>
            <Ionicons name="trending-up" size={32} color="#00D8FF" style={{marginLeft: 8}}/>
          </View>
        </View>

        <View style={{flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 15}}>
          <Text style={styles.headerSubtitle}>هذه الطلبات أُرسلت من مشترين يبحثون عن قطع الآن</Text>
          <View style={{flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: sellerProfile.is_online ? '#1e3816' : '#222', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20}}>
             <View style={{width: 8, height: 8, borderRadius: 4, backgroundColor: sellerProfile.is_online ? '#6eff35' : '#888', marginLeft: 6}} />
             <Text style={{color: sellerProfile.is_online ? '#6eff35' : '#888', fontSize: 11, fontWeight: 'bold'}}>{sellerProfile.is_online ? 'متصل' : 'متوقف'}</Text>
          </View>
        </View>
      </View>

      {/* شريط التبويب: الطلبات / محادثاتي */}
      <View style={{flexDirection: 'row-reverse', backgroundColor: '#0A0A0A', paddingHorizontal: 16, paddingBottom: 12, gap: 10}}>
        <TouchableOpacity
          style={{flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, gap: 6, backgroundColor: activeView === 'requests' ? '#00D8FF' : '#111', borderWidth: 1, borderColor: activeView === 'requests' ? '#00D8FF' : '#222'}}
          onPress={() => setActiveView('requests')}
        >
          <Ionicons name="list" size={18} color={activeView === 'requests' ? '#000' : '#888'} />
          <Text style={{fontWeight: 'bold', fontSize: 14, color: activeView === 'requests' ? '#000' : '#888'}}>الطلبات</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={{flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 14, gap: 6, backgroundColor: activeView === 'chats' ? '#00D8FF' : '#111', borderWidth: 1, borderColor: activeView === 'chats' ? '#00D8FF' : '#222'}}
          onPress={() => setActiveView('chats')}
        >
          <Ionicons name="chatbubbles" size={18} color={activeView === 'chats' ? '#000' : '#888'} />
          <Text style={{fontWeight: 'bold', fontSize: 14, color: activeView === 'chats' ? '#000' : '#888'}}>محادثاتي</Text>
        </TouchableOpacity>
      </View>

      {activeView === 'chats' ? (
        <View style={{flex: 1, padding: 16}}>
          {chatsLoading ? (
            <ActivityIndicator size="large" color="#00D8FF" style={{marginTop: 50}} />
          ) : conversations.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="chatbubbles-outline" size={50} color="#00D8FF" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد محادثات بعد</Text>
              <Text style={styles.emptySub}>تبدأ المحادثة عندما تتواصل مع مشترٍ من داخل طلبه.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false}>
              {conversations.map((c) => (
                <TouchableOpacity key={c.key} style={[styles.glassCard, {paddingVertical: 16}]} onPress={() => navigate('Chat', { request_id: c.request_id, receiver_id: c.other_id, other_party_name: c.other?.display_name || c.other?.email || 'المشتري' })}>
                  <View style={{flexDirection: 'row-reverse', alignItems: 'center', gap: 12}}>
                    <View style={{width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(0,216,255,0.1)', justifyContent: 'center', alignItems: 'center'}}>
                      <Ionicons name="person" size={24} color="#00D8FF" />
                    </View>
                    <View style={{flex: 1}}>
                      <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 15, textAlign: 'right'}}>{c.other?.display_name || c.other?.email || 'المشتري'}</Text>
                      <Text numberOfLines={1} style={{color: '#888', fontSize: 13, textAlign: 'right', marginTop: 4}}>
                        {c.last?.image_url ? '📷 صورة' : (c.last?.file_url ? '📎 ملف' : (c.last?.content || ''))}
                      </Text>
                    </View>
                    <Ionicons name="chevron-back" size={20} color="#555" />
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      ) : loading ? (
        <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
           <ActivityIndicator size="large" color="#00D8FF" />
        </View>
      ) : (
        <ScrollView 
          contentContainerStyle={styles.container} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#00D8FF" colors={['#00D8FF']} />
          }
        >
          {requests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                 <Ionicons name="notifications-off-outline" size={50} color="#00D8FF" />
              </View>
              <Text style={styles.emptyTitle}>لا توجد طلبات جديدة</Text>
              <Text style={styles.emptySub}>سيتم عرض طلبات القطع الخاصة بماركاتك المختارة فور وصولها. يرجى التأكد من تشغيل التنبيهات.</Text>
            </View>
          ) : (
            requests.map((req) => (
              <View key={req.id} style={styles.glassCard}>
                <View style={styles.cardHeader}>
                  <View style={styles.brandBadge}>
                    <Ionicons name="car-sport" size={14} color="#00D8FF" style={{marginRight: 6}}/>
                    <Text style={styles.brandText}>{req.car_brand}</Text>
                  </View>
                  <Text style={styles.timeText}>{calculateDate(req.created_at)}</Text>
                </View>

                {/* Displaying Region and VIN dynamically side by side */}
                <View style={{flexDirection: 'row-reverse', gap: 10, alignSelf: 'flex-end', marginBottom: 10}}>
                  {req.region ? (
                     <View style={styles.infoBadge}><Ionicons name="location" size={12} color="#AAA" /><Text style={styles.infoBadgeText}>{req.region}</Text></View>
                  ) : null}
                  {req.vin_number ? (
                     <View style={styles.infoBadge}><Ionicons name="barcode" size={12} color="#AAA" /><Text style={styles.infoBadgeText}>{req.vin_number}</Text></View>
                  ) : null}
                </View>

                <Text style={styles.yearText}>موديل: {req.model_year}</Text>
                <Text style={styles.detailsText}>{req.part_details}</Text>

                {/* Buyer Image Display */}
                {req.image_url ? (
                   <TouchableOpacity onPress={() => { setSelectedFullImage(req.image_url); setFullImageModal(true); }}>
                      <Image source={{uri: req.image_url}} style={{width: '100%', height: 180, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#333'}} />
                   </TouchableOpacity>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity style={styles.offerButton} onPress={() => openOfferModal(req)}>
                    <Text style={styles.buttonText}>تقديم تسعيرة وحل</Text>
                    <Ionicons name="cash-outline" size={20} color="#000" style={{marginLeft: 8}}/>
                  </TouchableOpacity>
                  
                  <View style={{flexDirection: 'row', gap: 10}}>
                     <TouchableOpacity 
                       style={styles.chatButton}
                       onPress={() => navigate('Chat', { request_id: req.id, receiver_id: req.buyer_id, other_party_name: 'المشتري' })}
                     >
                        <Ionicons name="chatbubbles-outline" size={20} color="#FFF" />
                     </TouchableOpacity>

                     <TouchableOpacity 
                       style={[styles.chatButton, {borderColor: '#FF3B30'}]}
                       onPress={() => rejectRequest(req.id)}
                     >
                        <Ionicons name="close-circle-outline" size={20} color="#FF3B30" />
                     </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}

      {/* Modern Modal for Offers with Image Upload */}
      <Modal visible={modalVisible} transparent={true} animationType="fade">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{width: '100%', alignItems: 'center'}}>
            <View style={styles.modalContent}>
              <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 20}}>
                <Text style={styles.modalTitle}>تقديم تسعيرة للقطعة</Text>
                <Ionicons name="pricetag" size={24} color="#00D8FF" style={{marginLeft: 8}}/>
              </View>
              
              <Text style={styles.label}>السعر (ريال)</Text>
              <View style={styles.inputWrapper}>
                <Text style={{color: '#666', fontSize: 16}}>SAR</Text>
                <TextInput style={styles.input} keyboardType="numeric" placeholder="مثال: 500" placeholderTextColor="#555" value={offerPrice} onChangeText={setOfferPrice}/>
              </View>

              <View style={{flexDirection: 'row-reverse', gap: 10, marginTop: 15}}>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>مدة الضمان</Text>
                  <View style={styles.inputWrapper}>
                    <TextInput style={styles.input} placeholder="شهر، سنة..." placeholderTextColor="#555" value={warranty} onChangeText={setWarranty}/>
                  </View>
                </View>
                <View style={{flex: 1}}>
                  <Text style={styles.label}>حالة القطعة</Text>
                  <View style={{flexDirection: 'row-reverse', gap: 5}}>
                    <TouchableOpacity 
                      style={[styles.conditionChip, condition === 'used' && styles.conditionChipActive]} 
                      onPress={() => setCondition('used')}
                    >
                      <Text style={[styles.conditionText, condition === 'used' && styles.conditionTextActive]}>مستعمل</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.conditionChip, condition === 'new' && styles.conditionChipActive]} 
                      onPress={() => setCondition('new')}
                    >
                      <Text style={[styles.conditionText, condition === 'new' && styles.conditionTextActive]}>جديد</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <Text style={styles.label}>ملاحظات إضافية</Text>
              <View style={[styles.inputWrapper, {alignItems: 'flex-start', paddingTop: 10, marginTop: 10}]}>
                <TextInput style={[styles.input, {height: 60, textAlignVertical: 'top'}]} multiline={true} placeholder="أصلية، نظيفة، معتمدة..." placeholderTextColor="#555" value={offerNotes} onChangeText={setOfferNotes}/>
              </View>

              {/* Seller Image Upload Option */}
              <Text style={styles.label}>دعم عرضك بصورة القطعة (اختياري)</Text>
              <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} disabled={imageUploading}>
                 {imageUploading ? (
                    <ActivityIndicator size="small" color="#00D8FF" />
                 ) : imageUri ? (
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <Image source={{uri: imageUri}} style={{width: 40, height: 40, borderRadius: 8, marginLeft: 10}} />
                       <Text style={{color: '#FFF', fontWeight: 'bold'}}>تم إرفاق الصورة بحمد الله ✅</Text>
                    </View>
                 ) : (
                    <View style={{flexDirection: 'row', alignItems: 'center'}}>
                       <Ionicons name="camera" size={24} color="#00D8FF" style={{marginLeft: 10}}/>
                       <Text style={{color: '#888', fontWeight: 'bold'}}>صوّر القطعة للزبون</Text>
                    </View>
                 )}
              </TouchableOpacity>

              <View style={{flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 25}}>
                 <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#00D8FF'}]} onPress={submitOffer} disabled={submitting || imageUploading}>
                   {submitting ? (
                     <ActivityIndicator size="small" color="#000" />
                   ) : (
                     <View style={{flexDirection: 'row', alignItems: 'center'}}>
                        <Text style={{color: '#000', fontWeight: '900', fontSize: 16}}>إرسال العرض</Text>
                        <Ionicons name="send" size={16} color="#000" style={{marginLeft: 8}}/>
                     </View>
                   )}
                 </TouchableOpacity>

                 <TouchableOpacity style={[styles.modalBtn, {backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333'}]} onPress={() => setModalVisible(false)}>
                   <Text style={{color: '#FFF', fontWeight: 'bold', fontSize: 16}}>تراجع</Text>
                 </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Full Screen Viewer for Images */}
      <Modal visible={fullImageModal} transparent={true} animationType="fade">
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center'}}>
          <TouchableOpacity style={{position: 'absolute', top: 50, right: 20}} onPress={() => setFullImageModal(false)}>
             <Ionicons name="close" size={40} color="#FFF" />
          </TouchableOpacity>
          {selectedFullImage && <Image source={{uri: selectedFullImage}} style={{width: '95%', height: '70%', resizeMode: 'contain'}} />}
        </View>
      </Modal>

      {/* Shop Settings Modal */}
      <Modal visible={settingsModalVisible} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, {height: '75%'}]}>
            <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
               <TouchableOpacity onPress={() => setSettingsModalVisible(false)}><Ionicons name="close-circle" size={28} color="#666" /></TouchableOpacity>
               <Text style={styles.modalTitle}>إعدادات المتجر 🏪</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
               <View style={styles.settingRow}>
                  <View>
                    <Text style={styles.settingTitle}>حالة المتجر (استقبال تنبيهات)</Text>
                    <Text style={styles.settingSub}>{sellerProfile.is_online ? 'أنت الآن تستقبل طلبات جديدة' : 'متوقف مؤقتاً عن استقبال الطلبات'}</Text>
                  </View>
                  <Switch 
                     value={sellerProfile.is_online} 
                     onValueChange={(val) => saveSellerProfile({ is_online: val })}
                     trackColor={{ false: "#333", true: "#00D8FF33" }}
                     thumbColor={sellerProfile.is_online ? "#00D8FF" : "#888"}
                  />
               </View>

               <DashedLine />

               <View style={styles.formSection}>
                  <Text style={styles.label}>الماركات المتخصص بها (الفلترة الذكية)</Text>
                  <Text style={{color: '#666', textAlign: 'right', marginBottom: 15, fontSize: 12}}>ستصلك فقط تنبيهات السيارات التي تختارها هنا.</Text>
                  
                  <View style={styles.brandsSelectionGrid}>
                     {allBrands.map(brand => {
                        const isHandled = sellerProfile.handled_brands.includes(brand.name);
                        return (
                           <TouchableOpacity 
                              key={brand.id} 
                              style={[styles.brandSelectChip, isHandled && styles.brandSelectChipActive]}
                              onPress={() => {
                                 const newList = isHandled 
                                    ? sellerProfile.handled_brands.filter(b => b !== brand.name)
                                    : [...sellerProfile.handled_brands, brand.name];
                                 saveSellerProfile({ handled_brands: newList });
                              }}
                           >
                              <Text style={[styles.brandSelectText, isHandled && styles.brandSelectTextActive]}>{brand.name}</Text>
                              {isHandled && <Ionicons name="checkmark" size={14} color="#000" />}
                           </TouchableOpacity>
                        );
                     })}
                  </View>
                  {sellerProfile.handled_brands.length === 0 && (
                     <View style={{backgroundColor: '#1a1811', padding: 10, borderRadius: 10, marginTop: 10, borderWidth: 1, borderColor: '#3d3012'}}>
                        <Text style={{color: '#ffcc00', fontSize: 12, textAlign: 'right'}}>⚠️ لم تختر أي ماركة، سيظهر لك "كل الطلبات" من جميع الماركات.</Text>
                     </View>
                  )}
               </View>

               <View style={{marginTop: 30, backgroundColor: '#111', padding: 15, borderRadius: 15}}>
                  <Text style={{color: '#555', textAlign: 'center', fontSize: 13}}>تقييم متجرك الحالي: ⭐ {sellerProfile.rating || '5.0'}</Text>
               </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Premium Glass Loading Overlay */}
      {(loading || submitting) && (
        <View style={styles.glassOverlay}>
           <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#00D8FF" />
              <Text style={styles.loaderText}>جاري تحديث البيانات...</Text>
              <Text style={styles.loaderSub}>يرجى الانتظار، نحن نربطك بأفضل العروض</Text>
           </View>
        </View>
      )}

      <StatusBar barStyle="light-content" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070707' },
  header: { padding: 24, paddingTop: 50, paddingBottom: 20, backgroundColor: '#0A0A0A' },
  headerTitle: { fontSize: 28, fontWeight: '900', color: '#FFF', letterSpacing: 1 },
  headerSubtitle: { fontSize: 14, color: '#888', textAlign: 'right', marginTop: 5 },
  logoutBtn: { backgroundColor: '#1A1A1A', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  container: { padding: 16, paddingBottom: 40 },
  glassCard: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  brandBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0, 216, 255, 0.1)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(0, 216, 255, 0.3)' },
  brandText: { color: '#00D8FF', fontWeight: '900', fontSize: 14 },
  timeText: { color: '#666', fontSize: 12 },
  
  infoBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  infoBadgeText: { color: '#AAA', fontSize: 12, fontWeight: '600', marginLeft: 6, letterSpacing: 1 },

  yearText: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  detailsText: { color: '#CCC', fontSize: 16, textAlign: 'right', marginBottom: 20, lineHeight: 26 },
  actionRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  offerButton: { flexDirection: 'row', backgroundColor: '#00D8FF', paddingVertical: 14, paddingHorizontal: 20, borderRadius: 14, flex: 1, marginLeft: 10, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#000', fontWeight: '900', fontSize: 16 },
  chatButton: { backgroundColor: '#1A1A1A', paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#111', borderRadius: 24, padding: 24, width: '100%', borderWidth: 1, borderColor: '#222' },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#FFF', textAlign: 'right' },
  label: { color: '#FFF', fontWeight: '700', fontSize: 13, marginBottom: 10, textAlign: 'right', marginTop: 10 },
  inputWrapper: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#0A0A0A', borderWidth: 1, borderColor: '#222', borderRadius: 16, paddingHorizontal: 15 },
  input: { flex: 1, paddingVertical: 16, color: '#FFF', fontSize: 15, textAlign: 'right', marginRight: 10 },
  
  imagePickerBtn: { backgroundColor: '#1A1A1A', borderWidth: 1, borderColor: '#333', borderStyle: 'dashed', borderRadius: 16, padding: 12, alignItems: 'center', justifyContent: 'center' },
  modalBtn: { paddingVertical: 16, borderRadius: 16, flex: 1, marginHorizontal: 5, alignItems: 'center', justifyContent: 'center' },

  // V2 Specific Styles
  conditionChip: { backgroundColor: '#1A1A1A', paddingVertical: 10, paddingHorizontal: 15, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  conditionChipActive: { backgroundColor: '#00D8FF', borderColor: '#00D8FF' },
  conditionText: { color: '#888', fontWeight: 'bold', fontSize: 13 },
  conditionTextActive: { color: '#000' },

  settingRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  settingTitle: { color: '#FFF', fontWeight: 'bold', textAlign: 'right', fontSize: 16 },
  settingSub: { color: '#666', textAlign: 'right', fontSize: 12, marginTop: 4 },

  brandsSelectionGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  brandSelectChip: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#111', borderColor: '#333', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, gap: 5, borderWidth: 1 },
  brandSelectChipActive: { backgroundColor: '#00D8FF', borderColor: '#00D8FF' },
  brandSelectText: { color: '#888', fontSize: 13, fontWeight: 'bold' },
  brandSelectTextActive: { color: '#000' },
  formSection: { marginTop: 20 },

  // V3.0 Premium UI Styles
  glassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  loaderBox: { backgroundColor: '#111', padding: 30, borderRadius: 30, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  loaderText: { color: '#FFF', marginTop: 15, fontWeight: 'bold', fontSize: 17 },
  loaderSub: { color: '#666', marginTop: 8, fontSize: 12, textAlign: 'center' },

  emptyContainer: { alignItems: 'center', marginTop: 80, padding: 30 },
  emptyIconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(0, 216, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  emptyTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
  emptySub: { color: '#777', textAlign: 'center', lineHeight: 22, fontSize: 14 }
});
