import React, { memo, useState } from 'react';
import { ContextMenu } from '../../../../shared';
import NodeCustomizationPanel from '../panels/NodeCustomizationPanel';
import { ImageModal, FileActionMenu } from '../../../files';
import AIGenerationModal from './AIGenerationModal';
import {
  MindMapModalsProvider,
  useMindMapModals,
  useSelectedNode,
  useNodeOperations,
  useFileOperations,
  useUIOperations,
  useMindMapUI,
  type MindMapModalsProviderProps
} from './MindMapModalsContext';
import type { MindMapNode } from '../../../../shared';

/**
 * AI生成モーダル管理フック
 */
const useAIModal = () => {
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiTargetNode, setAiTargetNode] = useState<MindMapNode | null>(null);
  
  const handleAIGenerate = (node: MindMapNode) => {
    setAiTargetNode(node);
    setShowAIModal(true);
  };
  
  const handleAIGenerationComplete = (childTexts: string[]) => {
    const { nodeOperations } = useMindMapModals();
    
    if (aiTargetNode) {
      // 複数の子ノードを順番に作成
      childTexts.forEach((text, index) => {
        setTimeout(() => {
          // 子ノードを追加して新しいノードIDを取得
          const newNodeId = nodeOperations.onAddChild(aiTargetNode.id, text);
          
          // 追加ログを出力（デバッグ用）
          if (newNodeId) {
            console.log('AI生成された子ノードを追加:', {
              parentId: aiTargetNode.id,
              childId: newNodeId,
              text: text
            });
          } else {
            console.warn('AI子ノード追加に失敗:', {
              parentId: aiTargetNode.id,
              text: text
            });
          }
        }, index * 100); // 各ノード作成を100ms間隔で実行
      });
    }
    setShowAIModal(false);
    setAiTargetNode(null);
  };
  
  const closeAIModal = () => {
    setShowAIModal(false);
    setAiTargetNode(null);
  };
  
  return {
    showAIModal,
    aiTargetNode,
    handleAIGenerate,
    handleAIGenerationComplete,
    closeAIModal
  };
};

/**
 * カスタマイゼーションパネルコンポーネント
 */
const CustomizationPanelModal: React.FC = () => {
  const ui = useMindMapUI();
  const selectedNode = useSelectedNode();
  const { onUpdateNode } = useNodeOperations();
  const { onCloseCustomizationPanel } = useUIOperations();

  if (!ui.showCustomizationPanel) return null;

  return (
    <NodeCustomizationPanel
      selectedNode={selectedNode}
      onUpdateNode={onUpdateNode}
      onClose={onCloseCustomizationPanel}
      position={ui.customizationPosition}
    />
  );
};

/**
 * コンテキストメニューコンポーネント
 */
const ContextMenuModal: React.FC<{ onAIGenerate: (node: MindMapNode) => void }> = ({ onAIGenerate }) => {
  const ui = useMindMapUI();
  const selectedNode = useSelectedNode();
  const { onDeleteNode, onShowCustomization, onCopyNode, onPasteNode } = useNodeOperations();
  const { onCloseContextMenu } = useUIOperations();

  if (!ui.showContextMenu) return null;

  return (
    <ContextMenu
      visible={true}
      position={ui.contextMenuPosition}
      selectedNode={selectedNode}
      onDelete={onDeleteNode}
      onCustomize={onShowCustomization}
      onCopy={onCopyNode}
      onPaste={onPasteNode}
      onAIGenerate={onAIGenerate}
      onClose={onCloseContextMenu}
    />
  );
};

/**
 * 画像モーダルコンポーネント
 */
const ImageModalComponent: React.FC = () => {
  const ui = useMindMapUI();
  const { onCloseImageModal } = useUIOperations();

  return (
    <ImageModal
      isOpen={ui.showImageModal}
      image={ui.selectedImage}
      onClose={onCloseImageModal}
    />
  );
};

/**
 * ファイルアクションメニューコンポーネント
 */
const FileActionMenuComponent: React.FC = () => {
  const ui = useMindMapUI();
  const { onFileDownload, onFileRename, onFileDelete, onShowImageModal } = useFileOperations();
  const { onCloseFileActionMenu } = useUIOperations();

  return (
    <FileActionMenu
      isOpen={ui.showFileActionMenu}
      file={ui.selectedFile}
      position={ui.fileMenuPosition}
      onClose={onCloseFileActionMenu}
      onDownload={onFileDownload}
      onRename={onFileRename}
      onDelete={onFileDelete}
      onView={onShowImageModal}
    />
  );
};

/**
 * AI生成モーダルコンポーネント
 */
const AIGenerationModalComponent: React.FC<{ 
  showAIModal: boolean;
  aiTargetNode: MindMapNode | null;
  onGenerationComplete: (childTexts: string[]) => void;
  onClose: () => void;
}> = ({ showAIModal, aiTargetNode, onGenerationComplete, onClose }) => {
  return (
    <AIGenerationModal
      isOpen={showAIModal}
      parentNode={aiTargetNode}
      contextNodes={[]} // コンテキストノードの取得ロジックは後で実装
      onClose={onClose}
      onGenerationComplete={onGenerationComplete}
    />
  );
};

/**
 * メインのモーダル管理コンポーネント（内部実装）
 */
const MindMapModalsInternal: React.FC = () => {
  const {
    showAIModal,
    aiTargetNode,
    handleAIGenerate,
    handleAIGenerationComplete,
    closeAIModal
  } = useAIModal();

  return (
    <>
      <CustomizationPanelModal />
      <ContextMenuModal onAIGenerate={handleAIGenerate} />
      <ImageModalComponent />
      <FileActionMenuComponent />
      <AIGenerationModalComponent
        showAIModal={showAIModal}
        aiTargetNode={aiTargetNode}
        onGenerationComplete={handleAIGenerationComplete}
        onClose={closeAIModal}
      />
    </>
  );
};

/**
 * リファクタリング後のMindMapModalsコンポーネント
 * プロバイダーパターンを使用して複雑なpropsを整理
 */
const MindMapModals: React.FC<Omit<MindMapModalsProviderProps, 'children'>> = (props) => {
  return (
    <MindMapModalsProvider {...props}>
      <MindMapModalsInternal />
    </MindMapModalsProvider>
  );
};

export default memo(MindMapModals);