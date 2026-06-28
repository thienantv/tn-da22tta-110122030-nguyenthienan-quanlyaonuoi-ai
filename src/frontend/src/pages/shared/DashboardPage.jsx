import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios'; // 🌟 Đã thêm axios để gọi API AI
import { pondService, seasonService, userService, taskService, expenseService } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../utils/toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];
// Bảng màu rực rỡ riêng cho AI
const AI_COLORS = ['#ef4444', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899', '#06b6d4']; 

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);
const formatDateTime = (v) => (v ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(v)) : '-');

const getComputedTaskStatus = (task) => {
    const baseStatus = normalizeUpper(task.status);
    if (['COMPLETED', 'CANCELLED'].includes(baseStatus)) return baseStatus;
    if (task.due_date && new Date(task.due_date) < new Date()) return 'OVERDUE';
    return baseStatus;
};

const Sparkline = ({ color }) => (
  <svg className="w-full h-8 opacity-60 mt-2" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CustomTooltip = ({ active, payload, isCurrency = false }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl border border-slate-700">
        {payload[0].payload.label}: <span className="text-emerald-400 ml-1">{isCurrency ? formatCurrency(payload[0].value) : payload[0].value}</span>
      </div>
    );
  }
  return null;
};

// ============================================================================
// COMPONENT CHÍNH
// ============================================================================
const DashboardPage = ({ roleLabel = 'Owner' }) => {
  const { user } = useAuth();
  const role = normalizeUpper(roleLabel);
  const isOwner = role === 'OWNER';
  const isTechnician = role === 'TECHNICIAN';
  const isWorker = role === 'WORKER';
  
  const [loading, setLoading] = useState(true);
  const [ponds, setPonds] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [expenses, setExpenses] = useState([]);
  
  // 🌟 Chuyển state AI thành mảng rỗng để đón dữ liệu thật
  const [aiPredictions, setAiPredictions] = useState([]); 

  useEffect(() => {
    const fetchRealData = async () => {
      setLoading(true);
      try {
        const myFarmId = String(user?.farm_id || ''); 

        if (isWorker) {
          const tasksRes = await taskService.getAllTasks().catch(() => ({ data: { data: [] } }));
          const myTasks = (tasksRes?.data?.data || []).filter(t => 
             t.assigned_workers_list && t.assigned_workers_list.some(w => String(w.worker_id) === String(user?.user_id))
          );
          setTasks(myTasks);
        } else {
          const [pondsRes, seasonsRes] = await Promise.all([
            pondService.getAllPonds().catch(() => ({ data: { data: [] } })),
            seasonService.getAllSeasons().catch(() => ({ data: { data: [] } }))
          ]);
          
          const fetchedPonds = pondsRes?.data?.data || [];
          setPonds(fetchedPonds.filter(p => String(p.farm_id || '') === myFarmId));
          setSeasons(seasonsRes?.data?.data || []); 

          // 🌟 LẤY DỮ LIỆU CHẨN ĐOÁN AI TỪ BACKEND
          try {
            const token = localStorage.getItem('token');
            const aiRes = await axios.get('http://localhost:3000/api/diseases/history', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const historyData = aiRes?.data?.data || [];
            
            // 🌟 LOGIC ĐẾM SỐ CA BỆNH THỰC TẾ
            const counts = {};
            historyData.forEach(h => {
                const name = h.disease_name || 'Khỏe mạnh';
                // Lọc bỏ các ca "Khỏe mạnh" để Dashboard chỉ hiển thị cảnh báo bệnh tật
                if (name.toLowerCase() !== 'khỏe mạnh' && name.toLowerCase() !== 'healthy') {
                    counts[name] = (counts[name] || 0) + 1;
                }
            });
            
            // Định dạng lại mảng để đưa vào Biểu đồ
            const formattedAiData = Object.keys(counts)
                .map((key, idx) => ({
                    disease_name: key,
                    count: counts[key],
                    color: AI_COLORS[idx % AI_COLORS.length]
                }))
                .sort((a, b) => b.count - a.count) // Bệnh nào nhiều nhất đẩy lên đầu
                .slice(0, 5); // Lấy top 5 bệnh phổ biến nhất
            
            setAiPredictions(formattedAiData);
          } catch (e) {
            console.error("Lỗi tải dữ liệu AI:", e);
          }

          if (isOwner) {
            const [usersRes, expensesRes] = await Promise.all([
              userService.getAllUsers().catch(() => ({ data: { data: [] } })),
              expenseService.getAllExpenses().catch(() => ({ data: { data: [] } }))
            ]);
            
            const fetchedUsers = usersRes?.data?.data || [];
            setUsers(fetchedUsers.filter(u => String(u.farm_id || '') === myFarmId));

            const fetchedExpenses = expensesRes?.data?.data || [];
            setExpenses(fetchedExpenses.filter(e => String(e.farm_id || '') === myFarmId));
            
          } else if (isTechnician) {
            const tasksRes = await taskService.getAllTasks().catch(() => ({ data: { data: [] } }));
            setTasks(tasksRes?.data?.data || []);
          }
        }
      } catch (error) {
        showToast({ title: 'Lỗi tải dữ liệu Dashboard', type: 'error' });
      } finally {
        setLoading(false);
      }
    };

    if (user?.user_id) fetchRealData();
  }, [role, isOwner, isTechnician, isWorker, user?.user_id, user?.farm_id]);

  // ================= METRICS =================
  const activeSeasonsCount = seasons.filter(s => ['DANG_NUOI', 'RUNNING', 'IN_PROGRESS'].includes(normalizeUpper(s.status))).length;
  const staffCount = users.filter(u => ['TECHNICIAN', 'WORKER'].includes(normalizeUpper(u.role || u.role_name))).length;
  
  const myPendingTasks = tasks.filter(t => ['PENDING', 'IN_PROGRESS'].includes(getComputedTaskStatus(t))).length;
  const myCompletedTasks = tasks.filter(t => getComputedTaskStatus(t) === 'COMPLETED').length;
  const myOverdueTasks = tasks.filter(t => getComputedTaskStatus(t) === 'OVERDUE').length;

  const totalDiseaseCases = aiPredictions.reduce((sum, item) => sum + item.count, 0);

  // ================= CHARTS =================
  const pondAllocationChart = useMemo(() => {
    let dangNuoi = 0, chuanBi = 0, caiTao = 0, tamNgung = 0;
    ponds.forEach(p => {
      const s = normalizeUpper(p.status);
      if (s === 'DANG_NUOI') dangNuoi++;
      else if (s === 'CHUAN_BI_NUOI') chuanBi++;
      else if (s === 'DANG_CAI_TAO') caiTao++;
      else tamNgung++;
    });
    return [
      { label: 'Đang nuôi', value: dangNuoi, color: '#10b981' },
      { label: 'Chuẩn bị nuôi', value: chuanBi, color: '#8b5cf6' },
      { label: 'Đang cải tạo', value: caiTao, color: '#f59e0b' },
      { label: 'Tạm ngưng', value: tamNgung, color: '#f43f5e' }
    ].filter(d => d.value > 0);
  }, [ponds]);

  const ownerCostChart = useMemo(() => {
    let dien = 0, luong = 0, baoTri = 0, vatTu = 0, khac = 0;
    expenses.forEach(e => {
      const amt = Number(e.amount || 0);
      const cat = normalizeUpper(e.category);
      if (cat === 'ELECTRICITY') dien += amt;
      else if (cat === 'LABOR') luong += amt;
      else if (cat === 'MAINTENANCE') baoTri += amt;
      else if (cat === 'MATERIAL') vatTu += amt;
      else khac += amt;
    });
    return [
      { label: 'Vật tư', value: vatTu, color: '#f59e0b' },
      { label: 'Điện năng', value: dien, color: '#0ea5e9' },
      { label: 'Nhân công', value: luong, color: '#10b981' },
      { label: 'Bảo trì', value: baoTri, color: '#8b5cf6' },
      { label: 'Khác', value: khac, color: '#64748b' }
    ].filter(d => d.value > 0);
  }, [expenses]);

  const taskChartData = useMemo(() => {
    return [
      { label: 'Chờ xử lý', value: tasks.filter(t => getComputedTaskStatus(t)==='PENDING').length, color: '#f59e0b' },
      { label: 'Đang làm', value: tasks.filter(t => getComputedTaskStatus(t)==='IN_PROGRESS').length, color: '#3b82f6' },
      { label: 'Hoàn thành', value: myCompletedTasks, color: '#10b981' },
      { label: 'Quá hạn', value: myOverdueTasks, color: '#ef4444' }
    ].filter(d => d.value > 0);
  }, [tasks, myCompletedTasks, myOverdueTasks]);

  const aiDiseaseChart = aiPredictions.map(item => ({
      label: item.disease_name.split(' (')[0], 
      value: item.count,
      color: item.color
  }));

  // ================= TABLES =================
  const recentExpenses = [...expenses].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);
  const recentTasks = [...tasks].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).slice(0, 5);

  // 🌟 LOADING CHÍNH
  if (loading && ponds.length === 0 && tasks.length === 0) {
    return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Trung tâm Điều hành ({roleLabel})</h1>
          <p className="text-slate-500 font-medium mt-1.5">Giám sát tổng quan hệ thống trại nuôi tôm thông minh</p>
        </div>
      </div>

      {/* ================= KHỐI KPI ================= */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
        {!isWorker ? (
          <>
            <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Tổng số ao nuôi</span><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">🏞️</div></div>
              <strong className="block text-3xl font-black text-slate-800">{ponds.length}</strong>
              <Sparkline color="#94a3b8" />
            </div>
            <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Vụ nuôi đang chạy</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">🌊</div></div>
              <strong className="block text-3xl font-black text-slate-800">{activeSeasonsCount}</strong>
              <Sparkline color="#10b981" />
            </div>
            {isOwner ? (
              <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Nhân sự quản lý</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">👥</div></div>
                <strong className="block text-3xl font-black text-slate-800">{staffCount}</strong>
                <Sparkline color="#f59e0b" />
              </div>
            ) : (
              <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Công việc tồn đọng</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">📋</div></div>
                <strong className="block text-3xl font-black text-slate-800">{myPendingTasks}</strong>
                <Sparkline color="#f59e0b" />
              </div>
            )}
            <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Ca bệnh AI phát hiện</span><div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">🦠</div></div>
              <strong className="block text-3xl font-black text-slate-800">{totalDiseaseCases}</strong>
              <Sparkline color="#f43f5e" />
            </div>
          </>
        ) : (
          <>
            <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Công việc hôm nay</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">📋</div></div>
              <strong className="block text-3xl font-black text-slate-800">{myPendingTasks}</strong>
              <Sparkline color="#f59e0b" />
            </div>
            <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Đã hoàn thành</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">✅</div></div>
              <strong className="block text-3xl font-black text-slate-800">{myCompletedTasks}</strong>
              <Sparkline color="#10b981" />
            </div>
            <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
              <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Bị trễ hạn</span><div className="w-8 h-8 rounded-full bg-rose-50 flex items-center justify-center text-rose-500">⚠️</div></div>
              <strong className="block text-3xl font-black text-slate-800">{myOverdueTasks}</strong>
              <Sparkline color="#f43f5e" />
            </div>
            <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-center items-center text-center">
               <span className="text-4xl mb-2">💪</span>
               <span className="font-bold text-slate-600">Chúc bạn một ngày làm việc hiệu quả!</span>
            </div>
          </>
        )}
      </div>

      {/* ================= KHỐI CHARTS (Chỉ dành cho Owner & Tech) ================= */}
      {!isWorker && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
          
          {/* Chart 1: Ao Nuôi */}
          <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
             {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
             <div className="flex justify-between items-center mb-4 relative z-0">
               <h3 className="font-extrabold text-slate-800 text-lg">Phân bổ ao nuôi</h3>
               <span className="text-xs font-bold bg-slate-100 text-slate-500 px-2 py-1 rounded-md">Tổng: {ponds.length}</span>
             </div>
             <div className="flex-1 flex items-center relative z-0">
                <div className="w-1/2 h-[180px]">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pondAllocationChart} innerRadius="60%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                        {pondAllocationChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center overflow-y-auto max-h-[180px] scrollbar-hide">
                   {pondAllocationChart.map(item => (
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

          {/* Chart 2: Chi phí / Tiến độ */}
          <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
             {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
             <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">{isOwner ? 'Cơ cấu chi phí' : 'Tiến độ công việc'}</h3>
             <div className="flex-1 flex items-center relative z-0">
                <div className="w-1/2 h-[180px]">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={isOwner ? ownerCostChart : taskChartData} innerRadius="60%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                        {(isOwner ? ownerCostChart : taskChartData).map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <RechartsTooltip content={<CustomTooltip isCurrency={isOwner} />} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-1/2 pl-6 flex flex-col gap-3 justify-center overflow-y-auto max-h-[180px] scrollbar-hide">
                   {(isOwner ? ownerCostChart : taskChartData).map(item => (
                      <div key={item.label} className="flex items-center justify-between">
                         <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <div className="w-3 h-3 rounded-full shadow-sm shrink-0" style={{ backgroundColor: item.color }}></div>
                            <span className="text-sm font-bold text-slate-500 truncate">{item.label}</span>
                         </div>
                         <span className={`text-base font-black text-slate-800 shrink-0 ${isOwner ? 'text-[11px]' : ''}`}>
                            {isOwner ? (item.value > 1000000 ? `${(item.value/1000000).toFixed(1)}M` : formatCurrency(item.value)) : item.value}
                         </span>
                      </div>
                   ))}
                </div>
             </div>
          </div>

          {/* Chart 3: AI Bệnh */}
          <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
            {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
            <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Thống kê dịch bệnh (AI)</h3>
            <div className="flex-1 h-[180px] relative z-0">
              {aiDiseaseChart.length > 0 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={aiDiseaseChart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                    <RechartsTooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                    <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={35}>
                      {aiDiseaseChart.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400 font-bold italic">Chưa có ca bệnh nào được ghi nhận</div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* ================= KHỐI DƯỚI: BẢNG DỮ LIỆU & AI LIST ================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Cột trái (Chiếm 2/3): Bảng dữ liệu chuẩn */}
        <div className="relative bg-white rounded-[24px] border border-slate-100 shadow-sm flex flex-col overflow-hidden h-full lg:col-span-2">
          {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
          
          <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center relative z-0">
            <h4 className="m-0 text-lg font-extrabold text-slate-800">
              {isOwner ? '💸 Nhật ký biến động chi phí' : '📋 Công việc thực địa mới nhất'}
            </h4>
            <span className="text-xs font-bold text-slate-500 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">Xem tất cả</span>
          </div>

          <div className="overflow-x-auto relative z-0">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-100">
                {isOwner ? (
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Hạng mục</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày hạch toán</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Số tiền (VNĐ)</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Công việc</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Khu vực (Ao)</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Trạng thái / Hạn chót</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isOwner ? (
                  recentExpenses.length > 0 ? recentExpenses.map((exp, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{exp.name}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">{formatDateTime(exp.expense_date || exp.created_at)}</td>
                      <td className="px-6 py-4 text-right font-black text-rose-500">-{formatCurrency(exp.amount)}</td>
                    </tr>
                  )) : <tr><td colSpan="3" className="p-8 text-center text-slate-500 font-medium">Chưa có phát sinh chi phí.</td></tr>
                ) : (
                  recentTasks.length > 0 ? recentTasks.map((task, idx) => {
                    const isOverdue = getComputedTaskStatus(task) === 'OVERDUE';
                    return (
                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{task.task_title || task.type_name}</td>
                      <td className="px-6 py-4 text-sm font-bold text-sky-600">{task.pond_name || '-'}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${isOverdue ? 'bg-rose-100 text-rose-700 border border-rose-200' : 'bg-slate-100 text-slate-600 border border-slate-200'}`}>
                          {isOverdue ? 'Quá hạn' : formatDateTime(task.due_date)}
                        </span>
                      </td>
                    </tr>
                  )}) : <tr><td colSpan="3" className="p-8 text-center text-slate-500 font-medium">Chưa có công việc nào.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Cột phải (Chiếm 1/3): AI List hoặc Việc cần làm */}
        <div className="bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-full lg:col-span-1">
          {!isWorker ? (
            <>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">🤖</span>
                <h4 className="m-0 text-lg font-extrabold text-slate-800">Tổng quan Chẩn đoán</h4>
              </div>
              <p className="text-sm font-medium text-slate-500 mb-5">Tần suất dịch bệnh phát hiện qua hình ảnh tải lên hệ thống.</p>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                {aiPredictions.length > 0 ? aiPredictions.map((pred, idx) => (
                  <div key={idx} className="flex justify-between items-center p-3.5 rounded-xl border border-slate-100 bg-slate-50 hover:bg-white hover:shadow-md transition-all group" style={{ borderLeftColor: pred.color, borderLeftWidth: '4px' }}>
                    <span className="font-bold text-slate-700 text-sm group-hover:text-slate-900 transition-colors">{pred.disease_name}</span>
                    <span className="px-2.5 py-1 rounded-lg text-xs font-black shadow-sm" style={{ color: pred.color, backgroundColor: `${pred.color}20` }}>
                      {pred.count} ca
                    </span>
                  </div>
                )) : (
                  <div className="flex flex-col items-center justify-center h-full text-emerald-500 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-4xl mb-3">🎉</span>
                    <strong className="text-center text-emerald-700">Trang trại đang an toàn. Chưa có ca bệnh nào!</strong>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-xl">🚨</span>
                <h4 className="m-0 text-lg font-extrabold text-slate-800">Việc cần làm ngay</h4>
              </div>
              
              <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-2 scrollbar-hide">
                {tasks.filter(t => getComputedTaskStatus(t) === 'OVERDUE').map((t, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors shadow-sm">
                    <strong className="block text-slate-800 text-sm mb-1">{t.task_title}</strong>
                    <div className="text-xs font-bold text-rose-600">Trễ hạn: {formatDateTime(t.due_date)}</div>
                  </div>
                ))}
                
                {myOverdueTasks === 0 && (
                  <div className="flex flex-col items-center justify-center h-full text-emerald-500 p-6 bg-emerald-50 rounded-2xl border border-emerald-100">
                    <span className="text-4xl mb-3">🎉</span>
                    <strong className="text-center text-emerald-700">Tuyệt vời! Bạn không có công việc nào bị trễ hạn.</strong>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

      </div>
    </div>
  );
};

export default DashboardPage;