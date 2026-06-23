import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Users, UserX, UserCheck, ShieldAlert, ShieldCheck } from 'lucide-react';

export default function UsersTab({ logAction }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('sellers'); // default to sellers

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('fetchUsers error:', error);
      alert('تعذّر جلب المستخدمين: ' + error.message);
    } else if (data) {
      setUsers(data);
    }
    setLoading(false);
  };

  const toggleBlock = async (user) => {
    const newStatus = !user.is_blocked;
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_blocked: newStatus })
        .eq('id', user.id);

      if (error) throw error;

      setUsers(users.map(u => u.id === user.id ? { ...u, is_blocked: newStatus } : u));
      
      // Notify success
      alert(newStatus ? `تم حظر ${user.email} بنجاح` : `تم إلغاء حظر ${user.email}`);

      logAction(newStatus ? 'BLOCK_USER' : 'UNBLOCK_USER', 'profile', user.id, { name: user.display_name, email: user.email });
    } catch (err) {
      console.error('Blocking error:', err);
      alert('فشل في تغيير حالة الحظر: ' + err.message);
    }
  };

  const toggleRole = async (user) => {
    if (user.role === 'Seller') {
       if(!window.confirm("تحويل هذا البائع إلى مشتري عادي؟")) return;
       updateRole(user.id, 'Buyer', user.role);
    } else {
       // Open Seller Registration Modal
       setActiveSellerUser(user);
       setShowSellerModal(true);
    }
  };

  const updateRole = async (id, newRole, oldRole, sellerData = null) => {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', id);
    if (error) {
      alert('تعذّر تغيير الرتبة: ' + error.message);
      return;
    }
    setUsers(users.map(u => u.id === id ? { ...u, role: newRole } : u));
    logAction('CHANGE_ROLE', 'profile', id, { oldRole, newRole, ...sellerData });
    if (newRole === 'Seller') {
      // حافظ على ماركات البائع السابقة إن كان له سجل قديم بدل تصفيرها
      const { data: existing } = await supabase.from('seller_profiles').select('handled_brands').eq('id', id).single();
      const { error: spError } = await supabase.from('seller_profiles').upsert([{
         id: id,
         handled_brands: existing?.handled_brands || [],
         is_online: true,
         manager_name: sellerData?.managerName || '',
         store_location: sellerData?.location || '',
         cr_document_url: sellerData?.cr || ''
      }]);
      if (spError) alert('تم تغيير الرتبة لكن تعذّر حفظ بيانات المتجر: ' + spError.message);
    }
  };

  const [showSellerModal, setShowSellerModal] = useState(false);
  const [activeSellerUser, setActiveSellerUser] = useState(null);
  const [sellerForm, setSellerForm] = useState({ cr: '', location: '', managerName: '' });

  const handleSellerSubmit = (e) => {
    e.preventDefault();
    updateRole(activeSellerUser.id, 'Seller', activeSellerUser.role, sellerForm);
    setShowSellerModal(false);
    setSellerForm({ cr: '', location: '', managerName: '' });
  };

  const filteredUsers = users.filter(u => {
    if (activeSubTab === 'blocked') return u.is_blocked;
    if (activeSubTab === 'sellers') return u.role === 'Seller' && !u.is_blocked;
    return (u.role === 'Buyer' || u.role === 'Admin') && !u.is_blocked;
  });

  return (
    <div className="tab-content">
      <div className="table-section" style={{marginTop: 0}}>
        <div className="table-header">
           <div style={{flexDirection: 'row', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 15}}>
              <Users size={20} color="#00D8FF"/>
              <h3>إدارة المستخدمين والرقابة</h3>
           </div>
           
           <div className="sub-tabs" style={{display: 'flex', gap: 10, marginBottom: 20, borderBottom: '1px solid #1A1A1A', paddingBottom: 15, flexWrap: 'wrap'}}>
              <button 
                className={`sub-tab-btn ${activeSubTab === 'sellers' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('sellers')}
                style={{
                  background: activeSubTab === 'sellers' ? 'rgba(0, 216, 255, 0.1)' : 'transparent',
                  color: activeSubTab === 'sellers' ? '#00D8FF' : '#666',
                  border: activeSubTab === 'sellers' ? '1px solid #00D8FF' : '1px solid #1A1A1A',
                  padding: '8px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: '0.3s'
                }}
              >
                المتاجر والبائعين ({users.filter(u => u.role === 'Seller' && !u.is_blocked).length})
              </button>
              <button 
                className={`sub-tab-btn ${activeSubTab === 'buyers' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('buyers')}
                style={{
                  background: activeSubTab === 'buyers' ? 'rgba(0, 216, 255, 0.1)' : 'transparent',
                  color: activeSubTab === 'buyers' ? '#00D8FF' : '#666',
                  border: activeSubTab === 'buyers' ? '1px solid #00D8FF' : '1px solid #1A1A1A',
                  padding: '8px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: '0.3s'
                }}
              >
                المشترين العامين ({users.filter(u => (u.role === 'Buyer' || u.role === 'Admin') && !u.is_blocked).length})
              </button>
              <button 
                className={`sub-tab-btn ${activeSubTab === 'blocked' ? 'active' : ''}`}
                onClick={() => setActiveSubTab('blocked')}
                style={{
                  background: activeSubTab === 'blocked' ? 'rgba(255, 59, 48, 0.1)' : 'transparent',
                  color: activeSubTab === 'blocked' ? '#FF3B30' : '#666',
                  border: activeSubTab === 'blocked' ? '1px solid #FF3B30' : '1px solid #1A1A1A',
                  padding: '8px 20px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: '0.3s'
                }}
              >
                المحظورين 🚫 ({users.filter(u => u.is_blocked).length})
              </button>
           </div>
        </div>
        
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>الاسم المستعار</th>
                <th>البريد الإلكتروني</th>
                <th>الجوال</th>
                <th>الرتبة</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" className="text-center loading-text">جاري التحميل...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan="6" className="text-center empty-text">لا يوجد مستخدمين في هذه القائمة</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className={user.is_blocked ? 'row-blocked' : ''}>
                    <td>
                      <div style={{display: 'flex', alignItems: 'center', gap: 10}}>
                         <div className="avatar-mini" style={{backgroundImage: user.avatar_url ? `url(${user.avatar_url})` : 'none', backgroundColor: '#1A1A1A'}}></div>
                         <b>{user.display_name || 'بدون اسم'}</b>
                      </div>
                    </td>
                    <td>{user.email}</td>
                    <td>{user.phone || 'غير مسجل'}</td>
                    <td>
                       <span className={`role-badge ${user.role}`}>
                          {user.role === 'Admin' ? 'مدير' : (user.role === 'Seller' ? 'بائع' : 'مشتري')}
                       </span>
                    </td>
                    <td>
                       {user.is_blocked ? 
                         <span style={{color: '#FF3B30', fontSize: 12}}>🚫 محظور</span> : 
                         <span style={{color: '#6eff35', fontSize: 12}}>✅ نشط</span>
                       }
                    </td>
                    <td>
                        <div className="action-buttons">
                           <button 
                             className={`btn-icon ${user.is_blocked ? 'unblock' : 'block'}`} 
                             onClick={() => toggleBlock(user)}
                             title={user.is_blocked ? 'إلغاء الحظر' : 'حظر الحساب'}
                           >
                             {user.is_blocked ? <UserCheck size={16}/> : <UserX size={16}/>}
                           </button>

                           {user.role !== 'Admin' && (
                             <button 
                               className="btn-icon promote" 
                               onClick={() => toggleRole(user)}
                               title={user.role === 'Seller' ? 'تحويل لمشتري' : 'ترقية لبائع'}
                             >
                               {user.role === 'Seller' ? <ShieldAlert size={16}/> : <ShieldCheck size={16}/>}
                             </button>
                           )}
                        </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showSellerModal && activeSellerUser && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100}}>
          <div style={{backgroundColor: '#0A0A0A', padding: 30, borderRadius: 15, width: 400, border: '1px solid #333'}}>
             <h3 style={{marginBottom: 20}}>تسجيل / توثيق المتجر</h3>
             <p style={{marginBottom: 15, color: '#888', fontSize: 13}}>يرجى إدخال البيانات الرسمية للمتجر الخاص بالمستخدم: {activeSellerUser.email}</p>
             <form onSubmit={handleSellerSubmit} style={{display: 'flex', flexDirection: 'column', gap: 15}}>
                <input required type="text" className="dark-input" placeholder="اسم المسؤول (المدير)" value={sellerForm.managerName} onChange={e => setSellerForm({...sellerForm, managerName: e.target.value})} />
                <input required type="text" className="dark-input" placeholder="الموقع الجغرافي / الوصلة" value={sellerForm.location} onChange={e => setSellerForm({...sellerForm, location: e.target.value})} />
                <input required type="text" className="dark-input" placeholder="رابط صورة السجل التجاري" value={sellerForm.cr} onChange={e => setSellerForm({...sellerForm, cr: e.target.value})} />
                <div style={{display: 'flex', gap: 10, marginTop: 10}}>
                   <button type="submit" className="save-btn" style={{flex: 1}}>حفظ وتفعيل</button>
                   <button type="button" className="save-btn" style={{flex: 1, backgroundColor: '#333', borderColor: '#444'}} onClick={() => setShowSellerModal(false)}>إلغاء</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
}
