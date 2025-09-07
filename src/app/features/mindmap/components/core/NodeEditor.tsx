import React, { useRef, useEffect, useCallback, memo } from 'react';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import { calculateIconLayout } from '../../../../shared/utils/nodeUtils';
import type { MindMapNode, NodeLink } from '@shared/types';

interface NodeEditorProps {
  node: MindMapNode;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  nodeWidth: number;
  imageHeight: number;
  blurTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onShowLinkActionMenu?: (link: NodeLink, nodeId: string, position: { x: number; y: number }) => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  isEditing,
  editText,
  setEditText,
  onFinishEdit,
  nodeWidth,
  imageHeight: _imageHeight,
  blurTimeoutRef,
  isSelected = false,
  onSelectNode,
  onShowLinkActionMenu
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings } = useMindMapStore();

  // リンククリック時の処理（ノード選択 or メニュー表示）
  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // ノードが選択されていない場合は選択する
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
      return;
    }
    
    // 既に選択されている場合は最初のリンクのアクションメニューを表示
    if (onShowLinkActionMenu && node.links && node.links.length > 0) {
      const firstLink = node.links[0];
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
      
      onShowLinkActionMenu(firstLink, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [isSelected, onSelectNode, onShowLinkActionMenu, node.id, node.links]);

  const handleLinkContextMenu = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    if (onShowLinkActionMenu && node.links && node.links.length > 0) {
      const firstLink = node.links[0];
      const clientX = e.clientX || 0;
      const clientY = e.clientY || 0;
      
      onShowLinkActionMenu(firstLink, node.id, {
        x: clientX,
        y: clientY
      });
    }
  }, [onShowLinkActionMenu, node.id, node.links]);

  // 編集モードになった時に確実にフォーカスを設定
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // 少し遅延してからフォーカス（DOM更新完了後）
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      }, 10);
    }
  }, [isEditing, node.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 編集中の入力フィールドでは、Escapeのみ処理（他はuseKeyboardShortcutsに委任）
    if (e.key === 'Escape') {
      e.preventDefault();
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      onFinishEdit(node.id, node.text);
    }
    // Tab/EnterはuseKeyboardShortcutsで統一処理
  }, [node.id, node.text, onFinishEdit, blurTimeoutRef]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // 既存のタイマーをクリア
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    // 最新の入力値を取得
    const currentValue = e.target ? e.target.value : editText;
    
    // 編集完了処理を実行
    onFinishEdit(node.id, currentValue);
  }, [node.id, editText, onFinishEdit, blurTimeoutRef]);


  if (!isEditing) {
    // 画像がある場合はテキストをノードの下部に表示
    const hasImage = node.attachments && node.attachments.some(f => f.isImage);
    
    // カスタム画像サイズを考慮
    const getActualImageHeight = () => {
      if (!hasImage) return 0;
      
      if (node.customImageWidth && node.customImageHeight) {
        return node.customImageHeight;
      }
      
      return 105;
    };
    
    const actualImageHeight = getActualImageHeight();
    const hasAttachments = node.attachments && node.attachments.length > 0;
    const hasLinks = node.links && node.links.length > 0;
    const textY = hasImage ? node.y + actualImageHeight / 2 + 2 : node.y;
    
    // アイコンレイアウトを計算してテキスト位置を調整
    const iconLayout = calculateIconLayout(node, nodeWidth);
    // アイコンがある場合、テキストを左に移動してアイコンと重ならないようにする
    const textOffsetX = iconLayout.totalWidth > 0 ? (iconLayout.totalWidth + 10) / 2 : 0;
    
    return (
      <>
        <text
          x={node.x - textOffsetX}
          y={textY}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={settings.theme === 'dark' ? 'var(--text-primary)' : 'black'}
          fontSize={settings.fontSize || node.fontSize || '14px'}
          fontWeight={node.fontWeight || 'normal'}
          fontStyle={node.fontStyle || 'normal'}
          fontFamily={settings.fontFamily || 'system-ui'}
          style={{ 
            pointerEvents: 'none', 
            userSelect: 'none'
          }}
        >
          <title>{node.text}</title>
          {node.text}
        </text>
        
        {/* アイコン表示エリア（添付ファイルとリンク） */}
        {(() => {
          if (!hasAttachments && !hasLinks) return null;
          
          return (
            <g>
              {/* 添付ファイルアイコン */}
              {hasAttachments && iconLayout.attachmentIcon && (
                <g>
                  {/* 背景バッジ */}
                  <rect
                    x={node.x + iconLayout.attachmentIcon.x}
                    y={textY + iconLayout.attachmentIcon.y}
                    width="26"
                    height="12"
                    fill="white"
                    stroke="#ddd"
                    strokeWidth="1"
                    rx="6"
                    ry="6"
                    style={{ 
                      filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))',
                      pointerEvents: 'none'
                    }}
                  />
                  
                  {/* SVGアイコン: ペーパークリップ */}
                  <g 
                    transform={`translate(${node.x + iconLayout.attachmentIcon.x + 3}, ${textY + iconLayout.attachmentIcon.y})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    <path
                      d="M3 6.5L1.5 8C0.5 9 0.5 10.5 1.5 11.5C2.5 12.5 4 12.5 5 11.5L8.5 8C9.5 7 9.5 5.5 8.5 4.5C7.5 3.5 6 3.5 5 4.5L2 7.5C1.5 8 1.5 8.5 2 9C2.5 9.5 3 9.5 3.5 9L6 6.5"
                      stroke="#666"
                      strokeWidth="1.2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: 'scale(0.75)' }}
                    />
                  </g>
                  
                  {/* ファイル数 */}
                  <text
                    x={node.x + iconLayout.attachmentIcon.x + 13}
                    y={textY + iconLayout.attachmentIcon.y + 7}
                    textAnchor="middle"
                    fill="#333"
                    fontSize="10px"
                    fontWeight="600"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none'
                    }}
                  >
                    {node.attachments?.length || 0}
                  </text>
                </g>
              )}

              {/* リンクアイコン */}
              {hasLinks && iconLayout.linkIcon && (
                <g>
                  {/* 背景バッジ */}
                  <rect
                    x={node.x + iconLayout.linkIcon.x}
                    y={textY + iconLayout.linkIcon.y}
                    width="26"
                    height="12"
                    fill="white"
                    stroke="#ddd"
                    strokeWidth="1"
                    rx="6"
                    ry="6"
                    style={{ 
                      filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))',
                      cursor: 'pointer'
                    }}
                    onClick={handleLinkClick}
                    onContextMenu={handleLinkContextMenu}
                  />
                  
                  {/* SVGアイコン: リンク */}
                  <g 
                    transform={`translate(${node.x + iconLayout.linkIcon.x + 3}, ${textY + iconLayout.linkIcon.y})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    <path
                      d="M4 7h1a3 3 0 0 1 0 6h-1M12 7h-1a3 3 0 0 0 0 6h1M8 13h8"
                      stroke="#666"
                      strokeWidth="1.2"
                      fill="none"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ transform: 'scale(0.75)' }}
                    />
                  </g>
                  
                  {/* リンク数 */}
                  <text
                    x={node.x + iconLayout.linkIcon.x + 13}
                    y={textY + iconLayout.linkIcon.y + 7}
                    textAnchor="middle"
                    fill="#333"
                    fontSize="10px"
                    fontWeight="600"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none'
                    }}
                  >
                    {node.links?.length || 0}
                  </text>
                </g>
              )}
            </g>
          );
        })()}
      </>
    );
  }

  // 編集時も画像がある場合はテキストを下部に配置
  const hasImage = node.attachments && node.attachments.some(f => f.isImage);
  
  const getActualImageHeight = () => {
    if (!hasImage) return 0;
    
    if (node.customImageWidth && node.customImageHeight) {
      return node.customImageHeight;
    }
    
    return 105;
  };
  
  const actualImageHeight = getActualImageHeight();
  const editY = hasImage ? node.y + actualImageHeight / 2 - 2 : node.y - 8;

  return (
    <foreignObject 
      x={node.x - nodeWidth / 2 + 8} 
      y={editY} 
      width={nodeWidth - 16} 
      height="20"
    >
      <input
        ref={inputRef}
        type="text"
        className="node-input"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleInputBlur}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid #ccc',
          background: settings.theme === 'dark' ? 'var(--bg-primary)' : 'white',
          textAlign: 'left',
          fontSize: settings.fontSize || node.fontSize || '14px',
          fontWeight: node.fontWeight || 'normal',
          fontStyle: node.fontStyle || 'normal',
          fontFamily: settings.fontFamily || 'system-ui',
          color: settings.theme === 'dark' ? 'var(--text-primary)' : 'black',
          outline: 'none',
          borderRadius: '4px',
          padding: '0 8px',
          boxSizing: 'border-box'
        }}
      />
    </foreignObject>
  );
};

export default memo(NodeEditor);