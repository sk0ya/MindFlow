import { useEffect, useState, useRef } from 'react';
import { useAuth } from './useAuth';

export function useMagicLink() {
  const { verifyToken } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const hasProcessedToken = useRef(false);

  useEffect(() => {
    // 既に処理済みの場合は何もしない
    if (hasProcessedToken.current) {
      return;
    }

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');

    console.log('🔗 Magic Link Check:', { 
      hasToken: !!token, 
      type, 
      tokenStart: token ? token.substring(0, 10) + '...' : null,
      hasProcessed: hasProcessedToken.current
    });

    if (token && (type === 'magic-link' || !type)) {
      console.log('✅ Magic Link detected, starting verification');
      hasProcessedToken.current = true; // 処理済みフラグを設定
      setIsVerifying(true);
      setVerificationError(null);
      
      verifyToken(token)
        .then(() => {
          console.log('✅ Magic Link verification successful');
          // URLからパラメータを即座に削除
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          
          // 少し遅延を入れてページをリロード（確実にクリーンな状態にする）
          setTimeout(() => {
            window.location.href = newUrl;
          }, 1000);
        })
        .catch((error) => {
          console.error('❌ Magic Link verification failed:', error);
          setVerificationError(error.message || 'Token verification failed');
          hasProcessedToken.current = false; // エラー時はリセット
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, []); // 依存配列を空にして初回のみ実行

  const clearError = () => {
    setVerificationError(null);
  };

  return {
    isVerifying,
    verificationError,
    clearError
  };
}