import React, { useRef, useEffect, useCallback, memo } from 'react';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import type { MindMapNode } from '@shared/types';

interface NodeEditorProps {
  node: MindMapNode;
  isEditing: boolean;
  editText: string;
  setEditText: (text: string) => void;
  onFinishEdit: (nodeId: string, text: string) => void;
  nodeWidth: number;
  imageHeight: number;
  blurTimeoutRef: React.MutableRefObject<NodeJS.Timeout | null>;
}

const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  isEditing,
  editText,
  setEditText,
  onFinishEdit,
  nodeWidth,
  imageHeight: _imageHeight,
  blurTimeoutRef
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { settings } = useMindMapStore();

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
      
      const imageSize = node.imageSize || 'medium';
      const sizeMap = {
        'small': 70,
        'medium': 105,
        'large': 140,
        'extra-large': 175
      };
      
      return sizeMap[imageSize];
    };
    
    const actualImageHeight = getActualImageHeight();
    const hasAttachments = node.attachments && node.attachments.length > 0;
    const textY = hasImage ? node.y + actualImageHeight / 2 + 9 : node.y;
    
    return (
      <>
        <text
          x={node.x - (hasAttachments ? 15 : 0)}
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
        
        {/* 添付ファイル数とアイコン（ノード右端付近） */}
        {node.attachments && node.attachments.length > 0 && (
          <g>
            {/* 背景バッジ */}
            <rect
              x={node.x + (nodeWidth / 2) - 35}
              y={textY - 8}
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
              transform={`translate(${node.x + (nodeWidth / 2) - 32}, ${textY - 8})`}
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
              x={node.x + (nodeWidth / 2) - 18}
              y={textY + 1}
              textAnchor="middle"
              fill="#333"
              fontSize="10px"
              fontWeight="600"
              style={{ 
                pointerEvents: 'none', 
                userSelect: 'none'
              }}
            >
              {node.attachments.length}
            </text>
          </g>
        )}
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
    
    const imageSize = node.imageSize || 'medium';
    const sizeMap = {
      'small': 70,
      'medium': 105,
      'large': 140,
      'extra-large': 175
    };
    
    return sizeMap[imageSize];
  };
  
  const actualImageHeight = getActualImageHeight();
  const editY = hasImage ? node.y + actualImageHeight / 2 + 5 : node.y - 8;

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