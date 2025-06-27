/**
 * 統一認証Reactフック（Local版 - 簡略化）
 * ローカルモードでは認証は不要
 */

import { useState, useCallback } from 'react';

// ローカルモード用の認証状態（常に非認証）
const localAuthState = {
  isAuthenticated: false,
  isLoading: false,
  user: null,
  error: null
};

export const useUnifiedAuth = () => {
  const [showModal, setShowModal] = useState(false);

  // ローカルモードでは全ての認証操作は無効
  const loginWithEmail = useCallback(async () => {
    console.log('ローカルモードでは認証は不要です');
  }, []);

  const loginWithGoogle = useCallback(async () => {
    console.log('ローカルモードでは認証は不要です');
  }, []);

  const loginWithGitHub = useCallback(async () => {
    console.log('ローカルモードでは認証は不要です');
  }, []);

  const verifyToken = useCallback(async () => {
    console.log('ローカルモードでは認証は不要です');
  }, []);

  const logout = useCallback(async () => {
    console.log('ローカルモードでは認証は不要です');
    setShowModal(false);
  }, []);

  const openModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const clearError = useCallback(() => {
    // ローカルモードでは何もしない
  }, []);

  const healthCheck = useCallback(async () => {
    return true; // ローカルモードでは常にヘルシー
  }, []);

  const refreshToken = useCallback(async () => {
    return true; // ローカルモードでは何もしない
  }, []);

  return {
    // 状態（常に非認証）
    state: localAuthState,
    isLoading: false,
    error: null,
    
    // 認証操作（全て無効）
    loginWithEmail,
    loginWithGoogle,
    loginWithGitHub,
    verifyToken,
    logout,
    
    // UI状態
    showModal,
    openModal,
    closeModal,
    
    // ユーティリティ
    clearError,
    healthCheck,
    refreshToken
  };
};

// 便利なカスタムフック（ローカル版）
export const useRequireAuth = () => {
  const auth = useUnifiedAuth();
  // ローカルモードでは認証は不要なので何もしない
  return auth;
};

export const useAuthStateChange = () => {
  const auth = useUnifiedAuth();
  // ローカルモードでは認証状態の変化はない
  return auth;
};

export const useMagicLinkVerification = () => {
  // ローカルモードではMagic Link検証は不要
  return {
    isVerifying: false,
    verificationError: null,
    clearVerificationError: () => {}
  };
};