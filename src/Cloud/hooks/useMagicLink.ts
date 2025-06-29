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

    console.log('🔗 Magic Link Check:', {
      hasToken: !!token,
      type,
      tokenStart: token?.substring(0, 10) + '...',
      currentUrl: window.location.href,
      processed: magicLinkProcessed
    });

    if (token && type === 'magic-link' && !magicLinkProcessed) {
      console.log('✅ Magic Link処理開始');
      setIsProcessing(true);
      setMagicLinkProcessed(true);

      const processToken = async () => {
        try {
          console.log('🔍 Token検証開始:', { tokenStart: token.substring(0, 10) + '...' });
          const result = await verifyToken(token);
          console.log('📋 Token検証結果:', result);
          
          if (result.success) {
            console.log('✅ 認証成功 - URLクリーンアップ');
            // URLからトークンパラメータを削除
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('token');
            newUrl.searchParams.delete('type');
            window.history.replaceState({}, '', newUrl.toString());
            console.log('✅ URLクリーンアップ完了');
          } else {
            console.error('❌ 認証失敗:', result);
          }
        } catch (error) {
          console.error('❌ Magic Link処理エラー:', error);
        } finally {
          console.log('🏁 Magic Link処理完了');
          setIsProcessing(false);
        }
      };

      processToken();
    } else {
      console.log('⏭️ Magic Link処理スキップ:', {
        hasToken: !!token,
        correctType: type === 'magic-link',
        notProcessed: !magicLinkProcessed
      });
    }
  }, [verifyToken, magicLinkProcessed]);

  return {
    isProcessing,
    magicLinkProcessed
  };
};