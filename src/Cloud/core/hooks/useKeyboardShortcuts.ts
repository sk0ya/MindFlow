import { useEffect } from 'react';

// キーボードショートカット管理専用のカスタムフック
interface UseKeyboardShortcutsProps {
  selectedNodeId: string | null;
  editingNodeId: string | null;
  setEditingNodeId: (id: string | null) => void;
  startEdit: (nodeId: string) => void;
  finishEdit: (nodeId: string, text: string) => void;
  editText: string;
  updateNode: (nodeId: string, updates: any) => void;
  addChildNode: (parentId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  addSiblingNode: (siblingId: string, text?: string, startEditing?: boolean) => Promise<string | null>;
  deleteNode: (nodeId: string) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  navigateToDirection: (direction: 'up' | 'down' | 'left' | 'right') => void;
  saveMindMap: () => void;
  showMapList: boolean;
  setShowMapList: (show: boolean | ((prev: boolean) => boolean)) => void;
  showCloudStorage: boolean;
  setShowCloudStorage: (show: boolean | ((prev: boolean) => boolean)) => void;
  showTutorial: boolean;
  setShowTutorial: (show: boolean | ((prev: boolean) => boolean)) => void;
  showKeyboardHelper: boolean;
  setShowKeyboardHelper: (show: boolean | ((prev: boolean) => boolean)) => void;
}

export const useKeyboardShortcuts = ({
  selectedNodeId,
  editingNodeId,
  setEditingNodeId,
  startEdit,
  finishEdit,
  editText,
  addChildNode,
  addSiblingNode,
  deleteNode,
  undo,
  redo,
  canUndo,
  canRedo,
  navigateToDirection,
  saveMindMap,
  showMapList,
  setShowMapList,
  showCloudStorage,
  setShowCloudStorage,
  showTutorial,
  setShowTutorial,
  showKeyboardHelper,
  setShowKeyboardHelper
}: UseKeyboardShortcutsProps): void => {
  
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent): Promise<void> => {
      // デバッグ用：重要なキーイベントのみログ出力
      if (e.key === 'Enter' || e.key === 'Tab' || (e.ctrlKey && ['s', 'z', 'y'].includes(e.key.toLowerCase()))) {
        console.log('🎹 重要キーイベント:', {
          key: e.key,
          target: e.target && 'tagName' in e.target ? (e.target as Element).tagName : 'unknown',
          editingNodeId: !!editingNodeId,
          selectedNodeId: !!selectedNodeId
        });
      }
      
      // 入力フィールドにフォーカスがある場合は、一部のショートカットのみ許可
      const activeElement = document.activeElement as HTMLElement | null;
      const isInputFocused = activeElement?.tagName === 'INPUT' || 
                           activeElement?.tagName === 'TEXTAREA' || 
                           activeElement?.contentEditable === 'true';

      // エスケープキーの処理（最優先）
      if (e.key === 'Escape') {
        e.preventDefault();
        console.log('⭕ Escapeキー処理:', { editingNodeId, showMapList, showCloudStorage, showTutorial, showKeyboardHelper });
        if (editingNodeId) {
          setEditingNodeId(null);
        } else if (showMapList) {
          setShowMapList(false);
        } else if (showCloudStorage) {
          setShowCloudStorage(false);
        } else if (showTutorial) {
          setShowTutorial(false);
        } else if (showKeyboardHelper) {
          setShowKeyboardHelper(false);
        }
        return;
      }

      // 編集中の場合は、まず編集を終了してから通常のキー処理を行う
      if (editingNodeId) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          console.log('🔧 ULTRA SIMPLE Enter: 編集終了');
          finishEdit(editingNodeId, editText);
          // 編集終了後、通常のEnterキー処理は下の非編集時処理で実行される
        } else if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          console.log('🔧 ULTRA SIMPLE Tab: 編集終了');
          finishEdit(editingNodeId, editText);
          // 編集終了後、通常のTabキー処理は下の非編集時処理で実行される
        }
        // 他のキーはそのまま編集を続ける
        return;
      }

      // モーダルが開いている場合は、キーボードショートカットを無効化
      if (showMapList || showCloudStorage || showTutorial || showKeyboardHelper) {
        return;
      }

      // 入力フィールドにフォーカスがある場合の制限
      if (isInputFocused) {
        // Ctrl/Cmd + S（保存）は許可
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
          e.preventDefault();
          saveMindMap();
        }
        return;
      }

      // ノードが選択されている場合のみ実行されるショートカット
      if (selectedNodeId) {
        console.log('🎯 選択ノードでのキー処理:', { key: e.key, selectedNodeId });
        switch (e.key) {
          case 'Tab':
            e.preventDefault();
            console.log('⭕ Tab → 子ノード追加:', { selectedNodeId });
            await addChildNode(selectedNodeId, '', true);
            break;
          
          case 'Enter':
            e.preventDefault();
            console.log('⭕ Enter → 兄弟ノード追加:', { selectedNodeId });
            if (selectedNodeId === 'root') {
              await addChildNode('root', '', true);
            } else {
              await addSiblingNode(selectedNodeId, '', true);
            }
            break;
          
          case ' ':
            e.preventDefault();
            startEdit(selectedNodeId);
            break;
          
          case 'Delete':
          case 'Backspace':
            e.preventDefault();
            if (selectedNodeId !== 'root') {
              deleteNode(selectedNodeId);
            }
            break;
          
          case 'ArrowUp':
            e.preventDefault();
            navigateToDirection('up');
            break;
          
          case 'ArrowDown':
            e.preventDefault();
            navigateToDirection('down');
            break;
          
          case 'ArrowLeft':
            e.preventDefault();
            navigateToDirection('left');
            break;
          
          case 'ArrowRight':
            e.preventDefault();
            navigateToDirection('right');
            break;
        }
      }

      // グローバルショートカット（Ctrl/Cmd組み合わせ）
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 's':
            e.preventDefault();
            saveMindMap();
            break;
          
          case 'z':
            e.preventDefault();
            if (e.shiftKey) {
              if (canRedo) redo();
            } else {
              if (canUndo) undo();
            }
            break;
          
          case 'y':
            e.preventDefault();
            if (canRedo) redo();
            break;
          
          case 'm':
            e.preventDefault();
            setShowMapList(prev => !prev);
            break;
          
          case 'k':
            e.preventDefault();
            setShowCloudStorage(prev => !prev);
            break;
        }
        return;
      }

      // その他のグローバルショートカット
      switch (e.key) {
        case 'F1':
          e.preventDefault();
          setShowTutorial(prev => !prev);
          break;
        
        case '?':
          if (e.shiftKey) {
            e.preventDefault();
            setShowKeyboardHelper(prev => !prev);
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    editingNodeId,
    editText,
    showMapList,
    showCloudStorage,
    showTutorial,
    showKeyboardHelper,
    canUndo,
    canRedo
  ]);
};