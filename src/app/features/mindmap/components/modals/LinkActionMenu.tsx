import React, { useRef, useEffect, useCallback } from 'react';
import type { NodeLink } from '@shared/types';

interface LinkActionMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  link: NodeLink;
  onClose: () => void;
  onNavigate: (link: NodeLink) => void;
  onEdit: (link: NodeLink) => void;
  onDelete: (linkId: string) => void;
  // リンク表示用の追加データ
  availableMaps?: { id: string; title: string }[];
  currentMapData?: { id: string; rootNode: any };
}

const LinkActionMenu: React.FC<LinkActionMenuProps> = ({
  isOpen,
  position,
  link,
  onClose,
  onNavigate,
  onEdit,
  onDelete,
  availableMaps = [],
  currentMapData
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // メニュー外クリックで閉じる
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // メニュー位置の調整
  const adjustedPosition = useCallback(() => {
    if (!menuRef.current) return position;

    const menuRect = menuRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let { x, y } = position;

    // 右端からはみ出る場合は左に移動
    if (x + menuRect.width > viewportWidth - 20) {
      x = viewportWidth - menuRect.width - 20;
    }

    // 下端からはみ出る場合は上に移動
    if (y + menuRect.height > viewportHeight - 20) {
      y = Math.max(20, y - menuRect.height);
    }

    // 左端・上端の境界チェック
    x = Math.max(20, x);
    y = Math.max(20, y);

    return { x, y };
  }, [position]);

  const handleNavigate = useCallback(() => {
    onNavigate(link);
    onClose();
  }, [link, onNavigate, onClose]);

  const handleEdit = useCallback(() => {
    onEdit(link);
    onClose();
  }, [link, onEdit, onClose]);

  // リンク情報を取得するヘルパー関数
  const getLinkDisplayInfo = useCallback(() => {
    if (!link.targetMapId) {
      // 現在のマップ内のリンク
      return {
        mapTitle: '現在のマップ',
        nodeText: link.targetNodeId ? getNodeText(currentMapData?.rootNode, link.targetNodeId) : 'ルートノード'
      };
    } else {
      // 他のマップへのリンク
      const targetMap = availableMaps.find(map => map.id === link.targetMapId);
      return {
        mapTitle: targetMap?.title || `マップID: ${link.targetMapId}`,
        nodeText: link.targetNodeId ? `ノードID: ${link.targetNodeId}` : 'ルートノード'
      };
    }
  }, [link, availableMaps, currentMapData]);

  // ノードテキストを取得するヘルパー関数
  const getNodeText = (rootNode: any, nodeId: string): string => {
    if (!rootNode) return 'ノードが見つかりません';
    
    const findNode = (node: any): string | null => {
      if (node.id === nodeId) return node.text;
      if (node.children) {
        for (const child of node.children) {
          const result = findNode(child);
          if (result) return result;
        }
      }
      return null;
    };
    
    return findNode(rootNode) || 'ノードが見つかりません';
  };

  const handleDelete = useCallback(() => {
    const { mapTitle, nodeText } = getLinkDisplayInfo();
    const linkDisplayText = `${mapTitle} > ${nodeText}`;
    if (confirm(`リンク「${linkDisplayText}」を削除しますか？`)) {
      onDelete(link.id);
      onClose();
    }
  }, [link, onDelete, onClose, getLinkDisplayInfo]);

  if (!isOpen) return null;

  const pos = adjustedPosition();
  const { mapTitle, nodeText } = getLinkDisplayInfo();

  return (
    <div
      ref={menuRef}
      className="link-action-menu"
      style={{
        position: 'fixed',
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        zIndex: 10001
      }}
    >
      <div className="menu-header">
        <div className="link-title">{mapTitle}</div>
        <div className="link-description">{nodeText}</div>
      </div>

      <div className="menu-divider" />

      <div className="menu-items">
        <button className="menu-item primary" onClick={handleNavigate}>
          <span className="menu-icon">🔗</span>
          <span className="menu-text">リンク先に移動</span>
        </button>

        <button className="menu-item" onClick={handleEdit}>
          <span className="menu-icon">✏️</span>
          <span className="menu-text">編集</span>
        </button>

        <div className="menu-divider" />

        <button className="menu-item danger" onClick={handleDelete}>
          <span className="menu-icon">🗑️</span>
          <span className="menu-text">削除</span>
        </button>
      </div>


      <style>{`
        .link-action-menu {
          background: white;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
          min-width: 220px;
          max-width: 300px;
          overflow: hidden;
          font-size: 14px;
          font-family: system-ui, -apple-system, sans-serif;
        }

        .menu-header {
          padding: 12px 16px;
          background: #f9fafb;
          border-bottom: 1px solid #e5e7eb;
        }

        .link-title {
          font-weight: 600;
          color: #111827;
          margin-bottom: 2px;
          word-wrap: break-word;
        }

        .link-description {
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .menu-divider {
          height: 1px;
          background: #e5e7eb;
          margin: 4px 0;
        }

        .menu-items {
          padding: 4px 0;
        }

        .menu-item {
          display: flex;
          align-items: center;
          width: 100%;
          padding: 8px 16px;
          border: none;
          background: none;
          color: #374151;
          font-size: 14px;
          text-align: left;
          cursor: pointer;
          transition: background-color 0.15s ease;
        }

        .menu-item:hover {
          background: #f3f4f6;
        }

        .menu-item.primary {
          color: #2563eb;
          font-weight: 500;
        }

        .menu-item.primary:hover {
          background: #dbeafe;
        }

        .menu-item.danger {
          color: #dc2626;
        }

        .menu-item.danger:hover {
          background: #fef2f2;
        }

        .menu-icon {
          margin-right: 8px;
          font-size: 14px;
          width: 16px;
          text-align: center;
        }

        .menu-text {
          flex: 1;
        }

        .menu-footer {
          padding: 8px 16px;
          background: #f9fafb;
          border-top: 1px solid #e5e7eb;
        }

        .link-info {
          font-size: 11px;
          color: #6b7280;
        }

        .info-item {
          display: flex;
          margin-bottom: 2px;
        }

        .info-item:last-child {
          margin-bottom: 0;
        }

        .info-label {
          font-weight: 500;
          margin-right: 4px;
          min-width: 55px;
        }

        .info-value {
          word-break: break-all;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
};

export default LinkActionMenu;