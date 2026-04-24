import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { Plus, Trash2, Image as ImageIcon } from 'lucide-react';

export default function BannersTab({ logAction }) {
  const [banners, setBanners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newImage, setNewImage] = useState('');
  const [newLink, setNewLink] = useState('');

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    setLoading(true);
    const { data } = await supabase.from('app_banners').select('*').order('sort_order', { ascending: true });
    if (data) setBanners(data);
    setLoading(false);
  };

  const addBanner = async (e) => {
    e.preventDefault();
    if (!newImage) return alert("يجب إدخال رابط الصورة");

    const { data, error } = await supabase.from('app_banners').insert([{
      image_url: newImage,
      link_url: newLink,
      is_active: true
    }]).select();

    if (!error && data) {
      setBanners([...banners, data[0]]);
      logAction('ADD_BANNER', 'app_banners', data[0].id);
      setNewImage('');
      setNewLink('');
    } else {
       alert(error?.message);
    }
  };

  const toggleActive = async (id, currentVal) => {
    const { error } = await supabase.from('app_banners').update({ is_active: !currentVal }).eq('id', id);
    if (!error) {
      setBanners(prev => prev.map(b => b.id === id ? { ...b, is_active: !currentVal } : b));
      logAction('TOGGLE_BANNER', 'app_banners', id, { is_active: !currentVal });
    }
  };

  const deleteBanner = async (id) => {
    if(!window.confirm("إزالة البنر نهائياً؟")) return;
    const { error } = await supabase.from('app_banners').delete().eq('id', id);
    if (!error) {
      setBanners(prev => prev.filter(b => b.id !== id));
      logAction('DELETE_BANNER', 'app_banners', id);
    }
  };

  return (
    <div className="tab-content fade-in">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
        <h2>البنرات والإعلانات 🖼️</h2>
      </div>

      <div className="settings-card" style={{marginBottom: 30}}>
         <h3>إضافة بنر جديد</h3>
         <form onSubmit={addBanner} style={{display: 'flex', gap: 10, marginTop: 15, flexWrap: 'wrap'}}>
            <input 
               type="text" 
               className="dark-input" 
               placeholder="رابط الصورة (URL)" 
               value={newImage}
               onChange={e => setNewImage(e.target.value)}
               style={{flex: 2, minWidth: 200}}
            />
            <input 
               type="text" 
               className="dark-input" 
               placeholder="رابط التوجيه (اختياري)" 
               value={newLink}
               onChange={e => setNewLink(e.target.value)}
               style={{flex: 2, minWidth: 200}}
            />
            <button type="submit" className="save-btn" style={{flex: 1, minWidth: 100}}>
               إضافة <Plus size={16} style={{marginLeft: 5}}/>
            </button>
         </form>
      </div>

      {loading ? (
        <p style={{textAlign: 'center', color: '#888'}}>جاري التحميل...</p>
      ) : (
        <div className="table-responsive">
          <table className="users-table">
            <thead>
              <tr>
                <th>الصورة</th>
                <th>رابط التوجيه</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {banners.map(banner => (
                <tr key={banner.id}>
                  <td>
                    <div style={{width: 100, height: 40, backgroundColor: '#1A1A1A', borderRadius: 8, overflow: 'hidden', backgroundImage: `url(${banner.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center'}} />
                  </td>
                  <td><a href={banner.link_url} target="_blank" style={{color: '#00D8FF'}}>{banner.link_url || 'لا يوجد'}</a></td>
                  <td>
                     <label className="switch">
                        <input type="checkbox" checked={banner.is_active} onChange={() => toggleActive(banner.id, banner.is_active)} />
                        <span className="slider round"></span>
                     </label>
                  </td>
                  <td>
                    <button className="btn-icon" title="حذف" onClick={() => deleteBanner(banner.id)}>
                       <Trash2 size={16} color="#FF3B30" />
                    </button>
                  </td>
                </tr>
              ))}
              {banners.length === 0 && (
                <tr><td colSpan="4" style={{textAlign: 'center', padding: 20}}>لا توجد بنرات حالياً</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
