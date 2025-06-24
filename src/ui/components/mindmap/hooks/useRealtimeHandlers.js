/**
 * リアルタイム機能関連のハンドラーを管理するカスタムフック
 */
export const useRealtimeHandlers = (initializeRealtime, isRealtimeConnected) => {
  const handleRealtimeReconnect = () => {
    if (initializeRealtime) {
      initializeRealtime();
    }
  };

  const handleRealtimeDisconnect = () => {
    // リアルタイムクライアントがあれば切断
    // この機能は必要に応じて useMindMap hook に追加
  };

  const handleToggleRealtime = () => {
    if (isRealtimeConnected) {
      handleRealtimeDisconnect();
    } else {
      handleRealtimeReconnect();
    }
  };

  const handleUserClick = (user) => {
    // ユーザークリック時の処理（必要に応じて実装）
  };

  return {
    handleRealtimeReconnect,
    handleRealtimeDisconnect,
    handleToggleRealtime,
    handleUserClick
  };
};