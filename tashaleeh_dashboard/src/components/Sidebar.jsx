import React from 'react';
import { Activity, FileText, Users, Settings, MessageCircle, AlertCircle, Image as ImageIcon, DollarSign, Edit } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon-wrapper">
          <Activity size={28} color="#00D8FF" />
        </div>
        <span>لوحة تحكم تشاليح</span>
        <span className="version-tag">Admin V4.0</span>
      </div>
      <nav className="side-nav">
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`} 
          onClick={() => setActiveTab('overview')}
        >
          <Activity size={20}/> نظرة عامة
        </a>
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'users' ? 'active' : ''}`} 
          onClick={() => setActiveTab('users')}
        >
          <Users size={20}/> البائعين والمستخدمين
        </a>
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'content' ? 'active' : ''}`} 
          onClick={() => setActiveTab('content')}
        >
          <Edit size={20}/> الرقابة والمحتوى
        </a>
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'financials' ? 'active' : ''}`} 
          onClick={() => setActiveTab('financials')}
        >
          <DollarSign size={20}/> المالية والعمولات
        </a>
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'banners' ? 'active' : ''}`} 
          onClick={() => setActiveTab('banners')}
        >
          <ImageIcon size={20}/> البنرات الترويجية
        </a>
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} 
          onClick={() => setActiveTab('reports')}
        >
          <AlertCircle size={20}/> البلاغات والنزاعات
        </a>
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'logs' ? 'active' : ''}`} 
          onClick={() => setActiveTab('logs')}
        >
          <FileText size={20}/> سجل العمليات (Logs)
        </a>
        <a 
          href="#" 
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} 
          onClick={() => setActiveTab('settings')}
        >
          <Settings size={20}/> الإعدادات والصفحات
        </a>
      </nav>
    </aside>
  );
}
