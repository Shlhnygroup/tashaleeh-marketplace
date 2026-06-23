import React, { useState, useEffect } from 'react';
import { supabase } from './supabase';
import AdminGuard from './src/components/AdminGuard';
import Sidebar from './src/components/Sidebar';
import TopHeader from './src/components/TopHeader';
import OverviewTab from './src/components/OverviewTab';
import ReportsTab from './src/components/ReportsTab';
import AuditLogs from './src/components/AuditLogs';
import SettingsTab from './src/components/SettingsTab';
import UsersTab from './src/components/UsersTab';
import ContentTab from './src/components/ContentTab';
import FinancialsTab from './src/components/FinancialsTab';
import BannersTab from './src/components/BannersTab';
import './Dashboard.css';

export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Dashboard & Settings States
  const [stats, setStats] = useState({ 
    totalRequests: 0, 
    totalOffers: 0, 
    activeSellers: 0, 
    totalBuyers: 0, // V3.4: New Stat
    totalMessages: 0 
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [topBrands, setTopBrands] = useState([]);
  const [appSettings, setAppSettings] = useState({ whatsapp_number: '', app_policy: '' });
  const [carBrands, setCarBrands] = useState([]);
  const [newBrand, setNewBrand] = useState('');

  // 1. Audit Logging Utility
  const logAction = async (action, targetType, targetId, details = {}) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    await supabase.from('action_logs').insert([{
      admin_id: session.user.id,
      action: action,
      target_type: targetType,
      target_id: targetId,
      details: details
    }]);
  };

  useEffect(() => {
    if (activeTab === 'overview') fetchDashboardData();
    else if (activeTab === 'settings') fetchSettingsData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [reqs, resps, msgs, sellers, buyers, allReqs] = await Promise.all([
        supabase.from('requests').select('id', { count: 'exact', head: true }),
        supabase.from('responses').select('id', { count: 'exact', head: true }),
        supabase.from('messages').select('id', { count: 'exact', head: true }),
        supabase.from('seller_profiles').select('id', { count: 'exact', head: true }).eq('is_online', true), // المتاجر النشطة (المتصلة) فقط
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'Buyer'), // كل المشترين
        supabase.from('requests').select('car_brand')
      ]);

      setStats({
        totalRequests: reqs.count || 0,
        totalOffers: resps.count || 0,
        totalMessages: msgs.count || 0,
        activeSellers: sellers.count || 0,
        totalBuyers: buyers.count || 0 // New field
      });

      if (allReqs.data) {
        const counts = allReqs.data.reduce((acc, curr) => {
          acc[curr.car_brand] = (acc[curr.car_brand] || 0) + 1;
          return acc;
        }, {});
        const sortedBrands = Object.entries(counts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopBrands(sortedBrands);
      }

      const { data } = await supabase
        .from('requests')
        .select('id, car_brand, model_year, part_details, region, created_at, status, responses(count)')
        .order('created_at', { ascending: false })
        .limit(10);
      
      if (data) setRecentRequests(data);
    } catch (error) {
      console.error('Error fetching data:', error);
    }
    setLoading(false);
  };

  const fetchSettingsData = async () => {
    setLoading(true);
    const [settingsRes, brandsRes] = await Promise.all([
      supabase.from('app_settings').select('*').eq('id', 1).single(),
      supabase.from('car_brands').select('*').order('id', { ascending: true })
    ]);
    if (settingsRes.data) setAppSettings(settingsRes.data);
    if (brandsRes.data) setCarBrands(brandsRes.data);
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    const { error } = await supabase.from('app_settings').upsert({ id: 1, ...appSettings });
    if (!error) {
      alert('تم الحفظ بنجاح!');
      logAction('UPDATE_SETTINGS', 'app_settings', '1', appSettings);
    } else {
      alert('فشل الحفظ: ' + error.message);
    }
    setSaving(false);
  };

  const addBrand = async () => {
    if (!newBrand.trim()) return;
    const { data, error } = await supabase.from('car_brands').insert([{ name: newBrand }]).select();
    if (!error && data) {
      setCarBrands([...carBrands, data[0]]);
      logAction('ADD_BRAND', 'car_brand', data[0].id.toString(), { name: newBrand });
      setNewBrand('');
    } else if (error) {
      alert(error.code === '23505' ? 'الماركة موجودة مسبقاً.' : 'تعذّر إضافة الماركة: ' + error.message);
    }
  };

  const deleteBrand = async (id) => {
    if(!window.confirm("هل تأكد من حذف هذه الماركة؟")) return;
    const { error } = await supabase.from('car_brands').delete().eq('id', id);
    if (!error) {
      setCarBrands(carBrands.filter(b => b.id !== id));
      logAction('DELETE_BRAND', 'car_brand', id.toString());
    } else {
      alert('تعذّر الحذف: ' + error.message);
    }
  };

  return (
    <AdminGuard>
      <div className="dashboard-container">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
        
        <main className="main-content">
          {(loading || saving) && <div className="loading-linear-bar"></div>}
          
          <TopHeader 
            loading={loading} 
            onRefresh={activeTab === 'overview' ? fetchDashboardData : fetchSettingsData} 
          />

          {activeTab === 'overview' && (
            <OverviewTab stats={stats} topBrands={topBrands} recentRequests={recentRequests} loading={loading} />
          )}

          {activeTab === 'reports' && (
            <ReportsTab logAction={logAction} />
          )}

          {activeTab === 'logs' && (
             <AuditLogs />
          )}

          {activeTab === 'settings' && (
            <SettingsTab 
              appSettings={appSettings} 
              setAppSettings={setAppSettings} 
              saveSettings={saveSettings} 
              saving={saving} 
              loading={loading} 
              newBrand={newBrand} 
              setNewBrand={setNewBrand} 
              addBrand={addBrand} 
              carBrands={carBrands} 
              deleteBrand={deleteBrand}
            />
          )}

          {activeTab === 'users' && (
             <UsersTab logAction={logAction} />
          )}

          {activeTab === 'content' && (
             <ContentTab logAction={logAction} />
          )}

          {activeTab === 'financials' && (
             <FinancialsTab logAction={logAction} />
          )}

          {activeTab === 'banners' && (
             <BannersTab logAction={logAction} />
          )}

        </main>
      </div>
    </AdminGuard>
  );
}
