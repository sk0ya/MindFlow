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
      // デバッグ用：キーイベントをログ出力
      console.log('🎹 キーイベント:', {
        key: e.key,
        target: e.target.tagName,
        editingNodeId,
        selectedNodeId,
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        shiftKey: e.shiftKey
      });
      
      // 入力フィールドにフォーカスがある場合は、一部のショートカットのみ許可
      const isInputFocused = document.activeElement?.tagName === 'INPUT' || 
                           document.activeElement?.tagName === 'TEXTAREA' || 
                           document.activeElement?.contentEditable === 'true';

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

      // 編集中の場合は、Tab/Enterキーを処理
      if (editingNodeId) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          console.log('⌨️ useKeyboardShortcuts Enter処理:', { editingNodeId, editText });
          
          // 実際の入力フィールドから現在の値を取得
          const currentInputElement = document.querySelector('.node-input');
          const currentText = currentInputElement ? currentInputElement.value : editText;
          
          console.log('📝 編集完了 - 実際のテキスト:', { currentText, fromElement: !!currentInputElement });
          
          // テキストがある場合のみ兄弟ノード追加（編集終了前に実行）
          if (currentText.trim() && addSiblingNode) {
            // 先に新ノードを作成してから編集終了
            const newNodeId = addSiblingNode(editingNodeId, '', true);
            console.log('📍 兄弟ノード作成完了:', { newNodeId, parentId: editingNodeId });
            
            // その後で前のノードの編集を終了
            setTimeout(() => {
              finishEdit(editingNodeId, currentText.trim());
            }, 50);
          } else {
            // テキストが空の場合は通常通り編集終了
            finishEdit(editingNodeId, currentText.trim());
          }
        } else if (e.key === 'Tab' && !e.shiftKey) {
          e.preventDefault();
          console.log('⌨️ useKeyboardShortcuts Tab処理:', { editingNodeId, editText });
          
          // 実際の入力フィールドから現在の値を取得
          const currentInputElement = document.querySelector('.node-input');
          const currentText = currentInputElement ? currentInputElement.value : editText;
          
          console.log('📝 編集完了 - 実際のテキスト:', { currentText, fromElement: !!currentInputElement });
          
          // テキストがある場合のみ子ノード追加（編集終了前に実行）
          if (currentText.trim() && addChildNode) {
            // 先に新ノードを作成してから編集終了
            const newNodeId = addChildNode(editingNodeId, '', true);
            console.log('📍 子ノード作成完了:', { newNodeId, parentId: editingNodeId });
            
            // その後で前のノードの編集を終了
            setTimeout(() => {
              finishEdit(editingNodeId, currentText.trim());
            }, 50);
          } else {
            // テキストが空の場合は通常通り編集終了
            finishEdit(editingNodeId, currentText.trim());
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
        console.log('🎯 選択ノードでのキー処理:', { key: e.key, selectedNodeId });
        switch (e.key) {
          case 'Tab':
            e.preventDefault();
            console.log('⭕ Tab → 子ノード追加:', { selectedNodeId });
            addChildNode(selectedNodeId, '', true);
            break;
          
          case 'Enter':
            e.preventDefault();
            console.log('⭕ Enter → 兄弟ノード追加:', { selectedNodeId });
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