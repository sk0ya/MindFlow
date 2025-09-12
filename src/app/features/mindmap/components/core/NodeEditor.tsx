import React, { useRef, useEffect, useCallback, memo } from 'react';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import { calculateIconLayout } from '../../../../shared/utils/nodeUtils';
import type { MindMapNode } from '@shared/types';

interface NodeEditorProps {
  node: MindMapNode;
  nodeLeftX: number;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  nodeWidth: number;
  imageHeight: number;
  blurTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
  isSelected?: boolean;
  onSelectNode?: (nodeId: string | null) => void;
  onToggleAttachmentList?: (nodeId: string) => void;
  onToggleLinkList?: (nodeId: string) => void;
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  nodeLeftX,
  isEditing,
  editText,
  setEditText,
  onFinishEdit,
  nodeWidth,
  imageHeight: _imageHeight,
  blurTimeoutRef,
  isSelected = false,
  onSelectNode,
  onToggleAttachmentList,
  onToggleLinkList
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings } = useMindMapStore();

  // リンククリック時の処理
  const handleLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // ノードが選択されていない場合は選択してからリンク一覧を表示
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
    }
    
    // リンク一覧をトグル（選択状態に関わらず）
    if (onToggleLinkList) {
      onToggleLinkList(node.id);
    }
  }, [isSelected, onSelectNode, onToggleLinkList, node.id]);


  // 添付ファイルアイコンクリック時の処理
  const handleAttachmentClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // ノードが選択されていない場合は選択してから添付ファイル一覧を表示
    if (!isSelected && onSelectNode) {
      onSelectNode(node.id);
    }
    
    // 添付ファイル一覧をトグル（選択状態に関わらず）
    if (onToggleAttachmentList) {
      onToggleAttachmentList(node.id);
    }
  }, [isSelected, onSelectNode, onToggleAttachmentList, node.id]);

  // 編集モードになった時に確実にフォーカスを設定
  useEffect(() => {
    if (isEditing && inputRef.current) {
      // 少し遅延してからフォーカス（DOM更新完了後）
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          
          // 編集モードに応じてカーソル位置を制御
          const editingMode = useMindMapStore.getState().editingMode;
          if (editingMode === 'cursor-at-end') {
            // カーソルを末尾に配置
            const length = inputRef.current.value.length;
            inputRef.current.setSelectionRange(length, length);
          } else {
            // デフォルト: 全選択
            inputRef.current.select();
          }
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
    
    return (
      <>
        <text
          x={nodeLeftX + 8}
          y={textY}
          textAnchor="start"
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
                    width="32"
                    height="16"
                    fill="white"
                    stroke="#ddd"
                    strokeWidth="1"
                    rx="8"
                    ry="8"
                    style={{ 
                      filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))',
                      cursor: 'pointer'
                    }}
                    onClick={handleAttachmentClick}
                  />
                  
                  {/* Unicode 添付ファイルアイコン */}
                  <text
                    x={node.x + iconLayout.attachmentIcon.x + 8}
                    y={textY + iconLayout.attachmentIcon.y + 10}
                    textAnchor="middle"
                    fill="#666"
                    fontSize="12px"
                    style={{ 
                      pointerEvents: 'none', 
                      userSelect: 'none'
                    }}
                  >
                    📎
                  </text>
                  
                  {/* ファイル数 */}
                  <text
                    x={node.x + iconLayout.attachmentIcon.x + 26}
                    y={textY + iconLayout.attachmentIcon.y + 11}
                    textAnchor="end"
                    fill="#333"
                    fontSize="11px"
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
                    width="32"
                    height="16"
                    fill="white"
                    stroke="#ddd"
                    strokeWidth="1"
                    rx="8"
                    ry="8"
                    style={{ 
                      filter: 'drop-shadow(0 1px 3px rgba(0, 0, 0, 0.1))',
                      cursor: 'pointer'
                    }}
                    onClick={handleLinkClick}
                  />
                  
                  {/* SVGアイコン: リンク */}
                  <g 
                    transform={`translate(${node.x + iconLayout.linkIcon.x + 4}, ${textY + iconLayout.linkIcon.y + 2})`}
                    style={{ pointerEvents: 'none' }}
                  >
                    {/* Unicode リンクアイコン */}
                    <text
                      x="8"
                      y="10"
                      textAnchor="middle"
                      fill="#666"
                      fontSize="12px"
                      style={{ 
                        pointerEvents: 'none', 
                        userSelect: 'none'
                      }}
                    >
                      🔗
                    </text>
                  </g>
                  
                  {/* リンク数 */}
                  <text
                    x={node.x + iconLayout.linkIcon.x + 26}
                    y={textY + iconLayout.linkIcon.y + 11}
                    textAnchor="end"
                    fill="#333"
                    fontSize="11px"
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
  const editY = hasImage ? node.y + actualImageHeight / 2 - 10 : node.y - 10;
  
  return (
    <foreignObject 
      x={nodeLeftX + 4} 
      y={editY} 
      width={nodeWidth - 8} 
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
          padding: '0 4px',
          boxSizing: 'border-box'
        }}
      />
    </foreignObject>
  );
};

export default memo(NodeEditor);