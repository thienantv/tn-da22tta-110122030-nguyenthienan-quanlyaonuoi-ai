import React, { createContext, useState, useContext, useEffect } from 'react';
import { notificationService } from '../services/api';
import { useAuth } from './AuthContext';

const NotificationContext = createContext();

export const NotificationProvider = ({ children }) => {
    const { user } = useAuth(); // Lấy thông tin user để biết đã đăng nhập chưa
    const [unreadCount, setUnreadCount] = useState(0);

    const fetchUnreadCount = async () => {
        if (!user) return; // Nếu chưa đăng nhập thì không gọi
        try {
            const res = await notificationService.getNotifications();
            const notifications = res.data.data || [];
            const count = notifications.filter(n => !n.is_read).length;
            setUnreadCount(count);
        } catch (error) {
            console.error("Lỗi lấy số lượng thông báo:", error);
        }
    };

    // Tự động đếm ngay khi user đăng nhập vào app
    useEffect(() => {
        fetchUnreadCount();
        
        // Bonus: Tự động cập nhật mỗi 1 phút để Sidebar luôn mới
        const interval = setInterval(fetchUnreadCount, 60000); 
        return () => clearInterval(interval);
    }, [user]);

    return (
        <NotificationContext.Provider value={{ unreadCount, fetchUnreadCount }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotification = () => useContext(NotificationContext);