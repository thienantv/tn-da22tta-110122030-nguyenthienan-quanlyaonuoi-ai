import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { showToast } from '../../utils/toast';
import { pondService } from '../../services/api';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

// --- HELPERS & COLORS ---
const CHART_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4', '#ec4899'];

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
};

const Sparkline = ({ color }) => (
  <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg shadow-lg border border-slate-700">
        {payload[0].payload.label}: <span className="text-emerald-400">{payload[0].value} ca</span>
      </div>
    );
  }
  return null;
};

// ============================================================================
// 🌟 TỪ ĐIỂN DỊCH TÊN BỆNH TỪ MÃ AI (RAW CLASS) SANG TIẾNG VIỆT
// ============================================================================
const DISEASE_NAME_MAP = {
  'YH': 'Bệnh đầu vàng (YHD)',
  'WSSV': 'Bệnh đốm trắng (WSD)',
  'BG': 'Bệnh đen mang',
  'WSSV_BG': 'Bệnh đốm trắng + đen mang',
  'HEALTHY': 'Tôm khỏe mạnh',
};

const getFriendlyDiseaseName = (rawName) => {
  if (!rawName) return 'Chưa xác định';
  const key = String(rawName).trim().toUpperCase();
  
  // 1. Kiểm tra khớp chính xác
  if (DISEASE_NAME_MAP[key]) return DISEASE_NAME_MAP[key];
  
  // 2. Fallback: Nếu AI trả về tên có chứa mã (Ví dụ: "Disease_YH", "Shrimp_WSSV")
  for (const [code, friendlyName] of Object.entries(DISEASE_NAME_MAP)) {
    if (key.includes(code)) return friendlyName;
  }
  
  return rawName; // Trả về tên gốc nếu không có trong từ điển
};

