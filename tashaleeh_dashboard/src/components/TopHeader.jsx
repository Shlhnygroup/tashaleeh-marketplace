import React from 'react';
import { Search, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '../../supabase';

export default function TopHeader({ loading, onRefresh }) {
  const handleLogout = async () => {
    if (window.confirm('هل تريد تسجيل الخروج من لوحة التحكم؟')) {
      await supabase.auth.signOut();
    }
  };

  return (
    <header className="top-header">
      <div className="header-search">
        <Search size={18} color="#888" />
        <input type="text" placeholder="ابحث برقم الهيكل، الهاتف..." />
      </div>
      <div className="header-actions">
        <button className="refresh-btn" onClick={onRefresh}>
          <RefreshCw size={18} className={loading ? "spinning" : ""} /> تحديث النظام
        </button>
        <button
          className="refresh-btn"
          onClick={handleLogout}
          title="تسجيل الخروج"
          style={{ color: '#FF3B30', borderColor: 'rgba(255,59,48,0.3)' }}
        >
          <LogOut size={18} /> خروج
        </button>
        <div className="admin-avatar">A</div>
      </div>
    </header>
  );
}
