import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

// グローバルフラグで完全に重複処理を防止
let magicLinkProcessed = false;

export function useMagicLink() {
  const { verifyToken } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    // 既に処理済みまたは現在処理中の場合は何もしない
    if (magicLinkProcessed) {
      console.log('🔗 Magic Link already processed, skipping');
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');

    console.log('🔗 Magic Link Check:', { 
      hasToken: !!token, 
      type, 
      tokenStart: token ? token.substring(0, 10) + '...' : null,
      processed: magicLinkProcessed
    });

    if (token && (type === 'magic-link' || !type)) {
      console.log('✅ Magic Link detected, starting verification');
      magicLinkProcessed = true; // グローバルフラグを設定
      setIsVerifying(true);
      setVerificationError(null);
      
      // URLからパラメータを即座に削除
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      
      verifyToken(token)
        .then(() => {
          console.log('✅ Magic Link verification successful');
          // 認証成功後は何もしない（リロードなし）
        })
        .catch((error) => {
          console.error('❌ Magic Link verification failed:', error);
          setVerificationError(error.message || 'Token verification failed');
          magicLinkProcessed = false; // エラー時のみリセット
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, []); // 依存配列を完全に空にする

  const clearError = () => {
    setVerificationError(null);
    magicLinkProcessed = false; // エラークリア時にリセット
  };

  return {
    isVerifying,
    verificationError,
    clearError
  };
}