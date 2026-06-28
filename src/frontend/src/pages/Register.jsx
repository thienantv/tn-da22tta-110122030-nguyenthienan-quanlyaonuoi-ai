import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../utils/toast';

export const Register = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    username: '',
    email: '',
    phone: '',
    farmName: '',
    password: '',
    passwordConfirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);

  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear field-level error when user edits the field
    setFieldErrors((prev) => {
      if (!prev || !prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  };

  const validateForm = () => {
    // Required fields
    const required = ['fullName', 'username', 'email', 'phone', 'farmName', 'password', 'passwordConfirm'];
    for (const f of required) {
      if (!String(formData[f] || '').trim()) {
        setError('Vui lòng điền đầy đủ thông tin bắt buộc');
        showToast({ title: 'Vui lòng điền đầy đủ thông tin', type: 'error' });
        return false;
      }
    }

    // Full name
    if (String(formData.fullName).trim().length < 2) {
      setError('Họ và tên phải có ít nhất 2 ký tự');
      showToast({ title: 'Họ và tên phải có ít nhất 2 ký tự', type: 'error' });
      return false;
    }
    const fullNameValid = /^[\p{L}\p{M}0-9\s'.-]{2,}$/u;
    if (!fullNameValid.test(formData.fullName)) {
      setError('Họ và tên chứa ký tự không hợp lệ');
      showToast({ title: 'Họ và tên chứa ký tự không hợp lệ', type: 'error' });
      return false;
    }

    // Email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Email không hợp lệ');
      showToast({ title: 'Email không hợp lệ', type: 'error' });
      return false;
    }

    // Phone: numeric, start with 0, 10 digits
    const phoneRegex = /^0\d{9}$/;
    if (!phoneRegex.test(formData.phone)) {
      setError('Số điện thoại phải bắt đầu bằng 0 và có đúng 10 chữ số');
      showToast({ title: 'Số điện thoại không hợp lệ', type: 'error' });
      return false;
    }

    // Username
    const usernameRegex = /^[A-Za-z0-9_]{4,30}$/;
    if (!usernameRegex.test(formData.username)) {
      setError('Tên tài khoản chỉ gồm chữ, số và dấu gạch dưới, độ dài 4-30');
      showToast({ title: 'Tên tài khoản không hợp lệ', type: 'error' });
      return false;
    }

    // Password strength
    const passwordStrong = /(?=.{8,})(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (!passwordStrong.test(formData.password)) {
      setError('Mật khẩu phải ít nhất 8 ký tự, có chữ hoa, chữ thường và chữ số');
      showToast({ title: 'Mật khẩu chưa đủ mạnh', type: 'error' });
      return false;
    }

    if (formData.password !== formData.passwordConfirm) {
      setError('Mật khẩu không khớp');
      showToast({ title: 'Mật khẩu không khớp', type: 'error' });
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validateForm()) {
      setLoading(false);
      return;
    }

    const result = await register(
      formData.fullName,
      formData.username,
      formData.email,
      formData.phone,
      formData.password,
      formData.passwordConfirm,
      formData.farmName
    );
    
    setLoading(false);
    
    if (result.success) {
      showToast({ title: 'Đăng ký tài khoản thành công', type: 'success' });
      setFormData((prev) => ({ ...prev, password: '', passwordConfirm: '' }));
      navigate('/login');
    } else {
      setFormData((prev) => ({ ...prev, password: '', passwordConfirm: '' }));
      setError(result.message);
      showToast({ title: result.message || 'Đăng ký thất bại', type: 'error' });
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 relative overflow-hidden p-4 sm:p-8">
      {/* Background Decorative Blobs */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-emerald-300/20 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-cyan-300/20 rounded-full blur-3xl pointer-events-none"></div>

      {/* Register Card */}
      <div className="w-full max-w-[650px] bg-white/80 backdrop-blur-xl rounded-[32px] shadow-2xl border border-white p-8 sm:p-10 relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-500 my-8">
        
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-lg shadow-emerald-500/30 mb-5">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight m-0">
            Tạo tài khoản <span className="text-emerald-500">Chủ trại</span>
          </h1>
          <p className="text-sm text-slate-500 font-medium mt-2">Đăng ký để quản lý hệ thống ao nuôi của bạn</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Full Name Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fullName" className="text-sm font-bold text-slate-700">Họ và tên <span className="text-rose-500">*</span></label>
              <input
                id="fullName"
                name="fullName"
                type="text"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
                placeholder="Nguyễn Văn A"
                value={formData.fullName}
                onChange={handleChange}
                disabled={loading}
                required
              />
              {fieldErrors.fullName && <span className="text-xs font-bold text-rose-500 mt-1">{fieldErrors.fullName}</span>}
            </div>

            {/* Username Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-sm font-bold text-slate-700">Tên đăng nhập <span className="text-rose-500">*</span></label>
              <input
                id="username"
                name="username"
                type="text"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
                placeholder="nguyenvana123"
                value={formData.username}
                onChange={handleChange}
                disabled={loading}
                required
              />
              {fieldErrors.username && <span className="text-xs font-bold text-rose-500 mt-1">{fieldErrors.username}</span>}
            </div>

            {/* Email Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-bold text-slate-700">Email <span className="text-rose-500">*</span></label>
              <input
                id="email"
                name="email"
                type="email"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
                placeholder="email@gmail.com"
                value={formData.email}
                onChange={handleChange}
                disabled={loading}
                required
              />
              {fieldErrors.email && <span className="text-xs font-bold text-rose-500 mt-1">{fieldErrors.email}</span>}
            </div>

            {/* Phone Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="phone" className="text-sm font-bold text-slate-700">Số điện thoại <span className="text-rose-500">*</span></label>
              <input
                id="phone"
                name="phone"
                type="tel"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
                placeholder="0912345678"
                value={formData.phone}
                onChange={handleChange}
                disabled={loading}
                required
              />
              {fieldErrors.phone && <span className="text-xs font-bold text-rose-500 mt-1">{fieldErrors.phone}</span>}
            </div>
          </div>

          {/* Farm Name Input */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="farmName" className="text-sm font-bold text-slate-700">Tên trại nuôi <span className="text-rose-500">*</span></label>
            <input
              id="farmName"
              name="farmName"
              type="text"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
              placeholder="Ví dụ: Trại Tôm Công Nghệ Cao Số 1"
              value={formData.farmName}
              onChange={handleChange}
              disabled={loading}
              required
            />
            {fieldErrors.farmName && <span className="text-xs font-bold text-rose-500 mt-1">{fieldErrors.farmName}</span>}
          </div>

          <div className="h-px bg-slate-100 my-1"></div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-sm font-bold text-slate-700">Mật khẩu <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
                  placeholder="Tối thiểu 8 ký tự"
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  disabled={loading}
                >
                  {showPassword ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
              {fieldErrors.password && <span className="text-xs font-bold text-rose-500 mt-1">{fieldErrors.password}</span>}
            </div>

            {/* Confirm Password Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="passwordConfirm" className="text-sm font-bold text-slate-700">Xác nhận mật khẩu <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input
                  id="passwordConfirm"
                  name="passwordConfirm"
                  type={showPasswordConfirm ? 'text' : 'password'}
                  className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 transition-all outline-none text-slate-800 font-medium disabled:opacity-50"
                  placeholder="Nhập lại mật khẩu"
                  value={formData.passwordConfirm}
                  onChange={handleChange}
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  className="absolute right-4 top-4 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
                  onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                  tabIndex="-1"
                  disabled={loading}
                >
                  {showPasswordConfirm ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold text-center mt-2 animate-in slide-in-from-top-2">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={loading}
            className="w-full mt-4 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Đang xử lý...</span>
              </>
            ) : (
              'Hoàn tất đăng ký'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-sm font-medium text-slate-500">
          Đã có tài khoản?{' '}
          <Link to="/login" className="text-emerald-600 hover:text-emerald-700 font-bold transition-colors">
            Đăng nhập ngay
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;