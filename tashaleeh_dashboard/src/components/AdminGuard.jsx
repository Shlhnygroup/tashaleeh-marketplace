import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { ShieldAlert, LogIn, Loader2 } from 'lucide-react';

export default function AdminGuard({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    checkUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchProfile(session.user.id);
      else setProfile(null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setUser(session?.user ?? null);
    if (session?.user) await fetchProfile(session.user.id);
    setLoading(false);
  };

  const fetchProfile = async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (data) setProfile(data);
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setAuthError('');
    
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (error) {
      setAuthError(error.message);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#070707', color: '#FFF'}}>
        <Loader2 size={50} className="spinning" color="#00D8FF" />
        <p style={{marginTop: 20, fontWeight: 'bold'}}>جاري التحقق من الصلاحيات...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="login-container" style={{height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#070707'}}>
        <div className="login-card" style={{backgroundColor: '#0A0A0A', padding: 40, borderRadius: 24, width: 400, border: '1px solid #1A1A1A'}}>
          <div style={{textAlign: 'center', marginBottom: 30}}>
             <ShieldAlert size={60} color="#00D8FF" style={{marginBottom: 15}}/>
             <h2 style={{color: '#FFF'}}>لوحة تحكم الإدارة</h2>
             <p style={{color: '#666', fontSize: 13}}>يرجى تسجيل الدخول بحساب "أدمن" للمتابعة</p>
          </div>
          
          <form onSubmit={handleLogin}>
            <div className="form-group" style={{marginBottom: 15}}>
              <input 
                type="email" 
                className="dark-input" 
                placeholder="البريد الإلكتروني" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group" style={{marginBottom: 20}}>
              <input 
                type="password" 
                className="dark-input" 
                placeholder="كلمة المرور" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
              />
            </div>
            {authError && <p style={{color: '#FF3B30', fontSize: 12, marginBottom: 15, textAlign: 'center'}}>{authError}</p>}
            <button type="submit" className="save-btn" style={{width: '100%', justifyContent: 'center'}}>
               تسجيل الدخول <LogIn size={18} style={{marginLeft: 8}}/>
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'Admin') {
    return (
      <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#070707', color: '#FFF', textAlign: 'center', padding: 20}}>
        <ShieldAlert size={80} color="#FF3B30" style={{marginBottom: 20}}/>
        <h1 style={{fontSize: 28, fontWeight: '900'}}>غير مصرح لك بالدخول! 🚫</h1>
        <p style={{color: '#888', maxWidth: 400, margin: '20px 0', lineHeight: 1.6}}>
           حسابك لا يمتلك صلاحيات "Admin". إذا كنت تعتقد أن هذا خطأ، يرجى مراجعة مدير النظام.
        </p>
        <button className="save-btn" onClick={() => supabase.auth.signOut()}>الخروج والعودة</button>
      </div>
    );
  }

  if (profile.is_blocked) {
    return (
      <div style={{height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#070707', color: '#FFF', textAlign: 'center', padding: 20}}>
        <ShieldAlert size={80} color="#FF3B30" style={{marginBottom: 20}}/>
        <h1 style={{fontSize: 28, fontWeight: '900'}}>تم حظر حسابك! 🚫</h1>
        <p style={{color: '#888', maxWidth: 400, margin: '20px 0', lineHeight: 1.6}}>
           يؤسفنا إبلاغك بأن حسابك قد تم إيقافه تماماً من قبل الإدارة لمخالفة السياسات.
        </p>
        <button className="save-btn" onClick={() => supabase.auth.signOut()}>الخروج</button>
      </div>
    );
  }

  return children;
}