// ============================================================================
// COMPONENT CHÍNH
// ============================================================================
const AiDiagnosticPage = ({ roleLabel = 'Owner' }) => {
  const [ponds, setPonds] = useState([]);
  const [selectedPond, setSelectedPond] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [confidenceFilter, setConfidenceFilter] = useState('ALL');

  const [selectedRecord, setSelectedRecord] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // --- STATE HỖ TRỢ ĐIỆN THOẠI (MOBILE) ---
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [showMobileSourceSelector, setShowMobileSourceSelector] = useState(false);

  useEffect(() => {
    fetchPonds();
    fetchHistory();

    const handleResize = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const fetchPonds = async () => {
    try {
      const res = await pondService.getAllPonds();
      setPonds(res?.data?.data || []);
    } catch (err) {
      console.error("Không thể tải danh sách ao", err);
    }
  };

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:3000/api/diseases/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setHistory(res?.data?.data || []);
    } catch (err) {
      console.error("Chưa tải được lịch sử", err);
      setHistory([]); 
    } finally {
      setLoadingHistory(false);
    }
  };

  // ================= TÍNH TOÁN DATA & CHARTS =================
  const stats = useMemo(() => {
    let high = 0, med = 0, low = 0;
    history.forEach(h => {
        const c = Number(h.confidence);
        if (c >= 80) high++; else if (c >= 50) med++; else low++;
    });
    return { total: history.length, high, med, low, latest: history[0]?.predicted_at || null };
  }, [history]);

  const diseaseChartData = useMemo(() => {
    const counts = {};
    history.forEach(h => {
        // 🌟 NÂNG CẤP: Dùng tên hiển thị thân thiện cho Biểu đồ
        const name = getFriendlyDiseaseName(h.disease_name);
        counts[name] = (counts[name] || 0) + 1;
    });
    return Object.keys(counts).map((key, idx) => ({ label: key, value: counts[key], color: CHART_COLORS[idx % CHART_COLORS.length] })).sort((a,b) => b.value - a.value).slice(0, 5);
  }, [history]);

  const confidenceChartData = useMemo(() => {
    return [
        { label: 'Tin cậy Cao (≥80%)', value: stats.high, color: '#10b981' },
        { label: 'Trung bình (50-79%)', value: stats.med, color: '#f59e0b' },
        { label: 'Tin cậy Thấp (<50%)', value: stats.low, color: '#f43f5e' },
    ].filter(d => d.value > 0);
  }, [stats]);

  const filteredHistory = useMemo(() => {
    return history.filter(record => {
      const searchLower = String(searchTerm || '').toLowerCase();
      
      // 🌟 NÂNG CẤP BỘ LỌC: Tìm kiếm bằng cả tên Tiếng Việt lẫn tên AI (Mã gốc)
      const friendlyName = getFriendlyDiseaseName(record.disease_name).toLowerCase();
      const rawName = (record.disease_name || '').toLowerCase();
      
      const matchesSearch = !searchTerm || 
        String(record.prediction_id).includes(searchLower) || 
        friendlyName.includes(searchLower) || 
        rawName.includes(searchLower);

      let matchesConfidence = true;
      const conf = Number(record.confidence);
      if (confidenceFilter === 'HIGH') matchesConfidence = conf >= 80;
      else if (confidenceFilter === 'MEDIUM') matchesConfidence = conf >= 50 && conf < 80;
      else if (confidenceFilter === 'LOW') matchesConfidence = conf < 50;

      return matchesSearch && matchesConfidence;
    });
  }, [history, searchTerm, confidenceFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredHistory.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredHistory.length);
  const paginatedHistory = filteredHistory.slice(startIndex, endIndex);

  // ================= HANDLERS =================
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
      setShowMobileSourceSelector(false); 
    }
  };

  const handleDropzoneClick = () => {
    if (isMobile) setShowMobileSourceSelector(true);
    else document.getElementById('ai-image-upload-gallery').click();
  };

  const triggerCamera = () => document.getElementById('ai-image-upload-camera').click();
  const triggerGallery = () => document.getElementById('ai-image-upload-gallery').click();

  const handlePredict = async () => {
    if (!selectedFile) return showToast({ title: 'Vui lòng chọn hình ảnh', type: 'warning' });

    if (!selectedPond) {
      return showToast({ title: 'Vui lòng chọn Ao nuôi trước khi chẩn đoán!', type: 'warning' });
    }

    const formData = new FormData();
    formData.append('image', selectedFile);
    if (selectedPond) formData.append('pond_id', selectedPond);

    try {
      setLoading(true);
      const token = localStorage.getItem('token'); 
      const response = await axios.post('http://localhost:3000/api/diseases/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data', 'Authorization': `Bearer ${token}` }
      });

      if (response.data.success) {
        setResult(response.data.data);
        showToast({ title: 'AI phân tích thành công!', type: 'success' });
        fetchHistory();
      }
    } catch (err) {
      showToast({ title: err.response?.data?.message || 'Lỗi kết nối AI Server', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedFile(null); setPreviewUrl(''); setResult(null);
  };

  // ================= RENDER HELPERS =================
  const getConfidenceBadge = (conf) => {
    const val = Number(conf);
    if (val >= 80) return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">{val}% (Cao)</span>;
    if (val >= 50) return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">{val}% (Trung bình)</span>;
    return <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">{val}% (Thấp)</span>;
  };

  const getBorderColor = (conf) => {
    if (conf >= 80) return 'border-emerald-500';
    if (conf >= 50) return 'border-amber-500';
    return 'border-rose-500';
  };
  
  const getTextColor = (conf) => {
    if (conf >= 80) return 'text-emerald-600';
    if (conf >= 50) return 'text-amber-600';
    return 'text-rose-600';
  };

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Chuyên gia AI Chẩn Đoán</h1>
          <p className="text-slate-500 font-medium mt-1.5">Hệ thống Computer Vision & Google Gemini AI hỗ trợ phân tích hình ảnh ({roleLabel})</p>
        </div>
        
        {result && (
          <div className="relative z-10 w-full md:w-auto">
            <button onClick={resetForm} className="w-full md:w-auto px-6 py-3 bg-white/80 backdrop-blur-md border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-white shadow-sm transition-all flex items-center justify-center gap-2">
              <span className="text-xl leading-none">+</span> Chẩn đoán ca mới
            </button>
          </div>
        )}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Tổng ca phân tích</span><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">📊</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.total}</strong>
          <div className="mt-2"><Sparkline color="#94a3b8" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Độ tin cậy Cao</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">🎯</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.high}</strong>
          <div className="mt-2"><Sparkline color="#10b981" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Cần lưu ý (Thấp)</span><div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">⚠️</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.low}</strong>
          <div className="mt-2"><Sparkline color="#f43f5e" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Cập nhật gần nhất</span><div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">⏱️</div></div>
          <strong className="block text-xl font-black text-slate-800 mt-2 truncate">{formatDateTime(stats.latest)}</strong>
          <div className="mt-1.5"><Sparkline color="#0ea5e9" /></div>
        </div>
      </div>

      {/* TOP LAYOUT: UPLOAD & KẾT QUẢ */}
      <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-5 mb-6">
        
        {/* CỘT TRÁI: UPLOAD PANEL */}
        <div className="bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col relative h-full">
          <h3 className="font-extrabold text-slate-800 text-lg mb-4">Tải mẫu vật</h3>
          
          <div className="flex flex-col gap-1.5 mb-5">
            <label className="text-sm font-bold text-slate-700">Ao nuôi liên quan (Tùy chọn)</label>
            <select 
              className="w-full px-4 py-3 border border-slate-300 rounded-xl outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-100 bg-white transition-all text-slate-700 font-medium"
              value={selectedPond} 
              onChange={(e) => setSelectedPond(e.target.value)}
            >
              <option value="">-- Không xác định ao --</option>
              {ponds.map(p => <option key={p.pond_id} value={p.pond_id}>{p.pond_name}</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <label className="text-sm font-bold text-slate-700">Hình ảnh mẫu vật <span className="text-rose-500 ml-0.5">*</span></label>
            
            <div 
              className={`relative flex-1 min-h-[200px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer bg-slate-50 transition-all hover:border-sky-400 hover:bg-sky-50/50 ${previewUrl ? 'p-2 border-slate-300' : 'p-6 border-slate-300'}`}
              onClick={handleDropzoneClick}
            >
              <input type="file" id="ai-image-upload-gallery" accept="image/*" className="hidden" onChange={handleFileChange} />
              <input type="file" id="ai-image-upload-camera" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
              
              {previewUrl ? (
                <img src={previewUrl} alt="Preview" className="w-full h-full object-cover rounded-xl shadow-sm" />
              ) : (
                <>
                  <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-3xl mb-3 shadow-sm border border-slate-200">📸</div>
                  <span className="text-slate-700 font-bold text-base">Nhấn để chọn ảnh tôm</span>
                  <span className="text-slate-400 text-xs mt-1.5 font-medium">Hỗ trợ JPG, PNG (Max: 5MB)</span>
                </>
              )}
            </div>
          </div>

          <button 
            className="w-full mt-5 px-4 py-3.5 bg-sky-500 text-white text-base font-bold rounded-xl hover:bg-sky-600 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-md shadow-sky-500/20" 
            onClick={handlePredict} 
            disabled={loading || !selectedFile}
          >
            {loading ? 'AI Đang Phân Tích...' : '✨ Khởi Động AI Chẩn Đoán'}
          </button>
        </div>

        {/* CỘT PHẢI: KẾT QUẢ DỰ ĐOÁN */}
        <div className="bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col relative h-full min-h-[400px]">
          <h3 className="font-extrabold text-slate-800 text-lg mb-4">Kết quả & Phác đồ điều trị</h3>
          
          {!result && !loading && (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 py-12 px-6 text-center">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-4xl mb-4 shadow-sm border border-slate-200 grayscale opacity-50">🤖</div>
              <p className="text-slate-500 font-medium max-w-sm">Tải ảnh lên và nhấn Khởi động để nhận phác đồ điều trị từ Bác sĩ AI Gemini</p>
            </div>
          )}

          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border border-slate-100">
               <div className="w-12 h-12 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin mb-5"></div>
               <p className="text-sky-600 font-bold text-lg animate-pulse">Gemini đang hội chẩn hình ảnh...</p>
            </div>
          )}

          {result && !loading && (
            <div className="flex flex-col gap-4 flex-1 overflow-y-auto animate-in fade-in duration-300 pr-1 scrollbar-hide">
              <div className={`flex flex-col sm:flex-row justify-between items-start sm:items-center bg-slate-50 p-5 rounded-2xl border-l-8 shadow-sm border border-slate-100 shrink-0 ${getBorderColor(result.confidence)}`}>
                 <div>
                    {/* 🌟 HIỂN THỊ TÊN BỆNH THÂN THIỆN */}
                    <h2 className="text-2xl font-extrabold text-slate-800 m-0">
                      {getFriendlyDiseaseName(result.disease_name)}
                    </h2>
                    <span className="inline-block mt-1.5 px-2.5 py-0.5 bg-white border border-slate-200 text-slate-500 text-xs font-bold rounded-md shadow-sm">
                      Mã ca bệnh: #{result.prediction_id} | AI Code: {result.disease_name}
                    </span>
                 </div>
                 <div className="mt-4 sm:mt-0 flex flex-col sm:items-end w-full sm:w-auto">
                    <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-0.5">Độ tin cậy AI</div>
                    <strong className={`text-3xl font-black ${getTextColor(result.confidence)}`}>{result.confidence}%</strong>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                <div className="md:col-span-2 bg-amber-50/80 border border-amber-200 p-5 rounded-2xl">
                    <label className="flex items-center gap-2 text-amber-800 font-bold mb-2.5 text-base"><span className="text-xl">🩺</span> Dấu hiệu thực tế:</label>
                    <p className="text-slate-700 leading-relaxed m-0 whitespace-pre-line text-sm md:text-base">{result.symptoms}</p>
                </div>
                <div className="bg-blue-50/80 border border-blue-200 p-5 rounded-2xl">
                    <label className="flex items-center gap-2 text-blue-800 font-bold mb-2.5 text-base"><span className="text-xl">💊</span> Phác đồ điều trị:</label>
                    <p className="text-slate-700 leading-relaxed font-medium m-0 whitespace-pre-line text-sm md:text-base">{result.treatment}</p>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200 p-5 rounded-2xl">
                    <label className="flex items-center gap-2 text-emerald-800 font-bold mb-2.5 text-base"><span className="text-xl">🛡️</span> Biện pháp phòng ngừa:</label>
                    <p className="text-slate-700 leading-relaxed m-0 whitespace-pre-line text-sm md:text-base">{result.prevention}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CHARTS THỐNG KÊ LỊCH SỬ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
           {loadingHistory && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
           <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Mức độ phân bố dịch bệnh</h3>
           <div className="flex-1 flex items-center relative z-0">
              <div className="w-1/2 h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={diseaseChartData} innerRadius="65%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                      {diseaseChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center">
                 {diseaseChartData.map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                       <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: item.color }}></div>
                          <span className="text-sm font-bold text-slate-500 truncate" title={item.label}>{item.label}</span>
                       </div>
                       <span className="text-base font-black text-slate-800 shrink-0">{item.value}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>

        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
           {loadingHistory && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
           <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Biên độ tin cậy AI</h3>
           <div className="flex-1 flex items-center relative z-0">
              <div className="w-1/2 h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={confidenceChartData} innerRadius="65%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                      {confidenceChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center">
                 {confidenceChartData.map(item => (
                    <div key={item.label} className="flex items-center justify-between">
                       <div className="flex items-center gap-2 overflow-hidden mr-2">
                          <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: item.color }}></div>
                          <span className="text-sm font-bold text-slate-500 truncate">{item.label}</span>
                       </div>
                       <span className="text-base font-black text-slate-800 shrink-0">{item.value}</span>
                    </div>
                 ))}
              </div>
           </div>
        </div>
      </div>

      {/* BẢNG LỊCH SỬ CHẨN ĐOÁN VỚI LOCAL LOADING */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden relative">
        {loadingHistory && (
           <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center transition-all">
             <div className="flex flex-col items-center">
               <div className="w-10 h-10 border-4 border-slate-200 border-t-sky-500 rounded-full animate-spin mb-3"></div>
               <span className="font-bold text-slate-600">Đang tải lịch sử...</span>
             </div>
           </div>
        )}

        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row gap-4 bg-slate-50/30">
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Tìm theo mã ca bệnh hoặc tên bệnh..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-sky-100 focus:border-sky-500 outline-none transition-all shadow-sm" />
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={confidenceFilter} onChange={(e) => {setConfidenceFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-sky-500 shadow-sm cursor-pointer w-full sm:w-auto">
              <option value="ALL">Tất cả độ tin cậy</option>
              <option value="HIGH">Tin cậy Cao (≥ 80%)</option>
              <option value="MEDIUM">Tin cậy Trung bình (50-79%)</option>
              <option value="LOW">Tin cậy Thấp (&lt; 50%)</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[100px]">Hình ảnh</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin ca bệnh</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Độ tin cậy</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thời gian</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[120px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedHistory.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-medium text-lg">Không tìm thấy lịch sử chẩn đoán phù hợp.</td></tr>
              ) : paginatedHistory.map(record => (
                <tr key={record.prediction_id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-center">
                    {record.image_url ? (
                      <img src={`http://localhost:3000${record.image_url}`} alt="Mẫu" className="w-12 h-12 object-cover rounded-xl border border-slate-200 shadow-sm mx-auto" />
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center border border-slate-200 text-xl mx-auto shadow-sm">🦐</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {/* 🌟 HIỂN THỊ TÊN BỆNH THÂN THIỆN TRONG BẢNG LỊCH SỬ */}
                    <strong className="block text-slate-800 text-base">
                      {getFriendlyDiseaseName(record.disease_name)}
                    </strong>
                    <span className="text-xs font-medium text-slate-400">Mã ca: #{record.prediction_id}</span>
                  </td>
                  <td className="px-6 py-4">{getConfidenceBadge(record.confidence)}</td>
                  <td className="px-6 py-4 text-slate-600 font-medium">{formatDateTime(record.predicted_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setSelectedRecord(record); setShowDetailModal(true); }} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-all shadow-sm" title="Xem phác đồ">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600 font-medium bg-white">
          <div className="flex items-center gap-3">
            <span>Hiển thị</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 outline-none bg-slate-50 focus:border-sky-500">
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>({filteredHistory.length > 0 ? startIndex + 1 : 0} - {endIndex} / {filteredHistory.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={safePage <= 1} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Trước</button>
            <div className="flex items-center justify-center px-4 py-2 bg-sky-50 text-sky-700 font-bold rounded-xl border border-sky-100">{safePage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={safePage >= totalPages} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Sau</button>
          </div>
        </div>
      </div>

      {/* --- MODAL CHỌN NGUỒN ẢNH (MOBILE) --- */}
      {showMobileSourceSelector && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 sm:p-0" onClick={() => setShowMobileSourceSelector(false)}>
          <div className="bg-white w-full sm:max-w-sm p-6 text-center rounded-[32px] sm:rounded-2xl shadow-2xl transform transition-all animate-in slide-in-from-bottom-8 sm:slide-in-from-bottom-0 sm:zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6 sm:hidden"></div>
            <h3 className="text-xl font-extrabold text-slate-800 mb-6 m-0">Nguồn tải ảnh</h3>
            
            <button className="w-full flex items-center justify-start gap-4 p-4 mb-3 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition-all hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 active:scale-[0.98]" onClick={triggerCamera}>
              <span className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">📷</span> Chụp ảnh Camera
            </button>
            
            <button className="w-full flex items-center justify-start gap-4 p-4 mb-6 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-700 text-lg transition-all hover:bg-sky-50 hover:border-sky-200 hover:text-sky-700 active:scale-[0.98]" onClick={triggerGallery}>
              <span className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xl">🖼️</span> Chọn từ Thư viện
            </button>

            <button className="w-full py-3.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-colors" onClick={() => setShowMobileSourceSelector(false)}>
              Hủy bỏ
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL CHI TIẾT BỆNH ÁN (SCROLLABLE) --- */}
      {showDetailModal && selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white max-w-3xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Hồ sơ bệnh án #{selectedRecord.prediction_id}</h2>
              <button type="button" onClick={() => setShowDetailModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>
            
            <div className="flex flex-col flex-1 overflow-y-auto pr-2 pb-2 scrollbar-hide">
              <p className="text-slate-500 mb-4 font-medium">Chẩn đoán lúc: {formatDateTime(selectedRecord.predicted_at)}</p>

              {selectedRecord.image_url && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 mb-6 flex justify-center">
                  <img src={`http://localhost:3000${selectedRecord.image_url}`} alt="Mẫu vật" className="max-w-full max-h-[300px] object-contain rounded-xl block shadow-sm" />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 p-5 border border-slate-200 rounded-2xl">
                  <label className="block text-sm font-bold text-slate-500 mb-1">Kết quả chẩn đoán</label>
                  {/* 🌟 HIỂN THỊ TÊN BỆNH THÂN THIỆN TRONG MODAL */}
                  <strong className="text-xl text-slate-800">
                    {getFriendlyDiseaseName(selectedRecord.disease_name)}
                  </strong>
                </div>
                <div className="bg-slate-50 p-5 border border-slate-200 rounded-2xl">
                  <label className="block text-sm font-bold text-slate-500 mb-2">Độ tin cậy AI</label>
                  <div>{getConfidenceBadge(selectedRecord.confidence)}</div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <div className="bg-amber-50/80 border border-amber-200 p-5 rounded-2xl">
                  <label className="flex items-center gap-2 text-amber-800 font-bold mb-2 text-base"><span className="text-xl">🩺</span> Dấu hiệu thực tế:</label>
                  <p className="text-slate-700 m-0 whitespace-pre-line text-sm md:text-base leading-relaxed">{selectedRecord.symptoms || 'Chưa có thông tin'}</p>
                </div>
                <div className="bg-blue-50/80 border border-blue-200 p-5 rounded-2xl">
                  <label className="flex items-center gap-2 text-blue-800 font-bold mb-2 text-base"><span className="text-xl">💊</span> Phác đồ điều trị:</label>
                  <p className="text-slate-700 m-0 whitespace-pre-line text-sm md:text-base leading-relaxed font-semibold">{selectedRecord.treatment || 'Chưa có thông tin'}</p>
                </div>
                <div className="bg-emerald-50/80 border border-emerald-200 p-5 rounded-2xl">
                  <label className="flex items-center gap-2 text-emerald-800 font-bold mb-2 text-base"><span className="text-xl">🛡️</span> Biện pháp phòng ngừa:</label>
                  <p className="text-slate-700 m-0 whitespace-pre-line text-sm md:text-base leading-relaxed">{selectedRecord.prevention || 'Chưa có thông tin'}</p>
                </div>
              </div>
            </div>
            
            <div className="flex justify-end mt-6 pt-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setShowDetailModal(false)} className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng hồ sơ</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AiDiagnosticPage;