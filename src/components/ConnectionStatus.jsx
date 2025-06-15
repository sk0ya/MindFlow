import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

/**
 * リアルタイム接続状態表示コンポーネント
 * 接続状況、エラー、再接続の管理UI
 */
const ConnectionStatus = ({
  realtimeStatus = 'disconnected',
  isRealtimeConnected = false,
  connectedUsers = [],
  pendingOperations = 0,
  reconnectAttempts = 0,
  lastError = null,
  onReconnect,
  onDisconnect,
  onToggleRealtime,
  onShowCollaborativeFeatures
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showError, setShowError] = useState(false);

  // エラー表示の自動非表示
  useEffect(() => {
    if (lastError) {
      setShowError(true);
      const timer = setTimeout(() => {
        setShowError(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [lastError]);

  const getStatusIcon = () => {
    switch (realtimeStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'reconnecting':
        return '🟠';
      case 'disconnected':
        return '🔴';
      default:
        return '⚫';
    }
  };

  const getStatusText = () => {
    switch (realtimeStatus) {
      case 'connected':
        return `${connectedUsers.length}人が接続中`;
      case 'connecting':
        return '接続中...';
      case 'reconnecting':
        return `再接続中... (${reconnectAttempts}回目)`;
      case 'disconnected':
        return 'オフライン';
      default:
        return '不明';
    }
  };

  const getStatusColor = () => {
    switch (realtimeStatus) {
      case 'connected':
        return '#28a745';
      case 'connecting':
        return '#ffc107';
      case 'reconnecting':
        return '#fd7e14';
      case 'disconnected':
        return '#dc3545';
      default:
        return '#6c757d';
    }
  };

  const handleManualReconnect = () => {
    if (onReconnect) {
      onReconnect();
    }
  };

  const handleDisconnect = () => {
    if (onDisconnect) {
      onDisconnect();
    }
  };

  const handleToggleRealtime = () => {
    if (onToggleRealtime) {
      onToggleRealtime();
    }
  };

  return (
    <div className="connection-status">
      {/* メインステータスバー */}
      <div 
        className="status-bar"
        onClick={() => setShowDetails(!showDetails)}
        style={{ borderLeftColor: getStatusColor() }}
      >
        <span className="status-icon">{getStatusIcon()}</span>
        <span className="status-text">{getStatusText()}</span>
        
        {pendingOperations > 0 && (
          <span className="pending-badge" title={`${pendingOperations}個の保留中操作`}>
            {pendingOperations}
          </span>
        )}
        
        <button className="details-toggle">
          {showDetails ? '▼' : '▶'}
        </button>
      </div>

      {/* 詳細パネル */}
      {showDetails && (
        <div className="status-details">
          <div className="detail-section">
            <h4>接続情報</h4>
            <div className="detail-item">
              <span>状態:</span>
              <span style={{ color: getStatusColor() }}>
                {realtimeStatus}
              </span>
            </div>
            <div className="detail-item">
              <span>接続ユーザー:</span>
              <span>{connectedUsers.length}人</span>
            </div>
            {pendingOperations > 0 && (
              <div className="detail-item">
                <span>保留中操作:</span>
                <span className="warning">{pendingOperations}個</span>
              </div>
            )}
            {reconnectAttempts > 0 && (
              <div className="detail-item">
                <span>再接続試行:</span>
                <span>{reconnectAttempts}回</span>
              </div>
            )}
          </div>

          <div className="detail-actions">
            {realtimeStatus === 'disconnected' && (
              <button 
                className="action-button reconnect"
                onClick={handleManualReconnect}
              >
                再接続
              </button>
            )}
            
            {isRealtimeConnected && (
              <button 
                className="action-button disconnect"
                onClick={handleDisconnect}
              >
                切断
              </button>
            )}
            
            <button 
              className="action-button toggle"
              onClick={handleToggleRealtime}
            >
              {isRealtimeConnected ? 'リアルタイム無効' : 'リアルタイム有効'}
            </button>
            
            {onShowCollaborativeFeatures && (
              <button 
                className="action-button collaborative"
                onClick={onShowCollaborativeFeatures}
              >
                共同編集機能
              </button>
            )}
          </div>
        </div>
      )}

      {/* エラー通知 */}
      {showError && lastError && (
        <div className="error-notification">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <span className="error-message">
              {lastError}
            </span>
            <button 
              className="error-close"
              onClick={() => setShowError(false)}
            >
              ×
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .connection-status {
          position: fixed;
          bottom: 20px;
          left: 20px;
          z-index: 1000;
          font-size: 14px;
        }

        .status-bar {
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border: 1px solid #e1e1e1;
          border-left: 4px solid #ccc;
          border-radius: 4px;
          padding: 8px 12px;
          cursor: pointer;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
          transition: all 0.2s ease;
          user-select: none;
        }

        .status-bar:hover {
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          transform: translateY(-1px);
        }

        .status-icon {
          font-size: 12px;
        }

        .status-text {
          font-weight: 500;
          color: #333;
        }

        .pending-badge {
          background: #ffc107;
          color: #333;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: bold;
          cursor: help;
        }

        .details-toggle {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 10px;
          padding: 2px;
          margin-left: auto;
        }

        .status-details {
          background: white;
          border: 1px solid #e1e1e1;
          border-radius: 4px;
          margin-top: 4px;
          padding: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }

        .detail-section {
          margin-bottom: 12px;
        }

        .detail-section h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: bold;
          color: #333;
          text-transform: uppercase;
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 2px 0;
          font-size: 12px;
        }

        .detail-item span:first-child {
          color: #666;
        }

        .detail-item span:last-child {
          font-weight: 500;
        }

        .warning {
          color: #ffc107 !important;
        }

        .detail-actions {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .action-button {
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          background: white;
          color: #333;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          background: #f8f8f8;
        }

        .action-button.reconnect {
          background: #28a745;
          color: white;
          border-color: #28a745;
        }

        .action-button.reconnect:hover {
          background: #218838;
        }

        .action-button.disconnect {
          background: #dc3545;
          color: white;
          border-color: #dc3545;
        }

        .action-button.disconnect:hover {
          background: #c82333;
        }

        .action-button.toggle {
          background: #007acc;
          color: white;
          border-color: #007acc;
        }

        .action-button.toggle:hover {
          background: #0056b3;
        }

        .action-button.collaborative {
          background: #6f42c1;
          color: white;
          border-color: #6f42c1;
        }

        .action-button.collaborative:hover {
          background: #5a2d91;
        }

        .error-notification {
          position: fixed;
          bottom: 80px;
          left: 20px;
          right: 20px;
          max-width: 400px;
          z-index: 1001;
        }

        .error-content {
          display: flex;
          align-items: center;
          gap: 8px;
          background: #f8d7da;
          border: 1px solid #f5c6cb;
          border-radius: 4px;
          padding: 12px;
          color: #721c24;
          animation: slide-up 0.3s ease-out;
        }

        .error-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .error-message {
          flex: 1;
          font-size: 13px;
        }

        .error-close {
          background: none;
          border: none;
          color: #721c24;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* レスポンシブ対応 */
        @media (max-width: 768px) {
          .connection-status {
            bottom: 10px;
            left: 10px;
            right: 10px;
          }

          .error-notification {
            bottom: 70px;
            left: 10px;
            right: 10px;
          }
        }

        /* ダークモード対応 */
        @media (prefers-color-scheme: dark) {
          .status-bar,
          .status-details {
            background: #2d2d2d;
            border-color: #404040;
            color: #e1e1e1;
          }

          .status-text {
            color: #e1e1e1;
          }

          .detail-section h4 {
            color: #e1e1e1;
          }

          .detail-item span:first-child {
            color: #999;
          }

          .action-button {
            background: #383838;
            border-color: #555;
            color: #e1e1e1;
          }

          .action-button:hover {
            background: #404040;
          }
        }
      `}</style>
    </div>
  );
};

ConnectionStatus.propTypes = {
  realtimeStatus: PropTypes.oneOf(['connected', 'connecting', 'reconnecting', 'disconnected']),
  isRealtimeConnected: PropTypes.bool,
  connectedUsers: PropTypes.array,
  pendingOperations: PropTypes.number,
  reconnectAttempts: PropTypes.number,
  lastError: PropTypes.string,
  onReconnect: PropTypes.func,
  onDisconnect: PropTypes.func,
  onToggleRealtime: PropTypes.func,
  onShowCollaborativeFeatures: PropTypes.func
};

export default ConnectionStatus;