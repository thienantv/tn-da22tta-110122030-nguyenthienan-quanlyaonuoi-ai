import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { expenseService, pondService, seasonService } from '../../services/api';
import { showToast } from '../../utils/toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';

const CHART_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6'];
const DEFAULT_PAGE_SIZE = 10;

const normalizeUpper = (value) => String(value || '').trim().toUpperCase();
const normalizeText = (value) => String(value || '').trim().toLowerCase();
const formatCurrency = (val) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(val || 0);

const Sparkline = ({ color }) => (
  <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl border border-slate-700">
        {payload[0].payload.name}: <span className="text-emerald-400 ml-1">{formatCurrency(payload[0].value)}</span>
      </div>
    );
  }
  return null;
};

// ============================================================================
// COMPONENT CHÍNH
// ============================================================================
const CostManagement = () => {
  const [expenses, setExpenses] = useState([]);
  const [ponds, setPonds] = useState([]);
  const [seasons, setSeasons] = useState([]);
  
  const [loading, setLoading] = useState(true);

  // States bộ lọc (Mặc định là 'ALL')
  const [searchTerm, setSearchTerm] = useState('');
  const [pondFilter, setPondFilter] = useState('ALL');
  const [seasonFilter, setSeasonFilter] = useState('ALL');
  const [productCategoryFilter, setProductCategoryFilter] = useState('ALL');
  const [monthFilter, setMonthFilter] = useState('ALL');
  
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true); 
      const [expenseRes, pondRes, seasonRes] = await Promise.all([
        expenseService.getAllExpenses(),
        pondService.getAllPonds(),
        seasonService.getAllSeasons()
      ]);
      setExpenses(expenseRes?.data?.data || []);
      setPonds(pondRes?.data?.data || []);
      setSeasons(seasonRes?.data?.data || []);
    } catch (err) {
      showToast({ title: 'Không tải được dữ liệu chi phí hệ thống', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // ============================================================================
  // 🌟 LOGIC BỘ LỌC CHÉO ĐA CHIỀU (CROSS-FILTERING) + NHÓM TÊN MÙA VỤ
  // ============================================================================

  // Bước 1: Chỉ lấy các dữ liệu liên quan đến Vật tư thực tế
  const materialExpenses = useMemo(() => {
    return expenses.filter(e => normalizeUpper(e.category) === 'MATERIAL');
  }, [expenses]);

  // Bước 2: Hàm kiểm tra chéo (Bỏ qua chính bộ lọc đang được tính toán options)
  const checkMatchExcept = useCallback((expense, skipField) => {
    const matchSearch = !normalizeText(searchTerm) || normalizeText(expense.note).includes(normalizeText(searchTerm)) || normalizeText(expense.name).includes(normalizeText(searchTerm));
    const matchPond = skipField === 'pond' || pondFilter === 'ALL' || String(expense.pond_id) === String(pondFilter);
    
    // So sánh Mùa vụ bằng TÊN (để gộp các season_id trùng tên)
    let matchSeason = true;
    if (skipField !== 'season' && seasonFilter !== 'ALL') {
       const seasonObj = seasons.find(s => String(s.season_id) === String(expense.season_id));
       matchSeason = seasonObj && seasonObj.season_name && seasonObj.season_name.trim() === seasonFilter;
    }

    const matchCat = skipField === 'category' || productCategoryFilter === 'ALL' || String(expense.product_category_id) === String(productCategoryFilter);
    const matchMonth = skipField === 'month' || monthFilter === 'ALL' || (expense.expense_date && expense.expense_date.startsWith(monthFilter));

    return matchSearch && matchPond && matchSeason && matchCat && matchMonth;
  }, [searchTerm, pondFilter, seasonFilter, productCategoryFilter, monthFilter, seasons]);

  // Bước 3: Tính toán Options động cho các Dropdown dựa trên dữ liệu chéo
  const dynamicPonds = useMemo(() => {
    const validExp = materialExpenses.filter(e => checkMatchExcept(e, 'pond'));
    const validIds = new Set(validExp.map(e => String(e.pond_id)));
    return ponds.filter(p => validIds.has(String(p.pond_id)));
  }, [materialExpenses, checkMatchExcept, ponds]);

  const dynamicSeasons = useMemo(() => {
    const validExp = materialExpenses.filter(e => checkMatchExcept(e, 'season'));
    const validIds = new Set(validExp.map(e => String(e.season_id)));
    
    // Gom nhóm để loại bỏ tên mùa vụ trùng lặp
    const uniqueNames = new Set();
    seasons.forEach(s => {
      if (validIds.has(String(s.season_id)) && s.season_name) {
        uniqueNames.add(s.season_name.trim());
      }
    });
    return Array.from(uniqueNames).sort(); // Trả về mảng TÊN MÙA VỤ
  }, [materialExpenses, checkMatchExcept, seasons]);

  const dynamicCategories = useMemo(() => {
    const validExp = materialExpenses.filter(e => checkMatchExcept(e, 'category'));
    const catMap = new Map();
    validExp.forEach(e => {
      if (e.product_category_id && e.product_category_name) {
        catMap.set(String(e.product_category_id), e.product_category_name);
      }
    });
    return Array.from(catMap.entries()).map(([id, name]) => ({ id, name }));
  }, [materialExpenses, checkMatchExcept]);

  const dynamicMonths = useMemo(() => {
    const validExp = materialExpenses.filter(e => checkMatchExcept(e, 'month'));
    const monthsSet = new Set();
    validExp.forEach(e => { if (e.expense_date) monthsSet.add(e.expense_date.substring(0, 7)); });
    return Array.from(monthsSet).sort().reverse();
  }, [materialExpenses, checkMatchExcept]);

  // Bước 4: Tự động Reset nếu giá trị đang chọn bị vô hiệu hóa bởi bộ lọc khác
  useEffect(() => {
    if (pondFilter !== 'ALL' && !dynamicPonds.some(p => String(p.pond_id) === String(pondFilter))) setPondFilter('ALL');
  }, [dynamicPonds, pondFilter]);

  useEffect(() => {
    // Vì seasonFilter là tên chuỗi (string) nên dùng includes
    if (seasonFilter !== 'ALL' && !dynamicSeasons.includes(seasonFilter)) setSeasonFilter('ALL');
  }, [dynamicSeasons, seasonFilter]);

  useEffect(() => {
    if (productCategoryFilter !== 'ALL' && !dynamicCategories.some(c => String(c.id) === String(productCategoryFilter))) setProductCategoryFilter('ALL');
  }, [dynamicCategories, productCategoryFilter]);

  useEffect(() => {
    if (monthFilter !== 'ALL' && !dynamicMonths.includes(monthFilter)) setMonthFilter('ALL');
  }, [dynamicMonths, monthFilter]);

  // ============================================================================
  // TÍNH TOÁN DỮ LIỆU CUỐI CÙNG LÊN BẢNG VÀ BIỂU ĐỒ
  // ============================================================================
  const filteredExpenses = useMemo(() => {
    return materialExpenses
      .filter(e => checkMatchExcept(e, 'none')) // 'none' = Áp dụng tất cả bộ lọc
      .sort((a, b) => new Date(b.expense_date) - new Date(a.expense_date));
  }, [materialExpenses, checkMatchExcept]);

  const summary = useMemo(() => {
    let total = 0;
    const categoryTotals = {};
    
    filteredExpenses.forEach(e => {
      const amt = Number(e.amount || 0);
      total += amt;
      const catName = e.product_category_name || 'Vật tư khác';
      categoryTotals[catName] = (categoryTotals[catName] || 0) + amt;
    });
    return { total, categoryTotals };
  }, [filteredExpenses]);

  const chartData = useMemo(() => {
    return Object.entries(summary.categoryTotals)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value); 
  }, [summary]);

  const totalPages = Math.max(1, Math.ceil(filteredExpenses.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredExpenses.length);
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  if (loading && expenses.length === 0) {
    return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Chi phí Sản xuất</h1>
          <p className="text-slate-500 font-medium mt-1.5">Giám sát dòng tiền hao phí vật tư từ các công việc phân công thực địa</p>
        </div>
      </div>

      {/* KHU VỰC TOP ROW: KPI CARDS & BIỂU ĐỒ TRÒN */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
          <div className="bg-white p-5 xl:p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-md transition-all duration-300">
            <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-slate-500 font-bold text-sm tracking-wide">TỔNG CHI PHÍ VẬT TƯ</span>
                  <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-500 transition-colors shadow-inner">💰</div>
                </div>
                <strong className="block text-2xl xl:text-3xl font-black text-slate-800">{formatCurrency(summary.total)}</strong>
            </div>
            <div className="mt-4 w-full"><Sparkline color="#94a3b8" /></div>
          </div>
          
          <div className="bg-white p-5 xl:p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-md transition-all duration-300">
            <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-slate-500 font-bold text-sm tracking-wide">LƯỢT XUẤT KHO</span>
                  <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center text-sky-500 group-hover:bg-sky-100 group-hover:text-sky-600 transition-colors shadow-inner">📝</div>
                </div>
                <strong className="block text-2xl xl:text-3xl font-black text-sky-600">{filteredExpenses.length}</strong>
            </div>
            <div className="mt-4 w-full"><Sparkline color="#0ea5e9" /></div>
          </div>

          <div className="bg-white p-5 xl:p-6 rounded-[24px] border border-slate-100 shadow-sm relative overflow-hidden flex flex-col justify-between h-full group hover:shadow-md transition-all duration-300">
            <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-slate-500 font-bold text-sm tracking-wide">TỐN KÉM NHẤT</span>
                  <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 group-hover:bg-amber-100 group-hover:text-amber-600 transition-colors shadow-inner">🏆</div>
                </div>
                <strong className="block text-xl xl:text-2xl font-black text-amber-600 truncate pr-2" title={chartData.length > 0 ? chartData[0].name : '-'}>
                  {chartData.length > 0 ? chartData[0].name : '-'}
                </strong>
            </div>
            <div className="mt-4 w-full"><Sparkline color="#f59e0b" /></div>
          </div>
        </div>

        <div className="lg:col-span-1 relative bg-white p-5 xl:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-full min-h-[260px]">
           {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all rounded-[24px]"></div>}
           <h3 className="font-extrabold text-slate-800 text-base xl:text-lg mb-4 text-center">Cơ cấu vật tư sử dụng</h3>
           <div className="flex-1 flex flex-col items-center justify-center relative z-0 w-full">
              {chartData.length > 0 ? (
                <>
                  <div className="w-full h-[150px] mb-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={chartData} innerRadius="55%" outerRadius="90%" paddingAngle={4} dataKey="value" stroke="none">
                          {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip content={<CustomTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="w-full overflow-y-auto max-h-[100px] scrollbar-hide flex flex-col gap-2 px-2">
                    {chartData.map((item, idx) => (
                      <div key={item.name} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 overflow-hidden mr-2">
                            <div className="w-2.5 h-2.5 rounded-full shadow-sm shrink-0" style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}></div>
                            <span className="font-bold text-slate-500 truncate">{item.name}</span>
                          </div>
                          <span className="font-black text-slate-800 shrink-0">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                   <span className="text-4xl mb-3">📊</span>
                   <span className="text-sm font-medium">Chưa có dữ liệu vật tư</span>
                </div>
              )}
           </div>
        </div>
      </div>

      {/* KHU VỰC BOTTOM ROW: BẢNG DỮ LIỆU */}
      <div className="relative bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden flex flex-col w-full">
        
        {loading && (
          <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center transition-all">
            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
              <span className="font-bold text-slate-600">Đang tải dữ liệu...</span>
            </div>
          </div>
        )}

        {/* 🌟 TOOLBAR TÌM KIẾM ĐÃ SẮP XẾP LẠI THỨ TỰ LOGIC LỌC TỪ TRÁI QUA PHẢI */}
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center gap-3 bg-slate-50/30">
          
          <div className="relative flex-1 min-w-[200px]">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            <input type="text" placeholder="Tìm tên vật tư, ghi chú..." value={searchTerm} onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}} className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-100 outline-none transition-all shadow-sm" />
          </div>

          <select value={pondFilter} onChange={(e) => {setPondFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]">
              <option value="ALL">Tất cả ao nuôi</option>
              {dynamicPonds.map(p => <option key={p.pond_id} value={p.pond_id}>{p.pond_name}</option>)}
          </select>

          <select value={seasonFilter} onChange={(e) => {setSeasonFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]">
              <option value="ALL">Tất cả mùa vụ</option>
              {dynamicSeasons.map(name => <option key={name} value={name}>{name}</option>)}
          </select>

          <select value={productCategoryFilter} onChange={(e) => {setProductCategoryFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[180px]">
              <option value="ALL">Tất cả danh mục nhóm</option>
              {dynamicCategories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
          </select>

          <select value={monthFilter} onChange={(e) => {setMonthFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[140px]">
            <option value="ALL">Tất cả thời gian</option>
            {dynamicMonths.map(m => {
              const [year, month] = m.split('-');
              return <option key={m} value={m}>Tháng {month}/{year}</option>
            })}
          </select>
        </div>

        <div className="flex-1 w-full overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ngày ghi nhận</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Sản phẩm sử dụng</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Nguồn phát sinh</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Tổng thành tiền</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Lý do / Diễn giải</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedExpenses.length === 0 ? (
                <tr><td colSpan={5} className="p-12 text-center text-slate-500 font-medium text-lg">Không có dữ liệu chi phí xuất kho vật tư.</td></tr>
              ) : paginatedExpenses.map((e, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-bold text-slate-700">
                    {new Date(e.expense_date).toLocaleDateString('vi-VN')}
                  </td>
                  <td className="px-6 py-4">
                    <strong className="block text-slate-800 text-base">{e.name}</strong>
                    <span className="text-[11px] font-bold text-slate-500 mt-1 bg-slate-100 px-2 py-0.5 rounded uppercase inline-block border border-slate-200">{e.product_category_name || 'Khác'}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider bg-sky-100 text-sky-700 border border-sky-200`}>
                      {e.source || 'HỆ THỐNG'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right font-black text-rose-600 text-lg">
                    -{formatCurrency(e.amount)}
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600 max-w-[250px] truncate" title={e.note}>
                    {e.note || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600 font-medium bg-white shrink-0">
          <div className="flex items-center gap-3">
            <span>Hiển thị</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 outline-none bg-slate-50 focus:border-emerald-500">
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>({filteredExpenses.length > 0 ? startIndex + 1 : 0} - {endIndex} / {filteredExpenses.length})</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentPage(p => p - 1)} disabled={safePage <= 1} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Trước</button>
            <div className="flex items-center justify-center px-4 py-2 bg-emerald-50 text-emerald-700 font-bold rounded-xl border border-emerald-100">{safePage} / {totalPages}</div>
            <button onClick={() => setCurrentPage(p => p + 1)} disabled={safePage >= totalPages} className="px-4 py-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50 transition-colors font-bold shadow-sm">Sau</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default CostManagement;