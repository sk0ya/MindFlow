// Login modal component for cloud authentication with ID/Password
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthProvider';
import { logger } from '../../shared/utils/logger';
import {
  modalOverlay,
  modalContainer,
} from '../../shared/styles/modalStyles';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegisterMode, setIsRegisterMode] = useState(false);

  useEffect(() => {
    if (isOpen) {
      logger.debug('LoginModal: Modal opened');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setMessage('');
      setIsLoading(false);
      setShowPassword(false);
      setIsRegisterMode(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setMessage('有効なメールアドレスを入力してください');
      return;
    }

    if (!password || password.length < 6) {
      setMessage('パスワードは6文字以上で入力してください');
      return;
    }

    if (isRegisterMode && password !== confirmPassword) {
      setMessage('パスワードが一致しません');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      if (isRegisterMode) {
        // 新規登録
        const response = await fetch('https://mindflow-api-production.shigekazukoya.workers.dev/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email, password }),
        });

        const result = await response.json();
        
        if (result.success) {
          setMessage('アカウント作成成功！自動ログインします...');
          // AuthProviderが自動的に認証状態を更新するはず
          setTimeout(() => {
            onClose();
          }, 1500);
        } else {
          setMessage(result.message || 'アカウント作成に失敗しました');
        }
      } else {
        // ログイン
        const result = await loginWithPassword(email, password);
        
        if (result.success) {
          setMessage('ログイン成功！');
          setTimeout(() => {
            onClose();
          }, 1000);
        } else {
          setMessage(result.error || 'ログインに失敗しました');
        }
      }
    } catch (error) {
      logger.error('Auth error:', error);
      setMessage('ネットワークエラーが発生しました。しばらく待ってから再度お試しください。');
    } finally {
      setIsLoading(false);
    }
  };



  if (!isOpen) return null;

  const modalContent = (
    <div 
style={{
        ...modalOverlay,
        zIndex: 99999,
        padding: '20px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          ...modalContainer,
          padding: '30px',
          width: '100%',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
          <div style={{ 
            width: '40px', 
            height: '40px', 
            backgroundColor: '#dbeafe', 
            borderRadius: '50%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            marginRight: '12px'
          }}>
            <span style={{ fontSize: '18px' }}>🔐</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
            {isRegisterMode ? 'アカウント作成' : 'クラウドログイン'}
          </h2>
          <button 
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151',
              marginBottom: '8px'
            }}>
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your-email@example.com"
              disabled={isLoading}
              autoFocus
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
              onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
              onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: '500', 
              color: '#374151',
              marginBottom: '8px'
            }}>
              パスワード
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上のパスワード"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  paddingRight: '48px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '18px',
                  padding: '4px'
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          {isRegisterMode && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '500', 
                color: '#374151',
                marginBottom: '8px'
              }}>
                パスワード（確認）
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="パスワードを再入力"
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
              />
            </div>
          )}

          {message && (
            <div style={{
              marginBottom: '16px',
              padding: '12px',
              backgroundColor: message.includes('成功') ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${message.includes('成功') ? '#bbf7d0' : '#fecaca'}`,
              borderRadius: '8px',
              color: message.includes('成功') ? '#166534' : '#dc2626',
              fontSize: '14px'
            }}>
              {message.includes('成功') ? '✅' : '⚠️'} {message}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
            <button
              type="submit"
              disabled={isLoading || !email || !password || (isRegisterMode && !confirmPassword)}
              style={{
                flex: 1,
                backgroundColor: isLoading || !email || !password || (isRegisterMode && !confirmPassword) ? '#9ca3af' : '#3b82f6',
                color: 'white',
                padding: '12px 16px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: isLoading || !email || !password || (isRegisterMode && !confirmPassword) ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (isRegisterMode ? 'アカウント作成中...' : 'ログイン中...') : (isRegisterMode ? 'アカウント作成' : 'ログイン')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '12px 16px',
                backgroundColor: 'white',
                color: '#6b7280',
                border: '1px solid #d1d5db',
                borderRadius: '8px',
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              ローカルモードに戻る
            </button>
          </div>

          <div style={{ textAlign: 'center' }}>
            <button
              type="button"
              onClick={() => {
                setIsRegisterMode(!isRegisterMode);
                setMessage('');
                setPassword('');
                setConfirmPassword('');
              }}
              disabled={isLoading}
              style={{
                background: 'none',
                border: 'none',
                color: '#3b82f6',
                fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                textDecoration: 'underline'
              }}
            >
              {isRegisterMode ? 'ログインに切り替え' : '新規アカウント作成'}
            </button>
          </div>
        </form>

        <div style={{
          marginTop: '20px',
          padding: '12px',
          backgroundColor: '#f9fafb',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#6b7280',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span>🔒</span>
          <span>
            {isRegisterMode 
              ? 'アカウント作成後、自動的にログインされます。' 
              : 'メールアドレスとパスワードでログインしてください。'
            }
          </span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};