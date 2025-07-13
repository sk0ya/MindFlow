// Login modal component for cloud authentication
import React, { useState } from 'react';
import type { AuthAdapter } from '../../core/auth/types';

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage('メールアドレスを入力してください');
      return;
    }

    setIsLoading(true);
    setMessage('');

    try {
      const result = await authAdapter.login(email);
      
      if (result.success) {
        setIsSuccess(true);
        setMessage('マジックリンクをメールに送信しました。メールを確認してリンクをクリックしてください。');
      } else {
        setMessage(result.error || 'ログインに失敗しました');
        setIsSuccess(false);
      }
    } catch (error) {
      setMessage('ログインに失敗しました');
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">クラウドログイン</h2>
          <button
            onClick={handleClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
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
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your-email@example.com"
                disabled={isLoading}
              />
            </div>

            {message && (
              <div className={`mb-4 p-3 rounded ${isSuccess ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {message}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
              >
                {isLoading ? '送信中...' : 'マジックリンクを送信'}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
              >
                キャンセル
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="mb-4 p-3 rounded bg-green-100 text-green-700">
              {message}
            </div>
            
            <div className="text-sm text-gray-600 mb-4">
              <p>メールが届かない場合は：</p>
              <ul className="list-disc list-inside mt-2">
                <li>迷惑メールフォルダを確認してください</li>
                <li>数分後に再度お試しください</li>
              </ul>
            </div>

            <button
              onClick={handleClose}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700"
            >
              閉じる
            </button>
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500">
          マジックリンクログインは、パスワード不要で安全にログインできます。
        </div>
      </div>
    </div>
  );
};