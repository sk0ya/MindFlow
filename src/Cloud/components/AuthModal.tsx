import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import './AuthModal.css';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const [email, setEmail] = useState('');
  const { login, isLoading, error } = useAuth();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) {
      await login(email.trim());
    }
  };

  return (
    <div className="auth-modal-overlay">
      <div className="auth-modal">
        <div className="auth-modal-header">
          <h2>MindFlow にログイン</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="auth-modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="email">メールアドレス</label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={isLoading}
                required
              />
            </div>
            
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className="login-button"
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? '送信中...' : '🔐 ログインリンクを送信'}
            </button>
          </form>
          
          <p className="auth-description">
            入力されたメールアドレスに安全なログインリンクを送信します
          </p>
        </div>
      </div>
    </div>
  );
}