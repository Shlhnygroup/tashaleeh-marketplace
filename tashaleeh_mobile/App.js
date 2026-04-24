import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert, Text, TouchableOpacity } from 'react-native';
import { supabase } from './supabase';
import AuthScreen from './AuthScreen';
import BuyerScreen from './BuyerScreen';
import SellerScreen from './SellerScreen';
import ChatScreen from './ChatScreen'; 
import ProfileScreen from './ProfileScreen';

export default function App() {
  const [session, setSession] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  
  // Custom MVP Navigation State
  const [currentRoute, setCurrentRoute] = useState({ name: 'Home', params: {} });

  const navigate = (name, params = {}) => {
    setCurrentRoute({ name, params });
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      extractRole(session);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      extractRole(session);
      if (session) {
        setCurrentRoute({ name: 'Home', params: {} }); // reset to home on login
      }
    });
  }, []);

  const extractRole = async (sess) => {
    if (sess && sess.user) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, is_blocked')
        .eq('id', sess.user.id)
        .single();
      
      if (data) {
        if (data.is_blocked) {
          setIsBlocked(true);
          setLoading(false);
          return;
        }
        setIsBlocked(false);
        setRole(data.role || sess.user.user_metadata?.role);
      } else {
        setRole(sess.user.user_metadata?.role);
      }
    } else {
      setIsBlocked(false);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <View style={{flex: 1, backgroundColor: '#070707', justifyContent: 'center', alignItems: 'center'}}>
        <ActivityIndicator size="large" color="#FF8C00" />
      </View>
    );
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (isBlocked) {
    return (
      <View style={{flex: 1, backgroundColor: '#070707', justifyContent: 'center', alignItems: 'center', padding: 25}}>
         <View style={{backgroundColor: '#0F0F0F', padding: 35, borderRadius: 30, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#FF3B30'}}>
            <View style={{width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(255, 59, 48, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25}}>
               <Text style={{fontSize: 40}}>🚫</Text>
            </View>
            
            <View style={{alignItems: 'center', marginBottom: 30}}>
               <Text style={{color: '#FF3B30', fontSize: 28, fontWeight: '900', textAlign: 'center', marginBottom: 10}}>حسابك محظور!</Text>
               <Text style={{color: '#888', fontSize: 16, textAlign: 'center', lineHeight: 24}}>
                  يؤسفنا إبلاغك بأن حسابك قد تم إيقافه تماماً من قبل الإدارة.
               </Text>
            </View>

            <View style={{backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 20, width: '100%', marginBottom: 35, borderWidth: 1, borderColor: '#1A1A1A'}}>
               <Text style={{color: '#FFF', fontSize: 16, textAlign: 'center', fontWeight: 'bold', marginBottom: 5}}>السبب والإجراء المطلوب:</Text>
               <Text style={{color: '#FF8C00', fontSize: 15, textAlign: 'center'}}>
                  محظور راجع الادارة لمعرفة الاسباب والاعتراض
               </Text>
            </View>

            <TouchableOpacity 
              style={{backgroundColor: '#FF3B30', width: '100%', height: 55, borderRadius: 15, justifyContent: 'center', alignItems: 'center', marginBottom: 15}}
              onPress={() => Alert.alert("تواصل مع الإدارة", "يرجى مراسلتنا عبر الواتساب برقم هاتفك المسجل لمراجعة حالتك.")}
            >
               <Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>تواصل مع الدعم الفني</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{width: '100%', height: 50, borderRadius: 15, borderWidth: 1, borderColor: '#333', justifyContent: 'center', alignItems: 'center'}} 
              onPress={() => supabase.auth.signOut()}
            >
               <Text style={{color: '#666', fontSize: 14, fontWeight: 'bold'}}>تسجيل الخروج</Text>
            </TouchableOpacity>
         </View>
      </View>
    );
  }

  // Basic Router Switch
  if (currentRoute.name === 'Chat') {
    return <ChatScreen navigate={navigate} params={currentRoute.params} currentUser={session.user} currentRole={role} />;
  }

  if (currentRoute.name === 'Profile') {
    return <ProfileScreen navigate={navigate} currentUser={session.user} />;
  }

  // Home Routes
  if (role === 'Buyer') {
    return <BuyerScreen navigate={navigate} />;
  }

  if (role === 'Seller') {
    return <SellerScreen navigate={navigate} />;
  }

  if (role === 'Admin') {
    return (
      <View style={{flex: 1, backgroundColor: '#070707', justifyContent: 'center', alignItems: 'center', padding: 25}}>
         <View style={{backgroundColor: '#0F0F0F', padding: 35, borderRadius: 30, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#00D8FF'}}>
            <View style={{width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0, 216, 255, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 25}}>
               <Text style={{fontSize: 40}}>🛡️</Text>
            </View>
            <Text style={{color: '#00D8FF', fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 10}}>مرحباً بالأدمن</Text>
            <Text style={{color: '#888', fontSize: 15, textAlign: 'center', lineHeight: 24, marginBottom: 30}}>
               لوحة التحكم متاحة عبر المتصفح فقط على العنوان التالي:
            </Text>
            <View style={{backgroundColor: 'rgba(0,216,255,0.05)', padding: 15, borderRadius: 15, marginBottom: 30, width: '100%', borderWidth: 1, borderColor: 'rgba(0,216,255,0.2)'}}>
               <Text style={{color: '#00D8FF', fontWeight: 'bold', textAlign: 'center', fontSize: 14}}>localhost:5173</Text>
            </View>
            <TouchableOpacity
              style={{backgroundColor: '#FF3B30', width: '100%', height: 52, borderRadius: 15, justifyContent: 'center', alignItems: 'center'}}
              onPress={() => supabase.auth.signOut()}
            >
               <Text style={{color: '#FFF', fontSize: 16, fontWeight: 'bold'}}>تسجيل الخروج</Text>
            </TouchableOpacity>
         </View>
      </View>
    );
  }

  return (
    <View style={{flex: 1, backgroundColor: '#070707', justifyContent: 'center', alignItems: 'center'}}>
       <ActivityIndicator size="large" color="#00D8FF" />
    </View>
  );
}
