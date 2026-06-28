import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { environmentLogService, userService } from '../../services/api';
import { showToast } from '../../utils/toast';
import { useAuth } from '../../context/AuthContext';
import { AreaChart, Area, ResponsiveContainer, Tooltip, YAxis, ReferenceLine } from 'recharts';

const emptyForm = { pondId: '', ph: '', temperature: '', oxygen: '', salinity: '', turbidity: '' };

const defaultISODate = (d) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const initialDateTo = defaultISODate(new Date());
const initialDateFrom = defaultISODate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));

const METRIC_CONFIG = [
  { key: 'ph', label: 'pH', unit: 'pH', color: '#0ea5e9' }, // Sky
  { key: 'temperature', label: 'Nhiệt độ', unit: '°C', color: '#10b981' }, // Emerald
  { key: 'oxygen', label: 'Oxy (DO)', unit: 'mg/L', color: '#8b5cf6' }, // Violet
  { key: 'salinity', label: 'Độ mặn', unit: 'ppt', color: '#f59e0b' }, // Amber
  { key: 'turbidity', label: 'Độ đục', unit: 'NTU', color: '#64748b' }, // Slate
];

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
};

const formatShortTime = (value) => {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--:--';
  return new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
};

const formatNumber = (value) => {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (Number.isNaN(number)) return '-';
  return (Math.round(number * 100) / 100).toFixed(2);
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

// Tooltip cho Biểu đồ Recharts
const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700">
        {payload[0].payload.time}: <span className="text-emerald-400">{payload[0].value}</span>
      </div>
    );
  }
  return null;
};

