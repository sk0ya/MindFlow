import React, { memo, useCallback } from 'react';
import { Link } from 'lucide-react';
import type { MindMapNode, NodeLink } from '@shared/types';
import { calculateLinkListHeight } from '../../../../shared/utils/listHeightUtils';

interface SelectedNodeLinkListProps {
  node: MindMapNode;
  isVisible: boolean;
  nodeWidth: number;
  nodeHeight: number;
  onLinkClick: (link: NodeLink) => void;
  onLinkDoubleClick?: (link: NodeLink) => void;
  onLinkContextMenu: (link: NodeLink, position: { x: number; y: number }) => void;
  onLinkNavigate?: (link: NodeLink) => void;
  // リンク表示用の追加データ
  availableMaps?: { id: string; title: string }[];
  currentMapData?: { id: string; rootNode: any };
}

const SelectedNodeLinkList: React.FC<SelectedNodeLinkListProps> = ({
  node,
  isVisible,
  nodeWidth,
  nodeHeight,
  onLinkClick,
  onLinkDoubleClick,
  onLinkContextMenu,
  onLinkNavigate,
  availableMaps = [],
  currentMapData
}) => {
  const handleLinkClick = useCallback((e: React.MouseEvent, link: NodeLink) => {
    // 右クリックの場合は処理しない
    if (e.button === 2) {
      return;
    }
    e.stopPropagation();
    onLinkClick(link);
  }, [onLinkClick]);

  const handleLinkDoubleClick = useCallback((link: NodeLink) => {
    if (onLinkDoubleClick) {
      onLinkDoubleClick(link);
    } else if (onLinkNavigate) {
      // ダブルクリックでナビゲーション
      onLinkNavigate(link);
    }
  }, [onLinkDoubleClick, onLinkNavigate]);

  const handleLinkContextMenu = useCallback((e: React.MouseEvent, link: NodeLink) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation(); // 他のイベントリスナーも停止
    
    // さらに確実にイベントを停止
    if (e.nativeEvent.stopPropagation) {
      e.nativeEvent.stopPropagation();
    }
    
    onLinkContextMenu(link, { x: e.clientX, y: e.clientY });
  }, [onLinkContextMenu]);

  // リンク情報を取得するヘルパー関数
  const getLinkDisplayInfo = useCallback((link: NodeLink) => {
    if (!link.targetMapId) {
      // 現在のマップ内のリンク
      return {
        mapTitle: '現在のマップ',
        nodeText: link.targetNodeId ? getNodeText(currentMapData?.rootNode, link.targetNodeId) : 'ルートノード'
      };
    } else {
      // 他のマップへのリンク
      const targetMap = availableMaps.find(map => map.id === link.targetMapId);
      const mapTitle = targetMap?.title || 'マップが見つかりません';
      
      // 他のマップのノードテキストも取得できるようになった
      let nodeText = 'ルートノード';
      if (link.targetNodeId) {
        // 現在は他のマップのノードテキスト取得は制限されているので、汎用的な表示
        nodeText = 'リンク先ノード';
      }
      
      return {
        mapTitle,
        nodeText
      };
    }
  }, [availableMaps, currentMapData]);

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

  if (!isVisible || !node.links || node.links.length === 0) {
    return null;
  }

  // リストの位置計算（ノードのすぐ下に表示）
  const listY = node.y + nodeHeight / 2 + 8; // ノードのすぐ下に表示
  const listX = node.x - nodeWidth / 2; // ノードの左端に合わせる
  const listWidth = Math.max(nodeWidth, 300); // 最小幅300px
  
  // 動的高さ計算（共通ユーティリティを使用）
  const listHeight = calculateLinkListHeight({ itemCount: node.links.length });

  return (
    <foreignObject
      x={listX}
      y={listY}
      width={listWidth}
      height={listHeight}
      style={{ 
        overflow: 'visible',
        pointerEvents: isVisible ? 'auto' : 'none'
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid #d0d7de',
          borderRadius: '6px',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.12)',
          padding: '6px',
          maxHeight: '240px',
          overflowY: 'auto',
          fontSize: '12px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          zIndex: 1000
        }}
        onClick={(e) => e.stopPropagation()}
      >

        {/* リンク一覧 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {node.links.map((link) => {
            const { mapTitle, nodeText } = getLinkDisplayInfo(link);
            
            return (
              <div
                key={link.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s ease',
                  backgroundColor: 'transparent',
                  border: '1px solid transparent'
                }}
                className="link-item"
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f8f9fa';
                  e.currentTarget.style.borderColor = '#e1e4e8';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
                onClick={(e) => handleLinkClick(e, link)}
                onDoubleClick={() => handleLinkDoubleClick(link)}
                onContextMenu={(e) => handleLinkContextMenu(e, link)}
              >
                {/* リンクアイコン */}
                <span
                  style={{
                    marginRight: '6px',
                    flexShrink: 0,
                    color: '#0969da',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <Link size={12} />
                </span>

                {/* リンク情報 */}
                <div style={{ flex: 1, overflow: 'hidden', minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '11px',
                      fontWeight: '500',
                      color: '#0969da',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      lineHeight: '1.1'
                    }}
                  >
                    {mapTitle}
                  </div>
                  
                  <div
                    style={{
                      fontSize: '9px',
                      color: '#656d76',
                      marginTop: '0px',
                      lineHeight: '1.1',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}
                  >
                    {nodeText}
                  </div>
                </div>

                {/* アクションヒント */}
                <div
                  style={{
                    fontSize: '9px',
                    color: '#8c959f',
                    marginLeft: '6px',
                    opacity: 0,
                    transition: 'opacity 0.2s ease'
                  }}
                  className="action-hint"
                >
                  右クリック
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ホバー時のアクションヒント表示用CSS */}
      <style dangerouslySetInnerHTML={{
        __html: `
          .link-item:hover .action-hint {
            opacity: 1 !important;
          }
        `
      }} />
    </foreignObject>
  );
};

export default memo(SelectedNodeLinkList);