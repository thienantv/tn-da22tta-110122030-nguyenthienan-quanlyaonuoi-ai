import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../utils/toast';
import { userService } from '../services/api';

const getRoleName = (role) => {
  const r = String(role || '').toUpperCase();
  if (r === 'OWNER') return 'Chủ trại';
  if (r === 'MANAGER') return 'Quản lý';
  if (r === 'TECHNICIAN') return 'Kỹ sư';
  if (r === 'WORKER') return 'Công nhân';
  return 'Người dùng';
};

const getRoleBadge = (role) => {
  const r = String(role || '').toUpperCase();
  if (r === 'OWNER') return <span className="bg-sky-100 text-sky-700 px-4 py-1.5 rounded-full text-sm font-bold border border-sky-200">Chủ trại</span>;
  if (r === 'MANAGER') return <span className="bg-violet-100 text-violet-700 px-4 py-1.5 rounded-full text-sm font-bold border border-violet-200">Quản lý</span>;
  if (r === 'TECHNICIAN') return <span className="bg-amber-100 text-amber-700 px-4 py-1.5 rounded-full text-sm font-bold border border-amber-200">Kỹ sư</span>;
  if (r === 'WORKER') return <span className="bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-200">Công nhân</span>;
  return <span className="bg-slate-100 text-slate-600 px-4 py-1.5 rounded-full text-sm font-bold border border-slate-200">{role || 'Khác'}</span>;
};

