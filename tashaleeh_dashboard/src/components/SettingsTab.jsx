import React from 'react';
import { Phone, Save, Plus, Trash2, CarFront } from 'lucide-react';

export default function SettingsTab({ 
  appSettings, 
  setAppSettings, 
  saveSettings, 
  saving, 
  loading, 
  newBrand, 
  setNewBrand, 
  addBrand, 
  carBrands, 
  deleteBrand 
}) {
  return (
    <div className="tab-content settings-view">
      <div className="settings-header">
        <h2>إعدادات التطبيق وسياسات التحكم (V3.1)</h2>
        <p>أي تغيير هنا ينعكس فوراً على تطبيق المشتري وتطبيق البائع دون الحاجة لتحديث من المتاجر.</p>
      </div>

      <div className="settings-grid">
        <div className="settings-card">
          <h3><Phone size={20} className="icon"/> إعدادات الدعم والسياسات</h3>
          <div className="form-group">
            <label>رقم واتساب الدعم الفني (API Link)</label>
            <input 
              type="text" 
              className="dark-input"
              value={appSettings.whatsapp_number} 
              onChange={(e) => setAppSettings({...appSettings, whatsapp_number: e.target.value})} 
              placeholder="مثال: 966500000000"
            />
            <small>عند ضغط العميل على زر "تواصل مع الدعم" سيتم تحويله لهذا الرقم.</small>
          </div>
          <div className="form-group">
            <label>الشروط والأحكام (Terms & Conditions)</label>
            <textarea 
              rows="4"
              className="dark-input"
              value={appSettings.terms_conditions || ''}
              onChange={(e) => setAppSettings({...appSettings, terms_conditions: e.target.value})}
            />
          </div>
          <div className="form-group">
            <label>سياسة الخصوصية (Privacy Policy)</label>
            <textarea 
              rows="4"
              className="dark-input"
              value={appSettings.privacy_policy || ''}
              onChange={(e) => setAppSettings({...appSettings, privacy_policy: e.target.value})}
            />
          </div>
          
          <div style={{display: 'flex', gap: 15, marginBottom: 15}}>
             <div className="form-group" style={{flex: 1}}>
               <label>قيمة العمولة الافتراضية (ريال)</label>
               <input 
                 type="number" 
                 className="dark-input"
                 value={appSettings.commission_rate || 0} 
                 onChange={(e) => setAppSettings({...appSettings, commission_rate: e.target.value})} 
               />
             </div>
             <div className="form-group" style={{flex: 1}}>
               <label>رسوم اشتراك المتاجر (ريال)</label>
               <input 
                 type="number" 
                 className="dark-input"
                 value={appSettings.subscription_fee || 0} 
                 onChange={(e) => setAppSettings({...appSettings, subscription_fee: e.target.value})} 
               />
             </div>
          </div>

          <button className="save-btn" onClick={saveSettings} disabled={saving || loading}>
            {saving ? 'جاري الحفظ...' : <><Save size={18}/> حفظ السياسات المتقدمة</>}
          </button>
        </div>

        <div className="settings-card">
          <h3><CarFront size={20} className="icon"/> الإدارة الديناميكية للماركات</h3>
          <div className="add-brand-row">
            <input 
              type="text" 
              className="dark-input" 
              placeholder="اسم الماركة الجديدة (مثال: بورش)"
              value={newBrand}
              onChange={(e) => setNewBrand(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addBrand()}
            />
            <button className="add-btn" onClick={addBrand}><Plus size={18}/></button>
          </div>
          <div className="brands-list">
            {loading ? <p className="loading-text">جاري جلب الماركات...</p> : 
              carBrands.map(brand => (
                <div key={brand.id} className="brand-tag">
                  <span>{brand.name}</span>
                  <button className="delete-icon" onClick={() => deleteBrand(brand.id)}>
                    <Trash2 size={16}/>
                  </button>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  );
}
