/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useState, useCallback, useEffect } from 'react';
import { authService, pondService } from '../services/api';
import { showToast } from '../utils/toast';

export const AuthContext = createContext();

const normalizeUserRole = (userData) => {
  if (!userData || typeof userData !== 'object') return userData;
  return {
    ...userData,
    role: String(userData.role || '').trim().toUpperCase(),
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [ponds, setPonds] = useState([]);

  // Initialize auth state from localStorage
  useEffect(() => {
    const storedToken = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (storedToken && storedUser) {
      let parsedUser = null;
      try {
        parsedUser = JSON.parse(storedUser);
      } catch (err) {
        console.error('Invalid stored user data:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }

      if (parsedUser) {
        const normalizedStoredUser = normalizeUserRole(parsedUser);
        setToken(storedToken);
        setUser(normalizedStoredUser);
        localStorage.setItem('user', JSON.stringify(normalizedStoredUser));
      }
    }
    setLoading(false);
  }, []);
  
  // Background polling for realtime sensor data
  useEffect(() => {
    if (!token || !user) {
      setPonds([]);
      return;
    }

    let isActive = true;

    const loadPondsForUser = async () => {
      try {
        const pondsRes = await pondService.getAllPonds();
        const pondsList = pondsRes?.data?.data || [];
        // sort by created_at ascending: oldest -> newest
        pondsList.sort((a, b) => {
          const ta = new Date(a?.created_at || 0).getTime();
          const tb = new Date(b?.created_at || 0).getTime();
          return ta - tb;
        });
        if (isActive) {
          setPonds(pondsList);
        }
      } catch (err) {
        console.error('Error loading ponds for user:', err);
      }
    };

    loadPondsForUser();

    return () => {
      isActive = false;
    };
  }, [token, user]);

  // Ensure ponds list is available for all authenticated users (Owner, Technician)
  useEffect(() => {
    const loadPondsForUser = async () => {
      if (!token || !user) {
        setPonds([]);
        return;
      }

      try {
        const pondsRes = await pondService.getAllPonds();
        const pondsList = pondsRes?.data?.data || [];
        // sort by created_at ascending: oldest -> newest
        pondsList.sort((a, b) => {
          const ta = new Date(a?.created_at || 0).getTime();
          const tb = new Date(b?.created_at || 0).getTime();
          return ta - tb;
        });
        setPonds(pondsList);
      } catch (err) {
        console.error('Error loading ponds for user:', err);
      }
    };

    loadPondsForUser();
  }, [token, user]);

  const login = useCallback(async (username, password) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.login(username, password);
      
      if (response.data.success) {
        const { user: userData, token: newToken } = response.data;
        const normalizedUser = normalizeUserRole(userData);
        
        localStorage.setItem('token', newToken);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
        
        setToken(newToken);
        setUser(normalizedUser);
        
        return { success: true, user: normalizedUser };
      } else {
        throw new Error(response.data.message || 'ng nh�p th�t b�i');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'L�i ng nh�p';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (fullName, username, email, phone, password, passwordConfirm, farmName) => {
    try {
      setLoading(true);
      setError(null);
      const response = await authService.register(fullName, username, email, phone, password, passwordConfirm, farmName);
      
      if (response.data.success) {
        // Per UX: do NOT auto-login after register; prompt user to login.
        return { success: true, message: 'Đăng ký thành công' };
      } else if (response.data.errors) {
        // field-level errors from backend
        return { success: false, errors: response.data.errors, message: response.data.message };
      } else {
        throw new Error(response.data.message || 'Đăng ký thất bại');
      }
    } catch (err) {
      const message = err.response?.data?.message || err.message || 'Lỗi đăng ký';
      setError(message);
      return { success: false, message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setError(null);
    try {
      showToast({ title: 'Đăng xuất thành công', type: 'success' });
    } catch (err) {
      // If toast fails for any reason, fail silently but keep logout behavior
      // eslint-disable-next-line no-console
      console.error('Error showing logout toast:', err);
    }
  }, []);

  const isAuthenticated = !!token && !!user;
  const userRole = user?.role;

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        error,
        isAuthenticated,
        userRole,
        setUser,
        login,
        register,
        logout,
        ponds,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
