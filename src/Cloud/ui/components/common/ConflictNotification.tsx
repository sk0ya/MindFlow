import React, { useState, useEffect } from 'react';

// 型定義
export interface ConflictUser {
  id: string;
  name: string;
  color?: string;
}

export interface ConflictMetadata {
  discardedOperations?: number;
  mergedFields?: string[];
  adjustedBy?: number;
  operationCount?: number;
  dataLoss?: boolean;
}

export interface Conflict {
  id: string;
  type: 'concurrent_update' | 'concurrent_creation' | 'position_adjustment' | 'merge_conflict' | 'deletion_conflict';
  resolutionType?: 'last_writer_wins' | 'field_merge' | 'position_adjustment' | 'first_delete_wins' | 'preserve_children' | 'averaged_position';
  metadata?: ConflictMetadata;
  affectedNodes?: string[];
  involvedUsers?: ConflictUser[];
  timestamp?: number;
  dismissed?: boolean;
}

export interface ConflictNotificationProps {
  conflicts?: Conflict[];
  onDismiss?: (conflictId: string) => void;
  position?: 'top-center' | 'top-right' | 'bottom-right' | 'bottom-center';
  autoHideDelay?: number;
}

export interface ConflictItemProps {
  conflict: Conflict;
  onDismiss: (conflictId: string) => void;
}

/**
 * 競合解決の視覚的フィードバックコンポーネント
 * リアルタイム編集での競合と解決状況を表示
 */
