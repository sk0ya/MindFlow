import { memo, useMemo } from 'react';
import type { Node, UserCursor as UserCursorType, PanState } from '../../../../shared/types/app.js';

interface CursorData {
  nodeId: string;
  offsetX?: number;
  offsetY?: number;
  type?: 'editing' | 'selecting' | 'dragging';
  action?: string;
  timestamp: number;
}

interface UserCursorInfo {
  userId: string;
  userName: string;
  userColor?: string;
  cursor?: CursorData;
}

interface UserCursorsProps {
  userCursors: UserCursorInfo[] | Map<string, UserCursorInfo>;
  currentUserId?: string;
  zoom?: number;
  pan?: PanState;
  findNode?: (nodeId: string) => Node | null;
}

interface UserCursorProps {
  cursor: UserCursorInfo;
  zoom: number;
  pan: PanState;
  findNode?: (nodeId: string) => Node | null;
}

/**
 * リアルタイムユーザーカーソル表示コンポーネント
 * 他のユーザーのカーソル位置とノード操作状況を表示
 */
const UserCursors = memo<UserCursorsProps>(({
  userCursors,
  currentUserId,
  zoom = 1,
  pan = { x: 0, y: 0 },
  findNode
}) => {
  // アクティブなカーソルのみをメモ化
  const activeCursors = useMemo(() => {
    // 緊急修正: userCursorsが未定義の場合の安全ガード
    if (!userCursors || (userCursors instanceof Map && userCursors.size === 0)) {
      return [];
    }

    // userCursorsがMapでない場合も対処
    let cursorsArray = [];
    try {
      if (userCursors && typeof userCursors.values === 'function') {
        cursorsArray = Array.from(userCursors.values());
      } else if (Array.isArray(userCursors)) {
        cursorsArray = userCursors;
      } else {
        return [];
      }
    } catch (error) {
      console.warn('UserCursors: userCursors処理エラー:', error);
      return [];
    }

    const now = Date.now();
    return cursorsArray
      .filter(cursor => 
        cursor &&
        cursor.userId !== currentUserId &&
        cursor.cursor &&
        cursor.cursor.timestamp &&
        now - cursor.cursor.timestamp < 5000 // 5秒以内をアクティブとみなす
      );
  }, [userCursors, currentUserId]);

  if (activeCursors.length === 0) {
    return null;
  }

  return (
    <div className="user-cursors">
      {activeCursors.map(cursor => (
        <UserCursor
          key={cursor.userId}
          cursor={cursor}
          zoom={zoom}
          pan={pan}
          findNode={findNode}
        />
      ))}
    </div>
  );
}, (prevProps: UserCursorsProps, nextProps: UserCursorsProps) => {
  // カスタム比較関数でレンダリングを最適化
  if (prevProps.currentUserId !== nextProps.currentUserId ||
      prevProps.zoom !== nextProps.zoom ||
      prevProps.pan?.x !== nextProps.pan?.x ||
      prevProps.pan?.y !== nextProps.pan?.y) {
    return false;
  }

  // userCursorsの詳細比較
  if (prevProps.userCursors && nextProps.userCursors) {
    // Map の場合
    if (prevProps.userCursors instanceof Map && nextProps.userCursors instanceof Map) {
      if (prevProps.userCursors.size !== nextProps.userCursors.size) {
        return false;
      }
      
      for (const [userId, cursor] of nextProps.userCursors) {
        const prevCursor = prevProps.userCursors.get(userId);
        if (!prevCursor ||
            prevCursor.cursor?.nodeId !== cursor.cursor?.nodeId ||
            prevCursor.cursor?.timestamp !== cursor.cursor?.timestamp) {
          return false;
        }
      }
    }
    // Array の場合
    else if (Array.isArray(prevProps.userCursors) && Array.isArray(nextProps.userCursors)) {
      if (prevProps.userCursors.length !== nextProps.userCursors.length) {
        return false;
      }
      // 簡単な比較 - より詳細な比較が必要な場合は改善
      return JSON.stringify(prevProps.userCursors) === JSON.stringify(nextProps.userCursors);
    }
  }

  return true;
});

/**
 * 個別ユーザーカーソルコンポーネント
 */
