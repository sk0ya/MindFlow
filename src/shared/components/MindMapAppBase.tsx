/**
 * MindMapAppBase - Shared base component for both Local and Cloud modes
 * Provides common functionality and UI patterns while allowing mode-specific customization
 */

import React, { useState, useCallback } from 'react';
import type { 
  MindMapData, 
  MindMapNode, 
  AuthState,
  MindMapHookReturn 
} from '../types';

// Props that both Local and Cloud modes need to provide
export interface MindMapAppBaseProps {
  // Data and state from hooks
  mindMapHook: MindMapHookReturn;
  authState?: AuthState;
  isLoading?: boolean;
  error?: string | null;
  
  // Mode-specific configurations
  mode: 'local' | 'cloud';
  showSidebar?: boolean;
  showFileHandling?: boolean;
  showRealtime?: boolean;
  
  // Event handlers that modes can customize
  onModeChange?: (mode: 'local' | 'cloud') => void;
  onAuthModalShow?: () => void;
  onLogout?: () => void;
  
  // UI customization
  additionalToolbarItems?: React.ReactNode;
  additionalPanels?: React.ReactNode;
  customFooter?: React.ReactNode;
}

// Base loading screen component
const LoadingScreen: React.FC<{ title: string; message: string }> = ({ title, message }) => (
  <div className="mindmap-app loading-screen">
    <div className="loading-content">
      <div className="loading-spinner"></div>
      <h2>{title}</h2>
      <p>{message}</p>
    </div>
  </div>
);

// Base error screen component  
const ErrorScreen: React.FC<{ error: string }> = ({ error }) => (
  <div className="mindmap-app error-screen">
    <div className="error-content">
      <h2>エラーが発生しました</h2>
      <p>{error}</p>
      <button onClick={() => window.location.reload()}>
        再読み込み
      </button>
    </div>
  </div>
);

// Shared keyboard shortcut handler
export const useSharedKeyboardShortcuts = (
  selectedNodeId: string | null,
  editingNodeId: string | null,
  editText: string,
  onAddChild: (parentId: string, text?: string, autoEdit?: boolean) => void,
  onAddSibling: (nodeId: string, text?: string, autoEdit?: boolean) => void,
  onStartEdit: (nodeId: string) => void,
  onFinishEdit: (nodeId?: string, text?: string) => void,
  onDeleteNode: (nodeId: string) => void,
  onDeselectNode: () => void
) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!selectedNodeId) return;

    // 編集中の場合の特殊処理
    if (editingNodeId) {
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        onFinishEdit(editingNodeId, editText);
        setTimeout(() => {
          if (e.key === 'Tab') {
            onAddChild(selectedNodeId, '', true);
          } else {
            onAddSibling(selectedNodeId, '', true);
          }
        }, 50);
      }
      return;
    }

    // 編集中でない場合の通常処理
    switch (e.key) {
      case 'Tab':
        e.preventDefault();
        onAddChild(selectedNodeId, '', true);
        break;
      case 'Enter':
        e.preventDefault();
        onAddSibling(selectedNodeId, '', true);
        break;
      case ' ': // スペースキー
        e.preventDefault();
        onStartEdit(selectedNodeId);
        break;
      case 'Delete':
        e.preventDefault();
        onDeleteNode(selectedNodeId);
        break;
      case 'Escape':
        e.preventDefault();
        onDeselectNode();
        break;
    }
  }, [
    selectedNodeId, 
    editingNodeId, 
    editText, 
    onAddChild, 
    onAddSibling, 
    onStartEdit, 
    onFinishEdit, 
    onDeleteNode, 
    onDeselectNode
  ]);

  React.useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
};

// Main base component
export const MindMapAppBase: React.FC<MindMapAppBaseProps> = ({
  mindMapHook,
  authState,
  isLoading,
  error,
  mode,
  showSidebar = false,
  showFileHandling = false,
  showRealtime = false,
  onModeChange,
  onAuthModalShow,
  onLogout,
  additionalToolbarItems,
  additionalPanels,
  customFooter,
  children
}) => {
  const {
    data,
    selectedNodeId,
    editingNodeId,
    editText,
    setSelectedNodeId,
    findNode,
    updateTitle,
    addChildNode,
    deleteNode,
    startEdit,
    finishEdit
  } = mindMapHook;

  // Shared UI state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });

  // Shared handlers
  const handleNodeSelect = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, [setSelectedNodeId]);

  const handleAddChild = useCallback((parentId: string, text: string = '', autoEdit: boolean = false) => {
    addChildNode(parentId, text, autoEdit);
  }, [addChildNode]);

  const handleAddSibling = useCallback((nodeId: string, text: string = '', autoEdit: boolean = false) => {
    const node = findNode(nodeId);
    if (!node || nodeId === 'root') return;
    
    // Find parent node
    const findParent = (searchNode: MindMapNode, targetId: string): MindMapNode | null => {
      if (!searchNode.children) return null;
      for (const child of searchNode.children) {
        if (child.id === targetId) return searchNode;
        const found = findParent(child, targetId);
        if (found) return found;
      }
      return null;
    };
    
    const parentNode = findParent(data?.rootNode as MindMapNode, nodeId);
    if (parentNode) {
      addChildNode(parentNode.id, text, autoEdit);
    }
  }, [findNode, data?.rootNode, addChildNode]);

  // Shared keyboard shortcuts
  useSharedKeyboardShortcuts(
    selectedNodeId,
    editingNodeId,
    editText,
    handleAddChild,
    handleAddSibling,
    startEdit,
    finishEdit,
    deleteNode,
    () => setSelectedNodeId(null)
  );

  // Loading state
  if (isLoading || !data) {
    const loadingMessage = mode === 'cloud' 
      ? 'クラウドデータを読み込み中...' 
      : 'ローカルデータを読み込み中...';
    return <LoadingScreen title="MindFlow" message={loadingMessage} />;
  }

  // Error state
  if (error) {
    return <ErrorScreen error={error} />;
  }

  // Main app layout
  return (
    <div className={`mindmap-app ${mode}-mode`}>
      {children}
      
      {/* Shared footer */}
      {customFooter || (
        <footer className="footer">
          <div>
            <span className="footer-brand">© 2024 MindFlow</span>
            <span className="stats">
              ノード数: {data?.rootNode ? countNodes(data.rootNode) : 0} | 
              最終更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString('ja-JP') : 'N/A'}
            </span>
            {mode === 'cloud' && (
              <span className="mode-indicator">クラウドモード</span>
            )}
          </div>
        </footer>
      )}
      
      {/* Additional panels from specific modes */}
      {additionalPanels}
    </div>
  );
};

// Utility function to count nodes
const countNodes = (node: MindMapNode): number => {
  return 1 + (node.children?.reduce((count, child) => count + countNodes(child), 0) || 0);
};

export default MindMapAppBase;