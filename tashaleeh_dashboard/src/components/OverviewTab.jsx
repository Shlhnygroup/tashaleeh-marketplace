import React from 'react';
import { FileText, Activity, MessageCircle, Users, CarFront } from 'lucide-react';

export default function Overview({ stats, topBrands, recentRequests, loading }) {
  return (
    <div className="tab-content">
      <section className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon req"><FileText size={24}/></div>
          <div className="stat-details">
            <h3>إجمالي الطلبات</h3>
            <p className="stat-number">{stats.totalRequests}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon off"><Activity size={24}/></div>
          <div className="stat-details">
            <h3>تسعيرات السوق</h3>
            <p className="stat-number">{stats.totalOffers}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon msg"><MessageCircle size={24}/></div>
          <div className="stat-details">
            <h3>المحادثات</h3>
            <p className="stat-number">{stats.totalMessages}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon sellers"><Users size={24}/></div>
          <div className="stat-details">
            <h3>المتاجر النشطة</h3>
            <p className="stat-number">{stats.activeSellers}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon buyers"><Users size={24}/></div>
          <div className="stat-details">
            <h3>المشترون المسجلون</h3>
            <p className="stat-number">{stats.totalBuyers}</p>
          </div>
        </div>
      </section>

      <section className="overview-grid" style={{
        display: 'grid', 
        gridTemplateColumns: '1fr 350px', 
        gap: 20, 
        marginTop: 25
      }}>
        <div className="table-section" style={{marginTop: 0}}>
          <div className="table-header"><h3>أحدث الطلبات المدرجة</h3></div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>الرقم</th>
                  <th>السيارة الماركة</th>
                  <th>التسعيرات</th>
                  <th>التاريخ</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="5" className="text-center loading-text">جاري جلب البيانات...</td></tr>
                ) : recentRequests.length === 0 ? (
                  <tr><td colSpan="5" className="text-center empty-text">لا يوجد أي طلب حالياً</td></tr>
                ) : (
                  recentRequests.map((req) => (
                    <tr key={req.id}>
                      <td><span className="row-id">#{req.id.substring(0,5)}</span></td>
                      <td><CarFront size={14} style={{marginLeft: 5}}/> <b>{req.car_brand}</b> ({req.model_year})</td>
                      <td><span className="offers-badge">{req.responses[0]?.count || 0} عرض</span></td>
                      <td>{new Date(req.created_at).toLocaleDateString('ar-SA')}</td>
                      <td><span className={`status-badge ${req.status}`}>{
                        req.status === 'open' ? 'نشط' :
                        req.status === 'bought' ? 'تم البيع' :
                        req.status === 'cancelled' ? 'ملغي' : 'مغلق'
                      }</span></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="analytics-sidebar">
          <div className="sidebar-card">
            <h3>📈 أكثر الماركات طلباً</h3>
            <div className="top-brands-list">
              {topBrands.length === 0 && <p className="empty-text">لا توجد بيانات كافية</p>}
              {topBrands.map((brand, index) => (
                <div key={brand.name} className="brand-stat-item">
                  <div className="brand-info">
                    <span className="rank">{index + 1}</span>
                    <span className="name">{brand.name}</span>
                  </div>
                  <span className="count">{brand.count} طلب</span>
                </div>
              ))}
            </div>
          </div>

          <div className="sidebar-card" style={{marginTop: 20}}>
            <h3>🏗️ حالة النظام</h3>
            <div className="system-health">
              <div className="health-item">
                <span>قاعدة البيانات</span>
                <span className="status-online">متصلة 🟢</span>
              </div>
              <div className="health-item">
                <span>خادم التنبيهات</span>
                <span className="status-online">نشط 🟢</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
