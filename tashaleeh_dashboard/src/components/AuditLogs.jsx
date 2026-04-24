import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabase';
import { FileText, User, Activity, Clock } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('action_logs')
      .select('*, admin:admin_id(email)')
      .order('created_at', { ascending: false });
    
    if (data) setLogs(data);
    setLoading(false);
  };

  return (
    <div className="tab-content">
      <div className="settings-header">
        <h2 style={{color: '#FFF', display: 'flex', alignItems: 'center', gap: 10}}>
          <Clock size={28} color="#00D8FF"/> سجل عمليات الإدارة (Audit Trail)
        </h2>
        <p style={{color: '#888'}}>مراقبة وتوثيق عمليات التعديل والحظر التي يقوم بها موظفو النظام.</p>
      </div>

      <div className="table-section">
        <table className="data-table">
          <thead>
            <tr>
              <th>الموظف</th>
              <th>العملية</th>
              <th>الهدف</th>
              <th>التفاصيل</th>
              <th>الوقت والتاريخ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" className="text-center">جاري التحميل...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan="5" className="text-center empty-text">لا توجد سجلات حالياً</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
                      <div className="admin-avatar small">A</div>
                      <span>{log.admin?.email?.split('@')[0] || 'أدمن'}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`log-badge ${log.action.toLowerCase()}`}>
                      {log.action}
                    </span>
                  </td>
                  <td>{log.target_type || '-'}</td>
                  <td>
                    <pre style={{fontSize: 11, color: '#888', background: '#070707', padding: 5, borderRadius: 4}}>
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  </td>
                  <td>
                    {new Date(log.created_at).toLocaleString('ar-SA')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
