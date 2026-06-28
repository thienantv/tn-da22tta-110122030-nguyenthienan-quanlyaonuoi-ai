import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { seasonService, pondService, userService, productService, taskService } from '../../services/api';
import { showToast } from '../../utils/toast';
import { useAuth } from '../../context/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const emptyCreateForm = { pondIds: [], seasonName: '', startDate: '', expectedHarvestDate: '', density: '', seedQuantity: '', note: '' };
const emptyHarvestForm = { actualHarvestDate: '', harvestWeightKg: '', note: '' };

const CHART_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const normalizeText = (s) => String(s || '').toLowerCase();
const normalizeUpper = (s) => String(s || '').toUpperCase();

const formatVietnameseDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
};

const formatRoundedNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isNaN(num) ? value : String(Math.round(num));
};

const toDateOnly = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const seasonDays = (season) => {
  if (!season?.start_date) return '-';
  const start = new Date(season.start_date);
  const endDateRaw = season.actual_harvest || season.actual_harvest_date || season.harvest_date;
  const end = endDateRaw ? new Date(endDateRaw) : new Date();
  const diff = Math.floor((end - start) / 86400000);
  return diff >= 0 ? diff : 0;
};

const normalizeSeasonStatus = (status) => {
  const s = normalizeUpper(status);
  if (['CHUAN_BI_NUOI', 'PLANNED', 'READY'].includes(s)) return 'CHUAN_BI_NUOI';
  if (['DANG_NUOI', 'RUNNING', 'IN_PROGRESS'].includes(s)) return 'DANG_NUOI';
  if (['COMPLETED', 'DA_THU_HOACH', 'FINISHED'].includes(s)) return 'DA_THU_HOACH';
  return s;
};

const getSeasonStatusBadge = (code) => {
  const s = normalizeSeasonStatus(code);
  if (s === 'DANG_NUOI') return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200 shadow-sm">Đang nuôi</span>;
  if (s === 'CHUAN_BI_NUOI') return <span className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-bold border border-violet-200 shadow-sm">Chuẩn bị nuôi</span>;
  if (s === 'DA_THU_HOACH') return <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold border border-sky-200 shadow-sm">Đã thu hoạch</span>;
  return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200 shadow-sm">{code || '-'}</span>;
};

