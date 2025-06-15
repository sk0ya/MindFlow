import React, { useEffect, useState } from 'react';
import { authManager } from '../utils/authManager.js';

const AuthVerification = ({ onAuthSuccess, onAuthError }) => {
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyToken = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const token = urlParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('認証トークンが見つかりません');
        onAuthError && onAuthError('認証トークンが見つかりません');
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
        onAuthSuccess && onAuthSuccess(result.user);
        
        // 3秒後にホームページにリダイレクト
        setTimeout(() => {
          window.location.href = '/MindFlow/';
        }, 3000);
        
      } catch (error) {
        console.error('Authentication verification failed:', error);
        setStatus('error');
        setMessage(error.message || '認証に失敗しました');
        onAuthError && onAuthError(error.message);
      }
    };

    verifyToken();
  }, [onAuthSuccess, onAuthError]);

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
              onMouseEnter={(e) => e.target.style.backgroundColor = '#5a6fd8'}
              onMouseLeave={(e) => e.target.style.backgroundColor = '#667eea'}
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