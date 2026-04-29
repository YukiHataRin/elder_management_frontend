import React, { useState, useEffect } from 'react';
import { authApi } from '../api/management';
import { AuthContext } from './auth-context';

const MANAGEMENT_ROLE_IDS = [1, 2, 5];

const isManagementUser = (user) => MANAGEMENT_ROLE_IDS.includes(user?.role_id);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const userData = await authApi.getMe();
          if (isManagementUser(userData)) {
            setUser(userData);
          } else {
            localStorage.removeItem('token');
          }
        } catch (error) {
          console.error('Failed to fetch user profile', error);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const data = await authApi.login(username, password);
      // V2 回傳結構確認: data.access_token
      if (data && data.access_token) {
        localStorage.setItem('token', data.access_token);
        
        // 稍微等待或確保 localStorage 寫入完成
        // 有些瀏覽器 localStorage 操作是同步的，但在複雜請求下可能會有競爭
        const userData = await authApi.getMe();
        if (!isManagementUser(userData)) {
          throw new Error('此平台僅供管理員與個管師登入，APP 個案帳號請使用 APP。');
        }
        setUser(userData);
        return userData;
      } else {
        throw new Error('Invalid login response');
      }
    } catch (error) {
      localStorage.removeItem('token');
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    logout,
    isAdmin: user?.role_id === 1,
    isCaseManager: user?.role_id === 2,
    isPatient: user?.role_id === 3,
    isPending: user?.role_id === 5,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