const Sparkline = ({ color }) => (
  <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const SOP_SECTIONS = [
    { id: '5', title: '🧪 Đo môi trường nước (2 cữ/ngày)', hasMaterial: false },
    { id: '2', title: '🦐 Cho tôm ăn (4 cữ/ngày)', hasMaterial: true },
    { id: '3', title: '🧬 Xử lý nước & Cấy vi sinh (Định kỳ)', hasMaterial: true },
    { id: '4', title: '🧹 Xi phong & Thay nước (Từ ngày 30)', hasMaterial: false },
    { id: '6', title: '🎯 Thu hoạch', hasMaterial: false },
];

const initialSopConfig = {
    '5': { workers: [], materials: [] },
    '2': { workers: [], materials: [{ product_id: '', quantity: '' }] },
    '3': { workers: [], materials: [{ product_id: '', quantity: '' }] },
    '4': { workers: [], materials: [] },
    '6': { workers: [], materials: [] },
};

const SeasonsPage = ({ roleLabel = 'Owner' }) => {
  const { user } = useAuth();
  const isOwner = roleLabel === 'Owner';
  const isTechnician = roleLabel === 'Technician';

  const [seasons, setSeasons] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  
  const [workers, setWorkers] = useState([]);
  const [products, setProducts] = useState([]);
  const [recentSeasonsForSOP, setRecentSeasonsForSOP] = useState([]); 
  const [sopConfig, setSopConfig] = useState(initialSopConfig);
  const [isSopLoading, setIsSopLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('ALL');
  const [technicianFilter, setTechnicianFilter] = useState('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHarvestModal, setShowHarvestModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showHarvestSummaryModal, setShowHarvestSummaryModal] = useState(false);
  
  const [showSopConfirmModal, setShowSopConfirmModal] = useState(false);
  const [showSopConfigModal, setShowSopConfigModal] = useState(false);

  const [selectedSeason, setSelectedSeason] = useState(null);
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [harvestForm, setHarvestForm] = useState(emptyHarvestForm);

  useEffect(() => { fetchData(); }, [roleLabel]);

  useEffect(() => {
      if (showSopConfigModal && workers.length === 0) {
          loadSopDependencies();
      }
  }, [showSopConfigModal]);

  const fetchData = async () => {
    try {
      setLoading(true); 
      const [seasonsRes, pondsRes] = await Promise.all([
        seasonService.getAllSeasons(),
        pondService.getAllPonds()
      ]);
      setSeasons(seasonsRes?.data?.data || []);
      setPonds(pondsRes?.data?.data || []);

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

  const loadSopDependencies = async () => {
      try {
          const [workerRes, prodRes] = await Promise.all([
              taskService.getWorkersStatus(),
              productService.getProducts()
          ]);
          
          const workerList = workerRes?.data?.data || [];
          setWorkers(workerList);
          setProducts(prodRes?.data?.data || []);
      } catch (err) {
          showToast({ title: 'Lỗi tải danh sách Công nhân/Vật tư', type: 'error' });
      }
  };

  const getPondName = useCallback((pondId) => {
    const found = ponds.find((p) => Number(p.pond_id) === Number(pondId));
    return found ? (found.pond_name || found.pond_code) : '-';
  }, [ponds]);

  const seasonStatusOptions = [
    { value: 'ALL', label: 'Tất cả trạng thái' },
    { value: 'CHUAN_BI_NUOI', label: 'Chuẩn bị nuôi' },
    { value: 'DANG_NUOI', label: 'Đang nuôi' },
    { value: 'DA_THU_HOACH', label: 'Đã thu hoạch' },
  ];

  const technicianOptions = useMemo(() => {
    return technicians.map(t => ({ id: t.user_id, name: t.full_name || t.username }));
  }, [technicians]);

  const filteredSeasons = useMemo(() => {
    return seasons.filter((s) => {
      const matchSearch = !searchTerm || normalizeText(s.season_name).includes(normalizeText(searchTerm)) || normalizeText(getPondName(s.pond_id)).includes(normalizeText(searchTerm));
      const matchState = stateFilter === 'ALL' || normalizeSeasonStatus(s.status) === stateFilter;
      const matchTech = !isOwner || technicianFilter === 'ALL' || normalizeText(s.technician_name || s.technician || '') === normalizeText(technicianFilter);

      const from = dateFrom ? toDateOnly(new Date(dateFrom)) : null;
      const startD = s.start_date ? toDateOnly(new Date(s.start_date)) : null;
      const matchDateExact = !from || (startD && startD.getTime() === from.getTime());

      return matchSearch && matchState && matchTech && matchDateExact;
    }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }, [seasons, searchTerm, stateFilter, technicianFilter, dateFrom, isOwner, getPondName]);

  const eligiblePonds = useMemo(() => ponds.filter(p => {
    if (normalizeUpper(p.usage_status) === 'NGUNG_SU_DUNG') return false;
    if (normalizeUpper(p.status) !== 'TAM_NGUNG') return false;
    return true;
  }), [ponds]);

  const editPondOptions = useMemo(() => {
    if (!selectedSeason?.season_id) return eligiblePonds;
    const currentPondId = Number(selectedSeason.pond_id);
    const currentPond = ponds.find(p => Number(p.pond_id) === currentPondId) || { pond_id: currentPondId, pond_name: getPondName(currentPondId), pond_code: selectedSeason.pond_code };
    const merged = [currentPond, ...eligiblePonds];
    return Array.from(new Map(merged.map(item => [item.pond_id, item])).values());
  }, [eligiblePonds, ponds, selectedSeason, getPondName]);

  const totalPages = Math.max(1, Math.ceil(filteredSeasons.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredSeasons.length);
  const paginatedSeasons = filteredSeasons.slice(startIndex, endIndex);

  const stats = useMemo(() => ({
    total: seasons.length,
    preparing: seasons.filter(s => normalizeSeasonStatus(s.status) === 'CHUAN_BI_NUOI').length,
    running: seasons.filter(s => normalizeSeasonStatus(s.status) === 'DANG_NUOI').length,
    completed: seasons.filter(s => normalizeSeasonStatus(s.status) === 'DA_THU_HOACH').length,
  }), [seasons]);

  const seasonChartData = [
    { label: 'Đang nuôi', value: stats.running, color: '#10b981' },
    { label: 'Chuẩn bị nuôi', value: stats.preparing, color: '#8b5cf6' },
    { label: 'Đã thu hoạch', value: stats.completed, color: '#0ea5e9' },
  ].filter(d => d.value > 0);

  const pondsProgress = useMemo(() => {
    const runningSeasons = seasons.filter(s => normalizeSeasonStatus(s.status) === 'DANG_NUOI');
    return runningSeasons.map((s, idx) => ({
      label: getPondName(s.pond_id),
      value: seasonDays(s) === '-' ? 0 : Number(seasonDays(s)),
      color: CHART_COLORS[idx % CHART_COLORS.length]
    })).slice(0, 6);
  }, [seasons, getPondName]);

  const getFilteredProducts = useCallback((typeId) => {
    const type = String(typeId);
    return products.filter(p => {
        const catCode = String(p.category_code || '').toUpperCase();
        if (type === '2') return ['CAT-THUC-AN', 'CAT-THUOC', 'CAT-KHOANG-VITAMIN', 'CAT-VI-SINH'].includes(catCode);
        if (type === '3') return ['CAT-HOA-CHAT', 'CAT-VI-SINH', 'CAT-KHOANG-VITAMIN'].includes(catCode);
        return true;
    });
  }, [products]);

  const toggleSopWorker = (typeId, workerId) => {
      setSopConfig(prev => {
          const current = prev[typeId].workers;
          const updated = current.includes(workerId) ? current.filter(id => id !== workerId) : [...current, workerId];
          return { ...prev, [typeId]: { ...prev[typeId], workers: updated } };
      });
  };

  const addSopMaterial = (typeId) => {
      setSopConfig(prev => ({
          ...prev, [typeId]: { ...prev[typeId], materials: [...prev[typeId].materials, { product_id: '', quantity: '' }] }
      }));
  };

  const removeSopMaterial = (typeId, index) => {
      setSopConfig(prev => ({
          ...prev, [typeId]: { ...prev[typeId], materials: prev[typeId].materials.filter((_, i) => i !== index) }
      }));
  };

  const updateSopMaterial = (typeId, index, field, value) => {
      setSopConfig(prev => {
          const newMats = [...prev[typeId].materials];
          newMats[index][field] = value;
          return { ...prev, [typeId]: { ...prev[typeId], materials: newMats } };
      });
  };

  const handleGenerateSopSubmit = async () => {
      if (recentSeasonsForSOP.length === 0) return;
      setIsSopLoading(true);
      
      try {
          for (const season of recentSeasonsForSOP) {
              await seasonService.generateSOP(season.season_id, { 
                  templateConfig: sopConfig 
              });
          }
          showToast({ title: 'Thiết lập và Bơm Lịch trình SOP thành công!', type: 'success' });
          setShowSopConfigModal(false);
          setSopConfig(initialSopConfig);
          fetchData(); 
      } catch (err) {
          showToast({ title: err?.response?.data?.message || 'Lỗi hệ thống khi sinh SOP', type: 'error' });
      } finally {
          setIsSopLoading(false);
      }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const isEditing = Boolean(selectedSeason?.season_id);

    if (createForm.pondIds.length === 0) {
      return showToast({ title: 'Vui lòng chọn ít nhất 1 ao nuôi', type: 'warning' });
    }

    setSaving(true);
    try {
      const payload = {
        pondIds: createForm.pondIds, 
        seasonName: createForm.seasonName.trim(),
        startDate: createForm.startDate,
        expectedHarvestDate: createForm.expectedHarvestDate || null,
        shrimpType: isEditing ? (selectedSeason.shrimp_type || 'Tôm sú') : 'Tôm sú', 
        density: Number(createForm.density),
        quantitySeed: Number(createForm.seedQuantity || 0),
        note: createForm.note?.trim() || null,
      };

      if (isEditing) {
        await seasonService.updateSeason(selectedSeason.season_id, payload);
        showToast({ title: 'Cập nhật mùa vụ thành công', type: 'success' });
        setShowCreateModal(false);
        fetchData();
      } else {
        const res = await seasonService.createSeason(payload);
        showToast({ title: `Đã tạo kế hoạch mùa vụ cho ${createForm.pondIds.length} ao`, type: 'success' });
        setShowCreateModal(false);
        fetchData(); 

        if (res?.data?.data?.length > 0) {
            setRecentSeasonsForSOP(res.data.data);
            setShowSopConfirmModal(true);
        }
      }
    } catch (err) {
      showToast({ title: err?.response?.data?.message || 'Lỗi lưu mùa vụ', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleHarvestSubmit = async (e) => {
    e.preventDefault();
    try {
      if (!window.confirm('Xác nhận thu hoạch mùa vụ? Ao sẽ chuyển sang trạng thái Đang xử lý.')) return;
      setSaving(true);
      await seasonService.harvestSeason(selectedSeason.season_id, {
        actualHarvestDate: harvestForm.actualHarvestDate, harvestWeightKg: Number(harvestForm.harvestWeightKg), harvestNote: harvestForm.note.trim() || null,
      });
      showToast({ title: 'Thu hoạch thành công', type: 'success' });
      setShowHarvestModal(false);
      fetchData();
    } catch (err) { showToast({ title: err?.response?.data?.message || 'Lỗi thu hoạch', type: 'error' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (season) => {
    if (!window.confirm(`Xác nhận xóa mùa vụ "${season.season_name}"? Mọi công việc chưa hoàn thành sẽ bị xóa.`)) return;
    try {
      await seasonService.deleteSeason(season.season_id);
      showToast({ title: 'Xóa thành công, Ao đã quay về Tạm Ngưng', type: 'success' });
      fetchData();
    } catch (err) { showToast({ title: err?.response?.data?.message || 'Lỗi xóa mùa vụ', type: 'error' }); }
  };

  if (loading && seasons.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">

      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Quản lý Mùa Vụ</h1>
          <p className="text-slate-500 font-medium mt-1.5">{isOwner ? 'Theo dõi tổng quan các vụ nuôi trong trang trại' : 'Lập kế hoạch, theo dõi và thu hoạch vụ nuôi'}</p>
        </div>

        {isTechnician && (
          <div className="relative z-10 w-full md:w-auto">
            <button onClick={() => { setCreateForm(emptyCreateForm); setSelectedSeason(null); setShowCreateModal(true); }} className="w-full md:w-auto px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
              <span className="text-xl leading-none">+</span> Lên Kế hoạch Vụ mới
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5 mb-6">
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Tổng mùa vụ</span><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">📊</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.total}</strong>
          <div className="mt-2"><Sparkline color="#94a3b8" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Đang nuôi</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">🦐</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.running}</strong>
          <div className="mt-2"><Sparkline color="#10b981" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Chuẩn bị nuôi</span><div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-500">💧</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.preparing}</strong>
          <div className="mt-2"><Sparkline color="#8b5cf6" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Đã thu hoạch</span><div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">🎉</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.completed}</strong>
          <div className="mt-2"><Sparkline color="#0ea5e9" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">TB Ngày nuôi</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">⏱️</div></div>
          <strong className="block text-3xl font-black text-slate-800">{filteredSeasons.length > 0 ? formatRoundedNumber(filteredSeasons.reduce((s, i) => s + (seasonDays(i) === '-' ? 0 : Number(seasonDays(i))), 0) / filteredSeasons.length) : '-'}</strong>
          <div className="mt-2"><Sparkline color="#f59e0b" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
          {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
          <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Tiến độ ngày nuôi (Ao đang chạy)</h3>
          <div className="flex-1 h-[180px] relative z-0">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={pondsProgress} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[6, 6, 6, 6]} maxBarSize={40}>
                  {pondsProgress.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
          {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
          <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Trạng thái tổng quan mùa vụ</h3>
          <div className="flex-1 flex items-center relative z-0">
            <div className="w-1/2 h-[180px]">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={seasonChartData} innerRadius="65%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                    {seasonChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center">
              {seasonChartData.map(item => (
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
      </div>

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
            <input type="text" placeholder="Tìm theo tên mùa vụ hoặc ao..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={stateFilter} onChange={(e) => { setStateFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer w-full sm:w-auto">
              {seasonStatusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            {isOwner && (
              <select value={technicianFilter} onChange={(e) => { setTechnicianFilter(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer w-full sm:w-auto">
                <option value="ALL">Kỹ sư phụ trách (Tất cả)</option>
                {technicianOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
              </select>
            )}

            <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm cursor-pointer w-full sm:w-auto" title="Lọc theo ngày thả" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin Mùa Vụ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Giống / Mật độ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Lịch trình</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[220px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedSeasons.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-medium text-lg">Không tìm thấy dữ liệu mùa vụ.</td></tr>
              ) : (
                paginatedSeasons.map(season => {
                  const statusNorm = normalizeSeasonStatus(season.status);
                  const canStart = isTechnician && statusNorm === 'CHUAN_BI_NUOI';
                  const canEdit = isTechnician && statusNorm === 'CHUAN_BI_NUOI';
                  const canDelete = isTechnician && statusNorm === 'CHUAN_BI_NUOI';
                  const canHarvest = isTechnician && statusNorm === 'DANG_NUOI';
                  const canViewSummary = statusNorm === 'DA_THU_HOACH';
                  
                  // 🌟 KIỂM TRA ĐÃ CÓ TASK CHƯA (Backend trả về biến task_count)
                  const hasSop = Number(season.task_count) > 0;

                  return (
                    <tr key={season.season_id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <strong className="block text-slate-800 text-base">{season.season_name}</strong>
                        <div className="text-sm font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">Ao: <span className="font-bold text-emerald-600">{getPondName(season.pond_id)}</span></div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-bold text-slate-700">{season.shrimp_type || 'Tôm sú'}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{formatRoundedNumber(season.density)} con/m²</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-slate-700"><span className="text-slate-400">Thả:</span> {formatVietnameseDate(season.start_date)}</div>
                        <div className="text-xs font-bold text-sky-600 mt-0.5">{seasonDays(season)} ngày tuổi</div>
                      </td>
                      <td className="px-6 py-4 text-center">{getSeasonStatusBadge(season.status)}</td>

                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">

                          <button onClick={() => { setSelectedSeason(season); setShowDetailModal(true); }} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-all shadow-sm" title="Xem chi tiết">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </button>

                          {canViewSummary && (
                            <button onClick={() => { setSelectedSeason(season); setShowHarvestSummaryModal(true); }} className="p-2 rounded-lg bg-sky-50 border border-sky-200 text-sky-600 hover:bg-sky-100 transition-all shadow-sm" title="Tổng kết thu hoạch">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </button>
                          )}

                          {isTechnician && (
                            <>                              
                              {/* 🌟 NÚT CẤU HÌNH SOP ĐÃ ĐƯỢC BẢO VỆ CHỐNG TRÙNG LẶP */}
                              {canStart && (
                                <button 
                                  onClick={() => { if(!hasSop) { setRecentSeasonsForSOP([season]); setShowSopConfigModal(true); } }} 
                                  disabled={hasSop}
                                  className={`p-2 rounded-lg border transition-all shadow-sm ${hasSop ? 'bg-slate-50 border-slate-200 text-emerald-500 cursor-not-allowed opacity-80' : 'bg-white border-slate-200 text-slate-500 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200'}`} 
                                  title={hasSop ? "Lịch trình SOP đã được thiết lập" : "Thiết lập Lịch trình SOP tự động"}>
                                  {hasSop ? '✅' : '⚙️'}
                                </button>
                              )}

                              {canEdit && (
                                <button onClick={() => {
                                  setSelectedSeason(season);
                                  setCreateForm({
                                    pondIds: [season.pond_id],
                                    seasonName: season.season_name,
                                    startDate: season.start_date?.split('T')[0] || '',
                                    expectedHarvestDate: season.expected_harvest?.split('T')[0] || '',
                                    density: season.density,
                                    seedQuantity: season.seed_quantity || season.quantity_seed || '',
                                    note: season.note || ''
                                  });
                                  setShowCreateModal(true);
                                }} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm" title="Chỉnh sửa Kế hoạch">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                                </button>
                              )}

                              {canHarvest && (
                                <button onClick={() => { setSelectedSeason(season); setHarvestForm(emptyHarvestForm); setShowHarvestModal(true); }} className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 hover:bg-emerald-100 transition-all shadow-sm" title="Thu hoạch mùa vụ">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                                </button>
                              )}

                              {canDelete && (
                                <button onClick={() => handleDelete(season)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm" title="Xóa hủy Kế hoạch">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  )
                })
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
            <span>({filteredSeasons.length > 0 ? startIndex + 1 : 0} - {endIndex} / {filteredSeasons.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={safePage <= 1} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Trước</button>
            <div className="flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">{safePage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={safePage >= totalPages} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Sau</button>
          </div>
        </div>
      </div>

      {/* Modal View Detail */}
      {showDetailModal && selectedSeason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white max-w-3xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Chi tiết Mùa vụ</h2>
              <button onClick={() => setShowDetailModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 overflow-y-auto pr-2 pb-2">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 sm:col-span-3 flex justify-between items-center">
                <div><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tên mùa vụ</span><strong className="text-xl text-slate-800">{selectedSeason.season_name}</strong></div>
                <div>{getSeasonStatusBadge(selectedSeason.status)}</div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Mã vụ</span><strong className="text-base text-slate-800">#{selectedSeason.season_id}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ao nuôi</span><strong className="text-base text-emerald-600">{getPondName(selectedSeason.pond_id)}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Kỹ sư</span><strong className="text-base text-slate-800">{selectedSeason.technician_name || '-'}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Loại tôm</span><strong className="text-base text-slate-800">{selectedSeason.shrimp_type || 'Tôm sú'}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Mật độ</span><strong className="text-base text-slate-800">{formatRoundedNumber(selectedSeason.density)} con/m²</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Giống thả</span><strong className="text-base text-slate-800">{selectedSeason.quantity_seed ?? selectedSeason.seed_quantity ?? '-'}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ngày bắt đầu</span><strong className="text-base text-slate-800">{formatVietnameseDate(selectedSeason.start_date)}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Dự kiến thu</span><strong className="text-base text-slate-800">{formatVietnameseDate(selectedSeason.expected_harvest)}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Thực thu</span><strong className="text-base text-slate-800">{formatVietnameseDate(selectedSeason.actual_harvest || selectedSeason.actual_harvest_date || selectedSeason.harvest_date)}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2 sm:col-span-3"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ghi chú</span><p className="text-sm text-slate-700 m-0 whitespace-pre-line">{selectedSeason.note || '-'}</p></div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowDetailModal(false)} className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng hồ sơ</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Harvest Summary */}
      {showHarvestSummaryModal && selectedSeason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowHarvestSummaryModal(false)}>
          <div className="bg-white max-w-2xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-sky-600">Tổng kết Thu Hoạch 🎉</h2>
              <button onClick={() => setShowHarvestSummaryModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 pb-2">
              <div className="bg-sky-50 p-4 rounded-2xl border border-sky-100 col-span-2 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                <div><span className="text-xs font-bold text-sky-600 uppercase block mb-1">Tên mùa vụ</span><strong className="text-xl text-slate-800">{selectedSeason.season_name}</strong></div>
                <div className="sm:text-right"><span className="text-xs font-bold text-sky-600 uppercase block mb-1">Sản lượng (Kg)</span><strong className="text-2xl text-sky-700">{formatRoundedNumber(selectedSeason.harvest_weight_kg ?? selectedSeason.harvest_weight)}</strong></div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ao nuôi</span><strong className="text-base text-emerald-600">{getPondName(selectedSeason.pond_id)}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Loại tôm</span><strong className="text-base text-slate-800">{selectedSeason.shrimp_type || 'Tôm sú'}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ngày thả</span><strong className="text-base text-slate-800">{formatVietnameseDate(selectedSeason.start_date)}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ngày thu</span><strong className="text-base text-slate-800">{formatVietnameseDate(selectedSeason.actual_harvest || selectedSeason.actual_harvest_date || selectedSeason.harvest_date)}</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tổng thời gian nuôi</span><strong className="text-base text-sky-600">{selectedSeason.total_days || seasonDays(selectedSeason)} ngày</strong></div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ghi chú thu hoạch</span><p className="text-sm text-slate-700 m-0 whitespace-pre-line">{selectedSeason.harvest_note ?? selectedSeason.note ?? '-'}</p></div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setShowHarvestSummaryModal(false)} className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng tổng kết</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add/Edit (Technician Only) */}
      {showCreateModal && isTechnician && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white max-w-3xl w-full p-0 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-slate-100 bg-slate-50/50 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">
                {selectedSeason?.season_id ? 'Chỉnh sửa Mùa vụ' : 'Bắt đầu Mùa vụ mới'}
              </h2>
              <button type="button" onClick={() => setShowCreateModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-800 text-lg font-bold transition-colors shadow-sm">&times;</button>
            </div>

            <form onSubmit={handleCreateSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
                <div className="flex flex-col gap-6">
                  
                  {/* Khối 1: Ma trận Chọn Ao */}
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-bold text-slate-700 flex justify-between items-center">
                      <span>Chọn Ao nuôi áp dụng <span className="text-rose-500">*</span></span>
                      {!selectedSeason?.season_id && (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100 shadow-sm">
                          Có thể chọn nhiều
                        </span>
                      )}
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 bg-slate-50/50 p-4 rounded-2xl border border-slate-200 max-h-[240px] overflow-y-auto shadow-inner">
                      {(selectedSeason?.season_id ? editPondOptions : eligiblePonds).map(p => {
                        const isChecked = createForm.pondIds.includes(p.pond_id);
                        return (
                          <label 
                            key={p.pond_id} 
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${isChecked ? 'bg-emerald-50 border-emerald-500 shadow-md scale-[1.02]' : 'bg-white border-slate-200 hover:border-emerald-300 shadow-sm'}`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              disabled={Boolean(selectedSeason?.season_id)}
                              onChange={(e) => {
                                if (e.target.checked) setCreateForm(prev => ({...prev, pondIds: [...prev.pondIds, p.pond_id]}));
                                else setCreateForm(prev => ({...prev, pondIds: prev.pondIds.filter(id => id !== p.pond_id)}));
                              }}
                              className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 disabled:opacity-50"
                            />
                            <div className="flex flex-col flex-1 min-w-0">
                              <span className={`text-sm font-bold truncate ${isChecked ? 'text-emerald-700' : 'text-slate-700'}`}>{p.pond_code}</span>
                              <span className="text-[10px] text-slate-500 truncate w-full" title={p.pond_name}>{p.pond_name}</span>
                            </div>
                          </label>
                        )
                      })}
                      {!selectedSeason?.season_id && eligiblePonds.length === 0 && (
                        <div className="col-span-full text-center py-8 flex flex-col items-center justify-center gap-2">
                           <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">🔒</div>
                           <span className="text-slate-500 text-sm font-medium">Tất cả các ao đều đang có vụ nuôi hoặc bị khóa.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Khối 2: Tên mùa vụ */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">Tên mùa vụ <span className="text-rose-500">*</span></label>
                    <input value={createForm.seasonName} onChange={(e) => setCreateForm({ ...createForm, seasonName: e.target.value })} required placeholder="VD: Mùa 1/2024" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:bg-white bg-slate-50 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" />
                  </div>

                  {/* Khối 3: Cột mốc thời gian */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 bg-sky-50/50 p-4 sm:p-5 rounded-2xl border border-sky-100">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-sky-800">Ngày thả giống <span className="text-rose-500">*</span></label>
                      <input 
                        type="date" 
                        value={createForm.startDate} 
                        onChange={(e) => {
                          const newStartDate = e.target.value;
                          let autoHarvestDate = createForm.expectedHarvestDate;
                          
                          if (newStartDate) {
                            const startObj = new Date(newStartDate);
                            startObj.setDate(startObj.getDate() + 120);
                            autoHarvestDate = startObj.toISOString().split('T')[0];
                          }

                          setCreateForm({ 
                            ...createForm, 
                            startDate: newStartDate, 
                            expectedHarvestDate: autoHarvestDate 
                          });
                        }} 
                        required 
                        className="w-full px-4 py-3 border border-sky-200 rounded-xl focus:bg-white bg-white focus:ring-2 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all font-medium shadow-sm cursor-pointer" 
                      />
                    </div>
                    
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-sky-800">Dự kiến thu hoạch (Tự động tính 120 ngày)</label>
                      <input 
                        type="date" 
                        value={createForm.expectedHarvestDate} 
                        onChange={(e) => setCreateForm({ ...createForm, expectedHarvestDate: e.target.value })} 
                        className="w-full px-4 py-3 border border-sky-200 rounded-xl focus:bg-white bg-white focus:ring-2 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all font-medium shadow-sm cursor-pointer" 
                      />
                    </div>
                  </div>

                  {/* Khối 4: Sản lượng & Mật độ */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-slate-700">Mật độ thả (con/m²) <span className="text-rose-500">*</span></label>
                      <input type="number" step="0.01" min="0" value={createForm.density} onChange={(e) => setCreateForm({ ...createForm, density: e.target.value })} required placeholder="VD: 120" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:bg-white bg-slate-50 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-bold text-slate-700">Số lượng con giống <span className="text-rose-500">*</span></label>
                      <input type="number" step="1" min="0" value={createForm.seedQuantity} onChange={(e) => setCreateForm({ ...createForm, seedQuantity: e.target.value })} required placeholder="VD: 500000" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:bg-white bg-slate-50 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" />
                    </div>
                  </div>

                  {/* Khối 5: Ghi chú */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">Ghi chú (Tùy chọn)</label>
                    <textarea rows="3" value={createForm.note} onChange={(e) => setCreateForm({ ...createForm, note: e.target.value })} placeholder="Thông tin bổ sung về mùa vụ này..." className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:bg-white bg-slate-50 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium resize-none shadow-sm"></textarea>
                  </div>

                </div>
              </div>

              {/* Footer */}
              <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end gap-3">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Hủy bỏ</button>
                <button type="submit" disabled={saving || createForm.pondIds.length === 0} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95 transition-all">
                  {saving ? 'Đang xử lý...' : (selectedSeason?.season_id ? 'Lưu thay đổi' : `Kích hoạt vụ mới (${createForm.pondIds.length} ao)`)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Harvest (Technician Only) */}
      {showHarvestModal && isTechnician && selectedSeason && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowHarvestModal(false)}>
          <div className="bg-white max-w-md w-full p-0 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            
            <div className="flex justify-between items-center p-5 sm:p-6 border-b border-emerald-100 bg-emerald-50/50 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-emerald-700 flex items-center gap-2">
                <span>Tiến hành Thu hoạch</span>
                <span className="text-2xl">🦐</span>
              </h2>
              <button type="button" onClick={() => setShowHarvestModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-100 text-lg font-bold transition-colors shadow-sm">&times;</button>
            </div>

            <form onSubmit={handleHarvestSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-5 sm:p-6 flex-1 overflow-y-auto">
                
                <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-100 mb-6 text-sm text-slate-700 shadow-inner">
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-emerald-100/50">
                    <span className="font-medium">Mùa vụ:</span> 
                    <strong className="text-emerald-800 text-base">{selectedSeason.season_name}</strong>
                  </div>
                  <div className="flex justify-between items-center pb-2 mb-2 border-b border-emerald-100/50">
                    <span className="font-medium">Ao nuôi:</span> 
                    <strong className="text-slate-800">{getPondName(selectedSeason.pond_id)}</strong>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Thời gian đã nuôi:</span> 
                    <strong className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-100">{seasonDays(selectedSeason)} ngày</strong>
                  </div>
                </div>

                <div className="flex flex-col gap-5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">Ngày thu hoạch thực tế <span className="text-rose-500">*</span></label>
                    <input type="date" value={harvestForm.actualHarvestDate} onChange={(e) => setHarvestForm({ ...harvestForm, actualHarvestDate: e.target.value })} required className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:bg-white bg-slate-50 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm cursor-pointer" />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">Tổng sản lượng thu được <span className="text-rose-500">*</span></label>
                    <div className="relative">
                      <input type="number" step="0.01" min="0" value={harvestForm.harvestWeightKg} onChange={(e) => setHarvestForm({ ...harvestForm, harvestWeightKg: e.target.value })} required placeholder="Ví dụ: 1200.5" className="w-full pl-4 pr-16 py-3 border border-slate-300 rounded-xl focus:bg-white bg-slate-50 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm text-lg text-emerald-700 font-bold" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold bg-white px-2 py-1 rounded">KG</span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-bold text-slate-700">Ghi chú thêm (Tùy chọn)</label>
                    <textarea rows="3" value={harvestForm.note} onChange={(e) => setHarvestForm({ ...harvestForm, note: e.target.value })} placeholder="Kích cỡ tôm, tình trạng, giá bán..." className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:bg-white bg-slate-50 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium resize-none shadow-sm"></textarea>
                  </div>
                </div>
              </div>

              <div className="p-5 sm:p-6 border-t border-slate-100 bg-slate-50/50 shrink-0 flex justify-end gap-3">
                <button type="button" onClick={() => setShowHarvestModal(false)} className="px-6 py-3 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors shadow-sm">Hủy bỏ</button>
                <button type="submit" disabled={saving} className="px-6 py-3 bg-emerald-500 text-white font-bold rounded-xl hover:bg-emerald-600 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95 transition-all">
                  {saving ? 'Đang xử lý...' : 'Xác nhận Thu hoạch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 🌟 1. MODAL HỎI SAU KHI TẠO VỤ */}
      {showSopConfirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4" onClick={() => setShowSopConfirmModal(false)}>
          <div className="bg-white max-w-sm w-full p-6 text-center rounded-[24px] shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl shadow-inner">⚡</div>
            <h3 className="text-xl font-extrabold text-slate-800 mb-2">Sinh Lịch trình (SOP)?</h3>
            <p className="text-slate-600 text-sm mb-6">Mùa vụ đã được tạo. Bạn có muốn hệ thống tự động sinh 120 ngày công việc (Cho ăn, xử lý nước...) theo quy chuẩn không?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setShowSopConfirmModal(false); setShowSopConfigModal(true); }} className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md transition-all active:scale-95">Thiết lập SOP ngay</button>
              <button onClick={() => setShowSopConfirmModal(false)} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all">Để tự tạo sau</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 2. MODAL CẤU HÌNH SOP MASTER TEMPLATE */}
      {showSopConfigModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowSopConfigModal(false)}>
          <div className="bg-white max-w-4xl w-full p-0 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200 overflow-hidden" onClick={e => e.stopPropagation()}>
            
            <div className="p-5 sm:p-6 border-b border-slate-100 bg-slate-50/80 shrink-0 flex justify-between items-center">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Cấu hình Thiết lập SOP Mẫu</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Gán Nhân sự và Cám/Thuốc mặc định. Hệ thống sẽ tự động nhân bản ra 120 ngày.</p>
              </div>
              <button onClick={() => setShowSopConfigModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 font-bold shadow-sm">&times;</button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/30">
              <div className="flex flex-col gap-6">
                  {SOP_SECTIONS.map(sec => (
                      <div key={sec.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                          <h4 className="font-extrabold text-slate-800 mb-4 pb-2 border-b border-slate-100">{sec.title}</h4>
                          
                          {/* Khối chọn Công nhân */}
                          <div className="mb-5">
                              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2.5 block">Phân công Nhân sự (Mặc định)</label>
                              <div className="flex flex-wrap gap-2.5">
                                  {workers.length === 0 ? <span className="text-sm italic text-slate-400">Không có công nhân nào được phân công.</span> : workers.map(w => {
                                      const wId = w.worker_id || w.user_id;
                                      const isSelected = sopConfig[sec.id].workers.includes(wId);
                                      return (
                                          <label key={wId} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border cursor-pointer text-sm font-bold transition-all ${isSelected ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300'}`}>
                                              <input type="checkbox" className="hidden" checked={isSelected} onChange={() => toggleSopWorker(sec.id, wId)} />
                                              {w.full_name || w.username}
                                          </label>
                                      )
                                  })}
                              </div>
                          </div>

                          {/* Khối chọn Vật tư */}
                          {sec.hasMaterial && (
                              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                  <div className="flex justify-between items-center mb-3">
                                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">Vật tư / Thuốc xuất kho (Mặc định)</label>
                                      <button type="button" onClick={() => addSopMaterial(sec.id)} className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition-colors shadow-sm">+ Thêm vật tư</button>
                                  </div>
                                  <div className="flex flex-col gap-3">
                                      {sopConfig[sec.id].materials.map((mat, idx) => (
                                          <div key={idx} className="flex flex-wrap sm:flex-nowrap gap-2 items-center bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                                              <select value={mat.product_id} onChange={e => updateSopMaterial(sec.id, idx, 'product_id', e.target.value)} className="flex-1 min-w-[200px] p-2.5 text-sm font-bold text-slate-700 border-none bg-transparent outline-none cursor-pointer">
                                                  <option value="">-- Chọn sản phẩm trong kho --</option>
                                                  {getFilteredProducts(sec.id).map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
                                              </select>
                                              <div className="w-[1px] h-8 bg-slate-200 hidden sm:block"></div>
                                              <input type="number" step="0.01" value={mat.quantity} onChange={e => updateSopMaterial(sec.id, idx, 'quantity', e.target.value)} placeholder="Định mức (VD: 5)" className="w-full sm:w-32 p-2.5 text-sm font-bold text-slate-700 border-none bg-transparent outline-none text-center sm:text-left" />
                                              <div className="w-[1px] h-8 bg-slate-200 hidden sm:block"></div>
                                              <input type="text" value={products.find(p => String(p.product_id) === String(mat.product_id))?.unit || '-'} disabled className="w-16 sm:w-20 p-2.5 text-sm font-bold text-slate-500 border-none bg-transparent outline-none text-center cursor-not-allowed" title="Đơn vị tính" />
                                              
                                              <button type="button" onClick={() => removeSopMaterial(sec.id, idx)} disabled={sopConfig[sec.id].materials.length === 1} className="w-10 h-10 flex items-center justify-center text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors ml-auto sm:ml-0 disabled:opacity-30">
                                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                              </button>
                                          </div>
                                      ))}
                                      {sopConfig[sec.id].materials.length === 0 && (
                                          <span className="text-xs text-slate-400 italic">Không có vật tư nào được chọn.</span>
                                      )}
                                  </div>
                              </div>
                          )}
                      </div>
                  ))}
              </div>
            </div>

            <div className="p-5 sm:p-6 border-t border-slate-100 bg-white shrink-0 flex justify-end gap-3">
              <button type="button" onClick={() => setShowSopConfigModal(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng lại</button>
              <button type="button" onClick={handleGenerateSopSubmit} disabled={isSopLoading} className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2">
                {isSopLoading ? (
                    <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> Đang bơm dữ liệu...</>
                ) : 'Phát lệnh SOP'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SeasonsPage;