import { useEffect } from 'react';

// キーボードショートカット管理専用のカスタムフック
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
}) => {
  
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 入力フィールドにフォーカスがある場合は、一部のショートカットのみ許可
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || 
                           document.activeElement?.tagName === 'TEXTAREA' || 
                           document.activeElement?.contentEditable === 'true';

      // エスケープキーの処理（最優先）
      if (e.key === 'Escape') {
        e.preventDefault();
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

      // 編集中の場合は、Tab/Enterキーを処理
      if (editingNodeId) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          console.log('⌨️ useKeyboardShortcuts Enter処理:', { editingNodeId, editText });
          const currentText = editText.trim();
          finishEdit(editingNodeId, currentText);
          // テキストがある場合のみ兄弟ノード追加
          if (currentText && addSiblingNode) {
            setTimeout(() => addSiblingNode(editingNodeId, '', true), 50);
          }
        } else if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          console.log('⌨️ useKeyboardShortcuts Tab処理:', { editingNodeId, editText });
          const currentText = editText.trim();
          finishEdit(editingNodeId, currentText);
          // テキストがある場合のみ子ノード追加
          if (currentText && addChildNode) {
            setTimeout(() => addChildNode(editingNodeId, '', true), 50);
          }
        }
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
        switch (e.key) {
          case 'Tab':
            e.preventDefault();
            console.log('⌨️ 非編集時Tab処理:', { selectedNodeId });
            addChildNode(selectedNodeId, '', true);
            break;
          
          case 'Enter':
            e.preventDefault();
            console.log('⌨️ 非編集時Enter処理:', { selectedNodeId });
            if (selectedNodeId === 'root') {
              addChildNode('root', '', true);
            } else {
              addSiblingNode(selectedNodeId, '', true);
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