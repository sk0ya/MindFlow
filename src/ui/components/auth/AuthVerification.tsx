import React, { useEffect, useState } from 'react';
import { authManager } from '../../../features/auth/authManager.js';
import type { User } from '../../../shared/types/index.js';

interface AuthVerificationProps {
  onAuthSuccess?: (user: User) => void;
  onAuthError?: (error: string) => void;
}

type VerificationStatus = 'verifying' | 'success' | 'error';

const AuthVerification: React.FC<AuthVerificationProps> = ({ onAuthSuccess, onAuthError }) => {
  const [status, setStatus] = useState<VerificationStatus>('verifying');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    const verifyToken = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('認証トークンが見つかりません');
        onAuthError?.('認証トークンが見つかりません');
        return;
      }

      try {
        setMessage('認証を確認しています...');
        const result = await authManager.verifyMagicLink(token);
        
        setStatus('success');
        setMessage('ログインに成功しました！');
        
        // URLからトークンパラメータを除去
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // 成功コールバック
        onAuthSuccess?.(result.user);
        
        // 3秒後にホームページにリダイレクト
        setTimeout(() => {
          window.location.href = '/MindFlow/';
        }, 3000);
        
      } catch (error) {
        console.error('Authentication verification failed:', error);
        setStatus('error');
        const errorMessage = error instanceof Error ? error.message : '認証に失敗しました';
        setMessage(errorMessage);
        onAuthError?.(errorMessage);
      }
    };

    verifyToken();
  }, [onAuthSuccess, onAuthError]);

  const handleButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    target.style.backgroundColor = '#5a6fd8';
  };

  const handleButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    target.style.backgroundColor = '#667eea';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '50px 40px',
        borderRadius: '16px',
        maxWidth: '400px',
        width: '90vw',
        textAlign: 'center',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.3)'
      }}>
        {status === 'verifying' && (
          <>
            <div style={{
              fontSize: '48px',
              marginBottom: '20px',
              animation: 'spin 1s linear infinite'
            }}>
              🔄
            </div>
            <h2 style={{ 
              color: '#333', 
              marginBottom: '15px',
              fontSize: '24px'
            }}>
              認証を確認中...
            </h2>
            <p style={{
              color: '#666',
              fontSize: '16px',
              lineHeight: '1.5'
            }}>
              {message}
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              fontSize: '64px',
              marginBottom: '20px',
              color: '#4CAF50'
            }}>
              ✅
            </div>
            <h2 style={{ 
              color: '#333', 
              marginBottom: '15px',
              fontSize: '24px'
            }}>
              ログイン成功！
            </h2>
            <p style={{
              color: '#666',
              fontSize: '16px',
              lineHeight: '1.5',
              marginBottom: '25px'
            }}>
              {message}
            </p>
            <p style={{
              color: '#999',
              fontSize: '14px'
            }}>
              MindFlowへようこそ！
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              fontSize: '64px',
              marginBottom: '20px',
              color: '#f44336'
            }}>
              ❌
            </div>
            <h2 style={{ 
              color: '#333', 
              marginBottom: '15px',
              fontSize: '24px'
            }}>
              認証エラー
            </h2>
            <p style={{
              color: '#666',
              fontSize: '16px',
              lineHeight: '1.5',
              marginBottom: '25px'
            }}>
              {message}
            </p>
            <button
              onClick={() => window.location.href = '/MindFlow/'}
              style={{
                backgroundColor: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '12px 24px',
                fontSize: '16px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={handleButtonMouseEnter}
              onMouseLeave={handleButtonMouseLeave}
            >
              ホームに戻る
            </button>
          </>
        )}

        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default AuthVerification;