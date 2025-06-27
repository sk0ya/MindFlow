/**
 * リアルタイム機能関連のハンドラーを管理するカスタムフック（Local版 - 無効化）
 */
export const useRealtimeHandlers = () => {
  // ローカルモードではリアルタイム機能は無効
  return {
    handleRealtimeReconnect: () => {},
    handleRealtimeDisconnect: () => {},
    handleToggleRealtime: () => {},
    handleUserClick: () => {}
  };
};