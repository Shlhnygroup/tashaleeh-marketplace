import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { DollarSign, Search, CheckCircle, Clock } from 'lucide-react';

export default function FinancialsTab({ logAction }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalSales: 0, pendingCommissions: 0, collectedCommissions: 0 });

  useEffect(() => {
    fetchFinancials();
  }, []);

  const fetchFinancials = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('transactions')
      .select(`
        id, sale_amount, commission_amount, status, created_at,
        seller:profiles!seller_id(display_name, email)
      `)
      .order('created_at', { ascending: false });
    
    if (data) {
      setTransactions(data);
      const ttSales = data.reduce((acc, curr) => acc + Number(curr.sale_amount), 0);
      const pComm = data.filter(d => d.status === 'pending').reduce((acc, curr) => acc + Number(curr.commission_amount), 0);
      const cComm = data.filter(d => d.status === 'paid').reduce((acc, curr) => acc + Number(curr.commission_amount), 0);
      setStats({ totalSales: ttSales, pendingCommissions: pComm, collectedCommissions: cComm });
    }
    setLoading(false);
  };

  const markAsPaid = async (id) => {
    if(!window.confirm("تأكيد استلام العمولة من البائع؟")) return;
    const { error } = await supabase.from('transactions').update({ status: 'paid' }).eq('id', id);
    if (!error) {
      logAction('MARK_TRANSACTION_PAID', 'transactions', id);
      fetchFinancials();
    }
  };

  return (
    <div className="tab-content fade-in">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20}}>
        <h2>المالية والعمولات 💰</h2>
      </div>

      <div className="stats-grid" style={{marginBottom: 30}}>
        <div className="stat-card">
          <div className="stat-icon" style={{backgroundColor: '#00D8FF22'}}><DollarSign color="#00D8FF" /></div>
          <div className="stat-info"><h3>إجمالي المبيعات المؤكدة</h3><p>{stats.totalSales} ريال</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{backgroundColor: '#FF950022'}}><Clock color="#FF9500" /></div>
          <div className="stat-info"><h3>عمولات معلقة (مطلوبة)</h3><p>{stats.pendingCommissions} ريال</p></div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{backgroundColor: '#34C75922'}}><CheckCircle color="#34C759" /></div>
          <div className="stat-info"><h3>عمولات محصلة</h3><p>{stats.collectedCommissions} ريال</p></div>
        </div>
      </div>

      <div className="settings-card" style={{marginBottom: 20}}>
         <h3 style={{marginBottom: 10}}>تسجيل عملية يدوية</h3>
         <p style={{color: '#888', fontSize: 13}}>سيتم توفير خيار التسجيل اليدوي للعمليات قريباً. حالياً يتم سحب العمليات تلقائياً متى ما أكد المشتري الاستلام.</p>
      </div>

      {loading ? (
        <p style={{textAlign: 'center', color: '#888'}}>جاري الجلب...</p>
      ) : (
        <div className="table-responsive">
          <table className="users-table">
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>البائع</th>
                <th>مبلغ البيع</th>
                <th>العمولة المستحقة</th>
                <th>حالة الدفع</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map(t => (
                <tr key={t.id}>
                  <td>{new Date(t.created_at).toLocaleDateString('ar-SA')}</td>
                  <td>{t.seller?.display_name || 'غير معروف'}</td>
                  <td><strong style={{color: '#00D8FF'}}>{t.sale_amount} ريال</strong></td>
                  <td><strong style={{color: '#FF9500'}}>{t.commission_amount} ريال</strong></td>
                  <td>
                    {t.status === 'paid' ? (
                       <span className="status-badge" style={{backgroundColor: '#34C75922', color: '#34C759'}}>مُحصلة ✅</span>
                    ) : (
                       <span className="status-badge" style={{backgroundColor: '#FF3B3022', color: '#FF3B30'}}>معلقة ⏳</span>
                    )}
                  </td>
                  <td>
                    {t.status === 'pending' && (
                       <button className="save-btn" style={{padding: '5px 10px', fontSize: 11}} onClick={() => markAsPaid(t.id)}>
                          تحصيل
                       </button>
                    )}
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                 <tr><td colSpan="6" style={{textAlign: 'center', padding: 20}}>لا توجد تداولات مالية مسجلة بعد</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
