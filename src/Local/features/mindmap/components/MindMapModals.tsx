import React, { memo } from 'react';
import { ContextMenu, MapLinksPanel } from '@local/shared';
import NodeCustomizationPanel from './NodeCustomizationPanel';
import { ImageModal, FileActionMenu } from '../../files';
import type { MindMapNode, FileAttachment } from '@local/shared';

interface MindMapModalsProps {
  ui: {
    showCustomizationPanel: boolean;
    showContextMenu: boolean;
    showImageModal: boolean;
    showFileActionMenu: boolean;
    showNodeMapLinksPanel: boolean;
    contextMenuPosition: { x: number; y: number };
    customizationPosition: { x: number; y: number };
    fileMenuPosition: { x: number; y: number };
    nodeMapLinksPanelPosition: { x: number; y: number };
    selectedImage: FileAttachment | null;
    selectedFile: FileAttachment | null;
    selectedNodeForLinks: MindMapNode | null;
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
  onAddNodeMapLink: (nodeId: string, targetMapId: string) => void;
  onRemoveNodeMapLink: (nodeId: string, linkId: string) => void;
  onNavigateToMap: (mapId: string) => void;
  onCloseCustomizationPanel: () => void;
  onCloseContextMenu: () => void;
  onCloseImageModal: () => void;
  onCloseFileActionMenu: () => void;
  onCloseNodeMapLinksPanel: () => void;
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
  onAddNodeMapLink,
  onRemoveNodeMapLink,
  onNavigateToMap,
  onCloseCustomizationPanel,
  onCloseContextMenu,
  onCloseImageModal,
  onCloseFileActionMenu,
  onCloseNodeMapLinksPanel,
  onShowImageModal
}) => {
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

      {ui.selectedNodeForLinks && (
        <MapLinksPanel
          isOpen={ui.showNodeMapLinksPanel}
          position={ui.nodeMapLinksPanelPosition}
          selectedNode={ui.selectedNodeForLinks}
          currentMapId={''}
          allMaps={[]}
          onClose={onCloseNodeMapLinksPanel}
          onAddLink={onAddNodeMapLink}
          onRemoveLink={onRemoveNodeMapLink}
          onNavigateToMap={onNavigateToMap}
        />
      )}
    </>
  );
};

export default memo(MindMapModals);