const ConflictNotification: React.FC<ConflictNotificationProps> = ({
  conflicts = [],
  onDismiss,
  position = 'top-center',
  autoHideDelay = 8000
}) => {
  const [visibleConflicts, setVisibleConflicts] = useState<(Conflict & { timestamp: number; dismissed: boolean })[]>([]);

  useEffect(() => {
    // 新しい競合を表示リストに追加
    if (conflicts.length > 0) {
      const newConflicts = conflicts.filter(
        conflict => !visibleConflicts.find(vc => vc.id === conflict.id)
      );
      
      if (newConflicts.length > 0) {
        setVisibleConflicts(prev => [
          ...prev,
          ...newConflicts.map(conflict => ({
            ...conflict,
            timestamp: Date.now(),
            dismissed: false
          }))
        ]);
      }
    }
  }, [conflicts, visibleConflicts]);

  useEffect(() => {
    // 自動非表示タイマー
    const timers: NodeJS.Timeout[] = [];
    
    visibleConflicts.forEach(conflict => {
      if (!conflict.dismissed && autoHideDelay > 0) {
        const timer = setTimeout(() => {
          handleDismiss(conflict.id);
        }, autoHideDelay);
        
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [visibleConflicts, autoHideDelay]);

  const handleDismiss = (conflictId: string): void => {
    setVisibleConflicts(prev =>
      prev.map(c => 
        c.id === conflictId ? { ...c, dismissed: true } : c
      )
    );

    // アニメーション完了後に削除
    setTimeout(() => {
      setVisibleConflicts(prev => 
        prev.filter(c => c.id !== conflictId)
      );
      
      if (onDismiss) {
        onDismiss(conflictId);
      }
    }, 300);
  };

  // Helper function for conflict icons - reserved for future enhanced UI
  // const getConflictIcon = (type: string): string => {
  //   switch (type) {
  //     case 'concurrent_update':
  //       return '⚡';
  //     case 'concurrent_creation':
  //       return '🆕';
  //     case 'position_adjustment':
  //       return '📍';
  //     case 'merge_conflict':
  //       return '🔀';
  //     case 'deletion_conflict':
  //       return '🗑️';
  //     default:
  //       return '⚠️';
  //   }
  // };

  // Helper function for conflict titles - reserved for future enhanced UI
  // const getConflictTitle = (type: string): string => {
  //   switch (type) {
  //     case 'concurrent_update':
  //       return '同時編集の競合';
  //     case 'concurrent_creation':
  //       return '同時作成の競合';
  //     case 'position_adjustment':
  //       return '位置調整';
  //     case 'merge_conflict':
  //       return 'マージ競合';
  //     case 'deletion_conflict':
  //       return '削除競合';
  //     default:
  //       return '競合が発生';
  //   }
  // };

  // Helper function for resolution messages - reserved for future enhanced UI
  // const getResolutionMessage = (conflict: Conflict): string => {
  //   const { resolutionType, metadata = {} } = conflict;
  //   
  //   switch (resolutionType) {
  //     case 'last_writer_wins':
  //       return `最新の変更を採用 (${metadata.discardedOperations || 0}個の操作を破棄)`;
  //     case 'field_merge':
  //       return `フィールドをマージ (${metadata.mergedFields?.length || 0}個のフィールド)`;
  //     case 'position_adjustment':
  //       return `位置を自動調整 (${Math.round(metadata.adjustedBy || 0)}px移動)`;
  //     case 'first_delete_wins':
  //       return '最初の削除操作を優先';
  //     case 'preserve_children':
  //       return '子ノードを保持して削除実行';
  //     case 'averaged_position':
  //       return `位置を平均化 (${metadata.operationCount || 0}個の操作)`;
  //     default:
  //       return '自動的に解決されました';
  //   }
  // };

  // Helper function for severity colors - reserved for future enhanced UI
  // const getSeverityColor = (conflict: Conflict): string => {
  //   const { type, metadata = {} } = conflict;
  //   
  //   if (metadata.dataLoss) return '#dc3545'; // 赤 - データ損失あり
  //   if (type === 'merge_conflict') return '#fd7e14'; // オレンジ - 要注意
  //   if (type === 'concurrent_update') return '#ffc107'; // 黄 - 注意
  //   return '#28a745'; // 緑 - 正常に解決
  // };

  if (visibleConflicts.length === 0) {
    return null;
  }

  return (
    <div className={`conflict-notifications ${position}`}>
      {visibleConflicts
        .filter(conflict => !conflict.dismissed)
        .map(conflict => (
          <ConflictItem
            key={conflict.id}
            conflict={conflict}
            onDismiss={handleDismiss}
          />
        ))}

      <style>{`
        .conflict-notifications {
          position: fixed;
          z-index: 2000;
          max-width: 400px;
          pointer-events: none;
        }

        .conflict-notifications.top-center {
          top: 80px;
          left: 50%;
          transform: translateX(-50%);
        }

        .conflict-notifications.top-right {
          top: 80px;
          right: 20px;
        }

        .conflict-notifications.bottom-right {
          bottom: 80px;
          right: 20px;
        }

        .conflict-notifications.bottom-center {
          bottom: 80px;
          left: 50%;
          transform: translateX(-50%);
        }

        /* レスポンシブ対応 */
        @media (max-width: 768px) {
          .conflict-notifications {
            left: 10px !important;
            right: 10px !important;
            max-width: none;
            transform: none !important;
          }
        }
      `}</style>
    </div>
  );
};

/**
 * 個別競合通知アイテム
 */
const ConflictItem: React.FC<ConflictItemProps> = ({ conflict, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // マウント時にフェードイン
    const timer = setTimeout(() => setIsVisible(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const handleDismissClick = (): void => {
    setIsVisible(false);
    setTimeout(() => onDismiss(conflict.id), 300);
  };

  const severityColor = getSeverityColor(conflict);
  const icon = getConflictIcon(conflict.type);
  const title = getConflictTitle(conflict.type);
  const message = getResolutionMessage(conflict);

  return (
    <div 
      className={`conflict-item ${isVisible ? 'visible' : 'hidden'}`}
      style={{ borderLeftColor: severityColor }}
    >
      <div className="conflict-header">
        <span className="conflict-icon">{icon}</span>
        <span className="conflict-title">{title}</span>
        <button 
          className="dismiss-button"
          onClick={handleDismissClick}
          title="閉じる"
        >
          ×
        </button>
      </div>
      
      <div className="conflict-content">
        <div className="resolution-message">
          {message}
        </div>
        
        {conflict.affectedNodes && conflict.affectedNodes.length > 0 && (
          <div className="affected-nodes">
            <span className="affected-label">影響ノード:</span>
            <span className="node-list">
              {conflict.affectedNodes.slice(0, 3).map(nodeId => (
                <span key={nodeId} className="node-tag">
                  {nodeId.substring(0, 8)}
                </span>
              ))}
              {conflict.affectedNodes.length > 3 && (
                <span className="more-nodes">
                  +{conflict.affectedNodes.length - 3}個
                </span>
              )}
            </span>
          </div>
        )}

        {conflict.involvedUsers && conflict.involvedUsers.length > 0 && (
          <div className="involved-users">
            <span className="users-label">関係ユーザー:</span>
            <div className="user-avatars">
              {conflict.involvedUsers.map((user: ConflictUser) => (
                <div
                  key={user.id}
                  className="user-avatar"
                  style={{ backgroundColor: user.color || '#666' }}
                  title={user.name}
                >
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .conflict-item {
          background: white;
          border: 1px solid #e1e1e1;
          border-left: 4px solid #666;
          border-radius: 6px;
          margin-bottom: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
          pointer-events: auto;
          opacity: 0;
          transform: translateY(-20px);
          transition: all 0.3s ease-out;
          overflow: hidden;
        }

        .conflict-item.visible {
          opacity: 1;
          transform: translateY(0);
        }

        .conflict-item.hidden {
          opacity: 0;
          transform: translateY(-20px);
        }

        .conflict-header {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px 8px;
          background: rgba(0, 0, 0, 0.02);
        }

        .conflict-icon {
          font-size: 16px;
          flex-shrink: 0;
        }

        .conflict-title {
          flex: 1;
          font-weight: 600;
          color: #333;
          font-size: 14px;
        }

        .dismiss-button {
          background: none;
          border: none;
          color: #666;
          cursor: pointer;
          font-size: 18px;
          font-weight: bold;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .dismiss-button:hover {
          background: rgba(0, 0, 0, 0.1);
          color: #333;
        }

        .conflict-content {
          padding: 0 16px 12px;
        }

        .resolution-message {
          color: #555;
          font-size: 13px;
          line-height: 1.4;
          margin-bottom: 8px;
        }

        .affected-nodes,
        .involved-users {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-top: 6px;
          font-size: 12px;
        }

        .affected-label,
        .users-label {
          color: #666;
          font-weight: 500;
        }

        .node-list {
          display: flex;
          gap: 4px;
          flex-wrap: wrap;
        }

        .node-tag {
          background: #f0f0f0;
          color: #666;
          padding: 2px 6px;
          border-radius: 10px;
          font-family: monospace;
          font-size: 10px;
        }

        .more-nodes {
          color: #999;
          font-style: italic;
        }

        .user-avatars {
          display: flex;
          gap: 4px;
        }

        .user-avatar {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 9px;
          font-weight: bold;
          cursor: help;
        }

        /* ダークモード対応 */
        @media (prefers-color-scheme: dark) {
          .conflict-item {
            background: #2d2d2d;
            border-color: #404040;
            color: #e1e1e1;
          }

          .conflict-header {
            background: rgba(255, 255, 255, 0.05);
          }

          .conflict-title {
            color: #e1e1e1;
          }

          .dismiss-button {
            color: #999;
          }

          .dismiss-button:hover {
            background: rgba(255, 255, 255, 0.1);
            color: #e1e1e1;
          }

          .resolution-message {
            color: #ccc;
          }

          .affected-label,
          .users-label {
            color: #999;
          }

          .node-tag {
            background: #404040;
            color: #ccc;
          }
        }
      `}</style>
    </div>
  );
};

// ヘルパー関数（重複を避けるため外部定義）
const getSeverityColor = (conflict: Conflict): string => {
  const { type, metadata = {} } = conflict;
  
  if (metadata.dataLoss) return '#dc3545';
  if (type === 'merge_conflict') return '#fd7e14';
  if (type === 'concurrent_update') return '#ffc107';
  return '#28a745';
};

const getConflictIcon = (type: string): string => {
  switch (type) {
    case 'concurrent_update':
      return '⚡';
    case 'concurrent_creation':
      return '🆕';
    case 'position_adjustment':
      return '📍';
    case 'merge_conflict':
      return '🔀';
    case 'deletion_conflict':
      return '🗑️';
    default:
      return '⚠️';
  }
};

const getConflictTitle = (type: string): string => {
  switch (type) {
    case 'concurrent_update':
      return '同時編集の競合';
    case 'concurrent_creation':
      return '同時作成の競合';
    case 'position_adjustment':
      return '位置調整';
    case 'merge_conflict':
      return 'マージ競合';
    case 'deletion_conflict':
      return '削除競合';
    default:
      return '競合が発生';
  }
};

const getResolutionMessage = (conflict: Conflict): string => {
  const { resolutionType, metadata = {} } = conflict;
  
  switch (resolutionType) {
    case 'last_writer_wins':
      return `最新の変更を採用 (${metadata.discardedOperations || 0}個の操作を破棄)`;
    case 'field_merge':
      return `フィールドをマージ (${metadata.mergedFields?.length || 0}個のフィールド)`;
    case 'position_adjustment':
      return `位置を自動調整 (${Math.round(metadata.adjustedBy || 0)}px移動)`;
    case 'first_delete_wins':
      return '最初の削除操作を優先';
    case 'preserve_children':
      return '子ノードを保持して削除実行';
    case 'averaged_position':
      return `位置を平均化 (${metadata.operationCount || 0}個の操作)`;
    default:
      return '自動的に解決されました';
  }
};


export default ConflictNotification;