import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './AuthModal.css';

interface AuthModalProps {
  isVisible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isVisible, onClose }) => {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const { login, authState } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setIsSubmitting(true);
    const result = await login(email.trim());

    if (result.success) {
      setShowSuccess(true);
      setEmail('');
    }
    setIsSubmitting(false);
  };

  if (!isVisible) return null;

  return (
    <div className="auth-modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <div className="auth-modal-header">
          <h2>クラウドモードでログイン</h2>
          <button className="auth-modal-close" onClick={onClose}>×</button>
        </div>

        {showSuccess ? (
          <div className="auth-success">
            <div className="success-icon">✉️</div>
            <h3>Magic Linkを送信しました</h3>
            <p>
              <strong>{email}</strong> にログインリンクを送信しました。
              <br />
              メールをチェックしてリンクをクリックしてください。
            </p>
            <button 
              className="auth-button secondary"
              onClick={() => {
                setShowSuccess(false);
                onClose();
              }}
            >
              閉じる
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-description">
              <p>
                メールアドレスを入力してください。
                <br />
                ログイン用のMagic Linkをお送りします。
              </p>
            </div>

            <div className="auth-input-group">
              <label htmlFor="email">メールアドレス</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            {authState.error && (
              <div className="auth-error">
                {authState.error}
              </div>
            )}

            <div className="auth-actions">
              <button
                type="submit"
                className="auth-button primary"
                disabled={isSubmitting || !email.trim()}
              >
                {isSubmitting ? '送信中...' : 'Magic Linkを送信'}
              </button>
              <button
                type="button"
                className="auth-button secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                キャンセル
              </button>
            </div>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <small>
              Magic Linkは5分間有効です。
              <br />
              メールが届かない場合は、迷惑メールフォルダをご確認ください。
            </small>
          </p>
        </div>
      </div>
    </div>
  );
};