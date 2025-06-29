import { useEffect, useState } from 'react';
import { useAuth } from './useAuth';

export function useMagicLink() {
  const { verifyToken } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');

    if (token && (type === 'magic-link' || !type)) {
      setIsVerifying(true);
      setVerificationError(null);
      
      verifyToken(token)
        .then(() => {
          // トークン検証成功
          // URLからパラメータを削除
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
        })
        .catch((error) => {
          setVerificationError(error.message || 'Token verification failed');
        })
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, [verifyToken]);

  const clearError = () => {
    setVerificationError(null);
  };

  return {
    isVerifying,
    verificationError,
    clearError
  };
}