export const Profile = () => {
  const { user, setUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  
  const [initialFormData, setInitialFormData] = useState({ fullName: '', email: '', phone: '' });
  const [formData, setFormData] = useState({ fullName: '', email: '', phone: '' });

  const [avatarPreview, setAvatarPreview] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setProfileLoading(true);
        const res = await userService.getCurrentUser();
        const currentUser = res?.data?.data || user || null;
        setProfile(currentUser);
        if (currentUser) {
          const nextFormData = {
            fullName: currentUser.full_name || '',
            email: currentUser.email || '',
            phone: currentUser.phone || '',
          };
          setFormData(nextFormData);
          setInitialFormData(nextFormData);
          setAvatarPreview(currentUser.avatar_url || '');
        }
      } catch (err) {
        showToast({ title: 'Không thể tải thông tin hồ sơ', type: 'error' });
      } finally {
        setProfileLoading(false);
      }
    };
    loadProfile();
  }, [user]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleReset = () => {
    setFormData(initialFormData);
    setAvatarPreview(profile?.avatar_url || '');
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const previewUrl = URL.createObjectURL(file);
    setAvatarPreview(previewUrl);

    try {
      setAvatarUploading(true);
      const uploadData = new FormData();
      uploadData.append('avatar', file);
      
      // Giả sử API upload avatar của bạn là uploadAvatar, 
      // nếu là hàm khác vui lòng đổi tên hàm tương ứng.
      const res = await userService.uploadAvatar(uploadData); 
      
      if (res?.data?.data?.avatar_url || res?.data?.avatar_url) {
        const newUrl = res.data.data?.avatar_url || res.data.avatar_url;
        setAvatarPreview(newUrl);
        setUser({ ...user, avatar_url: newUrl });
        setProfile({ ...profile, avatar_url: newUrl });
        showToast({ title: 'Cập nhật ảnh đại diện thành công', type: 'success' });
      }
    } catch (err) {
      setAvatarPreview(profile?.avatar_url || '');
      showToast({ title: 'Lỗi tải ảnh đại diện lên', type: 'error' });
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await userService.updateProfile({
        fullName: formData.fullName,
        email: formData.email,
        phone: formData.phone,
      });
      showToast({ title: 'Cập nhật hồ sơ thành công', type: 'success' });
      setInitialFormData(formData);
      setUser({ ...user, full_name: formData.fullName, email: formData.email, phone: formData.phone });
      setProfile({ ...profile, full_name: formData.fullName, email: formData.email, phone: formData.phone });
    } catch (err) {
      showToast({ title: err?.response?.data?.message || 'Lỗi cập nhật hồ sơ', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading && !profile) {
    return <div className="flex items-center justify-center h-screen"><div className="w-12 h-12 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="max-w-[1200px] mx-auto animate-in fade-in duration-300">
      
      {/* HEADER */}
      <div className="relative bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 rounded-[24px] p-6 md:p-8 mb-6 border border-emerald-100/60 shadow-sm overflow-hidden flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-64 h-64 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-800 tracking-tight">Hồ sơ Cá nhân</h1>
          <p className="text-slate-500 font-medium mt-1.5">Quản lý thông tin định danh và tài khoản bảo mật của bạn</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* CỘT TRÁI: AVATAR & THÔNG TIN CHUNG */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 flex flex-col items-center relative overflow-hidden h-fit">
          {profileLoading && <div className="absolute inset-0 z-10 bg-white/50 backdrop-blur-[2px]"></div>}
          
          <div className="relative mb-6 group">
            <div className={`w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-slate-100 flex items-center justify-center text-4xl font-bold text-slate-400 ${avatarUploading ? 'opacity-50' : ''}`}>
              {avatarPreview ? (
                <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <span>{formData.fullName?.charAt(0)?.toUpperCase() || 'U'}</span>
              )}
            </div>
            
            {/* Overlay Camera Icon */}
            <div 
              className="absolute inset-0 bg-slate-900/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleAvatarChange} 
              accept="image/*" 
              className="hidden" 
            />

            {avatarUploading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            )}
          </div>

          <h2 className="text-xl font-extrabold text-slate-800 text-center">{profile?.full_name || 'Chưa cập nhật tên'}</h2>
          <p className="text-sm font-medium text-slate-500 mt-1 mb-4">@{profile?.username || 'username'}</p>
          
          <div className="mb-6">
            {getRoleBadge(profile?.role_name || profile?.role)}
          </div>

          <div className="w-full pt-6 border-t border-slate-100 flex flex-col gap-4 text-sm">
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Trạng thái</span>
              <span className="flex items-center gap-1.5 font-bold text-emerald-600"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Đang hoạt động</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500 font-medium">Ngày tham gia</span>
              <span className="font-bold text-slate-700">
                {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : '-'}
              </span>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: FORM CHỈNH SỬA */}
        <div className="bg-white rounded-[24px] shadow-sm border border-slate-200 p-6 md:p-8 lg:col-span-2 relative overflow-hidden">
          {loading && (
             <div className="absolute inset-0 z-20 bg-white/50 backdrop-blur-sm flex items-center justify-center transition-all">
               <div className="flex flex-col items-center">
                 <div className="w-10 h-10 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin mb-3"></div>
                 <span className="font-bold text-slate-600">Đang lưu thay đổi...</span>
               </div>
             </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-extrabold text-slate-800">Thông tin chi tiết</h3>
            <p className="text-sm text-slate-500 mt-1">Cập nhật thông tin liên hệ để nhận các thông báo từ hệ thống.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Họ và tên <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  name="fullName"
                  value={formData.fullName} 
                  onChange={handleChange} 
                  required 
                  placeholder="Nhập họ và tên..."
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" 
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">Số điện thoại</label>
                <input 
                  type="tel" 
                  name="phone"
                  value={formData.phone} 
                  onChange={handleChange} 
                  placeholder="VD: 0912345678"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" 
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">Địa chỉ Email <span className="text-rose-500">*</span></label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email} 
                  onChange={handleChange} 
                  required 
                  placeholder="name@example.com"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-100 focus:border-emerald-500 outline-none transition-all font-medium shadow-sm" 
                />
              </div>

              <div className="flex flex-col gap-1.5 md:col-span-2">
                <label className="text-sm font-bold text-slate-700">Vai trò / Quyền hạn</label>
                <input 
                  type="text" 
                  value={getRoleName(profile?.role_name || profile?.role)} 
                  disabled
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold shadow-sm cursor-not-allowed" 
                />
                <span className="text-xs font-medium text-slate-400 mt-1 italic">Bạn đang đăng nhập với tư cách {getRoleName(profile?.role_name || profile?.role)}. Chỉ Hệ thống mới có thể đổi quyền.</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-slate-100">
              <button 
                type="button" 
                onClick={handleReset} 
                disabled={loading || avatarUploading}
                className="px-6 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50"
              >
                Khôi phục
              </button>
              <button 
                type="submit" 
                disabled={loading || avatarUploading} 
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20 active:scale-95 transition-all"
              >
                {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
              </button>
            </div>
          </form>

        </div>
      </div>

    </div>
  );
};

export default Profile;