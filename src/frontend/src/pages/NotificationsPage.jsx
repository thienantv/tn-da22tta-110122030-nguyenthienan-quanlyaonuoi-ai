import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 🌟 THÊM ROUTER ĐỂ ĐIỀU HƯỚNG
import { notificationService } from '../services/api';
import { showToast } from '../utils/toast';
import { useNotification } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext'; // 🌟 LẤY AUTH ĐỂ BIẾT ROLE MÀ ĐIỀU HƯỚNG CHO ĐÚNG

const NotificationsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth(); // Lấy thông tin user để check quyền (Owner/Technician/Worker)
    
    // 🌟 SỬA LỖI SIDEBAR: Khai báo đúng Context để lấy hàm fetchUnreadCount
    const { fetchUnreadCount } = useNotification(); 

    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [markingAll, setMarkingAll] = useState(false);

    useEffect(() => {
        fetchNotifications();
    }, []);

    const fetchNotifications = async () => {
        try {
            const res = await notificationService.getNotifications();
            setNotifications(res.data.data || []);
        } catch (error) {
            showToast({ title: 'Lỗi tải thông báo', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // 🌟 HÀM ĐIỀU HƯỚNG THÔNG MINH DỰA VÀO LOẠI THÔNG BÁO VÀ QUYỀN TRUY CẬP
    const getTargetRoute = (type) => {
        const role = String(user?.role || user?.role_name || '').toLowerCase();
        const basePath = role === 'owner' ? '/owner' : (role === 'worker' ? '/worker' : '/technician');
        const t = String(type).toUpperCase();

        if (t === 'AI_ALERT') return `${basePath}/ai-diagnostic`; // Về trang chẩn đoán AI
        if (['TASK_REMINDER', 'URGENT_REMINDER', 'SOP_REMINDER', 'ESCALATION_ALERT', 'DAILY_DIGEST'].includes(t)) {
            // Chủ trại không có trang quản lý công việc riêng, nên trỏ về dashboard
            return role === 'owner' ? `${basePath}/dashboard` : `${basePath}/tasks`; 
        }
        if (t === 'SYSTEM_ALERT' || t === 'OWNER_REPORT') {
            return `${basePath}/dashboard`;
        }
        return `${basePath}/dashboard`; // Mặc định
    };

    const handleNotificationClick = async (notif) => {
        // 1. Nếu chưa đọc thì gọi API đánh dấu đã đọc
        if (!notif.is_read) {
            try {
                await notificationService.markAsRead(notif.notification_id);
                // Cập nhật state local ngay lập tức để UI mượt mà
                setNotifications(prev => prev.map(n => n.notification_id === notif.notification_id ? { ...n, is_read: true } : n));
                
                // 🌟 GỌI HÀM NÀY ĐỂ TẮT CHẤM ĐỎ Ở SIDEBAR LẬP TỨC MÀ KHÔNG CẦN F5
                fetchUnreadCount(); 
            } catch (error) {
                console.error("Lỗi đánh dấu đã đọc", error);
            }
        }
        
        // 2. Chuyển hướng người dùng đến trang tương ứng để xử lý
        const targetRoute = getTargetRoute(notif.type);
        navigate(targetRoute);
    };

    // 🌟 HÀM MỚI: ĐÁNH DẤU TẤT CẢ ĐÃ ĐỌC (XỬ LÝ ĐỒNG THỜI ĐỂ TĂNG TỐC)
    const handleMarkAllAsRead = async () => {
        const unreadNotifs = notifications.filter(n => !n.is_read);
        if (unreadNotifs.length === 0) return;

        setMarkingAll(true);
        try {
            // Dùng Promise.all để gửi nhiều request đánh dấu đọc cùng lúc (Siêu nhanh)
            await Promise.all(unreadNotifs.map(n => notificationService.markAsRead(n.notification_id)));
            
            // Cập nhật lại UI lập tức
            setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
            fetchUnreadCount(); // Cập nhật Sidebar tắt chấm đỏ
            showToast({ title: 'Đã đánh dấu đọc tất cả', type: 'success' });
        } catch (error) {
            showToast({ title: 'Có lỗi xảy ra khi cập nhật', type: 'error' });
        } finally {
            setMarkingAll(false);
        }
    };

    const unreadCount = notifications.filter(n => !n.is_read).length;

    if (loading) {
        return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>;
    }

    return (
        <div className="max-w-[1600px] mx-auto animate-in fade-in duration-300">
            
            {/* HEADER */}
            <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

                <div className="relative z-10">
                    <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Trung tâm Thông báo</h1>
                    <p className="text-slate-500 font-medium mt-1.5">Theo dõi nhắc nhở và click vào thông báo để đi tới trang xử lý</p>
                </div>
                
                <div className="relative z-10 w-full md:w-auto flex flex-col sm:flex-row items-center gap-4">
                    {/* NÚT ĐÁNH DẤU TẤT CẢ (Chỉ hiện khi có thông báo chưa đọc để giao diện gọn gàng) */}
                    {unreadCount > 0 && (
                        <button 
                            onClick={handleMarkAllAsRead} 
                            disabled={markingAll}
                            className="w-full sm:w-auto px-5 py-2.5 bg-white text-slate-600 font-bold text-sm rounded-xl border border-slate-200 hover:bg-slate-50 hover:text-emerald-600 active:scale-95 transition-all shadow-sm flex items-center justify-center gap-2"
                        >
                            {markingAll ? 'Đang xử lý...' : '✓ Đánh dấu tất cả đã đọc'}
                        </button>
                    )}

                    {/* KHỐI HIỂN THỊ SỐ LƯỢNG */}
                    <div className="w-full sm:w-auto flex items-center justify-between md:justify-center bg-white px-5 py-3 rounded-2xl shadow-sm border border-emerald-100 gap-4">
                        <div className="flex flex-col items-start md:items-end">
                            <span className="text-2xl font-black text-emerald-600 leading-none">{unreadCount}</span>
                            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 mt-1">Chưa đọc</span>
                        </div>
                        <div className="w-12 h-12 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-center text-2xl shadow-inner">
                            🔔
                        </div>
                    </div>
                </div>
            </div>

            {/* DANH SÁCH THÔNG BÁO */}
            <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 overflow-hidden min-h-[500px]">
                {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-slate-400">
                        <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-4 border border-slate-100">
                            <span className="text-5xl">📭</span>
                        </div>
                        <h3 className="font-extrabold text-xl text-slate-600">Bạn chưa có thông báo nào</h3>
                        <p className="font-medium mt-2">Hệ thống sẽ gửi nhắc nhở khi có sự kiện quan trọng.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {notifications.map((notif) => (
                            <div 
                                key={notif.notification_id} 
                                onClick={() => handleNotificationClick(notif)}
                                className={`p-5 md:p-7 transition-all cursor-pointer group flex flex-col sm:flex-row gap-5 items-start relative ${!notif.is_read ? 'bg-emerald-50/40 hover:bg-emerald-50/80' : 'hover:bg-slate-50'}`}
                            >
                                {/* Dải màu dọc bên trái làm điểm nhấn cho thông báo mới */}
                                {!notif.is_read && <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-emerald-400"></div>}

                                {/* Icon */}
                                <div className={`shrink-0 w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm border ${!notif.is_read ? 'bg-amber-100 border-amber-200 text-amber-500' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                                    {notif.type === 'TASK_REMINDER' || notif.type === 'URGENT_REMINDER' || notif.type === 'SOP_REMINDER' ? '⏰' : (notif.type === 'AI_ALERT' ? '🦠' : '📢')}
                                </div>

                                {/* Nội dung */}
                                <div className="flex-1 w-full pr-8">
                                    <div className="flex justify-between items-start mb-1.5">
                                        <h3 className={`text-lg font-extrabold flex items-center gap-2 ${!notif.is_read ? 'text-slate-800' : 'text-slate-600'}`}>
                                            {notif.title}
                                            {!notif.is_read && <span className="px-2 py-0.5 bg-rose-500 text-white text-[9px] font-bold uppercase rounded-md shadow-sm">Mới</span>}
                                        </h3>
                                    </div>
                                    <p className={`text-base mb-3 leading-relaxed ${!notif.is_read ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                                        {notif.content}
                                    </p>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-block">
                                        {new Date(notif.created_at).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </span>
                                </div>

                                {/* Icon Mũi tên chỉ hướng (UX Improvement: Báo hiệu có thể click để đi tới trang) */}
                                <div className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 group-hover:text-emerald-500 transition-all duration-300">
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NotificationsPage;