import React, { useState, useEffect } from 'react';
import { CollaborativeFeaturesProps } from '../../../../shared/types/app';

/**
 * 共同編集用機能パネル
 * コメント、履歴、ユーザー活動などの管理UI
 */

// Comment type definition
interface Comment {
  id: string;
  nodeId: string;
  userId: string;
  userName: string;
  userColor: string;
  text: string;
  timestamp: number;
  resolved: boolean;
}

// Activity type definition
interface Activity {
  id: string;
  type: 'node_created' | 'node_updated' | 'node_deleted' | 'comment_added' | 'user_joined' | 'user_left';
  userId: string;
  userName: string;
  userColor: string;
  nodeId?: string;
  nodeText?: string;
  timestamp: number;
  changes?: any;
  comment?: string;
}

const CollaborativeFeatures: React.FC<CollaborativeFeaturesProps> = ({
  isVisible,
  onClose,
  selectedNodeId,
  findNode,
  currentUserId,
  connectedUsers = [],
  realtimeClient
}) => {
  const [activeTab, setActiveTab] = useState('comments');
  const [comments, setComments] = useState<Comment[]>([]);
  const [activityHistory, setActivityHistory] = useState<Activity[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isVisible) {
      loadComments();
      loadActivityHistory();
    }
  }, [isVisible, selectedNodeId]);

  const loadComments = async () => {
    // TODO: 実際のAPIから取得
    const mockComments = [
      {
        id: 'comment1',
        nodeId: selectedNodeId,
        userId: 'user1',
        userName: 'Alice',
        userColor: '#FF6B6B',
        text: 'このアイデアについてもう少し詳しく説明できますか？',
        timestamp: Date.now() - 3600000,
        resolved: false
      },
      {
        id: 'comment2',
        nodeId: selectedNodeId,
        userId: 'user2',
        userName: 'Bob',
        userColor: '#4ECDC4',
        text: '素晴らしいアイデアです！実装してみましょう。',
        timestamp: Date.now() - 1800000,
        resolved: true
      }
    ];
    setComments(mockComments as any);
  };

  const loadActivityHistory = async () => {
    // TODO: 実際のAPIから取得
    const mockHistory = [
      {
        id: 'activity1',
        type: 'node_created',
        userId: 'user1',
        userName: 'Alice',
        userColor: '#FF6B6B',
        nodeId: 'node-123',
        nodeText: '新しいアイデア',
        timestamp: Date.now() - 900000
      },
      {
        id: 'activity2',
        type: 'node_updated',
        userId: 'user2',
        userName: 'Bob',
        userColor: '#4ECDC4',
        nodeId: selectedNodeId,
        changes: { text: '更新されたテキスト' },
        timestamp: Date.now() - 600000
      },
      {
        id: 'activity3',
        type: 'comment_added',
        userId: 'user1',
        userName: 'Alice',
        userColor: '#FF6B6B',
        nodeId: selectedNodeId,
        comment: 'このアイデアについて...',
        timestamp: Date.now() - 300000
      }
    ];
    setActivityHistory(mockHistory as any);
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setIsLoading(true);
    try {
      const comment = {
        id: `comment_${Date.now()}`,
        nodeId: selectedNodeId,
        userId: currentUserId,
        userName: 'You',
        userColor: '#007acc',
        text: newComment.trim(),
        timestamp: Date.now(),
        resolved: false
      };

      // TODO: リアルタイムクライアント経由でサーバーに送信
      if (realtimeClient) {
        // realtimeClient.addComment(comment);
      }

      setComments(prev => [...prev, comment] as any);
      setNewComment('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      // TODO: サーバーで解決済みにマーク
      setComments(prev =>
        prev.map(c =>
          c.id === commentId ? { ...c, resolved: true } : c
        )
      );
    } catch (error) {
      console.error('Failed to resolve comment:', error);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      // TODO: サーバーから削除
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const formatTimestamp = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const getActivityIcon = (type: Activity['type']): string => {
    switch (type) {
      case 'node_created': return '➕';
      case 'node_updated': return '✏️';
      case 'node_deleted': return '🗑️';
      case 'comment_added': return '💬';
      case 'user_joined': return '👋';
      case 'user_left': return '👋';
      default: return '📝';
    }
  };

  const getActivityMessage = (activity: Activity): string => {
    switch (activity.type) {
      case 'node_created':
        return `${activity.userName}が「${activity.nodeText}」を作成`;
      case 'node_updated':
        return `${activity.userName}がノードを更新`;
      case 'node_deleted':
        return `${activity.userName}がノードを削除`;
      case 'comment_added':
        return `${activity.userName}がコメント追加`;
      case 'user_joined':
        return `${activity.userName}が参加`;
      case 'user_left':
        return `${activity.userName}が退出`;
      default:
        return `${activity.userName}が操作を実行`;
    }
  };

  const selectedNode = selectedNodeId ? findNode(selectedNodeId) : null;

  if (!isVisible) return null;

  return (
    <div className="collaborative-features">
      <div className="panel-header">
        <h3>共同編集機能</h3>
        <button className="close-button" onClick={onClose}>
          ×
        </button>
      </div>

      {selectedNode && (
        <div className="selected-node-info">
          <span className="node-label">選択中:</span>
          <span className="node-text">{selectedNode.text || 'Untitled'}</span>
        </div>
      )}

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'comments' ? 'active' : ''}`}
          onClick={() => setActiveTab('comments')}
        >
          💬 コメント ({comments.filter(c => !c.resolved).length})
        </button>
        <button
          className={`tab-button ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          📜 履歴
        </button>
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          👥 ユーザー ({connectedUsers.length})
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'comments' && (
          <CommentsTab
            comments={comments}
            newComment={newComment}
            setNewComment={setNewComment}
            onAddComment={handleAddComment}
            onResolveComment={handleResolveComment}
            onDeleteComment={handleDeleteComment}
            isLoading={isLoading}
            formatTimestamp={formatTimestamp}
            currentUserId={currentUserId}
            selectedNodeId={selectedNodeId}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab
            activities={activityHistory}
            formatTimestamp={formatTimestamp}
            getActivityIcon={getActivityIcon}
            getActivityMessage={getActivityMessage}
          />
        )}

        {activeTab === 'users' && (
          <UsersTab
            connectedUsers={connectedUsers}
            currentUserId={currentUserId}
          />
        )}
      </div>

      <style>{`
        .collaborative-features {
          position: fixed;
          top: 20px;
          left: 20px;
          width: 350px;
          max-height: 80vh;
          background: white;
          border: 1px solid #e1e1e1;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 1000;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #e1e1e1;
          background: #f8f9fa;
          border-radius: 8px 8px 0 0;
        }

        .panel-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
          color: #333;
        }

        .close-button {
          background: none;
          border: none;
          font-size: 20px;
          color: #666;
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .close-button:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #333;
        }

        .selected-node-info {
          padding: 12px 16px;
          background: #f0f8ff;
          border-bottom: 1px solid #e1e1e1;
          font-size: 14px;
        }

        .node-label {
          color: #666;
          margin-right: 8px;
        }

        .node-text {
          font-weight: 500;
          color: #333;
        }

        .tab-navigation {
          display: flex;
          border-bottom: 1px solid #e1e1e1;
        }

        .tab-button {
          flex: 1;
          padding: 12px 8px;
          border: none;
          background: white;
          color: #666;
          font-size: 12px;
          cursor: pointer;
          border-bottom: 2px solid transparent;
          transition: all 0.2s ease;
        }

        .tab-button:hover {
          background: #f8f9fa;
          color: #333;
        }

        .tab-button.active {
          background: #f8f9fa;
          color: #007acc;
          border-bottom-color: #007acc;
          font-weight: 500;
        }

        .panel-content {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }

        /* レスポンシブ対応 */
        @media (max-width: 768px) {
          .collaborative-features {
            left: 10px;
            right: 10px;
            width: auto;
            max-height: 70vh;
          }
        }

        /* ダークモード対応 */
        @media (prefers-color-scheme: dark) {
          .collaborative-features {
            background: #2d2d2d;
            border-color: #404040;
            color: #e1e1e1;
          }

          .panel-header {
            background: #383838;
            border-color: #404040;
          }

          .panel-header h3 {
            color: #e1e1e1;
          }

          .selected-node-info {
            background: #1a2332;
            border-color: #404040;
          }

          .node-label {
            color: #999;
          }

          .node-text {
            color: #e1e1e1;
          }

          .tab-button {
            background: #2d2d2d;
            color: #999;
          }

          .tab-button:hover {
            background: #383838;
            color: #e1e1e1;
          }

          .tab-button.active {
            background: #383838;
            color: #4fc3f7;
            border-bottom-color: #4fc3f7;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * コメントタブ
 */
interface CommentsTabProps {
  comments: Comment[];
  newComment: string;
  setNewComment: (text: string) => void;
  onAddComment: () => void;
  onResolveComment: (commentId: string) => void;
  onDeleteComment: (commentId: string) => void;
  isLoading: boolean;
  formatTimestamp: (timestamp: number) => string;
  currentUserId?: string;
  selectedNodeId?: string | null;
}

const CommentsTab: React.FC<CommentsTabProps> = ({
  comments,
  newComment,
  setNewComment,
  onAddComment,
  onResolveComment,
  onDeleteComment,
  isLoading,
  formatTimestamp,
  currentUserId,
  selectedNodeId
}) => {
  const filteredComments = comments.filter(c => 
    !selectedNodeId || c.nodeId === selectedNodeId
  );

  return (
    <div className="comments-tab">
      <div className="new-comment-section">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="コメントを追加..."
          rows={3}
          disabled={isLoading}
        />
        <button
          onClick={onAddComment}
          disabled={!newComment.trim() || isLoading}
          className="add-comment-button"
        >
          {isLoading ? '投稿中...' : 'コメント'}
        </button>
      </div>

      <div className="comments-list">
        {filteredComments.length === 0 ? (
          <div className="no-comments">
            まだコメントがありません
          </div>
        ) : (
          filteredComments.map(comment => (
            <div
              key={comment.id}
              className={`comment-item ${comment.resolved ? 'resolved' : ''}`}
            >
              <div className="comment-header">
                <div
                  className="user-avatar"
                  style={{ backgroundColor: comment.userColor }}
                >
                  {comment.userName.charAt(0).toUpperCase()}
                </div>
                <div className="comment-meta">
                  <span className="user-name">{comment.userName}</span>
                  <span className="timestamp">
                    {formatTimestamp(comment.timestamp)}
                  </span>
                </div>
                {comment.resolved && (
                  <span className="resolved-badge">解決済み</span>
                )}
              </div>
              <div className="comment-text">{comment.text}</div>
              <div className="comment-actions">
                {!comment.resolved && (
                  <button
                    onClick={() => onResolveComment(comment.id)}
                    className="action-button resolve"
                  >
                    解決
                  </button>
                )}
                {comment.userId === currentUserId && (
                  <button
                    onClick={() => onDeleteComment(comment.id)}
                    className="action-button delete"
                  >
                    削除
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <style>{`
        .comments-tab {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .new-comment-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .new-comment-section textarea {
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          resize: vertical;
          font-family: inherit;
        }

        .new-comment-section textarea:focus {
          outline: none;
          border-color: #007acc;
        }

        .add-comment-button {
          align-self: flex-end;
          padding: 8px 16px;
          background: #007acc;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }

        .add-comment-button:hover:not(:disabled) {
          background: #0056b3;
        }

        .add-comment-button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .comments-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .no-comments {
          text-align: center;
          color: #999;
          font-style: italic;
          padding: 20px;
        }

        .comment-item {
          border: 1px solid #e1e1e1;
          border-radius: 6px;
          padding: 12px;
          transition: all 0.2s ease;
        }

        .comment-item.resolved {
          opacity: 0.7;
          background: #f8f9fa;
        }

        .comment-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
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
          flex-shrink: 0;
        }

        .comment-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .user-name {
          font-weight: 500;
          font-size: 13px;
          color: #333;
        }

        .timestamp {
          font-size: 11px;
          color: #999;
        }

        .resolved-badge {
          background: #28a745;
          color: white;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 10px;
          font-weight: 500;
        }

        .comment-text {
          font-size: 14px;
          line-height: 1.4;
          color: #333;
          margin-bottom: 8px;
        }

        .comment-actions {
          display: flex;
          gap: 6px;
        }

        .action-button {
          padding: 4px 8px;
          border: 1px solid #ddd;
          border-radius: 3px;
          background: white;
          color: #666;
          font-size: 11px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .action-button:hover {
          background: #f8f9fa;
        }

        .action-button.resolve {
          border-color: #28a745;
          color: #28a745;
        }

        .action-button.resolve:hover {
          background: #28a745;
          color: white;
        }

        .action-button.delete {
          border-color: #dc3545;
          color: #dc3545;
        }

        .action-button.delete:hover {
          background: #dc3545;
          color: white;
        }
      `}</style>
    </div>
  );
};

/**
 * 履歴タブ
 */
interface HistoryTabProps {
  activities: Activity[];
  formatTimestamp: (timestamp: number) => string;
  getActivityIcon: (type: Activity['type']) => string;
  getActivityMessage: (activity: Activity) => string;
}

const HistoryTab: React.FC<HistoryTabProps> = ({
  activities,
  formatTimestamp,
  getActivityIcon,
  getActivityMessage
}) => {
  return (
    <div className="history-tab">
      {activities.length === 0 ? (
        <div className="no-activities">
          まだ活動履歴がありません
        </div>
      ) : (
        <div className="activities-list">
          {activities.map(activity => (
            <div key={activity.id} className="activity-item">
              <div className="activity-icon">
                {getActivityIcon(activity.type)}
              </div>
              <div className="activity-content">
                <div className="activity-message">
                  {getActivityMessage(activity)}
                </div>
                <div className="activity-timestamp">
                  {formatTimestamp(activity.timestamp)}
                </div>
              </div>
              <div
                className="activity-user-avatar"
                style={{ backgroundColor: activity.userColor }}
              >
                {activity.userName.charAt(0).toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .history-tab {
          display: flex;
          flex-direction: column;
        }

        .no-activities {
          text-align: center;
          color: #999;
          font-style: italic;
          padding: 20px;
        }

        .activities-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .activity-item {
          display: flex;
          align-items: flex-start;
          gap: 8px;
          padding: 8px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
        }

        .activity-item:hover {
          background: #f8f9fa;
        }

        .activity-icon {
          font-size: 16px;
          margin-top: 2px;
        }

        .activity-content {
          flex: 1;
        }

        .activity-message {
          font-size: 13px;
          color: #333;
          line-height: 1.4;
        }

        .activity-timestamp {
          font-size: 11px;
          color: #999;
          margin-top: 2px;
        }

        .activity-user-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 9px;
          font-weight: bold;
          flex-shrink: 0;
          margin-top: 2px;
        }
      `}</style>
    </div>
  );
};

/**
 * ユーザータブ
 */
interface UsersTabProps {
  connectedUsers: Array<{
    id: string;
    name: string;
    color?: string;
    isTyping?: boolean;
  }>;
  currentUserId?: string;
}

const UsersTab: React.FC<UsersTabProps> = ({ connectedUsers, currentUserId }) => {
  return (
    <div className="users-tab">
      <div className="users-list">
        {connectedUsers.map(user => (
          <div key={user.id} className="user-item">
            <div
              className="user-avatar"
              style={{ backgroundColor: user.color || '#666' }}
            >
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="user-info">
              <div className="user-name">
                {user.name}
                {user.id === currentUserId && (
                  <span className="you-label"> (You)</span>
                )}
              </div>
              <div className="user-status">
                {user.isTyping ? '入力中...' : 'オンライン'}
              </div>
            </div>
            <div className="user-indicator online"></div>
          </div>
        ))}
      </div>

      <style>{`
        .users-tab {
          display: flex;
          flex-direction: column;
        }

        .users-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .user-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px;
          border-radius: 4px;
          transition: background-color 0.2s ease;
        }

        .user-item:hover {
          background: #f8f9fa;
        }

        .user-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 14px;
          font-weight: bold;
          flex-shrink: 0;
        }

        .user-info {
          flex: 1;
        }

        .user-name {
          font-weight: 500;
          font-size: 14px;
          color: #333;
        }

        .you-label {
          font-weight: normal;
          color: #666;
          font-size: 12px;
        }

        .user-status {
          font-size: 12px;
          color: #999;
        }

        .user-indicator {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .user-indicator.online {
          background: #28a745;
        }
      `}</style>
    </div>
  );
};


export default CollaborativeFeatures;