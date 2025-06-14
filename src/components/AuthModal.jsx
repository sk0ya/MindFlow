import React, { useState } from 'react';
import { authManager } from '../utils/authManager.js';

const AuthModal = ({ isVisible, onClose, onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [authMode, setAuthMode] = useState('email'); // 'email' or 'oauth'

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await authManager.loginWithEmail(email);
      onAuthSuccess(result.user);
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setError('');

    try {
      await authManager.loginWithGoogle();
      // リダイレクトが発生するため、ここでは何もしない
    } catch (error) {
      setError(error.message);
      setIsLoading(false);
    }
  };

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '32px',
        minWidth: '400px',
        maxWidth: '500px',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{ margin: 0, color: '#333', fontSize: '24px' }}>
            MindFlow にログイン
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#666'
            }}
          >
            ×
          </button>
        </div>

        {error && (
          <div style={{
            backgroundColor: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '20px',
            fontSize: '14px'
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            borderRadius: '8px',
            backgroundColor: '#f5f5f5',
            padding: '4px'
          }}>
            <button
              onClick={() => setAuthMode('email')}
              style={{
                flex: 1,
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: authMode === 'email' ? 'white' : 'transparent',
                color: authMode === 'email' ? '#333' : '#666',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              メール
            </button>
            <button
              onClick={() => setAuthMode('oauth')}
              style={{
                flex: 1,
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: authMode === 'oauth' ? 'white' : 'transparent',
                color: authMode === 'oauth' ? '#333' : '#666',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              ソーシャル
            </button>
          </div>
        </div>

        {authMode === 'email' ? (
          <form onSubmit={handleEmailLogin}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontWeight: 'bold',
                color: '#333'
              }}>
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '2px solid #e1e5e9',
                  borderRadius: '8px',
                  fontSize: '16px',
                  outline: 'none',
                  transition: 'border-color 0.2s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#007bff'}
                onBlur={(e) => e.target.style.borderColor = '#e1e5e9'}
              />
              <small style={{ color: '#666', fontSize: '12px' }}>
                パスワード不要。メールアドレスのみでログインできます。
              </small>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: isLoading ? '#ccc' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              {isLoading ? 'ログイン中...' : 'ログイン'}
            </button>
          </form>
        ) : (
          <div>
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'white',
                color: '#333',
                border: '2px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '12px',
                transition: 'all 0.2s'
              }}
              onMouseOver={(e) => {
                e.target.style.backgroundColor = '#f8f9fa';
                e.target.style.borderColor = '#007bff';
              }}
              onMouseOut={(e) => {
                e.target.style.backgroundColor = 'white';
                e.target.style.borderColor = '#e1e5e9';
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285f4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34a853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fbbc05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#ea4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              {isLoading ? 'Google で認証中...' : 'Google でログイン'}
            </button>

            <div style={{
              margin: '20px 0',
              textAlign: 'center',
              color: '#666',
              fontSize: '12px'
            }}>
              または
            </div>

            <button
              onClick={() => setAuthMode('email')}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: 'transparent',
                color: '#007bff',
                border: '2px solid #007bff',
                borderRadius: '8px',
                fontSize: '16px',
                cursor: 'pointer'
              }}
            >
              メールアドレスでログイン
            </button>
          </div>
        )}

        <div style={{
          marginTop: '24px',
          padding: '16px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#666'
        }}>
          <strong>注意:</strong> クラウド機能を使用するにはログインが必要です。
          ローカルストレージのみを使用する場合はログイン不要です。
        </div>
      </div>
    </div>
  );
};

export default AuthModal;