// Sparkline cho KPI Cards
const Sparkline = ({ color }) => (
  <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const isOutOfRange = (log, thresholds) => {
  const ph = toNumber(log.ph), temperature = toNumber(log.temperature), oxygen = toNumber(log.oxygen), salinity = toNumber(log.salinity), turbidity = toNumber(log.turbidity);
  const minPh = toNumber(thresholds?.min_ph), maxPh = toNumber(thresholds?.max_ph), minTemp = toNumber(thresholds?.min_temp), maxTemp = toNumber(thresholds?.max_temp);
  const minOxygen = toNumber(thresholds?.min_oxygen), maxOxygen = toNumber(thresholds?.max_oxygen), minSalinity = toNumber(thresholds?.min_salinity), maxSalinity = toNumber(thresholds?.max_salinity);
  const minTurbidity = toNumber(thresholds?.min_turbidity), maxTurbidity = toNumber(thresholds?.max_turbidity);

  const generic = { ph: { min: 6.5, max: 8.5 }, temperature: { min: 25, max: 33 }, oxygen: { min: 4, max: 9 }, salinity: { min: 0, max: 35 }, turbidity: { min: 0, max: 10 } };
  const compare = (value, min, max, fallback) => {
    if (value === null) return false;
    const lower = min ?? fallback.min, upper = max ?? fallback.max;
    return value < lower || value > upper;
  };
  return compare(ph, minPh, maxPh, generic.ph) || compare(temperature, minTemp, maxTemp, generic.temperature) || compare(oxygen, minOxygen, maxOxygen, generic.oxygen) || compare(salinity, minSalinity, maxSalinity, generic.salinity) || compare(turbidity, minTurbidity, maxTurbidity, generic.turbidity);
};

const getMetricStatus = (metricKey, value, thresholds) => {
  if (value === null || value === undefined) return 'missing';
  const alertMode = String(thresholds?.alert_level || thresholds?.alertLevel || 'WARNING').toUpperCase();
  const metricRanges = {
    ph: { min: toNumber(thresholds?.min_ph), max: toNumber(thresholds?.max_ph), fallback: { min: 6.5, max: 8.5 } },
    temperature: { min: toNumber(thresholds?.min_temp), max: toNumber(thresholds?.max_temp), fallback: { min: 25, max: 33 } },
    oxygen: { min: toNumber(thresholds?.min_oxygen), max: toNumber(thresholds?.max_oxygen), fallback: { min: 4, max: 9 } },
    salinity: { min: toNumber(thresholds?.min_salinity), max: toNumber(thresholds?.max_salinity), fallback: { min: 0, max: 35 } },
    turbidity: { min: toNumber(thresholds?.min_turbidity), max: toNumber(thresholds?.max_turbidity), fallback: { min: 0, max: 10 } },
  };
  const range = metricRanges[metricKey];
  if (!range) return 'normal';
  const lower = range.min ?? range.fallback.min, upper = range.max ?? range.fallback.max;
  return value < lower || value > upper ? (alertMode === 'DANGER' ? 'danger' : 'warning') : 'normal';
};

// ============================================================================
// COMPONENT CHÍNH
// ============================================================================
const EnvironmentPage = ({ roleLabel = 'Owner' }) => {
  const { user, ponds } = useAuth();
  const isOwner = roleLabel === 'Owner';
  const isTechnician = roleLabel === 'Technician';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [environmentLogs, setEnvironmentLogs] = useState([]);
  const [thresholds, setThresholds] = useState(null);
  const [selectedPondId, setSelectedPondId] = useState('');
  const [showFormModal, setShowFormModal] = useState(false);

  const [dateFrom, setDateFrom] = useState(initialDateFrom);
  const [dateTo, setDateTo] = useState(initialDateTo);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [form, setForm] = useState(emptyForm);

  const [cooldownRemaining, setCooldownRemaining] = useState(0); // Lưu số giây đếm ngược

  // Hàm chuyển đổi giây sang định dạng mm:ss
  const formatCooldown = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // GỌI API CHÍNH XÁC NHƯ BẢN GỐC
  const loadPondData = useCallback(async (pondId) => {
    if (!pondId) { setEnvironmentLogs([]); setThresholds(null); return; }
    try {
      setLoading(true);
      const [logsRes, thresholdsRes] = await Promise.all([
        environmentLogService.getByPondId(pondId),
        environmentLogService.getThresholdsByPond(pondId)
      ]);
      let logs = logsRes?.data?.data || [];

      if (isOwner && logs.length > 0) {
        try {
          const usersRes = await userService.getAllUsers();
          const userMap = new Map((usersRes?.data?.data || []).map((u) => [String(u.user_id), u]));
          logs = logs.map((l) => {
            const creator = userMap.get(String(l.created_by)) || null;
            return { ...l, created_by_name: l.created_by_name || creator?.full_name || null, created_by_username: l.created_by_username || creator?.username || null };
          });
        } catch (err) { }
      }
      setEnvironmentLogs(logs);
      setThresholds(thresholdsRes?.data?.data || null);
    } catch (error) {
      setEnvironmentLogs([]); setThresholds(null);
      showToast({ title: 'Không tải được dữ liệu môi trường', type: 'error' });
    } finally { setLoading(false); }
  }, [isOwner]);

  useEffect(() => {
    if (ponds && ponds.length > 0) setSelectedPondId(String(ponds[0].pond_id || ponds[0].id));
    else setSelectedPondId('');
  }, [ponds]);

  useEffect(() => {
    if (selectedPondId) loadPondData(selectedPondId);
  }, [selectedPondId, loadPondData]);

  // Đếm ngược thời gian cooldown 30 phút
  useEffect(() => {
    // Chỉ chạy khi modal đang mở, form chọn đúng ao hiện tại và ao đó đã có dữ liệu
    if (!showFormModal || String(form.pondId) !== String(selectedPondId) || environmentLogs.length === 0) {
      setCooldownRemaining(0);
      return;
    }

    const latestLog = environmentLogs[0];
    if (!latestLog || !latestLog.recorded_at) {
      setCooldownRemaining(0);
      return;
    }

    const checkCooldown = () => {
      const lastTime = new Date(latestLog.recorded_at).getTime();
      const currentTime = new Date().getTime();
      const COOLDOWN_MS = 30 * 60 * 1000; // 30 phút tính bằng milliseconds
      const remainingMs = COOLDOWN_MS - (currentTime - lastTime);

      if (remainingMs > 0) {
        setCooldownRemaining(Math.ceil(remainingMs / 1000));
      } else {
        setCooldownRemaining(0);
      }
    };

    checkCooldown(); // Kiểm tra ngay lập tức
    const intervalId = setInterval(checkCooldown, 1000); // Sau đó lặp lại mỗi giây

    return () => clearInterval(intervalId); // Dọn dẹp interval khi đóng modal hoặc đổi ao
  }, [showFormModal, form.pondId, selectedPondId, environmentLogs]);

  const selectedPond = useMemo(() => (ponds || []).find((p) => String(p.pond_id || p.id) === String(selectedPondId)) || null, [ponds, selectedPondId]);
  const pondOptions = useMemo(() => (ponds || []).map((p) => ({ id: String(p.pond_id || p.id), label: `${p.pond_code || 'Ao'} ${p.pond_name ? `- ${p.pond_name}` : ''}` })), [ponds]);
  const orderedLogs = useMemo(() => [...environmentLogs].sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at)), [environmentLogs]);

  const filteredLogs = useMemo(() => {
    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) return [];
    const from = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date(0);
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : new Date();
    return orderedLogs.filter((log) => {
      const t = new Date(log.recorded_at).getTime();
      return t >= from.getTime() && t <= to.getTime();
    });
  }, [orderedLogs, dateFrom, dateTo]);

  const stats = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      ponds: (ponds || []).length,
      todayEntries: orderedLogs.filter((log) => new Date(log.recorded_at) >= today).length,
      anomalies: filteredLogs.filter((log) => isOutOfRange(log, thresholds)).length,
      latest: orderedLogs[orderedLogs.length - 1]?.recorded_at || null,
    };
  }, [filteredLogs, orderedLogs, ponds, thresholds]);

  const chartCards = useMemo(() => {
    const latestReading = filteredLogs[filteredLogs.length - 1] || null;

    // Áp dụng định mức an toàn để vẽ đường giới hạn (Reference Line)
    const metricRanges = {
      ph: { min: toNumber(thresholds?.min_ph), max: toNumber(thresholds?.max_ph), fallback: { min: 6.5, max: 8.5 } },
      temperature: { min: toNumber(thresholds?.min_temp), max: toNumber(thresholds?.max_temp), fallback: { min: 25, max: 33 } },
      oxygen: { min: toNumber(thresholds?.min_oxygen), max: toNumber(thresholds?.max_oxygen), fallback: { min: 4, max: 9 } },
      salinity: { min: toNumber(thresholds?.min_salinity), max: toNumber(thresholds?.max_salinity), fallback: { min: 0, max: 35 } },
      turbidity: { min: toNumber(thresholds?.min_turbidity), max: toNumber(thresholds?.max_turbidity), fallback: { min: 0, max: 10 } },
    };

    return METRIC_CONFIG.map((metric) => {
      const series = filteredLogs.map((log) => ({ time: formatShortTime(log.recorded_at), value: toNumber(log[metric.key]) })).filter(item => item.value !== null);
      const latestValue = series.length > 0 ? series[series.length - 1].value : null;
      const status = getMetricStatus(metric.key, toNumber(latestReading?.[metric.key]), thresholds);

      let statusColors = { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', stroke: '#10b981', label: 'Ổn định' };
      if (status === 'warning') statusColors = { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', stroke: '#f59e0b', label: 'Cảnh báo' };
      if (status === 'danger') statusColors = { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', stroke: '#f43f5e', label: 'Nguy hiểm' };
      if (status === 'missing') statusColors = { bg: 'bg-slate-50', text: 'text-slate-500', border: 'border-slate-200', stroke: '#94a3b8', label: 'Thiếu dữ liệu' };

      // Trích xuất ngưỡng min/max an toàn
      const safeRange = metricRanges[metric.key];
      const minSafe = safeRange.min ?? safeRange.fallback.min;
      const maxSafe = safeRange.max ?? safeRange.fallback.max;

      return { ...metric, latestValue, series, statusColors, minSafe, maxSafe };
    });
  }, [filteredLogs, thresholds]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // ========================================================
  // XỬ LÝ LƯU THÔNG SỐ (KÈM COOLDOWN 30 PHÚT TRÊN FRONTEND)
  // ========================================================
  const handleSubmit = async (e) => {
    e.preventDefault();

    const COOLDOWN_MINUTES = 30;

    // Lớp Bảo vệ 1 (Frontend): Chặn nếu nhập lại ao hiện tại trong vòng 30 phút
    if (String(form.pondId) === String(selectedPondId) && environmentLogs.length > 0) {
      // Dữ liệu từ API Backend getByPondId trả về ORDER BY recorded_at DESC, nên index [0] là mới nhất
      const latestLog = environmentLogs[0];

      if (latestLog && latestLog.recorded_at) {
        const lastTime = new Date(latestLog.recorded_at).getTime();
        const currentTime = new Date().getTime();
        const diffMinutes = (currentTime - lastTime) / (1000 * 60);

        if (diffMinutes < COOLDOWN_MINUTES) {
          const waitTime = Math.ceil(COOLDOWN_MINUTES - diffMinutes);
          showToast({
            title: `Hệ thống đang khóa chống spam. Vui lòng đợi thêm ${waitTime} phút nữa!`,
            type: 'warning'
          });
          return;
        }
      }
    }

    try {
      setSaving(true);
      await environmentLogService.createLog({
        pondId: Number(form.pondId),
        ph: Number(form.ph),
        temperature: Number(form.temperature),
        oxygen: Number(form.oxygen),
        salinity: Number(form.salinity),
        turbidity: Number(form.turbidity)
      });

      const nextPondId = String(form.pondId);
      showToast({ title: 'Đã lưu dữ liệu môi trường', type: 'success' });
      setShowFormModal(false);
      setForm((prev) => ({ ...emptyForm, pondId: prev.pondId }));

      if (nextPondId !== selectedPondId) {
        setSelectedPondId(nextPondId);
      } else {
        await loadPondData(nextPondId);
      }
    } catch (err) {
      // Lớp Bảo vệ 2 (Backend): Hiển thị thông báo lỗi nếu Backend chặn
      showToast({ title: err?.response?.data?.message || 'Lỗi lưu dữ liệu', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const creatorName = useCallback((log) => {
    if (log?.created_by_name) return log.created_by_name;
    if (log?.created_by_username) return log.created_by_username;
    if (String(log.created_by) === String(user?.user_id)) return user?.full_name || 'Bạn';
    if (!log.created_by) return '-';
    return `#${log.created_by}`;
  }, [user]);

  const searchedLogs = useMemo(() => {
    const term = String(searchTerm || '').trim().toLowerCase();
    if (!term) return filteredLogs;
    return filteredLogs.filter((item) => (creatorName(item) || '').toLowerCase().includes(term) || String(item.ph || '').toLowerCase().includes(term) || String(item.temperature || '').toLowerCase().includes(term));
  }, [filteredLogs, searchTerm, creatorName]);

  const totalPages = Math.max(1, Math.ceil(searchedLogs.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, searchedLogs.length);
  const paginatedLogs = searchedLogs.slice(startIndex, endIndex);

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">

      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Dữ liệu Môi trường</h1>
          <p className="text-slate-500 font-medium mt-1.5">{isOwner ? 'Xem nhật ký môi trường các ao do kỹ sư nhập (Chế độ xem)' : 'Theo dõi và nhập dữ liệu đo đạc thủ công hàng ngày'}</p>
        </div>

        {!isOwner && (
          <div className="relative z-10 w-full md:w-auto">
            <button onClick={() => { setForm(prev => ({ ...emptyForm, pondId: selectedPondId || pondOptions[0]?.id || '' })); setShowFormModal(true); }} className="w-full md:w-auto px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
              <span className="text-xl leading-none">+</span> Cập nhật Chỉ số
            </button>
          </div>
        )}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Ao đang phụ trách</span><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">💧</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.ponds}</strong>
          <div className="mt-2"><Sparkline color="#94a3b8" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Lượt nhập hôm nay</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">📝</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.todayEntries}</strong>
          <div className="mt-2"><Sparkline color="#10b981" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Chỉ số bất thường</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">⚠️</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.anomalies}</strong>
          <div className="mt-2"><Sparkline color="#f59e0b" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Cập nhật gần nhất</span><div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">⏱️</div></div>
          <strong className="block text-xl font-black text-slate-800 mt-2 truncate">{formatDateTime(stats.latest)}</strong>
          <div className="mt-1.5"><Sparkline color="#0ea5e9" /></div>
        </div>
      </div>

      {/* POND SELECTOR */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-2 scrollbar-hide">
        {pondOptions.map((pond) => {
          const isActive = String(selectedPondId) === String(pond.id);
          return (
            <button
              key={pond.id}
              onClick={() => setSelectedPondId(pond.id)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${isActive ? 'bg-slate-800 text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}
            >
              {pond.label}
            </button>
          )
        })}
      </div>

      {/* MINI CHARTS TRENDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-5 gap-4 md:gap-5 mb-6 relative">
        {chartCards.map((card) => (
          <div key={card.key} className={`relative p-5 rounded-[24px] border shadow-sm flex flex-col transition-colors overflow-hidden ${card.statusColors.bg} ${card.statusColors.border}`}>
            {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[1px] transition-all"></div>}
            <div className="flex justify-between items-start mb-4 relative z-0">
              <span className={`font-extrabold text-sm uppercase tracking-wider opacity-80 ${card.statusColors.text}`}>{card.label}</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border bg-white shadow-sm ${card.statusColors.text} ${card.statusColors.border}`}>{card.statusColors.label}</span>
            </div>
            <div className="flex items-end gap-1 mb-4 relative z-0">
              <span className={`text-4xl font-black ${card.statusColors.text}`}>{card.latestValue !== null ? formatNumber(card.latestValue) : '--'}</span>
              <span className={`font-bold mb-1 opacity-70 ${card.statusColors.text}`}>{card.unit}</span>
            </div>
            <div className="flex-1 h-[60px] w-full relative z-0">
              {card.series.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={card.series} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
                    <defs>
                      <linearGradient id={`gradient-${card.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={card.statusColors.stroke} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={card.statusColors.stroke} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Tooltip content={<CustomTooltip />} cursor={{ stroke: card.statusColors.stroke, strokeWidth: 1, strokeDasharray: '3 3' }} />

                    {/* 🌟 VẼ ĐƯỜNG GIỚI HẠN AN TOÀN (Ngưỡng trên và ngưỡng dưới) */}
                    <ReferenceLine y={card.maxSafe} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                    <ReferenceLine y={card.minSafe} stroke="#ef4444" strokeDasharray="3 3" strokeOpacity={0.5} />

                    {/* 🌟 VẼ ĐƯỜNG DỮ LIỆU CÓ CÁC CHẤM (DOTS) */}
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={card.statusColors.stroke}
                      strokeWidth={3}
                      fillOpacity={1}
                      fill={`url(#gradient-${card.key})`}
                      dot={{ r: 3.5, strokeWidth: 2, fill: '#fff', stroke: card.statusColors.stroke }}
                      activeDot={{ r: 6, strokeWidth: 0, fill: card.statusColors.stroke }}
                    />
                    <YAxis domain={['auto', 'auto']} hide />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-xs font-bold opacity-50">Chưa có dữ liệu</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* TABLE & FILTERS */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden relative">
        {loading && (
          <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
              <span className="font-bold text-slate-600">Đang tải dữ liệu...</span>
            </div>
          </div>
        )}

        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/30">
          <div className="relative w-full lg:w-[350px]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Tìm theo người nhập hoặc giá trị..." value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm" />
          </div>

          <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2 lg:pb-0">
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Từ ngày</label>
              <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm cursor-pointer" />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] font-bold text-slate-400 uppercase ml-1 mb-1">Đến ngày</label>
              <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 outline-none focus:border-emerald-500 shadow-sm cursor-pointer" />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thời gian</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã Ao</th>
                <th className="px-6 py-4 text-xs font-bold text-sky-600 uppercase tracking-wider text-center bg-sky-50/50">pH</th>
                <th className="px-6 py-4 text-xs font-bold text-emerald-600 uppercase tracking-wider text-center bg-emerald-50/50">Temp (°C)</th>
                <th className="px-6 py-4 text-xs font-bold text-violet-600 uppercase tracking-wider text-center bg-violet-50/50">DO (mg/L)</th>
                <th className="px-6 py-4 text-xs font-bold text-amber-600 uppercase tracking-wider text-center bg-amber-50/50">Salinity (ppt)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-600 uppercase tracking-wider text-center bg-slate-100/50">Turbidity (NTU)</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Nhân sự nhập</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedLogs.length === 0 ? (
                <tr><td colSpan={8} className="p-12 text-center text-slate-500 font-medium text-lg">Không có nhật ký nào trong khoảng thời gian này.</td></tr>
              ) : (
                paginatedLogs.map(item => (
                  <tr key={item.env_id || item.recorded_at} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <strong className="block text-slate-800 text-sm">{formatDateTime(item.recorded_at).split(' ')[1]}</strong>
                      <span className="text-xs font-medium text-slate-400">{formatDateTime(item.recorded_at).split(' ')[0]}</span>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-700">{selectedPond ? selectedPond.pond_code : `Ao ${item.pond_id}`}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700 bg-sky-50/20">{formatNumber(item.ph)}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700 bg-emerald-50/20">{formatNumber(item.temperature)}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700 bg-violet-50/20">{formatNumber(item.oxygen)}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700 bg-amber-50/20">{formatNumber(item.salinity)}</td>
                    <td className="px-6 py-4 text-center font-bold text-slate-700 bg-slate-50/50">{formatNumber(item.turbidity)}</td>
                    <td className="px-6 py-4 text-right font-medium text-slate-600">{creatorName(item)}</td>
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
            <span>({searchedLogs.length > 0 ? startIndex + 1 : 0} - {endIndex} / {searchedLogs.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={safePage <= 1} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Trước</button>
            <div className="flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">{safePage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={safePage >= totalPages} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Sau</button>
          </div>
        </div>
      </div>

      {/* MODAL NHẬP DỮ LIỆU */}
      {showFormModal && !isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowFormModal(false)}>
          <div className="bg-white max-w-2xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Nhập số liệu Môi trường</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Cập nhật kết quả đo đạc thủ công vào hệ thống</p>
              </div>
              <button type="button" onClick={() => setShowFormModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 pb-2">
                <div className="flex flex-col gap-1.5 md:col-span-2"><label className="text-sm font-bold text-slate-700">Ao Nuôi <span className="text-rose-500">*</span></label>
                  <select value={form.pondId} onChange={(e) => handleChange('pondId', e.target.value)} required className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-bold bg-white text-emerald-700 shadow-sm">
                    <option value="">-- Chọn ao cần nhập liệu --</option>
                    {pondOptions.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Chỉ số pH <span className="text-rose-500">*</span></label><input type="number" step="0.01" value={form.ph} onChange={(e) => handleChange('ph', e.target.value)} required placeholder="VD: 7.5" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Nhiệt độ (°C) <span className="text-rose-500">*</span></label><input type="number" step="0.1" value={form.temperature} onChange={(e) => handleChange('temperature', e.target.value)} required placeholder="VD: 29.5" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>

                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Oxy hòa tan (mg/L) <span className="text-rose-500">*</span></label><input type="number" step="0.1" value={form.oxygen} onChange={(e) => handleChange('oxygen', e.target.value)} required placeholder="VD: 5.5" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Độ mặn (ppt) <span className="text-rose-500">*</span></label><input type="number" step="0.1" value={form.salinity} onChange={(e) => handleChange('salinity', e.target.value)} required placeholder="VD: 15.0" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>

                <div className="flex flex-col gap-1.5 md:col-span-2"><label className="text-sm font-bold text-slate-700">Độ đục (NTU) <span className="text-rose-500">*</span></label><input type="number" step="0.1" value={form.turbidity} onChange={(e) => handleChange('turbidity', e.target.value)} required placeholder="VD: 5.0" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setShowFormModal(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy bỏ</button>
                <button
                  type="submit"
                  disabled={saving || cooldownRemaining > 0}
                  className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-emerald-500/20 active:scale-95 transition-all w-full sm:w-auto"
                >
                  {saving
                    ? 'Đang lưu...'
                    : (cooldownRemaining > 0
                      ? `⏳ Vui lòng đợi (${formatCooldown(cooldownRemaining)})`
                      : 'Lưu dữ liệu')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default EnvironmentPage;