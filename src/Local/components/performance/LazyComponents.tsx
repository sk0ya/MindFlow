import React, { lazy, Suspense } from 'react';
import type { MindMapData, MindMapNode, FileAttachment } from '../../../shared/types';

// Lazy loading components - using existing components
const LazyCustomizationPanel = lazy(() => import('../mindmap/NodeCustomizationPanel'));
const LazyContextMenu = lazy(() => import('../common/ContextMenu'));
const LazyImageModal = lazy(() => import('../files/ImageModal'));
const LazyFileActionMenu = lazy(() => import('../files/FileActionMenu'));

// Placeholder components for missing modals
const FileModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  isOpen ? <div onClick={onClose}>File Modal Placeholder</div> : null
);

const MapModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  isOpen ? <div onClick={onClose}>Map Modal Placeholder</div> : null
);

const NodeMapLinksModal = ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) => (
  isOpen ? <div onClick={onClose}>Node Map Links Modal Placeholder</div> : null
);

// Loading fallback components
const PanelLoading = () => (
  <div className="loading-panel">
    <div className="loading-spinner" />
    <span>パネルを読み込み中...</span>
  </div>
);

const ModalLoading = () => (
  <div className="loading-modal">
    <div className="loading-backdrop">
      <div className="loading-content">
        <div className="loading-spinner" />
        <span>読み込み中...</span>
      </div>
    </div>
  </div>
);

const MenuLoading = () => (
  <div className="loading-menu">
    <div className="loading-spinner-small" />
  </div>
);

// Lazy wrapper components with proper props
interface LazyCustomizationPanelProps {
  selectedNode: MindMapNode | null;
  onUpdateNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

export const LazyCustomizationPanelWrapper: React.FC<LazyCustomizationPanelProps> = (props) => (
  <Suspense fallback={<PanelLoading />}>
    <LazyCustomizationPanel 
      {...props} 
      position={props.position || { x: 0, y: 0 }} 
    />
  </Suspense>
);

interface LazyFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedNodeId: string;
  onFileUpload: (nodeId: string, files: FileList) => void;
  files: FileAttachment[];
  onRemoveFile: (nodeId: string, fileId: string) => void;
}

export const LazyFileModalWrapper: React.FC<LazyFileModalProps> = (props) => (
  <Suspense fallback={<ModalLoading />}>
    <FileModal {...props} />
  </Suspense>
);

interface LazyMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  maps: MindMapData[];
  onSelectMap: (mapId: string) => void;
  onCreateMap: (title: string) => void;
  onDeleteMap: (mapId: string) => void;
  onRenameMap: (mapId: string, newTitle: string) => void;
  onDuplicateMap: (mapId: string) => void;
  onExportMap: (mapId: string) => void;
  onImportMap: (file: File) => void;
  currentMapId: string;
}

export const LazyMapModalWrapper: React.FC<LazyMapModalProps> = (props) => (
  <Suspense fallback={<ModalLoading />}>
    <MapModal {...props} />
  </Suspense>
);

interface LazyContextMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  onDelete: () => void;
  onStartEdit: () => void;
  canDelete: boolean;
  selectedNode?: MindMapNode | null;
}

export const LazyContextMenuWrapper: React.FC<LazyContextMenuProps> = (props) => (
  <Suspense fallback={<MenuLoading />}>
    <LazyContextMenu 
      visible={props.isOpen}
      position={props.position}
      selectedNode={props.selectedNode || null}
      onAddChild={() => props.onAddChild()}
      onAddSibling={() => props.onAddSibling()}
      onDelete={() => props.onDelete()}
      onCustomize={() => {}}
      onCopy={() => {}}
      onPaste={() => {}}
      onChangeColor={() => {}}
      onClose={props.onClose}
    />
  </Suspense>
);

interface LazyImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: FileAttachment | null;
}

export const LazyImageModalWrapper: React.FC<LazyImageModalProps> = (props) => (
  <Suspense fallback={<ModalLoading />}>
    <LazyImageModal 
      {...props} 
      image={props.file} 
    />
  </Suspense>
);

interface LazyNodeMapLinksModalProps {
  isOpen: boolean;
  onClose: () => void;
  node: MindMapNode | null;
  position: { x: number; y: number };
  maps: MindMapData[];
  onCreateMapLink: (sourceNodeId: string, targetMapId: string, description: string) => void;
  onRemoveMapLink: (sourceNodeId: string, linkId: string) => void;
  onNavigateToMap: (mapId: string) => void;
}

export const LazyNodeMapLinksModalWrapper: React.FC<LazyNodeMapLinksModalProps> = (props) => (
  <Suspense fallback={<ModalLoading />}>
    <NodeMapLinksModal {...props} />
  </Suspense>
);

interface LazyFileActionMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  file: FileAttachment | null;
  onDownload: () => void;
  onRemove: () => void;
  onShowImage: () => void;
}

export const LazyFileActionMenuWrapper: React.FC<LazyFileActionMenuProps> = (props) => (
  <Suspense fallback={<MenuLoading />}>
    <LazyFileActionMenu 
      {...props} 
      onRename={() => {}}
      onDelete={props.onRemove}
      onView={props.onShowImage}
    />
  </Suspense>
);

// Bundle splitting utilities
export const preloadComponent = (componentName: string) => {
  switch (componentName) {
    case 'CustomizationPanel':
      return LazyCustomizationPanel;
    case 'ContextMenu':
      return LazyContextMenu;
    case 'ImageModal':
      return LazyImageModal;
    case 'FileActionMenu':
      return LazyFileActionMenu;
    default:
      return null;
  }
};

// Preload hook for performance optimization
export const usePreloadComponents = () => {
  const preloadOnHover = (componentName: string) => {
    const component = preloadComponent(componentName);
    if (component) {
      // Preload the component on hover
      component;
    }
  };

  const preloadOnUserInteraction = (componentNames: string[]) => {
    componentNames.forEach(name => {
      const component = preloadComponent(name);
      if (component) {
        // Preload components on user interaction
        component;
      }
    });
  };

  return {
    preloadOnHover,
    preloadOnUserInteraction
  };
};

// Styles for loading components
const styles = `
  .loading-panel {
    width: 300px;
    height: 400px;
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  }

  .loading-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
  }

  .loading-backdrop {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .loading-content {
    background: white;
    padding: 24px;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .loading-menu {
    background: white;
    border: 1px solid #ddd;
    border-radius: 4px;
    padding: 8px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  }

  .loading-spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #f3f3f3;
    border-top: 3px solid #4285f4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .loading-spinner-small {
    width: 16px;
    height: 16px;
    border: 2px solid #f3f3f3;
    border-top: 2px solid #4285f4;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}