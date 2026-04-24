import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Search, EyeOff, Eye, Trash2, ShieldAlert } from 'lucide-react';

export default function ContentTab({ logAction }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('requests')
      .select(`
        id, created_at, car_brand, part_details, image_url, is_hidden, status,
        buyer:profiles!buyer_id(display_name, email)
      `)
      .order('created_at', { ascending: false });
    
    if (data) setRequests(data);
    setLoading(false);
  };

  const toggleHide = async (id, currentVal) => {
    if(!window.confirm(`هل أنت متأكد من ${currentVal ? 'إظهار' : 'إخفاء'} هذا الطلب؟`)) return;
    
    const { error } = await supabase.from('requests').update({ is_hidden: !currentVal }).eq('id', id);
    if (!error) {
      setRequests(prev => prev.map(r => r.id === id ? { ...r, is_hidden: !currentVal } : r));
      logAction('TOGGLE_HIDE_REQUEST', 'requests', id, { new_status: !currentVal });
    }
  };

  const deleteRequest = async (id) => {
    if(!window.confirm("حذف نهائي! هل أنت متأكد؟ ستحذف جميع العروض التابعة له.")) return;
    
    const { error } = await supabase.from('requests').delete().eq('id', id);
    if (!error) {
      setRequests(prev => prev.filter(r => r.id !== id));
      logAction('DELETE_REQUEST', 'requests', id);
    } else {
      alert(error.message);
    }
  };

  const filtered = requests.filter(r => 
     r.part_details?.includes(search) || 
     r.car_brand?.includes(search) ||
     r.id.includes(search)
  );

  return (
    <div className="tab-content fade-in">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
        <h2>الرقابة وإدارة المحتوى</h2>
      </div>

      <div className="search-bar" style={{marginBottom: 20}}>
        <Search size={18} />
        <input 
          type="text" 
          placeholder="ابحث برقم الطلب، الماركة، أو التفاصيل..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <p style={{textAlign: 'center', color: '#888'}}>جاري جلب المحتوى...</p>
      ) : (
        <div className="table-responsive">
          <table className="users-table">
            <thead>
              <tr>
                <th>رقم الطلب</th>
                <th>المشتري</th>
                <th>التفاصيل</th>
                <th>الحالة</th>
                <th>الإجراءات (مدير)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(req => (
                <tr key={req.id} style={{ opacity: req.is_hidden ? 0.5 : 1 }}>
                  <td><span className="mono-text">{req.id.substring(0,8)}...</span></td>
                  <td>{req.buyer?.display_name || req.buyer?.email}</td>
                  <td>
                     <strong>{req.car_brand}</strong><br/>
                     <span style={{fontSize: 12, color: '#888'}}>{req.part_details.substring(0, 50)}...</span>
                  </td>
                  <td>
                     {req.is_hidden ? (
                        <span className="status-badge" style={{backgroundColor: '#FF3B3022', color: '#FF3B30'}}>مخفي 🚫</span>
                     ) : (
                        <span className="status-badge" style={{backgroundColor: '#00D8FF22', color: '#00D8FF'}}>ظاهر للجميع</span>
                     )}
                  </td>
                  <td>
                    <div style={{display: 'flex', gap: 10, justifyContent: 'center'}}>
                      <button 
                         className="btn-icon" 
                         title={req.is_hidden ? "إظهار" : "إخفاء"} 
                         onClick={() => toggleHide(req.id, req.is_hidden)}
                      >
                         {req.is_hidden ? <Eye size={16} color="#00D8FF" /> : <EyeOff size={16} color="#FF9500" />}
                      </button>
                      <button className="btn-icon" title="حذف نهائي" onClick={() => deleteRequest(req.id)}>
                         <Trash2 size={16} color="#FF3B30" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="5" style={{textAlign: 'center', padding: 20}}>لا يوجد محتوى يطابق البحث</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
