/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  return useContext(ToastContext);
};

let globalAdd = null;

export const showToast = (opts) => {
  // Ghi log ra console để bạn dễ dàng kiểm tra xem hàm có được gọi không
  console.log("🔊 showToast triggered:", opts.title || opts.message);
  
  if (typeof globalAdd === 'function') {
    globalAdd(opts);
  } else {
    console.warn("⚠️ ToastProvider chưa được mount vào App!");
  }
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((opts) => {
    const id = Date.now() + Math.random();
    const t = {
      id,
      title: opts.title || opts.message || '',
      message: opts.message || '',
      type: opts.type || 'info',
      duration: typeof opts.duration === 'number' ? opts.duration : 4500,
      actions: Array.isArray(opts.actions) ? opts.actions : [],
    };
    setToasts((s) => [...s, t]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((s) => s.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    globalAdd = addToast;
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      
      {/* CSS Animation thuần: Đảm bảo chạy 100% không cần cài thêm plugin Tailwind */}
      <style>
        {`
          @keyframes nativeSlideIn {
            from { transform: translateX(110%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .toast-native-animate {
            animation: nativeSlideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          }
        `}
      </style>

      {/* Khu vực neo thông báo: Ép Z-index siêu cao bằng Style Inline */}
      <div 
        className="fixed top-4 right-4 sm:top-6 sm:right-6 flex flex-col gap-3 pointer-events-none w-full max-w-[350px] px-4 sm:px-0"
        style={{ zIndex: 999999 }}
      >
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

function Toast({ toast, onClose }) {
  const { id, title, type, duration, actions } = toast;

  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  // Bộ Icon SVG tối giản cho từng trạng thái
  const getIcon = () => {
    switch (type) {
      case 'success':
        return (
          <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0 shadow-sm border border-emerald-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        );
      case 'error':
        return (
          <div className="w-9 h-9 rounded-full bg-rose-100 flex items-center justify-center text-rose-600 shrink-0 shadow-sm border border-rose-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
        );
      case 'warning':
        return (
          <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0 shadow-sm border border-amber-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
        );
      case 'info':
      default:
        return (
          <div className="w-9 h-9 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 shrink-0 shadow-sm border border-sky-200">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        );
    }
  };

  return (
    <div 
      className="pointer-events-auto bg-white/95 backdrop-blur-xl border border-slate-200 shadow-2xl shadow-slate-200/50 rounded-2xl p-4 flex items-start gap-3 toast-native-animate"
      role="status" 
      aria-live="polite"
    >
      {getIcon()}
      
      <div className="flex-1 pt-1.5 pb-1">
        {title && <h4 className="text-sm font-bold text-slate-800 m-0 leading-snug pr-4">{title}</h4>}
        
        {Array.isArray(actions) && actions.length > 0 && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {actions.map((a, idx) => (
              <button
                key={idx}
                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-slate-900 transition-colors active:scale-95"
                onClick={() => {
                  try {
                    if (typeof a.onClick === 'function') a.onClick();
                  } catch (err) {
                    console.error('Toast action error:', err);
                  }
                  onClose(id);
                }}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button 
        onClick={() => onClose(id)} 
        className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full p-1.5 transition-colors focus:outline-none shrink-0"
        title="Đóng thông báo"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}