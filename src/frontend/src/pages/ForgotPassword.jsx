import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { showToast } from '../utils/toast';

export const ForgotPassword = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!email) {
            showToast({ title: 'Vui lòng nhập địa chỉ email', type: 'warning' });
            return;
        }

        // Kiểm tra định dạng email cơ bản
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showToast({ title: 'Định dạng email không hợp lệ', type: 'error' });
            return;
        }

        setLoading(true);

        try {
            // Gọi API xuống Backend (Đảm bảo URL trùng với server của bạn)
            const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
            // Tự động kiểm tra: Nếu URL đã có đuôi /api rồi thì không nối thêm /api nữa
            const endpoint = BASE_URL.endsWith('/api')
                ? `${BASE_URL}/auth/forgot-password`
                : `${BASE_URL}/api/auth/forgot-password`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (data.success || response.ok) {
                setIsSuccess(true);
                showToast({ title: 'Đã gửi yêu cầu khôi phục thành công', type: 'success' });
            } else {
                showToast({ title: data.message || 'Có lỗi xảy ra, vui lòng thử lại', type: 'error' });
            }
        } catch (error) {
            console.error('Lỗi khi gọi API forgot-password:', error);
            showToast({ title: 'Không thể kết nối đến máy chủ', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden p-4 sm:p-8">
            {/* Background Decorative Blobs */}
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-300/20 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-300/20 rounded-full blur-3xl pointer-events-none"></div>

            {/* Forgot Password Card */}
            <div className="w-full max-w-[440px] bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white p-8 sm:p-10 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-500">

                {/* Brand Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 mb-5">
                        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-black text-slate-800 tracking-tight m-0">Khôi phục mật khẩu</h1>
                    <p className="text-sm text-slate-500 font-medium mt-2">
                        Nhập email của bạn, chúng tôi sẽ gửi một mật khẩu tạm thời để bạn đăng nhập lại.
                    </p>
                </div>

                {!isSuccess ? (
                    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                        {/* Email Input */}
                        <div className="flex flex-col gap-1.5">
                            <label htmlFor="email" className="text-sm font-bold text-slate-700">Email đã đăng ký</label>
                            <input
                                id="email"
                                type="email"
                                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
                                placeholder="Ví dụ: nguyenvan_a@gmail.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={loading}
                                required
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full mt-2 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                    <span>Đang gửi email...</span>
                                </>
                            ) : (
                                'Gửi yêu cầu khôi phục'
                            )}
                        </button>
                    </form>
                ) : (
                    /* Màn hình thông báo thành công */
                    <div className="text-center bg-emerald-50 border border-emerald-100 p-6 rounded-2xl animate-in zoom-in-95 duration-300">
                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-lg font-bold text-slate-800 mb-2">Đã gửi email!</h3>
                        <p className="text-sm text-slate-600 font-medium">
                            Vui lòng kiểm tra hộp thư đến (hoặc mục Spam) của <strong>{email}</strong> để lấy mật khẩu tạm thời.
                        </p>
                    </div>
                )}

                <div className="mt-8 text-center text-sm font-medium text-slate-500">
                    Nhớ lại mật khẩu rồi?{' '}
                    <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors">
                        Quay về Đăng nhập
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPassword;