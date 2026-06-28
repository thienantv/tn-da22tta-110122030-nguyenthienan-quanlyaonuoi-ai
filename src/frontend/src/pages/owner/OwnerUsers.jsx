import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { userService } from '../../services/api';
import { showToast } from '../../utils/toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const ROLE_OPTIONS = [
  { id: 2, label: 'Quản lý (Manager)' },
  { id: 3, label: 'Kỹ sư (Technician)' },
  { id: 4, label: 'Công nhân (Worker)' },
];

const emptyForm = { fullName: '', username: '', email: '', phone: '', password: '', roleId: 4 };

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date);
};

const getRoleBadge = (roleId, roleName) => {
  const role = normalizeUpper(roleName);
  if (role === 'OWNER' || roleId === 1) return <span className="bg-sky-100 text-sky-700 px-3 py-1 rounded-full text-xs font-bold border border-sky-200">Chủ trại</span>;
  if (role === 'MANAGER' || roleId === 2) return <span className="bg-violet-100 text-violet-700 px-3 py-1 rounded-full text-xs font-bold border border-violet-200">Quản lý</span>;
  if (role === 'TECHNICIAN' || roleId === 3) return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-bold border border-amber-200">Kỹ sư</span>;
  if (role === 'WORKER' || roleId === 4) return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-bold border border-emerald-200">Công nhân</span>;
  return <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-xs font-bold border border-slate-200">{roleName || 'Khác'}</span>;
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
        {payload[0].payload.name}: <span className="text-emerald-400">{payload[0].value} người</span>
      </div>
    );
  }
  return null;
};

