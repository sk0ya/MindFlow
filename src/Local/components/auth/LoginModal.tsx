// Login modal component for cloud authentication
import React, { useState, useEffect } from 'react';
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
  const [shouldAutoFocus, setShouldAutoFocus] = useState(false);

  // Auto focus email input when modal opens
  useEffect(() => {
    if (isOpen) {
      setShouldAutoFocus(true);
      // Clear previous state when modal opens
      setEmail('');
      setMessage('');
      setIsSuccess(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage('メールアドレスを入力してください');
      return;
    }

    if (!isValidEmail(email)) {
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
          // Development mode - show magic link
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

  const handleClose = () => {
    setEmail('');
    setMessage('');
    setIsSuccess(false);
    setIsLoading(false);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleTryAnotherEmail = () => {
    setIsSuccess(false);
    setMessage('');
    setEmail('');
    setShouldAutoFocus(true);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div 
        className="bg-white rounded-xl p-6 w-96 max-w-md mx-4 shadow-2xl transform transition-all duration-200 scale-100"
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-lg">☁️</span>
            </div>
            <h2 className="text-xl font-semibold text-gray-800">クラウドログイン</h2>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
            aria-label="閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {!isSuccess ? (
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                placeholder="your-email@example.com"
                disabled={isLoading}
                autoFocus={shouldAutoFocus}
                onFocus={() => setShouldAutoFocus(false)}
              />
            </div>

            {message && !isSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200">
                <div className="flex items-start gap-2">
                  <span className="text-red-500 text-sm">⚠️</span>
                  <span className="text-red-700 text-sm whitespace-pre-line">{message}</span>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading || !email}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span>送信中...</span>
                  </div>
                ) : (
                  'マジックリンクを送信'
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                disabled={isLoading}
              >
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-6 p-4 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-start gap-2">
                <span className="text-green-500 text-lg">✅</span>
                <div>
                  <h3 className="text-green-800 font-medium mb-1">メール送信完了</h3>
                  <p className="text-green-700 text-sm whitespace-pre-line">{message}</p>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 mb-6 bg-gray-50 p-4 rounded-lg">
              <p className="font-medium mb-2">📧 メールが届かない場合は：</p>
              <ul className="list-disc list-inside space-y-1">
                <li>迷惑メールフォルダを確認してください</li>
                <li>数分後に再度お試しください</li>
                <li>メールアドレスが正しく入力されているか確認してください</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleTryAnotherEmail}
                className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                別のメールアドレスで試す
              </button>
              <button
                onClick={handleClose}
                className="px-4 py-3 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                閉じる
              </button>
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500 bg-gray-50 p-3 rounded-lg">
          <div className="flex items-center gap-2">
            <span>🔒</span>
            <span>マジックリンクログインは、パスワード不要で安全にログインできます。</span>
          </div>
        </div>
      </div>
    </div>
  );
};