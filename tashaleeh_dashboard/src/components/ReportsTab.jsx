import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { AlertCircle, UserX, CheckCircle, ShieldAlert, MessageCircle, X } from 'lucide-react';

export default function ReportsTab({ logAction }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Chat Viewer State
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [activeReport, setActiveReport] = useState(null);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reports')
      .select('*, reporter:reporter_id(email), reported:reported_id(email)')
      .order('created_at', { ascending: false });
    
    if (data) setReports(data);
    setLoading(false);
  };

  const blockUser = async (userId, userEmail) => {
    if(!window.confirm(`هل أنت متأكد من حظر المستخدم ${userEmail} نهائياً؟`)) return;

    const { error } = await supabase
      .from('profiles')
      .update({ is_blocked: true })
      .eq('id', userId);

    if(!error) {
      alert("تم حظر المستخدم بنجاح.");
      logAction('BLOCK_USER', 'user', userId, { email: userEmail });
      fetchReports();
    }
  };

  const resolveReport = async (reportId) => {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'resolved' })
      .eq('id', reportId);

    if(!error) {
      fetchReports();
      logAction('RESOLVE_REPORT', 'report', reportId);
    }
  };

  const openChatViewer = async (report) => {
    setActiveReport(report);
    setShowChat(true);
    setChatLoading(true);
    
    // Fetch conversation between reporter and reported
    const { data } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${report.reporter_id},receiver_id.eq.${report.reported_id}),and(sender_id.eq.${report.reported_id},receiver_id.eq.${report.reporter_id})`)
      .order('created_at', { ascending: true });
      
    if (data) setChatMessages(data);
    setChatLoading(false);
    logAction('VIEW_CHAT_LOGS', 'dispute', report.id, { users: [report.reporter_id, report.reported_id] });
  };

  return (
    <div className="tab-content fade-in">
      <div className="settings-header">
        <h2 style={{color: '#FFF', display: 'flex', alignItems: 'center', gap: 10}}>
          <ShieldAlert size={28} color="#FF3B30"/> نظام البلاغات والرقابة
        </h2>
        <p style={{color: '#888'}}>مراجعة شكاوى المستخدمين والاطلاع الفوري على محادثاتهم لاتخاذ القرارات.</p>
      </div>

      <div className="table-responsive">
        <table className="users-table">
          <thead>
            <tr>
              <th>المُبلِغ</th>
              <th>المُبلَغ عنه (الخصم)</th>
              <th>السبب</th>
              <th>التاريخ</th>
              <th>الحالة</th>
              <th>الإجراء وتدقيق المحادثة</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="text-center">جاري التحميل...</td></tr>
            ) : reports.length === 0 ? (
              <tr><td colSpan="6" className="text-center empty-text">لا توجد بلاغات حالياً</td></tr>
            ) : (
              reports.map((report) => (
                <tr key={report.id}>
                  <td>{report.reporter?.email || 'مستخدم'}</td>
                  <td><b style={{color: '#FF8C00'}}>{report.reported?.email || 'مستخدم'}</b></td>
                  <td>{report.reason}</td>
                  <td>{new Date(report.created_at).toLocaleDateString('ar-SA')}</td>
                  <td>
                    <span className={`status-badge ${report.status === 'resolved' ? 'active' : ''}`}>
                      {report.status === 'pending' ? 'قيد الانتظار' : 'تم الحل'}
                    </span>
                  </td>
                  <td>
                    <div style={{display: 'flex', gap: 10}}>
                      <button className="btn-icon" title="تدقيق المحادثة" onClick={() => openChatViewer(report)}>
                         <MessageCircle size={16} color="#00D8FF"/>
                      </button>
                      {report.status === 'pending' && (
                        <button className="btn-icon" title="إغلاق البلاغ" onClick={() => resolveReport(report.id)}>
                          <CheckCircle size={16} color="#34C759"/>
                        </button>
                      )}
                      <button className="btn-icon" title="حظر الخصم" onClick={() => blockUser(report.reported_id, report.reported?.email)}>
                        <UserX size={16} color="#FF3B30"/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showChat && activeReport && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', zIndex: 100, display: 'flex', flexDirection: 'column'}}>
           <div style={{padding: 20, backgroundColor: '#111', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #333'}}>
              <h3 style={{color: '#FFF', display: 'flex', alignItems: 'center', gap: 10}}><MessageCircle color="#00D8FF"/> تدقيق المحادثات للنزاع</h3>
              <button onClick={() => setShowChat(false)} style={{background: 'none', border: 'none', color: '#FFF', cursor: 'pointer'}}><X size={24}/></button>
           </div>
           
           <div style={{flex: 1, overflowY: 'auto', padding: 20, maxWidth: 800, margin: '0 auto', width: '100%'}}>
              {chatLoading ? <p style={{color: '#00D8FF', textAlign: 'center'}}>جاري سحب السجلات السرية...</p> : (
                 chatMessages.length === 0 ? <p style={{color: '#888', textAlign: 'center'}}>لا توجد محادثات بين هذين الطرفين (قد يكون البلاغ خارجي).</p> : (
                    chatMessages.map(msg => {
                       const isReporter = msg.sender_id === activeReport.reporter_id;
                       return (
                          <div key={msg.id} style={{
                             alignSelf: isReporter ? 'flex-start' : 'flex-end',
                             backgroundColor: isReporter ? '#222' : '#00D8FF22',
                             padding: 15,
                             borderRadius: 15,
                             marginBottom: 10,
                             maxWidth: '80%',
                             marginLeft: isReporter ? 0 : 'auto',
                             marginRight: isReporter ? 'auto' : 0,
                             border: isReporter ? '1px solid #333' : '1px solid rgba(0, 216, 255, 0.3)'
                          }}>
                             <p style={{fontSize: 11, color: '#888', marginBottom: 5}}>
                                {isReporter ? `المُبَلِغ (${activeReport.reporter?.email})` : `الخصم (${activeReport.reported?.email})`}
                             </p>
                             <p style={{color: '#FFF'}}>{msg.content}</p>
                          </div>
                       )
                    })
                 )
              )}
           </div>
        </div>
      )}
    </div>
  );
}
