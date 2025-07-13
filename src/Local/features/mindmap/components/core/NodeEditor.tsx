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
  isComposing: boolean;
  setIsComposing: (composing: boolean) => void;
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
  isComposing,
  setIsComposing,
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
          console.log('🎯 フォーカス設定完了:', { nodeId: node.id, focused: document.activeElement === inputRef.current });
        }
      }, 10);
    }
  }, [isEditing, node.id]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    console.log('🎹 NodeEditor handleKeyDown:', { key: e.key, isComposing, editText });
    
    // IME変換中は何もしない
    if (isComposing) {
      console.log('🎹 IME変換中のためスキップ');
      return;
    }
    
    // 編集中の入力フィールドでは、Escapeのみ処理（他はuseKeyboardShortcutsに委任）
    if (e.key === 'Escape') {
      e.preventDefault();
      console.log('🎹 Escape処理: 元のテキストに戻す');
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }
      onFinishEdit(node.id, node.text);
    }
    // Tab/EnterはuseKeyboardShortcutsで統一処理
  }, [node.id, node.text, isComposing, onFinishEdit, blurTimeoutRef, editText]);

  const handleCompositionStart = useCallback(() => {
    setIsComposing(true);
  }, [setIsComposing]);

  const handleCompositionEnd = useCallback(() => {
    setIsComposing(false);
  }, [setIsComposing]);

  const handleInputBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    // IME変換中でない場合のみ編集を終了
    if (!isComposing) {
      console.log('🎹 NodeEditor blur処理:', { 
        nodeId: node.id, 
        originalText: node.text, 
        editText, 
        targetValue: e.target.value,
        timestamp: Date.now()
      });
      
      // 既存のタイマーをクリア
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
      
      // 最新の入力値を即座に取得（DOM要素から直接取得）
      const currentValue = e.target ? e.target.value : editText;
      console.log('🎹 NodeEditor blur実行:', { 
        nodeId: node.id,
        finalValue: currentValue,
        isEmpty: !currentValue || currentValue.trim() === '',
        isRoot: node.id === 'root'
      });
      
      // 即座に編集完了処理を実行（finishEditが削除判定を行う）
      onFinishEdit(node.id, currentValue);
    }
  }, [node.id, node.text, editText, onFinishEdit, isComposing, blurTimeoutRef]);

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
      x={node.x - nodeWidth / 2 + 10} 
      y={node.y - 10 + imageHeight / 2} 
      width={nodeWidth - 20} 
      height="20"
    >
      <input
        ref={inputRef}
        type="text"
        className="node-input"
        value={editText}
        onChange={(e) => setEditText(e.target.value)}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        onBlur={handleInputBlur}
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