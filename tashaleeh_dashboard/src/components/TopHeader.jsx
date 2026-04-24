import React from 'react';
import { Search, RefreshCw } from 'lucide-react';

export default function TopHeader({ loading, onRefresh }) {
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
        <div className="admin-avatar">A</div>
      </div>
    </header>
  );
}
