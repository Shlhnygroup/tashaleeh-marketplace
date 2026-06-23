import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ScrollView, SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, Modal, Image, Linking, Alert, Keyboard } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { supabase } from './supabase';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import { formatArTime, COLORS } from './utils';

export default function ChatScreen({ navigate, params, currentUser, currentRole }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollViewRef = useRef();

  // Image Support
  const [imageUri, setImageUri] = useState(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [publicImageUrl, setPublicImageUrl] = useState("");
  const [fullImageModal, setFullImageModal] = useState(false);
  const [selectedFullImage, setSelectedFullImage] = useState(null);
  
  // File & Menu Support (V3.0)
  const [fileUri, setFileUri] = useState(null);
  const [fileName, setFileName] = useState("");
  const [fileUploading, setFileUploading] = useState(false);
  const [publicFileUrl, setPublicFileUrl] = useState("");
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false); // For Global Loading Overlay

  const primaryColor = currentRole === 'Buyer' ? '#FF8C00' : '#00D8FF';

  // Extract navigation parameters
  const request_id = params?.request_id;
  const receiver_id = params?.receiver_id;
  const targetName = params?.other_party_name || 'العميل';

  useEffect(() => {
    if (!request_id || !receiver_id || !currentUser?.id) return; // حارس: لا تشترك قبل توفّر معرّفات المحادثة
    fetchMessages();

    // Subscribe to new real-time messages for this request
    const subscription = supabase
      .channel(`chat_${request_id}_${[currentUser.id, receiver_id].sort().join('-')}`) // Standardized channel name
      .on('postgres_changes', { 
         event: 'INSERT', 
         schema: 'public', 
         table: 'messages',
         filter: `request_id=eq.${request_id}`
      }, payload => {
         const newMsg = payload.new;
         // RLS will ensure we only get messages meant for us, 
         // but we still filter for this specific conversation in the UI.
         const isRelevant = 
           (newMsg.sender_id === currentUser.id && newMsg.receiver_id === receiver_id) ||
           (newMsg.sender_id === receiver_id && newMsg.receiver_id === currentUser.id);
           
         if (isRelevant) {
           // منع تكرار الرسالة لو وصل نفس الحدث مرتين
           setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]);
           scrollToBottom();
         }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [request_id, receiver_id, currentUser?.id]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      // Fetch only messages where current user and target user are the participants
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('request_id', request_id)
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${receiver_id}),and(sender_id.eq.${receiver_id},receiver_id.eq.${currentUser.id})`)
        .order('created_at', { ascending: true });

      if (!error && data) {
        setMessages(data);
      }
    } catch (err) {
      console.log('Error fetching messages: ', err);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };
  const pickImage = async () => {
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 4],
        quality: 0.5,
        base64: true, // ✅ لازم لرفع موثوق
      });

      if (!result.canceled && result.assets[0].base64) {
        uploadImage(result.assets[0].uri, result.assets[0].base64);
      }
    } catch (e) {
      Alert.alert("خطأ في اختيار الصورة", e.message);
    }
  };

  const uploadImage = async (uri, base64Data) => {
    setImageUri(uri); // Preview فوري
    setIsProcessing(true);
    setImageUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const filePath = `uploads/${user.id}/chat_${Date.now()}.jpg`;

      // ✅ base64 مباشرة — أكثر موثوقية من blob في React Native
      const { data, error } = await supabase.storage
        .from('parts_images')
        .upload(filePath, decode(base64Data), { contentType: 'image/jpeg', upsert: true });
        
      if (error) {
         console.log("Upload Error:", error);
         Alert.alert("فشل الرفع للمخدّم", error.message);
         setImageUri(null);
         setPublicImageUrl("");
      } else {
         const { data: { publicUrl } } = supabase.storage.from('parts_images').getPublicUrl(filePath);
         // ✅ cache-buster لضمان ظهور الصورة فوراً
         setPublicImageUrl(`${publicUrl}?t=${Date.now()}`);
      }
    } catch (e) {
      console.log("Image processing failed:", e);
      Alert.alert("خطأ تقني", e.message);
      setImageUri(null);
      setPublicImageUrl("");
    } finally {
      setImageUploading(false);
      setIsProcessing(false);
    }
  };

  const pickDocument = async () => {
    setAttachmentMenu(false);
    let result = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true
    });

    if (!result.canceled) {
      setFileName(result.assets[0].name);
      uploadFile(result.assets[0]);
    }
  };

  const uploadFile = async (fileAsset) => {
    setIsProcessing(true);
    setFileUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = fileAsset.name.split('.').pop();
      const filePath = `chat_files/${user.id}_${Date.now()}.${fileExt}`;

      // Fetch the file as a blob
      const response = await fetch(fileAsset.uri);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('parts_images')
        .upload(filePath, blob, { contentType: fileAsset.mimeType || 'application/octet-stream' });
        
      if (error) {
         Alert.alert("خطأ في رفع الملف", error.message);
         console.log("Chat file upload error:", error);
      } else {
         const { data: { publicUrl } } = supabase.storage.from('parts_images').getPublicUrl(filePath);
         setPublicFileUrl(publicUrl);
         setFileUri(fileAsset.uri);
      }
    } catch (e) {
      console.log("File upload failed:", e);
      Alert.alert("خطأ", "تعذّر رفع الملف، حاول مرة أخرى.");
    } finally {
      setFileUploading(false);
      setIsProcessing(false);
    }
  };

  const sendMessage = async () => {
    // ✅ FIX: إزالة focus من TextInput قبل الإرسال (يصلح بق الضغط الأول في الويب)
    Keyboard.dismiss();
    if (inputText.trim() === '' && !publicImageUrl && !publicFileUrl) return;
    
    setIsProcessing(true);
    const newMessage = {
      request_id: request_id,
      sender_id: currentUser.id,
      receiver_id: receiver_id,
      content: inputText,
      image_url: publicImageUrl,
      file_url: publicFileUrl // Adding file support
    };

    // احفظ القيم لاسترجاعها لو فشل الإرسال (حتى لا تضيع الرسالة)
    const prev = { inputText, imageUri, publicImageUrl, fileUri, fileName, publicFileUrl };
    const restore = () => {
      setInputText(prev.inputText);
      setImageUri(prev.imageUri);
      setPublicImageUrl(prev.publicImageUrl);
      setFileUri(prev.fileUri);
      setFileName(prev.fileName);
      setPublicFileUrl(prev.publicFileUrl);
    };

    setInputText('');
    setImageUri(null);
    setPublicImageUrl("");
    setFileUri(null);
    setFileName("");
    setPublicFileUrl("");

    try {
      const { error } = await supabase.from('messages').insert([newMessage]);

      if (error) {
        restore();
        if (Platform.OS === 'web') alert('تعذّر إرسال الرسالة: ' + error.message);
        else Alert.alert('فشل الإرسال', 'تعذّر إرسال الرسالة، حاول مرة أخرى.');
      }
    } catch (err) {
      restore();
      if (Platform.OS === 'web') alert('فشل الاتصال، تعذّر إرسال الرسالة.');
      else Alert.alert('خطأ', 'فشل الاتصال، تعذّر إرسال الرسالة.');
    } finally {
      setIsProcessing(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      if(scrollViewRef.current) scrollViewRef.current.scrollToEnd({ animated: true });
    }, 200);
  };

  const formatTime = (ts) => formatArTime(ts);

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigate('Home')} style={styles.backBtn}>
            <Ionicons name="arrow-back-outline" size={24} color="#FFF" />
          </TouchableOpacity>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View>
              <Text style={styles.headerTitle}>{targetName}</Text>
              <Text style={[styles.headerSubtitle, {color: '#888'}]}>محادثة بخصوص الطلب</Text>
            </View>
            <View style={[styles.avatar, {borderColor: primaryColor}]}>
              <Ionicons name="person" size={24} color={primaryColor} />
            </View>
          </View>
        </View>

        {/* Chat Area */}
        {loading ? (
          <View style={{flex: 1, justifyContent: 'center', alignItems: 'center'}}>
             <ActivityIndicator size="large" color={primaryColor} />
          </View>
        ) : (
          <ScrollView 
            ref={scrollViewRef}
            contentContainerStyle={styles.chatArea}
            onContentSizeChange={scrollToBottom}
          >
            {messages.length === 0 ? (
               <Text style={{color: '#555', textAlign: 'center', marginTop: 50}}>لا توجد رسائل بينكم بعد. ابدأ التفاوض!</Text>
            ) : null}

            {messages.map((msg) => {
              const isMe = msg.sender_id === currentUser.id;
              return (
                <View key={msg.id} style={[styles.messageBubble, isMe ? [styles.myMessage, {backgroundColor: primaryColor}] : styles.theirMessage]}>
                  {msg.image_url ? (
                    <TouchableOpacity onPress={() => { setSelectedFullImage(msg.image_url); setFullImageModal(true); }}>
                      <Image source={{uri: msg.image_url}} style={{width: 200, height: 200, borderRadius: 12, marginBottom: 8}} />
                    </TouchableOpacity>
                  ) : null}
                  {msg.file_url ? (
                    <TouchableOpacity onPress={() => Linking.openURL(msg.file_url)} style={styles.fileBubble}>
                      <Ionicons name="document-attach-outline" size={24} color={isMe ? "#000" : "#FFF"} />
                      <Text style={[styles.fileText, {color: isMe ? "#000" : "#FFF"}]}>فتح الملف المرفق</Text>
                    </TouchableOpacity>
                  ) : null}
                  {msg.content ? (
                    <Text style={[styles.messageText, isMe ? styles.myMessageText : styles.theirMessageText]}>
                      {msg.content}
                    </Text>
                  ) : null}
                  <Text style={[styles.messageTime, isMe ? {color: 'rgba(0,0,0,0.6)'} : {}]}>{formatTime(msg.created_at)}</Text>
                </View>
              );
            })}
          </ScrollView>
        )}

        {/* Image Preview Area */}
        {imageUri && (
          <View style={styles.previewContainer}>
            <View style={styles.previewWrapper}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} />
              <TouchableOpacity 
                style={styles.removePreviewBtn} 
                onPress={() => {
                  setImageUri(null);
                  setPublicImageUrl('');
                }}
              >
                <Ionicons name="close-circle" size={24} color="#FF3B30" />
              </TouchableOpacity>
              {imageUploading && (
                 <View style={styles.previewLoading}>
                   <ActivityIndicator color={primaryColor} />
                 </View>
              )}
            </View>
          </View>
        )}

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TouchableOpacity 
            style={[styles.attachButton, {borderColor: primaryColor}]} 
            onPress={() => setAttachmentMenu(true)}
            disabled={imageUploading || fileUploading}
          >
            {imageUploading || fileUploading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : (
              <Ionicons name="add-circle-outline" size={24} color={primaryColor} />
            )}
          </TouchableOpacity>

          <TextInput 
            style={[styles.input, {borderColor: primaryColor}]}
            placeholder={imageUri ? "اضغط سهم الإرسال لرفع الصورة..." : (fileUri ? "تم إرفاق ملف، أرسل الآن..." : "اكتب رسالتك للمفاوضة...")}
            placeholderTextColor="#888"
            value={inputText}
            onChangeText={setInputText}
          />
          <TouchableOpacity 
            style={[styles.sendButton, {backgroundColor: primaryColor, opacity: (imageUploading || fileUploading) ? 0.5 : 1}]}
            onPress={sendMessage}
            disabled={imageUploading || fileUploading}
          >
            <Ionicons name="send" size={20} color="#000" />
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>

      {/* Attachment Menu Modal */}
      <Modal visible={attachmentMenu} transparent={true} animationType="slide">
        <View style={styles.modalOverlay}>
           <View style={styles.menuContent}>
              <Text style={styles.menuTitle}>إرفاق محتوى للدردشة</Text>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => { setAttachmentMenu(false); pickImage(); }}>
                 <Ionicons name="image-outline" size={24} color="#FFF" />
                 <Text style={styles.menuText}>صورة من المعرض</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={pickDocument}>
                 <Ionicons name="document-text-outline" size={24} color="#FFF" />
                 <Text style={styles.menuText}>مستند أو ملف</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.menuItem, {marginTop: 10, borderBottomWidth: 0}]} onPress={() => setAttachmentMenu(false)}>
                 <Text style={{color: '#FF3B30', fontWeight: 'bold'}}>إلغاء</Text>
              </TouchableOpacity>
           </View>
        </View>
      </Modal>

      {/* Image Viewer Modal */}
      <Modal visible={fullImageModal} transparent={true} animationType="fade">
        <View style={{flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center'}}>
          <TouchableOpacity style={{position: 'absolute', top: 50, right: 20}} onPress={() => setFullImageModal(false)}>
             <Ionicons name="close" size={40} color="#FFF" />
          </TouchableOpacity>
          {selectedFullImage && <Image source={{uri: selectedFullImage}} style={{width: '95%', height: '70%', resizeMode: 'contain'}} />}
        </View>
      </Modal>

      {/* Global Loading Overlay (Glassmorphism) */}
      {isProcessing && (
        <View style={styles.glassOverlay}>
           <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={styles.loaderText}>جاري المعالجة...</Text>
           </View>
        </View>
      )}

      <StatusBar style="light" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#070707' },
  container: { flex: 1 },
  header: { padding: 20, paddingTop: 50, paddingBottom: 15, backgroundColor: '#0A0A0A', borderBottomWidth: 1, borderBottomColor: '#1A1A1A', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  backBtn: { padding: 10, backgroundColor: '#111', borderRadius: 12, borderWidth: 1, borderColor: '#222' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#FFF', textAlign: 'right' },
  headerSubtitle: { fontSize: 12, marginTop: 4, textAlign: 'right' },
  avatar: { width: 45, height: 45, borderRadius: 25, borderWidth: 2, justifyContent: 'center', alignItems: 'center', marginLeft: 15, backgroundColor: '#111' },
  
  chatArea: { padding: 16, paddingBottom: 30 },
  messageBubble: { maxWidth: '80%', padding: 14, borderRadius: 20, marginBottom: 16 },
  myMessage: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  theirMessage: { backgroundColor: '#1A1A1A', alignSelf: 'flex-end', borderBottomRightRadius: 4, borderWidth: 1, borderColor: '#222' },
  messageText: { fontSize: 16, textAlign: 'right', lineHeight: 24 },
  myMessageText: { color: '#000', fontWeight: '700' },
  theirMessageText: { color: '#E0E0E0' },
  messageTime: { fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 8, textAlign: 'right' },
  
  inputContainer: { flexDirection: 'row-reverse', padding: 15, backgroundColor: '#0A0A0A', borderTopWidth: 1, borderTopColor: '#1A1A1A', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#111', borderWidth: 1, borderRadius: 24, paddingHorizontal: 20, fontSize: 16, color: '#FFF', textAlign: 'right', height: 45 },
  attachButton: { width: 45, height: 45, backgroundColor: '#111', borderRadius: 25, borderWidth: 1, justifyContent: 'center', alignItems: 'center', marginRight: 10 },
  sendButton: { width: 45, height: 45, justifyContent: 'center', alignItems: 'center', borderRadius: 25, marginLeft: 10, shadowColor: '#FFF', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
  
  previewContainer: { paddingHorizontal: 20, paddingBottom: 10, alignItems: 'flex-end' },
  previewWrapper: { width: 80, height: 80, borderRadius: 12, borderWidth: 2, borderColor: '#00D8FF', overflow: 'hidden', position: 'relative' },
  previewImage: { width: '100%', height: '100%' },
  removePreviewBtn: { position: 'absolute', top: -2, left: -2, zIndex: 10 },
  previewLoading: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  
  // V3.0 Styles
  fileBubble: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 10, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  fileText: { fontSize: 14, fontWeight: 'bold' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  menuContent: { backgroundColor: '#111', padding: 25, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  menuTitle: { color: '#888', textAlign: 'center', marginBottom: 20, fontSize: 13 },
  menuItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 15, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  menuText: { color: '#FFF', fontSize: 17, fontWeight: 'bold' },
  glassOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center', zIndex: 999 },
  loaderBox: { backgroundColor: '#111', padding: 30, borderRadius: 24, alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  loaderText: { color: '#FFF', marginTop: 15, fontWeight: 'bold' }
});