export const OwnerUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filters & Pagination
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  // Modal Matrix Worker
  const [showWorkerAssignmentModal, setShowWorkerAssignmentModal] = useState(false);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [workerAssignment, setWorkerAssignment] = useState({ workers: [], technicians: [], assignments: [] });
  const [busyAssignmentKey, setBusyAssignmentKey] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true); // Local Loading
      const response = await userService.getAllUsers();
      setUsers(response?.data?.data || []);
    } catch (err) {
      showToast({ title: 'Lỗi tải danh sách nhân viên', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ================= TÍNH TOÁN DATA =================
  const filteredUsers = useMemo(() => {
    const term = normalizeText(searchTerm);
    return users.filter(u => {
      const matchSearch = !term || normalizeText(u.full_name).includes(term) || normalizeText(u.username).includes(term) || normalizeText(u.phone).includes(term);
      const matchRole = roleFilter === 'ALL' || String(u.role_id) === String(roleFilter);
      const matchStatus = statusFilter === 'ALL' || (statusFilter === 'ACTIVE' ? u.status === 1 : u.status === 0);
      return matchSearch && matchRole && matchStatus;
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [users, searchTerm, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredUsers.length);
  const paginatedUsers = filteredUsers.slice(startIndex, endIndex);

  const stats = useMemo(() => {
    return {
      total: users.length,
      technicians: users.filter(u => u.role_id === 3 || normalizeUpper(u.role_name) === 'TECHNICIAN').length,
      workers: users.filter(u => u.role_id === 4 || normalizeUpper(u.role_name) === 'WORKER').length,
      active: users.filter(u => u.status === 1).length,
      locked: users.filter(u => u.status === 0).length,
    };
  }, [users]);

  const roleChartData = useMemo(() => {
    const counts = {};
    users.forEach(u => {
      const role = u.role_name || 'Khác';
      counts[role] = (counts[role] || 0) + 1;
    });
    return Object.keys(counts).map((key, idx) => ({ name: key, value: counts[key], color: CHART_COLORS[idx % CHART_COLORS.length] }));
  }, [users]);

  // ================= HANDLERS =================
  const handleOpenModal = (user = null) => {
    if (user) {
      setEditingUserId(user.user_id);
      setFormData({ fullName: user.full_name, username: user.username, email: user.email || '', phone: user.phone || '', password: '', roleId: user.role_id || 4 });
    } else {
      setEditingUserId(null);
      setFormData(emptyForm);
    }
    setShowModal(true);
  };

  const handleSubmitUser = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const payload = {
        fullName: formData.fullName.trim(), username: formData.username.trim(), email: formData.email.trim() || null,
        phone: formData.phone.trim() || null, roleId: Number(formData.roleId)
      };

      if (editingUserId) {
        if (formData.password.trim()) payload.password = formData.password.trim();
        await userService.updateUser(editingUserId, payload);
        showToast({ title: 'Cập nhật nhân viên thành công', type: 'success' });
      } else {
        if (!formData.password.trim()) return showToast({ title: 'Vui lòng nhập mật khẩu', type: 'error' });
        payload.password = formData.password.trim();
        await userService.createUser(payload);
        showToast({ title: 'Tạo nhân viên thành công', type: 'success' });
      }
      setShowModal(false);
      fetchUsers();
    } catch (err) { showToast({ title: err?.response?.data?.message || 'Lỗi lưu thông tin', type: 'error' }); } 
    finally { setSaving(false); }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Chắc chắn muốn xóa nhân viên này? Các công việc liên quan có thể bị ảnh hưởng.')) return;
    try {
      await userService.deleteUser(userId);
      showToast({ title: 'Xóa nhân sự thành công', type: 'success' });
      fetchUsers();
    } catch (err) { showToast({ title: err?.response?.data?.message || 'Lỗi xóa nhân sự', type: 'error' }); }
  };

  const handleToggleStatus = async (user) => {
    const isLocking = user.status === 1;
    if (!window.confirm(`Xác nhận ${isLocking ? 'KHÓA' : 'MỞ KHÓA'} tài khoản này?`)) return;
    try {
      await userService.toggleUserStatus(user.user_id, isLocking ? 0 : 1);
      showToast({ title: `${isLocking ? 'Đã khóa' : 'Đã mở khóa'} tài khoản`, type: 'success' });
      fetchUsers();
    } catch (err) { showToast({ title: 'Lỗi cập nhật trạng thái', type: 'error' }); }
  };

  // ================= MATRIX WORKER ASSIGNMENT =================
  const handleOpenWorkerAssignment = async () => {
    setShowWorkerAssignmentModal(true);
    setLoadingMatrix(true);
    try {
      const res = await userService.getWorkerAssignments();
      setWorkerAssignment(res?.data?.data || { workers: [], technicians: [], assignments: [] });
    } catch (e) {
      showToast({ title: 'Lỗi tải ma trận phân công', type: 'error' });
    } finally {
      setLoadingMatrix(false);
    }
  };

  const handleWorkerAssignmentChange = async (techId, workerId, checked) => {
    try {
      setBusyAssignmentKey(`${techId}-${workerId}`);
      // Optimistic Update
      setWorkerAssignment(prev => {
        let newAssignments = [...prev.assignments];
        if (checked) newAssignments.push({ technician_id: techId, worker_id: workerId });
        else newAssignments = newAssignments.filter(a => !(a.technician_id === techId && a.worker_id === workerId));
        return { ...prev, assignments: newAssignments };
      });
      await userService.assignWorker({ technician_id: techId, worker_id: workerId, assigned: checked });
    } catch (e) {
      showToast({ title: 'Lỗi khi phân công', type: 'error' });
      handleOpenWorkerAssignment(); // Rollback nếu lỗi
    } finally {
      setBusyAssignmentKey('');
    }
  };

  // 🌟 LOADING TOÀN TRANG LẦN ĐẦU
  if (loading && users.length === 0) {
    return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Quản lý Nhân sự</h1>
          <p className="text-slate-500 font-medium mt-1.5">Kiểm soát tài khoản, quyền hạn và tổ đội kỹ thuật trong trại</p>
        </div>
        
        <div className="relative z-10 flex flex-wrap gap-3 w-full md:w-auto">
          {/* NÚT PHÂN CÔNG ĐÃ ĐƯỢC KHÔI PHỤC */}
          <button onClick={handleOpenWorkerAssignment} className="flex-1 md:flex-none px-5 py-2.5 bg-white/80 backdrop-blur-md border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-white shadow-sm transition-all flex items-center justify-center gap-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
            Phân công Tổ đội (Kỹ sư ✕ Công nhân)
          </button>
          
          <button onClick={() => handleOpenModal()} className="flex-1 md:flex-none px-5 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
            <span className="text-lg leading-none">+</span> Thêm Nhân sự mới
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Tổng nhân sự</span><div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">👥</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.total}</strong>
          <div className="mt-2"><Sparkline color="#94a3b8" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Kỹ sư</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">🎓</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.technicians}</strong>
          <div className="mt-2"><Sparkline color="#f59e0b" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Công nhân</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">👷</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.workers}</strong>
          <div className="mt-2"><Sparkline color="#10b981" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Đang hoạt động</span><div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">🟢</div></div>
          <strong className="block text-3xl font-black text-slate-800">{stats.active}</strong>
          <div className="mt-2"><Sparkline color="#0ea5e9" /></div>
        </div>
      </div>

      {/* CHART VÀ LIST INFO NHO NHỎ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden col-span-1 lg:col-span-1">
           {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
           <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Cơ cấu nhân sự</h3>
           <div className="flex-1 flex flex-col items-center justify-center relative z-0">
              <div className="w-full h-[160px] mb-2">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={roleChartData} innerRadius="55%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                      {roleChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <RechartsTooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full overflow-y-auto max-h-[80px] scrollbar-hide flex flex-col gap-1.5 px-2">
                {roleChartData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 overflow-hidden mr-2">
                        <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: item.color }}></div>
                        <span className="font-bold text-slate-500 truncate">{item.name}</span>
                      </div>
                      <span className="font-black text-slate-800 shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
           </div>
        </div>

        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden col-span-1 lg:col-span-2">
            <div className="flex justify-between items-center mb-4">
               <h3 className="font-extrabold text-slate-800 text-lg">Thông tin bảo mật</h3>
               <span className="px-3 py-1 bg-slate-100 text-slate-500 font-bold text-xs rounded-full">Lưu ý chung</span>
            </div>
            <div className="flex-1 bg-slate-50 rounded-xl p-5 border border-slate-100 text-slate-600 text-sm leading-relaxed overflow-y-auto">
               <p className="mb-3">👉 <strong>Chủ trại (Owner):</strong> Chỉ có Hệ thống mới cấp được quyền Owner mới. Owner quản lý toàn bộ Trại.</p>
               <p className="mb-3">👉 <strong>Kỹ sư (Technician):</strong> Có quyền xem/tạo/cập nhật dữ liệu Ao, Mùa vụ, Môi trường và tạo Task giao cho Công nhân.</p>
               <p className="mb-3">👉 <strong>Công nhân (Worker):</strong> Chỉ có quyền xem Task được Kỹ sư giao và xác nhận "Đã hoàn thành".</p>
               <p className="mb-0">⚠️ Việc <strong>Khóa (Lock)</strong> tài khoản sẽ ngăn chặn người dùng đăng nhập vào hệ thống ngay lập tức, nhưng dữ liệu công việc cũ vẫn được giữ nguyên.</p>
            </div>
        </div>
      </div>

      {/* TABLE VỚI LOCAL LOADING */}
      <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden relative">
        {loading && (
           <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center transition-all">
             <div className="flex flex-col items-center">
               <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
               <span className="font-bold text-slate-600">Đang tải dữ liệu...</span>
             </div>
           </div>
        )}

        <div className="p-5 border-b border-slate-100 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-slate-50/30">
          <div className="relative w-full lg:w-[350px]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Tìm theo tên, tài khoản, SĐT..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm" />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <select value={roleFilter} onChange={(e) => {setRoleFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[150px]">
              <option value="ALL">Tất cả chức vụ</option>
              {ROLE_OPTIONS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
            <select value={statusFilter} onChange={(e) => {setStatusFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[150px]">
              <option value="ALL">Tất cả trạng thái</option>
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="LOCKED">Bị khóa</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Thông tin Nhân viên</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Chức vụ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tài khoản & Liên hệ</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Trạng thái</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[160px]">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedUsers.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-medium text-lg">Không tìm thấy nhân sự phù hợp.</td></tr>
              ) : paginatedUsers.map(user => {
                 const isOwnerData = normalizeUpper(user.role_name) === 'OWNER';
                 return (
                  <tr key={user.user_id} className={`transition-colors group ${!user.status ? 'bg-slate-50 opacity-80' : 'hover:bg-slate-50/50'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold shadow-inner ${user.status ? 'bg-gradient-to-br from-emerald-100 to-teal-100 text-teal-600' : 'bg-slate-200 text-slate-500'}`}>
                          {user.full_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <strong className="block text-slate-800 text-base">{user.full_name}</strong>
                          <span className="text-xs font-medium text-slate-400">Gia nhập: {formatDateTime(user.created_at).split(' ')[0]}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">{getRoleBadge(user.role_id, user.role_name)}</td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-bold text-slate-700">{user.username}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{user.phone || user.email || 'Chưa cập nhật LH'}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {user.status === 1 
                        ? <span className="flex items-center justify-center gap-1.5 text-emerald-600 text-sm font-bold"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></span>Hoạt động</span>
                        : <span className="flex items-center justify-center gap-1.5 text-rose-500 text-sm font-bold"><span className="w-2 h-2 rounded-full bg-rose-500 shadow-sm"></span>Đã khóa</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => handleOpenModal(user)} disabled={isOwnerData} className="p-2 rounded-lg border text-slate-500 transition-all shadow-sm bg-white border-slate-200 hover:bg-amber-50 hover:text-amber-600 disabled:opacity-30 disabled:cursor-not-allowed" title="Chỉnh sửa">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                        </button>
                        
                        <button onClick={() => handleToggleStatus(user)} disabled={isOwnerData} className={`p-2 rounded-lg border transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed ${user.status === 1 ? 'bg-white border-slate-200 text-rose-500 hover:bg-rose-50' : 'bg-emerald-50 border-emerald-200 text-emerald-600 hover:bg-emerald-100'}`} title={user.status === 1 ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}>
                          {user.status === 1 ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg> // Lock
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" /></svg> // Unlock
                          )}
                        </button>

                        <button onClick={() => handleDelete(user.user_id)} disabled={isOwnerData} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm disabled:opacity-30 disabled:cursor-not-allowed" title="Xóa">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                 );
              })}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600 font-medium bg-white">
          <div className="flex items-center gap-3">
            <span>Hiển thị</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 outline-none bg-slate-50 focus:border-emerald-500">
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>({filteredUsers.length > 0 ? startIndex + 1 : 0} - {endIndex} / {filteredUsers.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={safePage <= 1} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Trước</button>
            <div className="flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">{safePage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={safePage >= totalPages} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Sau</button>
          </div>
        </div>
      </div>

      {/* ================= MODAL THÊM / SỬA NHÂN SỰ ================= */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowModal(false)}>
          <div className="bg-white max-w-2xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">{editingUserId ? 'Cập nhật Nhân sự' : 'Thêm Nhân sự mới'}</h2>
              <button type="button" onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handleSubmitUser} className="flex flex-col flex-1 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 pb-2 scrollbar-hide">
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Chức vụ <span className="text-rose-500">*</span></label>
                  <select value={formData.roleId} onChange={(e) => setFormData({...formData, roleId: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none font-bold text-emerald-700 bg-white shadow-sm">
                    {ROLE_OPTIONS.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                  </select>
                </div>
                
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Họ và tên <span className="text-rose-500">*</span></label><input type="text" value={formData.fullName} onChange={(e) => setFormData({...formData, fullName: e.target.value})} required placeholder="VD: Nguyễn Văn A" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Tên đăng nhập <span className="text-rose-500">*</span></label><input type="text" value={formData.username} onChange={(e) => setFormData({...formData, username: e.target.value})} required disabled={!!editingUserId} placeholder="VD: nguyenvana" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium disabled:bg-slate-50 disabled:text-slate-500 shadow-sm" /></div>
                
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Số điện thoại</label><input type="text" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} placeholder="VD: 0912345678" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Email</label><input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="VD: email@gmail.com" className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" /></div>
                
                <div className="flex flex-col gap-1.5 md:col-span-2">
                  <label className="text-sm font-bold text-slate-700">Mật khẩu {!editingUserId && <span className="text-rose-500">*</span>}</label>
                  <input type="password" value={formData.password} onChange={(e) => setFormData({...formData, password: e.target.value})} required={!editingUserId} placeholder={editingUserId ? "Để trống nếu không muốn đổi mật khẩu" : "Nhập mật khẩu ít nhất 6 ký tự"} minLength={6} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" />
                </div>
              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setShowModal(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                <button type="submit" disabled={saving} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95 transition-all">{saving ? 'Đang lưu...' : 'Lưu dữ liệu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL PHÂN CÔNG TỔ ĐỘI (MA TRẬN CÔNG NHÂN) ================= */}
      {showWorkerAssignmentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowWorkerAssignmentModal(false)}>
          <div className="bg-white max-w-5xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <div>
                <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">Biên chế Tổ đội Kỹ thuật</h2>
                <p className="text-sm text-slate-500 font-medium mt-1">Phân bổ Công nhân vào quyền quản lý của các Kỹ sư</p>
              </div>
              <button type="button" onClick={() => setShowWorkerAssignmentModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>
            
            <div className="flex flex-col flex-1 overflow-hidden border border-slate-200 rounded-[16px] shadow-sm relative bg-white min-h-[250px]">
              {loadingMatrix && (
                 <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-20 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div>
                 </div>
              )}
              
              <div className="bg-slate-50 px-5 py-3 border-b border-slate-200 font-bold text-slate-700 text-sm shrink-0">
                 Ma trận Biên chế (Công nhân × Kỹ sư)
              </div>
              
              <div className="flex-1 overflow-auto max-h-[400px]">
                <table className="w-full text-center border-collapse">
                  <thead className="bg-slate-50 sticky top-0 shadow-sm z-10 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-4 border-r border-slate-200 text-left font-bold text-slate-600 bg-slate-50 min-w-[200px]">Nhân sự (Công nhân)</th>
                      {workerAssignment.technicians.map(tech => (
                        <th key={`tech-${tech.user_id}`} className="px-3 py-4 text-xs font-bold text-slate-600 whitespace-nowrap bg-slate-50" title={tech.full_name}>
                          {tech.full_name} <br/><span className="text-[10px] font-medium text-slate-400">({tech.username})</span>
                        </th>
                      ))}
                      {workerAssignment.technicians.length === 0 && !loadingMatrix && (
                        <th className="px-4 py-4 text-sm font-medium text-slate-400 italic bg-slate-50 text-left">Chưa có Kỹ sư nào trong trại.</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {workerAssignment.workers.length === 0 ? (
                      <tr><td colSpan={workerAssignment.technicians.length + 1} className="p-8 text-center text-slate-500 font-medium">Chưa có Công nhân nào trong trại.</td></tr>
                    ) : (
                      workerAssignment.workers.map(worker => (
                        <tr key={`worker-${worker.user_id}`} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-4 py-3 border-r border-slate-200 text-left bg-white sticky left-0 z-0">
                            <strong className="block text-slate-800 text-sm">{worker.full_name}</strong>
                            <span className="text-xs font-medium text-slate-400">{worker.username}</span>
                          </td>
                          {workerAssignment.technicians.map(tech => {
                            const assigned = workerAssignment.assignments.some(a => a.technician_id === tech.user_id && a.worker_id === worker.user_id);
                            return (
                              <td key={`worker-${worker.user_id}-tech-${tech.user_id}`} className="px-3 py-3 text-center border-l border-slate-100">
                                <input 
                                  type="checkbox" 
                                  checked={assigned} 
                                  disabled={Boolean(busyAssignmentKey)} 
                                  onChange={(e) => handleWorkerAssignmentChange(tech.user_id, worker.user_id, e.target.checked)} 
                                  className="w-4 h-4 cursor-pointer text-emerald-500 focus:ring-emerald-500 rounded disabled:opacity-30 border-slate-300" 
                                />
                              </td>
                            )
                          })}
                          {workerAssignment.technicians.length === 0 && !loadingMatrix && <td></td>}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={() => setShowWorkerAssignmentModal(false)} className="px-8 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng hộp thoại</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default OwnerUsers;