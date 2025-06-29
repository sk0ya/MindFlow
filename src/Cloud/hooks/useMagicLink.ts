import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';

export const useMagicLink = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [magicLinkProcessed, setMagicLinkProcessed] = useState(false);
  const { verifyToken } = useAuth();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const type = urlParams.get('type');

    if (token && type === 'auth' && !magicLinkProcessed) {
      setIsProcessing(true);
      setMagicLinkProcessed(true);

      const processToken = async () => {
        try {
          const result = await verifyToken(token);
          
          if (result.success) {
            // URLからトークンパラメータを削除
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            newUrl.searchParams.delete('type');
            window.history.replaceState({}, '', newUrl.toString());
          }
        } catch (error) {
          console.error('Magic Link processing error:', error);
        } finally {
          setIsProcessing(false);
        }
      };

      processToken();
    }
  }, [verifyToken, magicLinkProcessed]);

  return {
    isProcessing,
    magicLinkProcessed
  };
};