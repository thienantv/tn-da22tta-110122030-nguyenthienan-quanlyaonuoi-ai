import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';
import { showToast } from '../utils/toast';

export const ChangePassword = () => {
  const navigate = useNavigate();
  useAuth(); // Giữ nguyên hook auth theo logic cũ của bạn

  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const validateForm = () => {
    if (!formData.currentPassword) {
      showToast({ title: 'Vui lòng nhập mật khẩu hiện tại', type: 'error' });
      return false;
    }
    if (!formData.newPassword) {
      showToast({ title: 'Vui lòng nhập mật khẩu mới', type: 'error' });
      return false;
    }
    if (!formData.confirmPassword) {
      showToast({ title: 'Vui lòng xác nhận mật khẩu', type: 'error' });
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      showToast({ title: 'Mật khẩu mới không khớp', type: 'error' });
      return false;
    }
    if (formData.newPassword.length < 6) {
      showToast({ title: 'Mật khẩu phải từ 6 ký tự trở lên', type: 'error' });
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      await authService.changePassword({
        oldPassword: formData.currentPassword,       // Đổi thành oldPassword
        newPassword: formData.newPassword,
        passwordConfirm: formData.confirmPassword
      });
      
      showToast({ title: 'Đổi mật khẩu thành công', type: 'success' });
      setFormData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      
      // Tự động chuyển hướng về trang chủ sau 1.5s
      setTimeout(() => {
        navigate('/');
      }, 1500);
      
    } catch (err) {
      showToast({ 
        title: err?.response?.data?.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại mật khẩu cũ.', 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords(prev => ({ ...prev, [field]: !prev[field] }));
  };

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Đổi mật khẩu</h1>
          <p className="text-slate-500 font-medium mt-1.5">Bảo vệ tài khoản của bạn bằng một mật khẩu mạnh và an toàn</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* FORM ĐỔI MẬT KHẨU */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 lg:col-span-2 relative overflow-hidden">
          {loading && (
             <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center transition-all">
               <div className="flex flex-col items-center">
                 <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
                 <span className="font-bold text-slate-600">Đang xử lý...</span>
               </div>
             </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-800">Cập nhật mật khẩu</h3>
            <p className="text-sm text-slate-500 mt-1">Vui lòng nhập mật khẩu hiện tại trước khi tạo mật khẩu mới.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-bold text-slate-700">Mật khẩu hiện tại <span className="text-rose-500">*</span></label>
              <div className="relative">
                <input 
                  type={showPasswords.current ? 'text' : 'password'}
                  name="currentPassword"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  required
                  placeholder="Nhập mật khẩu đang sử dụng"
                  className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm"
                />
                <button 
                  type="button" 
                  onClick={() => togglePasswordVisibility('current')}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPasswords.current ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="h-px bg-slate-100 my-2"></div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Mật khẩu mới <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input 
                    type={showPasswords.new ? 'text' : 'password'}
                    name="newPassword"
                    value={formData.newPassword}
                    onChange={handleChange}
                    required
                    placeholder="Mật khẩu mới (tối thiểu 6 ký tự)"
                    className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm"
                  />
                  <button 
                    type="button" 
                    onClick={() => togglePasswordVisibility('new')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPasswords.new ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Xác nhận mật khẩu mới <span className="text-rose-500">*</span></label>
                <div className="relative">
                  <input 
                    type={showPasswords.confirm ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full pl-4 pr-12 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm"
                  />
                  <button 
                    type="button" 
                    onClick={() => togglePasswordVisibility('confirm')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPasswords.confirm ? '🙈' : '👁️'}
                  </button>
                </div>
                {formData.newPassword && formData.confirmPassword && formData.newPassword === formData.confirmPassword && (
                  <span className="text-xs font-bold text-emerald-600 mt-1 flex items-center gap-1">
                    ✓ Mật khẩu xác nhận trùng khớp
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-slate-100">
              <button 
                type="button" 
                onClick={() => navigate(-1)} 
                disabled={loading}
                className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Trở về
              </button>
              <button 
                type="submit" 
                disabled={loading} 
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
              >
                {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </div>

        {/* TIPS BẢO MẬT */}
        <div className="bg-slate-50 rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col justify-start h-fit">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center text-amber-500 text-2xl mb-4 shadow-sm border border-amber-200">
            🛡️
          </div>
          <h3 className="text-lg font-extrabold text-slate-800 mb-4">Mẹo bảo mật tài khoản</h3>
          
          <ul className="flex flex-col gap-3.5 text-sm text-slate-600 font-medium">
            <li className="flex gap-2.5 items-start">
              <span className="text-emerald-500 font-bold mt-0.5">✓</span> 
              Sử dụng mật khẩu dài (tối thiểu 8 ký tự để an toàn hơn).
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="text-emerald-500 font-bold mt-0.5">✓</span> 
              Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt (VD: @, #, $).
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="text-rose-500 font-bold mt-0.5">×</span> 
              Không dùng thông tin cá nhân dễ đoán như ngày sinh, số điện thoại.
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="text-emerald-500 font-bold mt-0.5">✓</span> 
              Nên thay đổi mật khẩu định kỳ 3-6 tháng một lần.
            </li>
            <li className="flex gap-2.5 items-start">
              <span className="text-rose-500 font-bold mt-0.5">×</span> 
              Tuyệt đối không chia sẻ mật khẩu này cho bất kỳ ai.
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
};

export default ChangePassword;