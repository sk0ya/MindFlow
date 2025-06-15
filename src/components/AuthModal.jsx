import React, { useState } from 'react';
import { authManager } from '../utils/authManager.js';
import MagicLinkNotification from './MagicLinkNotification.jsx';

const AuthModal = ({ isVisible, onClose, onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [authMode, setAuthMode] = useState('email'); // 'email' or 'oauth'
  const [step, setStep] = useState('email'); // 'email' or 'sent'
  const [magicLink, setMagicLink] = useState('');

  const handleSendMagicLink = async (e) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await authManager.sendMagicLink(email);
      setSuccess(result.message);
      setStep('sent');
      
      // Magic Linkがレスポンスに含まれている場合は保存
      if (result.magicLink) {
        setMagicLink(result.magicLink);
      }
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

  const resetModal = () => {
    setStep('email');
    setError('');
    setSuccess('');
    setEmail('');
    setMagicLink('');
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
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '40px',
        borderRadius: '12px',
        width: '400px',
        maxWidth: '90vw',
        boxShadow: '0 20px 50px rgba(0, 0, 0, 0.2)',
        position: 'relative'
      }}>
        <button
          onClick={() => {
            resetModal();
            onClose();
          }}
          style={{
            position: 'absolute',
            top: '15px',
            right: '15px',
            background: 'none',
            border: 'none',
            fontSize: '24px',
            cursor: 'pointer',
            color: '#666',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          ×
        </button>

        <h2 style={{ 
          color: '#333', 
          marginBottom: '20px',
          textAlign: 'center',
          fontSize: '24px'
        }}>
          🧠 MindFlow にログイン
        </h2>
        
        {error && (
          <div style={{
            background: '#fee',
            color: '#c33',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '15px',
            border: '1px solid #fcc',
            fontSize: '14px'
          }}>
            ✕ {error}
          </div>
        )}

        {success && (
          <div style={{
            background: '#efe',
            color: '#363',
            padding: '12px',
            borderRadius: '6px',
            marginBottom: '15px',
            border: '1px solid #cfc',
            fontSize: '14px'
          }}>
            ✓ {success}
          </div>
        )}

        <div style={{ marginBottom: '25px' }}>
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
                padding: '10px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: authMode === 'email' ? 'white' : 'transparent',
                color: authMode === 'email' ? '#333' : '#666',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: authMode === 'email' ? '500' : '400'
              }}
            >
              メール
            </button>
            <button
              onClick={() => setAuthMode('oauth')}
              style={{
                flex: 1,
                padding: '10px 16px',
                border: 'none',
                borderRadius: '6px',
                backgroundColor: authMode === 'oauth' ? 'white' : 'transparent',
                color: authMode === 'oauth' ? '#333' : '#666',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: authMode === 'oauth' ? '500' : '400'
              }}
            >
              ソーシャル
            </button>
          </div>
        </div>

        {authMode === 'email' ? (
          step === 'email' ? (
            <form onSubmit={handleSendMagicLink}>
              <div style={{ marginBottom: '20px' }}>
                <label style={{
                  display: 'block',
                  marginBottom: '8px',
                  color: '#555',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: '1px solid #ddd',
                    borderRadius: '6px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#ddd'}
                  required
                />
              </div>

              <p style={{
                fontSize: '13px',
                color: '#666',
                marginBottom: '25px',
                lineHeight: '1.5',
                textAlign: 'center'
              }}>
                🔐 入力されたメールアドレスに安全なログインリンクを送信します
              </p>

              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '14px',
                  backgroundColor: isLoading ? '#ccc' : '#667eea',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '16px',
                  fontWeight: '500',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  if (!isLoading) e.target.style.backgroundColor = '#5a6fd8';
                }}
                onMouseLeave={(e) => {
                  if (!isLoading) e.target.style.backgroundColor = '#667eea';
                }}
              >
                {isLoading ? '📧 送信中...' : '📧 ログインリンクを送信'}
              </button>
            </form>
          ) : (
            <div style={{ textAlign: 'center' }}>
              <div style={{
                fontSize: '64px',
                marginBottom: '20px',
                opacity: '0.8'
              }}>
                📧
              </div>
              <h3 style={{ 
                color: '#333', 
                marginBottom: '15px',
                fontSize: '20px' 
              }}>
                メールを確認してください
              </h3>
              <p style={{
                color: '#666',
                marginBottom: '20px',
                lineHeight: '1.6',
                fontSize: '15px'
              }}>
                <strong style={{ color: '#333' }}>{email}</strong> に<br/>
                ログインリンクを送信しました。
              </p>
              <p style={{
                color: '#666',
                marginBottom: '25px',
                lineHeight: '1.6',
                fontSize: '14px'
              }}>
                📱 メール内のリンクをクリックしてログインしてください。
              </p>
              <div style={{
                backgroundColor: '#f8f9fa',
                padding: '12px',
                borderRadius: '6px',
                marginBottom: '20px'
              }}>
                <p style={{
                  fontSize: '12px',
                  color: '#999',
                  margin: '0'
                }}>
                  ⏰ リンクは10分間有効です
                </p>
              </div>
              <button
                onClick={() => {
                  setStep('email');
                  setError('');
                  setSuccess('');
                }}
                style={{
                  backgroundColor: 'transparent',
                  color: '#667eea',
                  border: '1px solid #667eea',
                  borderRadius: '6px',
                  padding: '10px 20px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#667eea';
                  e.target.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#667eea';
                }}
              >
                別のメールアドレスを使用
              </button>
            </div>
          )
        ) : (
          <div style={{ textAlign: 'center' }}>
            <button
              onClick={handleGoogleLogin}
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: 'white',
                color: '#333',
                border: '1px solid #ddd',
                borderRadius: '6px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!isLoading) e.target.style.backgroundColor = '#f8f9fa';
              }}
              onMouseLeave={(e) => {
                if (!isLoading) e.target.style.backgroundColor = 'white';
              }}
            >
              <span style={{ fontSize: '18px' }}>🌟</span>
              {isLoading ? 'Googleで認証中...' : 'Googleでログイン'}
            </button>
          </div>
        )}
      </div>
      
      <MagicLinkNotification 
        isVisible={!!magicLink}
        magicLink={magicLink}
        onClose={() => setMagicLink('')}
      />
    </div>
  );
};

export default AuthModal;