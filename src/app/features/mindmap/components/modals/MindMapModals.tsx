import React, { memo, useState } from 'react';
import { ContextMenu } from '../../../../shared';
import NodeCustomizationPanel from '../panels/NodeCustomizationPanel';
import { ImageModal, FileActionMenu } from '../../../files';
import AIGenerationModal from './AIGenerationModal';
import type { MindMapNode, FileAttachment } from '../../../../shared';

interface MindMapModalsProps {
  ui: {
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
  };
  selectedNodeId: string | null;
  findNode: (nodeId: string) => MindMapNode | null;
  onAddChild: (parentId: string) => void;
  onAddSibling: (nodeId: string) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onCopyNode: (node: MindMapNode) => void;
  onPasteNode: (parentId: string) => void;
  onShowCustomization: (node: MindMapNode) => void;
  onFileDownload: (file: FileAttachment) => void;
  onFileRename: (fileId: string, newName: string) => void;
  onFileDelete: (fileId: string) => void;
  onCloseCustomizationPanel: () => void;
  onCloseContextMenu: () => void;
  onCloseImageModal: () => void;
  onCloseFileActionMenu: () => void;
  onShowImageModal: (file: FileAttachment) => void;
}

const MindMapModals: React.FC<MindMapModalsProps> = ({
  ui,
  selectedNodeId,
  findNode,
  onAddChild,
  onAddSibling,
  onDeleteNode,
  onUpdateNode,
  onCopyNode,
  onPasteNode,
  onShowCustomization,
  onFileDownload,
  onFileRename,
  onFileDelete,
  onCloseCustomizationPanel,
  onCloseContextMenu,
  onCloseImageModal,
  onCloseFileActionMenu,
  onShowImageModal
}) => {
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTargetNode, setAiTargetNode] = useState<MindMapNode | null>(null);
  
  const handleAIGenerate = (node: MindMapNode) => {
    setAiTargetNode(node);
    setShowAIModal(true);
  };
  
  const handleAIGenerationComplete = (childTexts: string[]) => {
    if (aiTargetNode) {
      // 複数の子ノードを順番に作成
      childTexts.forEach((text, index) => {
        setTimeout(() => {
          // 子ノードを追加
          onAddChild(aiTargetNode.id);
          
          // 短い遅延の後にテキストを設定
          setTimeout(() => {
            const updatedParent = findNode(aiTargetNode.id);
            if (updatedParent && updatedParent.children) {
              // 新しく追加されたノードを見つける
              const newChild = updatedParent.children[updatedParent.children.length - 1];
              if (newChild && newChild.text === 'New Node') { // デフォルトテキストの場合
                onUpdateNode(newChild.id, { text });
              }
            }
          }, 50);
        }, index * 100); // 各ノード作成を100ms間隔で実行
      });
    }
    setShowAIModal(false);
    setAiTargetNode(null);
  };
  
  return (
    <>
      {ui.showCustomizationPanel && (
        <NodeCustomizationPanel
          selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
          onUpdateNode={onUpdateNode}
          onClose={onCloseCustomizationPanel}
          position={ui.customizationPosition}
        />
      )}

      {ui.showContextMenu && (
        <ContextMenu
          visible={true}
          position={ui.contextMenuPosition}
          selectedNode={selectedNodeId ? findNode(selectedNodeId) : null}
          onAddChild={onAddChild}
          onAddSibling={onAddSibling}
          onDelete={onDeleteNode}
          onCustomize={onShowCustomization}
          onCopy={onCopyNode}
          onPaste={onPasteNode}
          onChangeColor={(nodeId: string, color: string) => onUpdateNode(nodeId, { color })}
          onAIGenerate={handleAIGenerate}
          onClose={onCloseContextMenu}
        />
      )}

      <ImageModal
        isOpen={ui.showImageModal}
        image={ui.selectedImage}
        onClose={onCloseImageModal}
      />

      <FileActionMenu
        isOpen={ui.showFileActionMenu}
        file={ui.selectedFile}
        position={ui.fileMenuPosition}
        onClose={onCloseFileActionMenu}
        onDownload={onFileDownload}
        onRename={onFileRename}
        onDelete={onFileDelete}
        onView={(file: FileAttachment) => {
          onShowImageModal(file);
        }}
      />
      
      <AIGenerationModal
        isOpen={showAIModal}
        parentNode={aiTargetNode}
        contextNodes={[]} // コンテキストノードの取得ロジックは後で実装
        onClose={() => {
          setShowAIModal(false);
          setAiTargetNode(null);
        }}
        onGenerationComplete={handleAIGenerationComplete}
      />

    </>
  );
};

export default memo(MindMapModals);