import React, { useEffect, useMemo, useState } from 'react';
import { pondService } from '../../services/api';
import { showToast } from '../../utils/toast';
import { useAuth } from '../../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const POND_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái ao' },
  { value: 'CHUAN_BI_NUOI', label: 'Chuẩn bị nuôi' },
  { value: 'TAM_NGUNG', label: 'Tạm ngưng' },
  { value: 'DANG_NUOI', label: 'Đang nuôi' },
  { value: 'DANG_CAI_TAO', label: 'Đang xử lý (Vệ sinh)' },
];

const USAGE_STATUS_OPTIONS = [
  { value: 'ALL', label: 'Tất cả trạng thái' },
  { value: 'HOAT_DONG', label: 'Hoạt động' },
  { value: 'NGUNG_SU_DUNG', label: 'Ngưng sử dụng' },
];

const CHART_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const formatRoundedNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isNaN(num) ? value : String(Math.round(num));
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  // 🌟 HIỂN THỊ NGÀY GIỜ ĐẸP CHO GIAO DIỆN
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
};

const getPondStatusBadge = (status) => {
  switch (normalizeUpper(status)) {
    case 'CHUAN_BI_NUOI': return <span className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-bold border border-violet-200 shadow-sm">Chuẩn bị nuôi</span>;
    case 'DANG_NUOI': return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 shadow-sm">Đang nuôi</span>;
    case 'DANG_XU_LY':
    case 'DANG_CAI_TAO': return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200 shadow-sm">Đang xử lý</span>;
    case 'TAM_NGUNG': return <span className="bg-rose-100 text-rose-700 px-3 py-1 rounded-full text-xs font-bold border border-rose-200 shadow-sm">Tạm ngưng</span>;
    default: return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold shadow-sm">{status || '-'}</span>;
  }
};

const getUsageStatusBadge = (status) => {
  if (normalizeUpper(status) === 'HOAT_DONG') {
    return <span className="flex items-center gap-1.5 text-emerald-600 text-sm font-bold"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm"></span>Hoạt động</span>;
  }
  return <span className="flex items-center gap-1.5 text-rose-500 text-sm font-bold"><span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-sm"></span>Ngưng dùng</span>;
};

