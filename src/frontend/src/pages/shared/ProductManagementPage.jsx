import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { productService } from '../../services/api';
import { showToast } from '../../utils/toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const emptyProductForm = { categoryId: '', categoryName: '', productName: '', unit: '', supplier: '', unitPrice: '', note: '' };
const emptyOverview = { totalCategories: 0, totalProducts: 0, totalSuppliers: 0, topCategory: null, categoryStats: [], supplierStats: [], topProducts: [] };

// --- HELPERS & COLORS ---
const CHART_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f43f5e', '#64748b'];

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }).format(date);
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('vi-VN')} ₫`;
};

const normalizeText = (value) => String(value || '').trim().toLowerCase();

const Sparkline = ({ color }) => (
  <svg className="w-full h-8 opacity-60" viewBox="0 0 100 30" preserveAspectRatio="none">
    <path d="M0 25 Q 20 5, 40 15 T 70 10 T 100 20" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// ============================================================================
// COMPONENT CHÍNH
// ============================================================================
const ProductManagementPage = ({ roleLabel = 'Owner' }) => {
  const [overview, setOverview] = useState(emptyOverview);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [savingProduct, setSavingProduct] = useState(false);
  
  const [activeTab, setActiveTab] = useState('products');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const [showProductModal, setShowProductModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [productForm, setProductForm] = useState(emptyProductForm);
  
  const [editingProductId, setEditingProductId] = useState(null);
  const [detailType, setDetailType] = useState('');
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // 🌟 GỌI API CHUẨN XÁC
  const fetchData = useCallback(async () => {
    try {
      setLoading(true); 
      const [overviewRes, categoriesRes, productsRes] = await Promise.all([
        productService.getProductOverview(),
        productService.getProductCategories(),
        productService.getProducts(),
      ]);

      setOverview(overviewRes?.data?.data || overviewRes?.data || emptyOverview);
      setCategories(categoriesRes?.data?.data || categoriesRes?.data || []);
      setProducts(productsRes?.data?.data || productsRes?.data || []);
    } catch (err) {
      showToast({ title: err?.response?.data?.message || 'Không tải được dữ liệu sản phẩm', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- DATA COMPUTATION ---
  const totalSuppliers = useMemo(() => {
    return new Set(products.map((item) => String(item.supplier || '').trim()).filter(Boolean)).size;
  }, [products]);

  const activeDataList = useMemo(() => activeTab === 'categories' ? categories : products, [activeTab, categories, products]);

  const filteredList = useMemo(() => {
    const term = normalizeText(search);
    return activeDataList.filter((item) => {
      if (activeTab === 'categories') {
        const matchesSearch = !term || normalizeText(item.category_name).includes(term);
        const count = Number(item.product_count || 0);
        const matchesFilter = categoryFilter === 'ALL' ? true : categoryFilter === 'HAS_PRODUCTS' ? count > 0 : count === 0;
        return matchesSearch && matchesFilter;
      } else {
        const matchesSearch = !term || normalizeText(item.product_name).includes(term) || normalizeText(item.supplier).includes(term);
        const matchesCat = categoryFilter === 'ALL' || String(item.category_id) === String(categoryFilter);
        return matchesSearch && matchesCat;
      }
    });
  }, [activeDataList, activeTab, search, categoryFilter]);

  // --- PAGINATION ---
  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const safePage = Math.min(Math.max(currentPage, 1), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, filteredList.length);
  const paginatedList = filteredList.slice(startIndex, endIndex);

  // --- CHART DATA ---
  const categoryChartData = useMemo(() => {
    return (overview.categoryStats || []).map((item, idx) => ({ label: item.label, value: Number(item.value || 0), color: CHART_COLORS[idx % CHART_COLORS.length] }));
  }, [overview.categoryStats]);

  const supplierChartData = useMemo(() => {
    return (overview.supplierStats || []).map((item, idx) => ({ label: item.label, value: Number(item.value || 0), color: CHART_COLORS[(idx + 2) % CHART_COLORS.length] }));
  }, [overview.supplierStats]);

  const topProductsChartData = useMemo(() => {
    return (overview.topProducts || []).slice(0, 5).map((item, idx) => ({ label: item.label, value: Number(item.value || 0), color: CHART_COLORS[(idx + 4) % CHART_COLORS.length] }));
  }, [overview.topProducts]);

  // --- HANDLERS ---
  const handleTabChange = (tab) => {
    setActiveTab(tab); setSearch(''); setCategoryFilter('ALL'); setCurrentPage(1);
  };

  const openProductModal = (product = null) => {
    setEditingProductId(product?.product_id || null);
    setProductForm(product ? { 
        categoryId: String(product.category_id || ''), 
        categoryName: '', 
        productName: product.product_name || '', 
        unit: product.unit || '', 
        supplier: product.supplier || '', 
        unitPrice: String(product.unit_price ?? ''), 
        note: product.note || '' 
    } : emptyProductForm);
    setShowProductModal(true);
  };

  const handleSubmitProduct = async (e) => {
    e.preventDefault();
    if (!window.confirm(editingProductId ? 'Xác nhận cập nhật sản phẩm?' : 'Xác nhận thêm sản phẩm?')) return;
    try {
      setSavingProduct(true);
      const payload = {
        categoryId: productForm.categoryId, 
        categoryName: productForm.categoryName.trim(), 
        productName: productForm.productName.trim(),
        unit: productForm.unit.trim(), 
        supplier: productForm.supplier.trim(), 
        unitPrice: Number(productForm.unitPrice) || 0, 
        note: productForm.note.trim(),
      };
      if (editingProductId) {
        await productService.updateProduct(editingProductId, payload);
        showToast({ title: 'Đã cập nhật sản phẩm', type: 'success' });
      } else {
        await productService.createProduct(payload);
        showToast({ title: 'Đã tạo sản phẩm', type: 'success' });
      }
      setShowProductModal(false);
      fetchData();
    } catch (err) { showToast({ title: err?.response?.data?.message || 'Lỗi lưu sản phẩm', type: 'error' }); } 
    finally { setSavingProduct(false); }
  };

  const handleDeleteProduct = async (id) => {
    if (!window.confirm('Chắc chắn muốn xoá sản phẩm này?')) return;
    try {
      await productService.deleteProduct(id);
      showToast({ title: 'Đã xoá sản phẩm', type: 'success' });
      fetchData();
    } catch (err) { showToast({ title: err?.response?.data?.message || 'Lỗi xoá sản phẩm', type: 'error' }); }
  };

  const openDetail = async (id, type) => {
    setDetailType(type); setDetailData(null); setShowDetailModal(true); setDetailLoading(true);
    try {
      const res = type === 'category' ? await productService.getProductCategoryById(id) : await productService.getProductById(id);
      setDetailData(res?.data?.data || res?.data || null);
    } catch (err) {
      showToast({ title: 'Lỗi tải chi tiết', type: 'error' });
      setShowDetailModal(false);
    } finally { setDetailLoading(false); }
  };

  if (loading && categories.length === 0 && products.length === 0) {
    return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Kho Vật Tư & Thuốc</h1>
          <p className="text-slate-500 font-medium mt-1.5">Khai báo các sản phẩm Cám, Thuốc, Vi sinh để xuất kho cho kịch bản SOP</p>
        </div>
        
        <div className="relative z-10 flex flex-wrap gap-3 w-full md:w-auto">
          <button onClick={() => openProductModal()} className="flex-1 md:flex-none px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2">
            <span className="text-lg leading-none">+</span> Khai báo Sản phẩm
          </button>
        </div>
      </div>

      {/* 4 KPI CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5 mb-6">
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Tổng Danh mục</span><div className="w-8 h-8 rounded-full bg-violet-50 flex items-center justify-center text-violet-500">📁</div></div>
          <strong className="block text-3xl font-black text-slate-800">{overview.totalCategories || 6}</strong>
          <div className="mt-2"><Sparkline color="#8b5cf6" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Tổng Sản phẩm</span><div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500">📦</div></div>
          <strong className="block text-3xl font-black text-slate-800">{overview.totalProducts}</strong>
          <div className="mt-2"><Sparkline color="#10b981" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">Nhà cung cấp</span><div className="w-8 h-8 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">🏭</div></div>
          <strong className="block text-3xl font-black text-slate-800">{totalSuppliers}</strong>
          <div className="mt-2"><Sparkline color="#f59e0b" /></div>
        </div>
        <div className="bg-white p-5 rounded-[20px] border border-slate-100 shadow-sm relative overflow-hidden">
          <div className="flex justify-between items-start mb-2"><span className="text-slate-500 font-bold text-sm">DM nhiều SP nhất</span><div className="w-8 h-8 rounded-full bg-sky-50 flex items-center justify-center text-sky-500">⭐</div></div>
          <strong className="block text-xl font-black text-slate-800 mt-2 truncate">{overview.topCategory?.label || '-'}</strong>
          <div className="mt-1.5"><Sparkline color="#0ea5e9" /></div>
        </div>
      </div>

      {/* CHARTS WITH LOCAL LOADING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">
        
        {/* Chart 1: Phân bố theo Danh mục */}
        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
           {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
           <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Sản phẩm theo Danh mục</h3>
           <div className="flex-1 flex items-center relative z-0">
              <div className="w-1/2 h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={categoryChartData} innerRadius="60%" outerRadius="90%" paddingAngle={3} dataKey="value" stroke="none">
                      {categoryChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="w-1/2 pl-4 flex flex-col gap-2 overflow-y-auto h-[180px] justify-start scrollbar-hide py-1">
                 {categoryChartData.map(item => (
                    <div key={item.label} className="flex items-center justify-between shrink-0">
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

        {/* Chart 2: Phân bố theo NCC */}
        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
           {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
           <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Theo Nhà cung cấp</h3>
           <div className="flex-1 flex items-center relative z-0">
              <div className="w-1/2 h-[180px]">
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={supplierChartData} innerRadius="60%" outerRadius="90%" paddingAngle={3} dataKey="value" stroke="none">
                      {supplierChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              
              <div className="w-1/2 pl-4 flex flex-col gap-2 overflow-y-auto h-[180px] justify-start scrollbar-hide py-1">
                 {supplierChartData.map(item => (
                    <div key={item.label} className="flex items-center justify-between shrink-0">
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

        {/* Chart 3: Top sử dụng */}
        <div className="relative bg-white p-5 md:p-6 rounded-[24px] border border-slate-100 shadow-sm flex flex-col h-[320px] overflow-hidden">
          {loading && <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] transition-all"></div>}
          <h3 className="font-extrabold text-slate-800 text-lg mb-4 relative z-0">Top Sản phẩm (Lượt dùng)</h3>
          <div className="flex-1 h-[180px] relative z-0">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topProductsChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="value" radius={[4, 4, 4, 4]} maxBarSize={35}>
                  {topProductsChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* TABS */}
      <div className="flex items-center gap-3 overflow-x-auto pb-4 mb-2 scrollbar-hide">
        <button onClick={() => handleTabChange('products')} className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${activeTab === 'products' ? 'bg-slate-800 text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>📦 Quản lý Sản phẩm</button>
        <button onClick={() => handleTabChange('categories')} className={`whitespace-nowrap px-6 py-2.5 rounded-full text-sm font-bold transition-all shadow-sm ${activeTab === 'categories' ? 'bg-slate-800 text-white shadow-md scale-105' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'}`}>📁 Danh mục Hệ thống (Cố định)</button>
      </div>

      {/* TABLE & FILTERS */}
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
            <input type="text" placeholder={`Tìm kiếm ${activeTab === 'products' ? 'sản phẩm, nhà cung cấp' : 'danh mục'}...`} value={search} onChange={(e) => {setSearch(e.target.value); setCurrentPage(1);}} className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all shadow-sm" />
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {activeTab === 'products' ? (
              <select value={categoryFilter} onChange={(e) => {setCategoryFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[180px]">
                <option value="ALL">Tất cả Danh mục</option>
                {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
              </select>
            ) : (
              <select value={categoryFilter} onChange={(e) => {setCategoryFilter(e.target.value); setCurrentPage(1);}} className="px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 outline-none focus:border-emerald-500 shadow-sm cursor-pointer min-w-[180px]">
                <option value="ALL">Tất cả Danh mục</option>
                <option value="HAS_PRODUCTS">Đang có sản phẩm</option>
                <option value="EMPTY">Chưa có sản phẩm</option>
              </select>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead className="bg-slate-50 border-b border-slate-200">
              {activeTab === 'products' ? (
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên Sản phẩm</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Danh mục</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Đơn vị</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Nhà cung cấp</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Đơn giá</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[160px]">Thao tác</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tên Danh mục</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Mã Hệ thống (Code)</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Ghi chú hướng dẫn</th>
                  <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-center w-[100px]">Thao tác</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedList.length === 0 ? (
                <tr><td colSpan={6} className="p-12 text-center text-slate-500 font-medium text-lg">Không tìm thấy dữ liệu phù hợp.</td></tr>
              ) : paginatedList.map(item => (
                <tr key={activeTab === 'products' ? item.product_id : item.category_id} className="hover:bg-slate-50/50 transition-colors group">
                  
                  {activeTab === 'products' ? (
                    <>
                      <td className="px-6 py-4">
                        <strong className="block text-slate-800 text-base">{item.product_name}</strong>
                        <span className="text-xs font-medium text-slate-400">Cập nhật: {formatDateTime(item.updated_at || item.created_at)}</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-emerald-600">{item.category_name || '-'}</td>
                      <td className="px-6 py-4 text-center font-bold text-slate-700 bg-slate-50/50">{item.unit || '-'}</td>
                      <td className="px-6 py-4 font-medium text-slate-700">{item.supplier || '-'}</td>
                      <td className="px-6 py-4 text-right font-black text-sky-600">{formatCurrency(item.unit_price)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openDetail(item.product_id, 'product')} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-all shadow-sm" title="Xem chi tiết">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          </button>
                          <button onClick={() => openProductModal(item)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 transition-all shadow-sm" title="Chỉnh sửa">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/></svg>
                          </button>
                          <button onClick={() => handleDeleteProduct(item.product_id)} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all shadow-sm" title="Xóa">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-6 py-4">
                        <strong className="block text-slate-800 text-base">{item.category_name}</strong>
                        <span className="text-xs font-medium text-slate-400">Số lượng: {item.product_count || 0} sản phẩm</span>
                      </td>
                      <td className="px-6 py-4 font-bold text-sky-600 bg-sky-50/20">{item.category_code || '-'}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium max-w-[350px] whitespace-normal">{item.note || '-'}</td>
                      <td className="px-6 py-4">
                        {/* CHỈ CHO PHÉP XEM, KHÔNG CHO XÓA SỬA DANH MỤC MASTER */}
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openDetail(item.category_id, 'category')} className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:bg-sky-50 hover:text-sky-600 hover:border-sky-200 transition-all shadow-sm" title="Xem chi tiết">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="p-5 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-slate-600 font-medium bg-white">
          <div className="flex items-center gap-3">
            <span>Hiển thị</span>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 outline-none bg-slate-50 focus:border-emerald-500">
              {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span>({filteredList.length > 0 ? startIndex + 1 : 0} - {endIndex} / {filteredList.length})</span>
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
      {showDetailModal && detailData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowDetailModal(false)}>
          <div className="bg-white max-w-2xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">{detailType === 'category' ? 'Chi tiết Danh mục Hệ thống' : 'Chi tiết Sản phẩm'}</h2>
              <button onClick={() => setShowDetailModal(false)} className="w-8 h-8 flex items-center justify-center bg-slate-100 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-2 pb-2 scrollbar-hide">
              {detailLoading ? (
                <div className="flex justify-center p-8"><div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>
              ) : detailType === 'products' || activeTab === 'products' ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tên Sản phẩm</span><strong className="text-xl text-slate-800">{detailData.product_name}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Mã sản phẩm</span><strong className="text-base text-slate-800">#{detailData.product_id || detailData.product_code}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Danh mục</span><strong className="text-base text-emerald-600">{detailData.category_name || '-'}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Đơn vị</span><strong className="text-base text-slate-800">{detailData.unit}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Đơn giá</span><strong className="text-base text-sky-600 font-black">{formatCurrency(detailData.unit_price)}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Nhà cung cấp</span><strong className="text-base text-slate-800">{detailData.supplier || '-'}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Ghi chú</span><p className="text-sm text-slate-700 m-0 whitespace-pre-line">{detailData.note || '-'}</p></div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Tên Danh mục</span><strong className="text-xl text-slate-800">{detailData.category_name}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Mã hệ thống (Code)</span><strong className="text-base font-bold text-sky-600">{detailData.category_code}</strong></div>
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 col-span-2"><span className="text-xs font-bold text-slate-500 uppercase block mb-1">Hướng dẫn sử dụng</span><p className="text-sm text-slate-700 m-0 whitespace-pre-line">{detailData.note || '-'}</p></div>
                </div>
              )}
            </div>
            
            <div className="mt-4 pt-4 border-t border-slate-100 shrink-0">
               <button onClick={() => setShowDetailModal(false)} className="w-full py-3.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Đóng hồ sơ</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Form PRODUCT */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 sm:p-6" onClick={() => setShowProductModal(false)}>
          <div className="bg-white max-w-2xl w-full p-5 md:p-8 rounded-[24px] shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6 shrink-0">
              <h2 className="text-xl md:text-2xl font-extrabold text-slate-800">{editingProductId ? 'Sửa Sản phẩm' : 'Thêm Sản phẩm'}</h2>
              <button type="button" onClick={() => setShowProductModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 text-lg font-bold transition-colors">&times;</button>
            </div>
            
            <form onSubmit={handleSubmitProduct} className="flex flex-col flex-1 overflow-hidden">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 pb-2">
                
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Tên sản phẩm <span className="text-rose-500">*</span></label><input value={productForm.productName} onChange={(e) => setProductForm({...productForm, productName: e.target.value})} required className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium" /></div>
                
                {/* 🌟 ĐÃ GỠ BỎ TÙY CHỌN "+ DANH MỤC MỚI" - ÉP CHỌN DANH MỤC CHUẨN */}
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Thuộc Danh mục Hệ thống <span className="text-rose-500">*</span></label>
                  <select value={productForm.categoryId} onChange={(e) => setProductForm({...productForm, categoryId: e.target.value})} required className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-bold bg-white text-emerald-700 shadow-sm cursor-pointer">
                    <option value="">-- Bắt buộc chọn danh mục --</option>
                    {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
                  </select>
                </div>
                
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Đơn vị tính <span className="text-rose-500">*</span></label><input value={productForm.unit} onChange={(e) => setProductForm({...productForm, unit: e.target.value})} required placeholder="VD: Kg, Lít, Gói..." className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium" /></div>
                
                <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-slate-700">Đơn giá (VNĐ)</label><input type="number" min="0" step="1000" value={productForm.unitPrice} onChange={(e) => setProductForm({...productForm, unitPrice: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium" /></div>
                
                <div className="flex flex-col gap-1.5 md:col-span-2"><label className="text-sm font-bold text-slate-700">Nhà cung cấp</label><input value={productForm.supplier} onChange={(e) => setProductForm({...productForm, supplier: e.target.value})} placeholder="Tên Cty / Đại lý..." className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium" /></div>
                
                <div className="flex flex-col gap-1.5 md:col-span-2"><label className="text-sm font-bold text-slate-700">Ghi chú</label><textarea rows="3" value={productForm.note} onChange={(e) => setProductForm({...productForm, note: e.target.value})} className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium resize-none"></textarea></div>

              </div>
              
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onClick={() => setShowProductModal(false)} className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors">Hủy</button>
                <button type="submit" disabled={savingProduct} className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95 transition-all">{savingProduct ? 'Đang lưu...' : 'Lưu dữ liệu'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductManagementPage;