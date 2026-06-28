import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const Icons = {
  dashboard: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
  ponds: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  seasons: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>,
  environment: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
  products: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>,
  logs: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  costs: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  users: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>,
  tasks: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>,
  ai: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>,
  notifications: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
};

export const Sidebar = () => {
  const { user, userRole, logout } = useAuth();
  const { unreadCount } = useNotification();
  const location = useLocation();
  const navigate = useNavigate();

  // 🌟 Mặc định Sidebar sẽ thu gọn (false)
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);
  const [showDropdown, setShowDropdown] = useState(false);

  // Tham chiếu đến toàn bộ thẻ aside để kiểm tra vùng click chuột
  const sidebarRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 1024;
      setIsMobile(mobile);
      if (mobile) setIsOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🌟 Lắng nghe sự kiện click chuột để thu gọn Sidebar nếu click ra ngoài
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Nếu click vào một phần tử không nằm trong Sidebar và Sidebar đang mở
      if (sidebarRef.current && !sidebarRef.current.contains(event.target)) {
        if (!isMobile && isOpen) {
          setIsOpen(false);
          setShowDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMobile, isOpen]);

  // Tự động truyền biến CSS độ rộng của Sidebar ra ngoài Layout chính
  useEffect(() => {
    if (!isMobile) {
      document.documentElement.style.setProperty('--sidebar-width', isOpen ? '280px' : '84px');
    } else {
      document.documentElement.style.setProperty('--sidebar-width', '0px');
    }
  }, [isOpen, isMobile]);

  const getMenuConfig = () => {
    // Ép kiểu in hoa và fallback an toàn để đảm bảo không bao giờ bị undefined
    const role = String(userRole || 'OWNER').toUpperCase();

    const menus = {
      OWNER: [
        {
          group: null, items: [
            { label: 'Bảng điều khiển', icon: 'dashboard', path: '/owner/dashboard' },
            { label: 'Thông báo', icon: 'notifications', path: '/notifications' }
          ]
        },
        {
          group: 'QUẢN LÝ AO NUÔI', items: [
            { label: 'Quản lý ao nuôi', icon: 'ponds', path: '/owner/ponds' },
            { label: 'Quản lý mùa vụ', icon: 'seasons', path: '/owner/seasons' },
            { label: 'Dữ liệu môi trường', icon: 'environment', path: '/owner/environment' },
          ]
        },
        {
          group: 'QUẢN LÝ SẢN XUẤT', items: [
            { label: 'Quản lý sản phẩm', icon: 'products', path: '/owner/products' },
            { label: 'Nhật ký canh tác', icon: 'logs', path: '/owner/farming-logs' },
            { label: 'Quản lý chi phí', icon: 'costs', path: '/owner/costs' },
          ]
        },
        { group: 'QUẢN LÝ NHÂN SỰ', items: [{ label: 'Quản lý nhân viên', icon: 'users', path: '/owner/users' }] },
        { group: 'CÔNG CỤ HỖ TRỢ', items: [{ label: 'Chẩn đoán bệnh AI', icon: 'ai', path: '/owner/ai-diagnostic' }] }
      ],
      TECHNICIAN: [
        {
          group: null, items: [
            { label: 'Bảng điều khiển', icon: 'dashboard', path: '/technician/dashboard' },
            { label: 'Thông báo', icon: 'notifications', path: '/notifications' }
          ]
        },
        {
          group: 'QUẢN LÝ AO NUÔI', items: [
            { label: 'Quản lý ao nuôi', icon: 'ponds', path: '/technician/ponds' },
            { label: 'Quản lý mùa vụ', icon: 'seasons', path: '/technician/seasons' },
            { label: 'Nhập môi trường', icon: 'environment', path: '/technician/environment' },
          ]
        },
        {
          group: 'QUẢN LÝ SẢN XUẤT', items: [
            { label: 'Quản lý sản phẩm', icon: 'products', path: '/technician/products' },
            { label: 'Phân công công việc', icon: 'tasks', path: '/technician/tasks' },
          ]
        },
        { group: 'CÔNG CỤ HỖ TRỢ', items: [{ label: 'Chẩn đoán bệnh AI', icon: 'ai', path: '/technician/ai-diagnostic' }] }
      ],
      WORKER: [
        {
          group: null, items: [
            { label: 'Bảng điều khiển', icon: 'dashboard', path: '/worker/dashboard' },
            { label: 'Thông báo', icon: 'notifications', path: '/notifications' }
          ]
        },
        { 
          group: 'CÔNG VIỆC', items: [
            { label: 'Công việc được giao', icon: 'tasks', path: '/worker/tasks' },
            // THÊM DÒNG NÀY VÀO DƯỚI TASK CỦA WORKER
            { label: 'Nhập môi trường', icon: 'environment', path: '/worker/environment' } 
          ] 
        }
      ]
    };

    // Luôn trả về 1 mảng (dù là mảng rỗng []) để đảm bảo hàm .map() ở dưới không bao giờ bị sập
    return menus[role] || menus['OWNER'] || [];
  };

  const isActive = (path) => location.pathname === path;
  const handleLinkClick = () => {
    if (isMobile) setIsOpen(false);
    setShowDropdown(false);
  };

  const handleLogout = () => {
    if (window.confirm('Bạn có chắc chắn muốn đăng xuất?')) {
      logout();
      navigate('/login');
    }
  };

  const getRoleLabel = () => {
    if (userRole === 'OWNER') return 'Chủ trại';
    if (userRole === 'TECHNICIAN') return 'Kỹ thuật viên';
    if (userRole === 'WORKER') return 'Công nhân';
    return 'Người dùng';
  };

  const getInitials = (fullName) => {
    const name = String(fullName || '').trim();
    if (!name) return '?';
    const parts = name.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
  };

  return (
    <>
      {/* NÚT MOBILE */}
      {isMobile && !isOpen && (
        <button
          className="fixed top-4 left-4 z-40 p-2.5 bg-slate-900 text-white rounded-xl shadow-lg transition-transform active:scale-95"
          onClick={() => setIsOpen(true)}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
      )}

      {/* OVERLAY MOBILE */}
      <div
        className={`fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300 ${isOpen && isMobile ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => { setIsOpen(false); setShowDropdown(false); }}
      ></div>

      {/* SIDEBAR */}
      <aside
        ref={sidebarRef}
        className={`fixed top-0 left-0 h-screen bg-slate-900 text-slate-300 flex flex-col z-50 transition-all duration-300 ease-in-out shadow-2xl
          ${isMobile ? (isOpen ? 'w-[280px] translate-x-0' : 'w-[280px] -translate-x-full') : (isOpen ? 'w-[280px] translate-x-0' : 'w-[84px] translate-x-0')}
        `}
      >
        {/* HEADER & LOGO */}
        <div className="relative flex items-center px-5 h-[80px] border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
            </div>

            <div className={`flex flex-col whitespace-nowrap transition-all duration-300 overflow-hidden ${isOpen ? 'w-32 opacity-100' : 'w-0 opacity-0'}`}>
              <span className="font-extrabold text-white text-lg tracking-wider">AQUA <span className="text-emerald-500">FARM</span></span>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">Hệ thống ao nuôi</span>
            </div>
          </div>

          {!isMobile && (
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="absolute -right-3.5 w-7 h-7 rounded-full bg-slate-800 border border-slate-500 flex items-center justify-center text-slate-400 hover:text-white hover:border-emerald-400 hover:bg-slate-700 transition-colors z-50 shadow-md"
            >
              <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${isOpen ? '' : 'rotate-180'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" /></svg>
            </button>
          )}

          {isMobile && (
            <button onClick={() => setIsOpen(false)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          )}
        </div>

        {/* MENU ITEMS */}
        <div className="flex-1 overflow-y-auto py-6 px-3 scrollbar-hide">
          {getMenuConfig().map((section, idx) => (
            <div key={idx} className={`${idx !== 0 ? 'mt-6' : ''}`}>
              {section.group && isOpen && (
                <div className="px-3 mb-2 text-[11px] font-bold text-slate-500 tracking-widest uppercase">{section.group}</div>
              )}
              {section.group && !isOpen && (
                <div className="h-[1px] bg-slate-800 mx-4 my-4"></div>
              )}

              <div className="flex flex-col gap-1.5">
                {section.items.map((item) => {
                  const active = isActive(item.path);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={handleLinkClick}
                      title={!isOpen ? item.label : ''}
                      className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative
                        ${active ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' : 'text-slate-400 hover:bg-slate-800/80 hover:text-white'}
                        ${!isOpen ? 'justify-center' : ''}
                      `}
                    >
                      {/* KHỐI ICON (Có kèm chấm đỏ khi thu gọn) */}
                      <span className={`relative shrink-0 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                        {Icons[item.icon]}

                        {!isOpen && item.icon === 'notifications' && unreadCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-rose-500 border-2 border-slate-900 rounded-full animate-pulse"></span>
                        )}
                      </span>

                      {/* KHỐI TEXT (Có kèm số đếm khi mở rộng) */}
                      {isOpen && (
                        <span className="font-medium whitespace-nowrap text-[15px] flex-1 flex items-center justify-between">
                          {item.label}

                          {item.icon === 'notifications' && unreadCount > 0 && (
                            <span className="bg-rose-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm animate-pulse">
                              {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                          )}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* PROFILE DROP-UP */}
        <div className="relative shrink-0">
          {showDropdown && (
            <div className={`absolute bottom-full mb-3 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50 flex flex-col w-[220px] animate-in fade-in zoom-in-95 duration-200
              ${!isOpen && !isMobile ? 'left-4' : 'left-4 right-4 w-auto'}`}
            >
              <div className="px-4 py-3 border-b border-slate-700/50">
                <p className="text-sm font-bold text-white truncate">{user?.full_name || 'Người dùng'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email || 'Chưa cập nhật email'}</p>
              </div>
              <Link to="/profile" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" onClick={() => setShowDropdown(false)}>
                <span className="text-lg">👤</span> Hồ sơ cá nhân
              </Link>
              <Link to="/change-password" className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-700 transition-colors" onClick={() => setShowDropdown(false)}>
                <span className="text-lg">🔒</span> Đổi mật khẩu
              </Link>
              <div className="h-px bg-slate-700/50"></div>
              <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-3.5 text-sm font-bold text-red-400 hover:text-red-300 hover:bg-slate-700 transition-colors w-full text-left">
                <span className="text-lg">🚪</span> Đăng xuất
              </button>
            </div>
          )}

          <div className="p-4 border-t border-slate-800 flex items-center justify-between cursor-pointer hover:bg-slate-800/80 transition-colors" onClick={() => setShowDropdown(!showDropdown)}>
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-10 h-10 rounded-full bg-slate-700 border-2 border-slate-600 overflow-hidden shrink-0 flex items-center justify-center text-white font-bold">
                {user?.avatar_url ? (
                  <img src={user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(user?.full_name)}</span>
                )}
              </div>
              {isOpen && (
                <div className="flex flex-col whitespace-nowrap">
                  <span className="text-sm font-bold text-white">{user?.full_name || 'Người dùng'}</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">{getRoleLabel()}</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </aside>
    </>
  );
};

export default Sidebar;