const UserCursor = memo<UserCursorProps>(({ cursor, zoom, pan, findNode }) => {
  const { _userId, userName, userColor, cursor: cursorData } = cursor;
  
  if (!cursorData || !cursorData.nodeId) {
    return null;
  }

  // ノード位置を取得
  const node = findNode && findNode(cursorData.nodeId);
  if (!node) {
    return null;
  }

  // SVG座標をスクリーン座標に変換
  const screenX = (node.x + pan.x) * zoom;
  const screenY = (node.y + pan.y) * zoom;

  // カーソルの相対的オフセット
  const cursorOffsetX = (cursorData.offsetX || 0) * zoom;
  const cursorOffsetY = (cursorData.offsetY || 0) * zoom;

  const finalX = screenX + cursorOffsetX;
  const finalY = screenY + cursorOffsetY;

  // カーソルタイプに基づく表示の決定
  const getCursorIcon = (cursorType?: string) => {
    switch (cursorType) {
      case 'editing':
        return '✏️';
      case 'selecting':
        return '👆';
      case 'dragging':
        return '✋';
      default:
        return '👆';
    }
  };

  const isActive = cursorData.timestamp && (Date.now() - cursorData.timestamp < 5000); // 5秒以内をアクティブとみなす

  if (!isActive) {
    return null;
  }

  return (
    <>
      <div
        className="user-cursor"
        style={{
          left: `${finalX}px`,
          top: `${finalY}px`,
          borderColor: userColor || '#007acc'
        }}
      >
        <div 
          className="cursor-pointer"
          style={{ backgroundColor: userColor || '#007acc' }}
        />
        <div className="cursor-trail" />
      </div>
      
      <div
        className="user-cursor-label"
        style={{
          left: `${finalX + 15}px`,
          top: `${finalY - 25}px`,
          backgroundColor: userColor || '#007acc'
        }}
      >
        <span className="cursor-icon">
          {getCursorIcon(cursorData.type)}
        </span>
        <span className="cursor-name">
          {userName}
        </span>
        {cursorData.action && (
          <span className="cursor-action">
            {cursorData.action}
          </span>
        )}
      </div>

      <style>{`
        .user-cursor {
          position: absolute;
          z-index: 999;
          pointer-events: none;
          transform: translate(-2px, -2px);
        }

        .cursor-pointer {
          width: 4px;
          height: 4px;
          border-radius: 50%;
          position: relative;
          animation: cursor-pulse 2s infinite;
        }

        .cursor-trail {
          position: absolute;
          top: -2px;
          left: -2px;
          width: 8px;
          height: 8px;
          border: 1px solid currentColor;
          border-radius: 50%;
          animation: cursor-fade 1.5s infinite;
        }

        .user-cursor-label {
          position: absolute;
          z-index: 1000;
          padding: 4px 8px;
          border-radius: 12px;
          color: white;
          font-size: 12px;
          font-weight: 500;
          white-space: nowrap;
          pointer-events: none;
          display: flex;
          align-items: center;
          gap: 4px;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          animation: label-fade-in 0.3s ease-out;
        }

        .cursor-icon {
          font-size: 10px;
        }

        .cursor-name {
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .cursor-action {
          font-size: 10px;
          opacity: 0.9;
          font-style: italic;
        }

        @keyframes cursor-pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 1;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.7;
          }
        }

        @keyframes cursor-fade {
          0% {
            transform: scale(0.5);
            opacity: 1;
          }
          100% {
            transform: scale(2);
            opacity: 0;
          }
        }

        @keyframes label-fade-in {
          0% {
            opacity: 0;
            transform: translateY(-5px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* ノードハイライト効果 */
        .user-cursor.editing::before {
          content: '';
          position: absolute;
          top: -20px;
          left: -20px;
          width: 40px;
          height: 40px;
          border: 2px dashed currentColor;
          border-radius: 4px;
          animation: edit-highlight 2s infinite;
        }

        @keyframes edit-highlight {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      `}</style>
    </>
  );
}, (prevProps: UserCursorProps, nextProps: UserCursorProps) => {
  // UserCursorの最適化された比較
  return (
    prevProps.cursor.userId === nextProps.cursor.userId &&
    prevProps.cursor.cursor?.nodeId === nextProps.cursor.cursor?.nodeId &&
    prevProps.cursor.cursor?.timestamp === nextProps.cursor.cursor?.timestamp &&
    prevProps.zoom === nextProps.zoom &&
    prevProps.pan.x === nextProps.pan.x &&
    prevProps.pan.y === nextProps.pan.y
  );
});

export default UserCursors;