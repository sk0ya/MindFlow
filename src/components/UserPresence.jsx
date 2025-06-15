import React, { memo, useMemo } from 'react';
import PropTypes from 'prop-types';

/**
 * 接続中ユーザーの表示コンポーネント
 * リアルタイム共同編集での参加者一覧を表示
 */
const UserPresence = memo(({
  connectedUsers = [],
  currentUserId,
  realtimeStatus = 'disconnected',
  onUserClick
}) => {
  // ユーザーリストを最適化
  const optimizedUsers = useMemo(() => {
    return connectedUsers.map(user => ({
      ...user,
      isCurrentUser: user.id === currentUserId
    }));
  }, [connectedUsers, currentUserId]);

  if (!optimizedUsers.length) {
    return null;
  }

  const getStatusIcon = (status) => {
    switch (status) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'reconnecting':
        return '🟠';
      default:
        return '🔴';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'connected':
        return '接続中';
      case 'connecting':
        return '接続中...';
      case 'reconnecting':
        return '再接続中...';
      default:
        return '切断';
    }
  };

  return (
    <div className="user-presence">
      <div className="presence-header">
        <span className="status-indicator">
          {getStatusIcon(realtimeStatus)}
        </span>
        <span className="status-text">
          {getStatusText(realtimeStatus)}
        </span>
        {optimizedUsers.length > 1 && (
          <span className="user-count">
            {optimizedUsers.length}人
          </span>
        )}
      </div>
      
      <div className="connected-users">
        {optimizedUsers.map(user => (
          <div
            key={user.id}
            className={`user-item ${user.isCurrentUser ? 'current-user' : ''}`}
            onClick={() => onUserClick && onUserClick(user)}
            title={`${user.name}${user.isCurrentUser ? ' (あなた)' : ''}`}
          >
            <div
              className="user-avatar"
              style={{ 
                backgroundColor: user.color || '#666',
                borderColor: user.isCurrentUser ? '#007acc' : 'transparent'
              }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <span className="user-name">
              {user.name}
              {user.isCurrentUser && <span className="you-label"> (You)</span>}
            </span>
            {user.lastActivity && (
              <span className="last-activity">
                {formatLastActivity(user.lastActivity)}
              </span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        .user-presence {
          position: fixed;
          top: 20px;
          right: 20px;
          background: white;
          border: 1px solid #e1e1e1;
          border-radius: 8px;
          padding: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          z-index: 1000;
          max-width: 250px;
          font-size: 14px;
        }

        .presence-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f0f0f0;
        }

        .status-indicator {
          font-size: 12px;
        }

        .status-text {
          font-weight: 500;
          color: #333;
        }

        .user-count {
          background: #007acc;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
          margin-left: auto;
        }

        .connected-users {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .user-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.2s;
        }

        .user-item:hover {
          background: #f8f8f8;
        }

        .user-item.current-user {
          background: #f0f8ff;
        }

        .user-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
          font-weight: bold;
          border: 2px solid transparent;
          flex-shrink: 0;
        }

        .user-name {
          flex: 1;
          font-weight: 500;
          color: #333;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .you-label {
          font-weight: normal;
          color: #666;
          font-size: 11px;
        }

        .last-activity {
          font-size: 11px;
          color: #999;
        }

        /* レスポンシブ対応 */
        @media (max-width: 768px) {
          .user-presence {
            position: fixed;
            top: 10px;
            right: 10px;
            left: 10px;
            max-width: none;
          }
        }

        /* ダークモード対応 */
        @media (prefers-color-scheme: dark) {
          .user-presence {
            background: #2d2d2d;
            border-color: #404040;
            color: #e1e1e1;
          }

          .status-text {
            color: #e1e1e1;
          }

          .user-item:hover {
            background: #383838;
          }

          .user-item.current-user {
            background: #1a2332;
          }

          .user-name {
            color: #e1e1e1;
          }
        }
      `}</style>
    </div>
  );
}, (prevProps, nextProps) => {
  // UserPresenceの最適化された比較
  if (prevProps.realtimeStatus !== nextProps.realtimeStatus ||
      prevProps.currentUserId !== nextProps.currentUserId ||
      prevProps.connectedUsers.length !== nextProps.connectedUsers.length) {
    return false;
  }

  // ユーザーの詳細比較
  return prevProps.connectedUsers.every((prevUser, index) => {
    const nextUser = nextProps.connectedUsers[index];
    return prevUser.id === nextUser.id &&
           prevUser.name === nextUser.name &&
           prevUser.color === nextUser.color &&
           prevUser.lastActivity === nextUser.lastActivity;
  });
});

/**
 * 最終活動時間をフォーマット
 */
const formatLastActivity = (timestamp) => {
  if (!timestamp) return '';
  
  const now = Date.now();
  const diff = now - timestamp;
  
  if (diff < 60000) { // 1分未満
    return 'Just now';
  } else if (diff < 3600000) { // 1時間未満
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  } else if (diff < 86400000) { // 24時間未満
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  } else {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
};

UserPresence.propTypes = {
  connectedUsers: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string.isRequired,
    color: PropTypes.string,
    lastActivity: PropTypes.number
  })),
  currentUserId: PropTypes.string,
  realtimeStatus: PropTypes.oneOf(['connected', 'connecting', 'reconnecting', 'disconnected']),
  onUserClick: PropTypes.func
};

export default UserPresence;