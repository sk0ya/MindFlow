/**
 * MindMapModalsのためのコンテキスト
 * 巨大なpropsを整理してコンポーネント間の通信を簡素化
 */

import React, { createContext, useContext, ReactNode } from 'react';
import type { MindMapNode, FileAttachment } from '../../../../shared';

// UI状態の型定義
export interface MindMapUIState {
  showCustomizationPanel: boolean;
  showContextMenu: boolean;
  showImageModal: boolean;
  showFileActionMenu: boolean;
  contextMenuPosition: { x: number; y: number };
  customizationPosition: { x: number; y: number };
  fileMenuPosition: { x: number; y: number };
  selectedImage: FileAttachment | null;
  selectedFile: FileAttachment | null;
  clipboard: MindMapNode | null;
}

// ノード操作関数の型定義
export interface NodeOperations {
  findNode: (nodeId: string) => MindMapNode | null;
  onDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onCopyNode: (node: MindMapNode) => void;
  onPasteNode: (parentId: string) => void;
  onShowCustomization: (node: MindMapNode) => void;
  onAddChild: (parentId: string, text?: string) => string | undefined; // 新しい子ノードのIDを返す（失敗時undefined）
}

// ファイル操作関数の型定義
export interface FileOperations {
  onFileDownload: (file: FileAttachment) => void;
  onFileRename: (fileId: string, newName: string) => void;
  onFileDelete: (fileId: string) => void;
  onShowImageModal: (file: FileAttachment) => void;
}

// UI操作関数の型定義
export interface UIOperations {
  onCloseCustomizationPanel: () => void;
  onCloseContextMenu: () => void;
  onCloseImageModal: () => void;
  onCloseFileActionMenu: () => void;
}

// コンテキストの値の型
export interface MindMapModalsContextValue {
  ui: MindMapUIState;
  selectedNodeId: string | null;
  nodeOperations: NodeOperations;
  fileOperations: FileOperations;
  uiOperations: UIOperations;
}

// コンテキスト作成
const MindMapModalsContext = createContext<MindMapModalsContextValue | null>(null);

// プロバイダーのProps型
export interface MindMapModalsProviderProps {
  children: ReactNode;
  ui: MindMapUIState;
  selectedNodeId: string | null;
  nodeOperations: NodeOperations;
  fileOperations: FileOperations;
  uiOperations: UIOperations;
}

/**
 * MindMapModalsProvider コンポーネント
 */
export const MindMapModalsProvider: React.FC<MindMapModalsProviderProps> = ({
  children,
  ui,
  selectedNodeId,
  nodeOperations,
  fileOperations,
  uiOperations
}) => {
  const contextValue: MindMapModalsContextValue = {
    ui,
    selectedNodeId,
    nodeOperations,
    fileOperations,
    uiOperations
  };

  return (
    <MindMapModalsContext.Provider value={contextValue}>
      {children}
    </MindMapModalsContext.Provider>
  );
};

/**
 * コンテキストを使用するカスタムフック
 */
export const useMindMapModals = (): MindMapModalsContextValue => {
  const context = useContext(MindMapModalsContext);
  if (!context) {
    throw new Error('useMindMapModals must be used within a MindMapModalsProvider');
  }
  return context;
};

/**
 * 個別のフック（特定の操作だけ必要な場合）
 */
export const useNodeOperations = (): NodeOperations => {
  const { nodeOperations } = useMindMapModals();
  return nodeOperations;
};

export const useFileOperations = (): FileOperations => {
  const { fileOperations } = useMindMapModals();
  return fileOperations;
};

export const useUIOperations = (): UIOperations => {
  const { uiOperations } = useMindMapModals();
  return uiOperations;
};

export const useMindMapUI = (): MindMapUIState => {
  const { ui } = useMindMapModals();
  return ui;
};

export const useSelectedNode = (): MindMapNode | null => {
  const { selectedNodeId, nodeOperations } = useMindMapModals();
  return selectedNodeId ? nodeOperations.findNode(selectedNodeId) : null;
};