import React, { useRef, useEffect, useCallback, memo } from 'react';
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
  imageHeight,
  blurTimeoutRef
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

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
    const displayText = node.text.length > 25 ? node.text.substring(0, 25) + '...' : node.text;
    
    return (
      <text
        x={node.x}
        y={node.y + 5 + imageHeight / 2}
        textAnchor="middle"
        fill="black"
        fontSize={node.fontSize || '14px'}
        fontWeight={node.fontWeight || 'normal'}
        fontStyle={node.fontStyle || 'normal'}
        style={{ 
          pointerEvents: 'none', 
          userSelect: 'none'
        }}
      >
        <title>{node.text.length > 25 ? node.text : displayText}</title>
        {displayText}
      </text>
    );
  }

  return (
    <foreignObject 
      x={node.x - nodeWidth / 2} 
      y={node.y - 12 + imageHeight / 2} 
      width={nodeWidth} 
      height="24"
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
          background: 'white',
          textAlign: 'center',
          fontSize: node.fontSize || '14px',
          fontWeight: node.fontWeight || 'normal',
          fontStyle: node.fontStyle || 'normal',
          color: 'black',
          outline: 'none',
          borderRadius: '4px',
          padding: '0',
          boxSizing: 'border-box'
        }}
      />
    </foreignObject>
  );
};

export default memo(NodeEditor);