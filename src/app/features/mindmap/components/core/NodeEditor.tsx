import React, { useRef, useEffect, useCallback, memo, useState } from 'react';
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
  const [isComposing, setIsComposing] = useState(false);

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
    // IME入力中は通常のキーイベント処理をスキップ
    if (isComposing) {
      return;
    }
    
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
  }, [isComposing, node.id, node.text, onFinishEdit, blurTimeoutRef]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // IME入力中のblurは無視（composition終了後に適切に処理される）
    if (isComposing) {
      return;
    }
    
    // 既存のタイマーをクリア
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    // 最新の入力値を取得
    const currentValue = e.target ? e.target.value : editText;
    
    // 編集完了処理を実行
    onFinishEdit(node.id, currentValue);
  }, [isComposing, node.id, editText, onFinishEdit, blurTimeoutRef]);

  // IME composition開始時の処理
  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, []);

  // IME composition終了時の処理
  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, []);

  if (!isEditing) {
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
        {node.text}
      </text>
    );
  }

  return (
    <foreignObject 
      x={node.x - nodeWidth / 2} 
      y={node.y - 10 + imageHeight / 2} 
      width={nodeWidth} 
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
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        style={{
          width: '100%',
          border: '1px solid #ccc',
          background: 'white',
          textAlign: 'center',
          fontSize: node.fontSize || '14px',
          fontWeight: node.fontWeight || 'normal',
          fontStyle: node.fontStyle || 'normal',
          color: 'black',
          outline: 'none',
          borderRadius: '4px',
          padding: '2px 4px'
        }}
      />
    </foreignObject>
  );
};

export default memo(NodeEditor);