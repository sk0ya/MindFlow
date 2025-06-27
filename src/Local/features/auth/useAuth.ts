import { useState } from 'react';

// ローカルモード専用の認証フック（認証不要）
export const useAuth = () => {
  // ローカルモードでは常に認証済み状態（認証機能無効）
  const [authState] = useState({
    isAuthenticated: false, // ローカルモードでは認証不要
    user: null,
    isLoading: false
  });
  
  // 認証状態の更新（ローカルモードでは何もしない）
  const updateAuthState = () => {
    // ローカルモードでは認証状態を変更しない
  };

  return {
    authState,
    updateAuthState,
    isAuthVerification: false // ローカルモードでは認証検証なし
  };
};