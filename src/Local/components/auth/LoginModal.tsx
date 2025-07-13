// Login modal component for cloud authentication
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { AuthAdapter } from '@local/core/auth';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  authAdapter: AuthAdapter;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose, authAdapter }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      console.log('🔓 LoginModal: Modal opened');
      setEmail('');
      setMessage('');
      setIsSuccess(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setMessage('有効なメールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const result = await authAdapter.login(email);
      
      if (result.success) {
        setIsSuccess(true);
        if (result.magicLink) {
          setMessage(`開発モード: マジックリンクが生成されました。\n${result.magicLink}`);
        } else {
          setMessage('マジックリンクをメールに送信しました。メールを確認してリンクをクリックしてください。');
        }
      } else {
        setMessage(result.message || 'ログインに失敗しました');
        setIsSuccess(false);
      }
    } catch (error) {
      console.error('Login error:', error);
      setMessage('ネットワークエラーが発生しました。しばらく待ってから再度お試しください。');
      setIsSuccess(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div 
      style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div 
        style={{
          backgroundColor: 'white',
          padding: '30px',
          borderRadius: '12px',
          maxWidth: '400px',
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
            <span style={{ fontSize: '18px' }}>☁️</span>
          </div>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '600', color: '#1f2937' }}>
            クラウドログイン
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

        {!isSuccess ? (
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

            {message && !isSuccess && (
              <div style={{
                marginBottom: '16px',
                padding: '12px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                color: '#dc2626',
                fontSize: '14px'
              }}>
                ⚠️ {message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="submit"
                disabled={isLoading || !email}
                style={{
                  flex: 1,
                  backgroundColor: isLoading || !email ? '#9ca3af' : '#3b82f6',
                  color: 'white',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: isLoading || !email ? 'not-allowed' : 'pointer'
                }}
              >
                {isLoading ? '送信中...' : 'マジックリンクを送信'}
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
          </form>
        ) : (
          <div>
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ fontSize: '18px' }}>✅</span>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', color: '#166534', fontSize: '16px', fontWeight: '500' }}>
                    メール送信完了
                  </h3>
                  <p style={{ margin: 0, color: '#166534', fontSize: '14px', whiteSpace: 'pre-line' }}>
                    {message}
                  </p>
                </div>
              </div>
            </div>
            
            <div style={{
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              fontSize: '14px',
              color: '#4b5563'
            }}>
              <p style={{ margin: '0 0 8px 0', fontWeight: '500' }}>📧 メールが届かない場合は：</p>
              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                <li>迷惑メールフォルダを確認してください</li>
                <li>数分後に再度お試しください</li>
                <li>メールアドレスが正しく入力されているか確認してください</li>
              </ul>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setIsSuccess(false);
                  setMessage('');
                  setEmail('');
                }}
                style={{
                  flex: 1,
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  padding: '12px 16px',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer'
                }}
              >
                別のメールアドレスで試す
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'white',
                  color: '#6b7280',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  cursor: 'pointer'
                }}
              >
                ローカルモードに戻る
              </button>
            </div>
          </div>
        )}

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
          <span>マジックリンクログインは、パスワード不要で安全にログインできます。</span>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};