const Sparkline = ({ color }) => (
  <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const PondsPage = ({ roleLabel = 'Owner' }) => {
  const { user } = useAuth();

  const isOwner = roleLabel === 'Owner';
  const isTechnician = roleLabel === 'Technician';

  const [ponds, setPonds] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [usageFilter, setUsageFilter] = useState('ALL');
  const [technicianFilter, setTechnicianFilter] = useState('ALL');
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);

  const [selectedPond, setSelectedPond] = useState(null);
  const [busyAssignmentKey, setBusyAssignmentKey] = useState('');
  const [form, setForm] = useState({ pondName: '', area_m2: '', depth_m: '', assigned_staff: '', usage_status: 'HOAT_DONG' });

  useEffect(() => {
    fetchData();
  }, [roleLabel]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const pondRes = await pondService.getAllPonds();
      setPonds(pondRes?.data?.data || []);

      if (isOwner) {
        const matrixRes = await pondService.getAssignmentMatrix().catch(() => null);
        setTechnicians(matrixRes?.data?.data?.technicians || []);
      }
    } catch (err) {
      showToast({ title: 'Không tải được dữ liệu', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const technicianOptions = useMemo(() => technicians.map(t => ({ id: t.user_id, name: t.full_name || t.username, isActive: Boolean(t.status) })), [technicians]);
  const getTechnicianName = (id) => technicianOptions.find(t => String(t.id) === String(id))?.name || '-';

  const summary = useMemo(() => {
    const s = { total: ponds.length, chuanBi: 0, tamNgung: 0, dangNuoi: 0, dangCaiTao: 0, hoatDong: 0, ngungDung: 0 };
    ponds.forEach(p => {
      const st = normalizeUpper(p.status);
      const us = normalizeUpper(p.usage_status);
      if (st === 'TAM_NGUNG') s.tamNgung++;
      if (st === 'CHUAN_BI_NUOI') s.chuanBi++;
      if (st === 'DANG_NUOI') s.dangNuoi++;
      if (st === 'DANG_CAI_TAO' || st === 'DANG_XU_LY') s.dangCaiTao++;
      if (us === 'HOAT_DONG') s.hoatDong++;
      if (us === 'NGUNG_SU_DUNG') s.ngungDung++;
    });
    return s;
  }, [ponds]);

  const filteredPonds = useMemo(() => {
    const search = normalizeText(searchTerm);
    return [...ponds]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .filter(p => {
        const matchSearch = !search || normalizeText(p.pond_name).includes(search);
        const matchStatus = statusFilter === 'ALL' || normalizeUpper(p.status) === statusFilter || (statusFilter === 'DANG_CAI_TAO' && normalizeUpper(p.status) === 'DANG_XU_LY');
        const matchUsage = usageFilter === 'ALL' || normalizeUpper(p.usage_status) === usageFilter;
        const matchTech = !isOwner || technicianFilter === 'ALL' || String(p.assigned_staff || '') === String(technicianFilter);
        return matchSearch && matchStatus && matchUsage && matchTech;
      });
  }, [ponds, searchTerm, statusFilter, usageFilter, technicianFilter, isOwner]);

  const totalPages = Math.max(1, Math.ceil(filteredPonds.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredPonds.length);
  const paginatedPonds = filteredPonds.slice(startIndex, endIndex);

  const statusChart = [
    { label: 'Đang nuôi', value: summary.dangNuoi, color: '#10b981' },
    { label: 'Chuẩn bị nuôi', value: summary.chuanBi, color: '#8b5cf6' },
    { label: 'Đang xử lý', value: summary.dangCaiTao, color: '#f59e0b' },
    { label: 'Tạm ngưng', value: summary.tamNgung, color: '#f43f5e' },
  ].filter(d => d.value > 0);

  const usageChart = [
    { label: 'Hoạt động', value: summary.hoatDong, color: '#0ea5e9' },
    { label: 'Ngưng dùng', value: summary.ngungDung, color: '#94a3b8' },
  ];

  const techWorkloadChart = useMemo(() => {
    if (!isOwner) return [];
    const loadMap = new Map(technicianOptions.map(t => [String(t.id), { name: t.name, count: 0 }]));
    ponds.forEach(p => {
      const key = String(p.assigned_staff || '');
      if (loadMap.has(key)) loadMap.get(key).count++;
    });
    return Array.from(loadMap.values()).sort((a, b) => b.count - a.count).slice(0, 5).map((item, idx) => ({
      label: item.name.split(' ').pop(), value: item.count, color: CHART_COLORS[idx % CHART_COLORS.length]
    }));
  }, [ponds, technicianOptions, isOwner]);

  // ==========================================================================
  // HANDLERS
  // ==========================================================================
  const handleAssignTech = async (pond, techId, checked) => {
    try {
      setBusyAssignmentKey(`${pond.pond_id}:${techId}`);
      setPonds(prev => prev.map(p => p.pond_id === pond.pond_id ? { ...p, assigned_staff: checked ? techId : null } : p));
      await pondService.updateAssignment(pond.pond_id, checked ? techId : null);
    } catch (err) {
      showToast({ title: 'Lỗi phân công', type: 'error' });
      fetchData();
    } finally {
      setBusyAssignmentKey('');
    }
  };

  const handleToggleUsage = async (pond) => {
    // 🌟 THÊM LOGIC CHẶN TẤT CẢ TRẠNG THÁI BẬN CỦA AO
    if (normalizeUpper(pond.usage_status) === 'HOAT_DONG') {
      const status = normalizeUpper(pond.status);
      if (['DANG_NUOI', 'CHUAN_BI_NUOI', 'DANG_XU_LY', 'DANG_CAI_TAO'].includes(status)) {
        showToast({ title: 'Chỉ có thể ngưng sử dụng khi ao đang ở trạng thái Tạm Ngưng!', type: 'warning' });
        return;
      }
    }

    const next = normalizeUpper(pond.usage_status) === 'HOAT_DONG' ? 'NGUNG_SU_DUNG' : 'HOAT_DONG';
    if (!window.confirm(`Chuyển trạng thái sang ${next === 'HOAT_DONG' ? 'Hoạt động' : 'Ngưng dùng'}?`)) return;
    try {
      setPonds(prev => prev.map(p => p.pond_id === pond.pond_id ? { ...p, usage_status: next } : p));
      await pondService.updateUsageStatus(pond.pond_id, next);
    } catch (err) { 
      showToast({ title: 'Lỗi cập nhật trạng thái', type: 'error' }); 
      fetchData(); 
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Bạn chắc chắn muốn xóa ao nuôi này?')) return;
    try {
      await pondService.deletePond(id);
      showToast({ title: 'Xóa thành công', type: 'success' });
      fetchData();
    } catch (err) {
      showToast({ title: err?.response?.data?.message || 'Không thể xóa ao (Ao đang có dữ liệu liên quan)', type: 'error' });
      fetchData();
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await pondService.createPond({
        pondName: form.pondName.trim(), areaMeter: Number(form.area_m2), depthMeter: Number(form.depth_m),
        assignedStaff: form.assigned_staff ? Number(form.assigned_staff) : null,
      });
      showToast({ title: 'Tạo ao thành công', type: 'success' });
      setShowCreateModal(false);
      fetchData();
    } catch (err) { showToast({ title: err?.response?.data?.message || 'Lỗi tạo ao', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await pondService.updatePond(selectedPond.pond_id, {
        pondName: form.pondName.trim(), areaMeter: Number(form.area_m2), depthMeter: Number(form.depth_m),
        assignedStaff: form.assigned_staff ? Number(form.assigned_staff) : null,
      });
      if (normalizeUpper(selectedPond.usage_status) !== normalizeUpper(form.usage_status)) {
        await pondService.updateUsageStatus(selectedPond.pond_id, form.usage_status);
      }
      showToast({ title: 'Cập nhật thành công', type: 'success' });
      setShowEditModal(false);
      fetchData();
    } catch (err) { showToast({ title: 'Lỗi cập nhật ao', type: 'error' }); }
    finally { setSaving(false); }
  };

  const canConfirmRenovation = (pond) => {
    const st = normalizeUpper(pond.status);
    return (st === 'DANG_CAI_TAO' || st === 'DANG_XU_LY') &&
      normalizeUpper(pond.usage_status) === 'HOAT_DONG' &&
      Number(pond.assigned_staff) === Number(user?.user_id) &&
      !pond.renovation_completed_at;
  };

  const handleConfirmRenovation = async (pond) => {
    if (!window.confirm(`Xác nhận hoàn tất vệ sinh xử lý cho ao ${pond.pond_name}? Ao sẽ trở về trạng thái Tạm Ngưng.`)) return;
    try {
      await pondService.completeRenovation(pond.pond_id);
      showToast({ title: 'Đã hoàn tất xử lý ao', type: 'success' });
      fetchData();
    } catch (err) { showToast({ title: 'Lỗi xác nhận xử lý', type: 'error' }); }
  };

  if (loading && ponds.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Quản lý Ao Nuôi</h1>
          <p className="text-slate-500 font-medium mt-1.5">{isOwner ? 'Theo dõi và vận hành toàn bộ hệ thống ao nuôi' : 'Danh sách các ao nuôi bạn được phân công quản lý'}</p>
        </div>

        {isOwner && (
          <div className="relative z-10 flex flex-wrap gap-3 w-full md:w-auto">
            <button onClick={() => setShowAssignmentModal(true)} className="flex-1 md:flex-none px-5 py-2.5 bg-white/80 backdrop-blur-md border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-white shadow-sm transition-all flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              Phân Công Kỹ Sư
            </button>
            <button onClick={() => { setForm({ pondName: '', area_m2: '', depth_m: '', assigned_staff: '', usage_status: 'HOAT_DONG' }); setShowCreateModal(true); }} className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
              <span className="text-lg leading-none">+</span> Thêm ao Nuôi
            </button>
          </div>
        )}
      </div>

      {/* 5 KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5 mb-6">
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-bold text-sm">Tổng số ao</span>
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">📊</div>
          </div>
          <strong className="block text-3xl font-black text-slate-800">{summary.total}</strong>
          <div className="mt-2"><Sparkline color="#94a3b8" /></div>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-bold text-sm">Đang nuôi</span>
            <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">🦐</div>
          </div>
          <strong className="block text-3xl font-black text-slate-800">{summary.dangNuoi}</strong>
          <div className="mt-2"><Sparkline color="#10b981" /></div>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-bold text-sm">Chuẩn bị nuôi</span>
            <div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-500">💧</div>
          </div>
          <strong className="block text-3xl font-black text-slate-800">{summary.chuanBi}</strong>
          <div className="mt-2"><Sparkline color="#8b5cf6" /></div>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-bold text-sm">Đang xử lý</span>
            <div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">🚧</div>
          </div>
          <strong className="block text-3xl font-black text-slate-800">{summary.dangCaiTao}</strong>
          <div className="mt-2"><Sparkline color="#f59e0b" /></div>
        </div>

        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2">
            <span className="text-slate-500 font-bold text-sm">Tạm ngưng</span>
            <div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">🛑</div>
          </div>
          <strong className="block text-3xl font-black text-slate-800">{summary.tamNgung}</strong>
          <div className="mt-2"><Sparkline color="#f43f5e" /></div>
        </div>
      </div>

      {/* CHARTS WITH LOCAL LOADING OVERLAY */}
      <div className={`grid grid-cols-1 ${isOwner ? 'lg:grid-cols-3' : 'lg:grid-cols-2'} gap-5 mb-6`}>

        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
          {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
          <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Trạng thái ao nuôi</h3>
          <div className="flex-1 flex items-center relative z-0">
            <div className="w-1/2 h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={statusChart} innerRadius="65%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                    {statusChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center">
              {statusChart.map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-bold text-slate-500">{item.label}</span>
                  </div>
                  <span className="text-base font-black text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
          {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
          <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Trạng thái sử dụng</h3>
          <div className="flex-1 flex items-center relative z-0">
            <div className="w-1/2 h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={usageChart} innerRadius="65%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                    {usageChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center">
              {usageChart.map(item => (
                <div key={item.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-bold text-slate-500">{item.label}</span>
                  </div>
                  <span className="text-base font-black text-slate-800">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {isOwner && (
          <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
            {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
            <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Phân công kỹ sư</h3>
            <div className="flex-1 h-[180px] relative z-0">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={techWorkloadChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                  <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={40}>
                    {techWorkloadChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* TABLE & FILTERS WITH LOCAL LOADING OVERLAY */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden relative">

        {loading && (
          <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center transition-all">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
              <span className="font-bold text-slate-600">Đang tải dữ liệu...</span>
            </div>
          </div>
        )}

        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 bg-slate-50/30">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Tìm kiếm ao (VD: Ao A01)..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm" />
          </div>

          <div className="flex flex-wrap gap-3">
            <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm min-w-[160px] cursor-pointer">
              {POND_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select value={usageFilter} onChange={(e) => { setUsageFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm min-w-[160px] cursor-pointer">
              {USAGE_STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {isOwner && (
              <select value={technicianFilter} onChange={(e) => { setTechnicianFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm min-w-[160px] cursor-pointer">
                <option value="ALL">Kỹ sư phụ trách (Tất cả)</option>
                {technicianOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin Ao</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Kích thước</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái ao</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Sử dụng</th>
                {isOwner && <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Kỹ sư</th>}
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[180px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedPonds.length === 0 ? (
                <tr><td colSpan={isOwner ? 6 : 5} className="p-12 text-center text-slate-500 font-medium text-lg">Không tìm thấy dữ liệu ao nuôi.</td></tr>
              ) : (
                paginatedPonds.map(pond => (
                  <tr key={pond.pond_id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-100 to-teal-100 flex items-center justify-center text-teal-600 font-bold shadow-inner">
                          {pond.pond_code?.slice(-2)}
                        </div>
                        <div>
                          <strong className="block text-slate-800 text-base">{pond.pond_name}</strong>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{pond.pond_code}</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <div className="text-sm font-bold text-slate-700">{formatRoundedNumber(pond.area_m2)} m²</div>
                      <div className="text-xs font-medium text-slate-500 mt-0.5">Sâu: {formatRoundedNumber(pond.depth_m)} m</div>
                    </td>

                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center">
                        {getPondStatusBadge(pond.status)}
                        {/* 🌟 ĐÃ HIỂN THỊ THỜI GIAN CẬP NHẬT TẠI ĐÂY */}
                        {pond.updated_at && (
                          <div className="text-[10px] text-slate-400 font-bold mt-1.5" title="Thời gian thay đổi trạng thái">
                            🕒 {formatDateTime(pond.updated_at)}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 flex justify-center mt-2">{getUsageStatusBadge(pond.usage_status)}</td>

                    {isOwner && (
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                            {getTechnicianName(pond.assigned_staff).charAt(0)}
                          </div>
                          <span className="font-bold text-sm text-slate-700 truncate max-w-[120px]">{getTechnicianName(pond.assigned_staff)}</span>
                        </div>
                      </td>
                    )}

                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">

                        <button onClick={() => { setSelectedPond(pond); setShowDetailModal(true); }} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-all shadow-sm" title="Xem chi tiết">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        </button>

                        {isOwner && (
                          <>
                            <button onClick={() => { setForm({ pondName: pond.pond_name, area_m2: pond.area_m2, depth_m: pond.depth_m, assigned_staff: pond.assigned_staff || '', usage_status: pond.usage_status }); setSelectedPond(pond); setShowEditModal(true); }} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm" title="Chỉnh sửa">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>

                            <button onClick={() => handleToggleUsage(pond)} className={`p-2 rounded-lg border transition-all shadow-sm ${normalizeUpper(pond.usage_status) === 'HOAT_DONG' ? 'bg-white border-slate-200 text-rose-500 hover:bg-rose-50 hover:border-rose-200' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`} title={normalizeUpper(pond.usage_status) === 'HOAT_DONG' ? 'Tạm ngưng sử dụng' : 'Mở lại hoạt động'}>
                              {normalizeUpper(pond.usage_status) === 'HOAT_DONG' ? (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              )}
                            </button>

                            <button onClick={() => handleDelete(pond.pond_id)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm" title="Xóa ao">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </>
                        )}

                        {isTechnician && canConfirmRenovation(pond) && (
                          <button onClick={() => handleConfirmRenovation(pond)} className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all shadow-sm" title="Xác nhận xong cải tạo">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600 font-medium bg-white">
          <div className="flex items-center gap-3">
            <span>Hiển thị</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 outline-none bg-slate-50 focus:border-emerald-500">
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>({filteredPonds.length > 0 ? startIndex + 1 : 0} - {endIndex} / {filteredPonds.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={safePage <= 1} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Trước</button>
            <div className="flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">{safePage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={safePage >= totalPages} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Sau</button>
          </div>
        </div>
      </div>

      {/* ================= MODALS ================= */}
      {/* Modal View Detail */}
      {showDetailModal && selectedPond && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white max-w-3xl w-full p-6 md:p-8 rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-extrabold text-slate-800">Hồ sơ {selectedPond.pond_code}</h2>
              <button onClick={() => setShowDetailModal(false)} className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 md:col-span-3 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tên ao</span>
                  <strong className="text-lg text-slate-800">{selectedPond.pond_name}</strong>
                </div>
                {getPondStatusBadge(selectedPond.status)}
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Diện tích</span>
                <strong className="text-lg text-slate-800">{formatRoundedNumber(selectedPond.area_m2)} m²</strong>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Độ sâu</span>
                <strong className="text-lg text-slate-800">{formatRoundedNumber(selectedPond.depth_m)} m</strong>
              </div>

              {/* 🌟 HIỂN THỊ THỜI GIAN CẬP NHẬT TRONG CHI TIẾT */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Cập nhật lần cuối</span>
                <strong className="text-base text-slate-800">{selectedPond.updated_at ? formatDateTime(selectedPond.updated_at) : '-'}</strong>
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 md:col-span-1">
                <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Kỹ sư quản lý</span>
                <strong className="text-base text-slate-800">{selectedPond.technician_name || getTechnicianName(selectedPond.assigned_staff) || '-'}</strong>
              </div>

              {isOwner && (
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2">
                  <span className="text-xs font-bold text-slate-500 uppercase block mb-1">Công nhân trực</span>
                  <strong className="text-base text-slate-800">{(selectedPond.workers || []).map(w => w.full_name || w.username).join(', ') || '-'}</strong>
                </div>
              )}
            </div>

            <button onClick={() => setShowDetailModal(false)} className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng hồ sơ</button>
          </div>
        </div>
      )}

      {/* Modal Add/Edit */}
      {(showCreateModal || showEditModal) && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => { setShowCreateModal(false); setShowEditModal(false) }}>
          <div className="bg-white max-w-md w-full p-6 md:p-8 rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <h2 className="text-2xl font-extrabold text-slate-800 mb-6">{showEditModal ? 'Cập nhật ao nuôi' : 'Thêm ao mới'}</h2>
            <form onSubmit={showEditModal ? handleEditSubmit : handleCreateSubmit} className="flex flex-col gap-4">
              {showEditModal && <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Mã ao</label><input value={selectedPond?.pond_code || ''} disabled className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold" /></div>}
              <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Tên ao <span className="text-rose-500">*</span></label><input value={form.pondName} onChange={(e) => setForm({ ...form, pondName: e.target.value })} required className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Diện tích (m²) <span className="text-rose-500">*</span></label><input type="number" min="0" step="0.01" value={form.area_m2} onChange={(e) => setForm({ ...form, area_m2: e.target.value })} required className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Độ sâu (m) <span className="text-rose-500">*</span></label><input type="number" min="0" step="0.01" value={form.depth_m} onChange={(e) => setForm({ ...form, depth_m: e.target.value })} required className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium" /></div>
              </div>
              <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Kỹ sư phụ trách</label><select value={form.assigned_staff} onChange={(e) => setForm({ ...form, assigned_staff: e.target.value })} className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 font-medium"><option value="">-- Không phân công --</option>{technicianOptions.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              {showEditModal && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-bold text-slate-700">Tình trạng sử dụng</label>
                  <select 
                    value={form.usage_status} 
                    onChange={(e) => setForm({...form, usage_status: e.target.value})} 
                    disabled={['DANG_NUOI', 'CHUAN_BI_NUOI', 'DANG_XU_LY', 'DANG_CAI_TAO'].includes(normalizeUpper(selectedPond?.status))}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 font-medium disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    <option value="HOAT_DONG">Hoạt động</option>
                    {!['DANG_NUOI', 'CHUAN_BI_NUOI', 'DANG_XU_LY', 'DANG_CAI_TAO'].includes(normalizeUpper(selectedPond?.status)) && (
                      <option value="NGUNG_SU_DUNG">Ngưng sử dụng</option>
                    )}
                  </select>
                  {['DANG_NUOI', 'CHUAN_BI_NUOI', 'DANG_XU_LY', 'DANG_CAI_TAO'].includes(normalizeUpper(selectedPond?.status)) && (
                    <span className="text-xs text-rose-500 font-medium italic">* Không thể ngưng sử dụng vì ao đang vướng lịch vụ nuôi</span>
                  )}
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => { setShowCreateModal(false); setShowEditModal(false) }} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                <button type="submit" disabled={saving} className="px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95 transition-all">{saving ? 'Đang xử lý...' : 'Lưu dữ liệu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Matrix Kỹ sư */}
      {showAssignmentModal && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowAssignmentModal(false)}>
          <div className="bg-white max-w-5xl w-full p-6 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-2xl font-extrabold text-slate-800">Phân công Kỹ sư quản lý</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Đánh dấu check để bàn giao ao cho kỹ sư tương ứng</p>
              </div>
              <button onClick={() => setShowAssignmentModal(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-xl font-bold transition-colors">&times;</button>
            </div>

            <div className="flex-1 overflow-auto border border-slate-200 rounded-[16px] shadow-sm">
              <table className="w-full text-center border-collapse">
                <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-4 border-r border-slate-200 text-left font-bold text-slate-600">Nhân sự</th>
                    {ponds.map(p => <th key={p.pond_id} className="px-3 py-4 text-xs font-bold text-slate-600 whitespace-nowrap" title={p.pond_name}>{p.pond_code}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {technicianOptions.map(tech => (
                    <tr key={tech.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-4 py-3 border-r border-slate-200 text-left">
                        <strong className="block text-slate-800 text-sm">{tech.name}</strong>
                        <span className={`text-[10px] font-bold uppercase ${tech.isActive ? 'text-emerald-500' : 'text-rose-500'}`}>{tech.isActive ? 'Active' : 'Locked'}</span>
                      </td>
                      {ponds.map(pond => {
                        const isAssigned = Number(pond.assigned_staff) === Number(tech.id);
                        const isDisabled = (Boolean(pond.assigned_staff) && !isAssigned) || !tech.isActive || Boolean(busyAssignmentKey);
                        return (
                          <td key={pond.pond_id} className="px-3 py-3">
                            <input type="checkbox" checked={isAssigned} disabled={isDisabled} onChange={(e) => handleAssignTech(pond, tech.id, e.target.checked)} className="w-4 h-4 cursor-pointer text-emerald-500 focus:ring-emerald-500 rounded disabled:opacity-30 border-slate-300" />
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end mt-6 pt-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowAssignmentModal(false)} className="px-8 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng bảng</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PondsPage;