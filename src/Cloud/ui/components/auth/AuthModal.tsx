import React, { useState, useEffect } from 'react';
import { useUnifiedAuth } from '../../../features/auth/useUnifiedAuth.js';
import MagicLinkNotification from '../common/MagicLinkNotification.jsx';
import type { User } from '../../../shared/types/index.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user?: User) => void;
}

type AuthMode = 'email' | 'oauth';
type AuthStep = 'email' | 'sent';

const AuthModal: React.FC<AuthModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess
}) => {
  // 統一認証システムを使用
  const auth = useUnifiedAuth();
  
  const [email, setEmail] = useState<string>('');
  const [authMode, setAuthMode] = useState<AuthMode>('email');
  const [step, setStep] = useState<AuthStep>('email');
  const [magicLink, setMagicLink] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  
  // 認証成功の監視
  useEffect(() => {
    if (auth.state.isAuthenticated && auth.state.user) {
      console.log('🎉 認証成功検知:', auth.state.user);
      
      // コールバック実行
      if (onSuccess) {
        onSuccess(auth.state.user);
      }
      
      // モーダルを閉じる
      onClose();
    }
  }, [auth.state.isAuthenticated, auth.state.user, onSuccess, onAuthSuccess, onClose]);
  
  // 状態を統一システムから取得
  const isLoading = auth.isLoading;
  const error = auth.error || '';

  const handleSendMagicLink = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      return;
    }

    try {
      // 統一認証システムでMagic Link送信
      await auth.loginWithEmail(email);
      
      // 成功時の処理はメール送信完了を意味する
      setSuccess('メールを送信しました。メールボックスを確認してください。');
      setStep('sent');
      
      // テスト環境の処理は統一システム内で実装されていることを想定
      setMagicLink('');
    } catch (error) {
      console.error('Magic link sending error:', error);
      // エラーは統一システムが管理
    }
  };

  const handleGoogleLogin = async () => {
    try {
      // 統一認証システムでGoogleログイン
      await auth.loginWithGoogle();
      // リダイレクトが発生するため、ここでは何もしない
    } catch (error) {
      console.error('Google login error:', error);
      // エラーは統一システムが管理
    }
  };

  const resetModal = () => {
    setStep('email');
    setSuccess('');
    setEmail('');
    setMagicLink('');
    auth.clearError(); // 統一システムのエラーをクリア
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleInputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#667eea';
  };

  const handleInputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#ddd';
  };

  const handleButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    if (!isLoading && target.style.backgroundColor === '#667eea') {
      target.style.backgroundColor = '#5a6fd8';
    }
  };

  const handleButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    if (!isLoading && target.style.backgroundColor === '#5a6fd8') {
      target.style.backgroundColor = '#667eea';
    }
  };

  const handleSecondaryButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    target.style.backgroundColor = '#667eea';
    target.style.color = 'white';
  };

  const handleSecondaryButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    target.style.backgroundColor = 'transparent';
    target.style.color = '#667eea';
  };

  const handleGoogleButtonMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    if (!isLoading) {
      target.style.backgroundColor = '#f8f9fa';
    }
  };

  const handleGoogleButtonMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    const target = e.target as HTMLButtonElement;
    if (!isLoading) {
      target.style.backgroundColor = 'white';
    }
  };

  if (!isOpen) return null;

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
                  onChange={handleInputChange}
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
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
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
                onMouseEnter={handleButtonMouseEnter}
                onMouseLeave={handleButtonMouseLeave}
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
                {magicLink ? (
                  <span style={{ color: '#4a90e2', fontWeight: '500' }}>
                    テスト環境のためリンクを下記に表示しています。
                  </span>
                ) : (
                  <span style={{ color: '#10b981', fontWeight: '500' }}>
                    ログインリンクをメールで送信しました。
                  </span>
                )}
              </p>
              <p style={{
                color: '#666',
                marginBottom: '25px',
                lineHeight: '1.6',
                fontSize: '14px'
              }}>
                {magicLink ? (
                  '🧪 下記のリンクをクリックしてログインしてください。'
                ) : (
                  '📧 メールボックスを確認し、リンクをクリックしてログインしてください。'
                )}
              </p>
              {magicLink && (
                <>
                  <div style={{
                    backgroundColor: '#fff3cd',
                    padding: '12px',
                    borderRadius: '6px',
                    marginBottom: '15px',
                    border: '1px solid #ffeaa7'
                  }}>
                    <p style={{
                      fontSize: '12px',
                      color: '#856404',
                      margin: '0',
                      fontWeight: '500'
                    }}>
                      ⚠️ 開発・テスト環境です。本番環境ではメールが送信されます。
                    </p>
                  </div>
                  <div style={{
                    backgroundColor: '#f0f8ff',
                    padding: '15px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    border: '1px solid #4a90e2'
                  }}>
                  <p style={{
                    fontSize: '12px',
                    color: '#4a90e2',
                    marginBottom: '10px',
                    fontWeight: '500'
                  }}>
                    🧪 テスト環境用 Magic Link:
                  </p>
                  <div style={{
                    fontSize: '11px',
                    color: '#333',
                    wordBreak: 'break-all',
                    marginBottom: '10px',
                    fontFamily: 'monospace',
                    backgroundColor: 'white',
                    padding: '8px',
                    borderRadius: '4px'
                  }}>
                    {magicLink}
                  </div>
                  <button
                    onClick={() => window.open(magicLink, '_blank')}
                    style={{
                      backgroundColor: '#4a90e2',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '8px 16px',
                      fontSize: '12px',
                      cursor: 'pointer',
                      fontWeight: '500'
                    }}
                  >
                    🚀 今すぐログイン
                  </button>
                  </div>
                </>
              )}
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
                onMouseEnter={handleSecondaryButtonMouseEnter}
                onMouseLeave={handleSecondaryButtonMouseLeave}
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
              onMouseEnter={handleGoogleButtonMouseEnter}
              onMouseLeave={handleGoogleButtonMouseLeave}
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