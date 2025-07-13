import React, { memo } from 'react';
import ToolbarLogo from './toolbar/ToolbarLogo';
import TitleEditor from './toolbar/TitleEditor';
import ActionButtons from './toolbar/ActionButtons';
import StorageModeSwitch from './toolbar/StorageModeSwitch';
import ToolbarStyles from './toolbar/ToolbarStyles';

interface ToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onShowShortcutHelper: () => void;
  onShowLocalStoragePanel?: () => void;
  onAutoLayout?: () => void;
  isLocalMode?: boolean;
  onToggleSidebar?: () => void;
  showSidebar?: boolean;
  storageMode?: 'local' | 'cloud' | 'hybrid';
  onStorageModeChange?: (mode: 'local' | 'cloud' | 'hybrid') => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  title,
  onTitleChange,
  onExport,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onShowShortcutHelper,
  onShowLocalStoragePanel,
  onAutoLayout,
  isLocalMode = true,
  onToggleSidebar,
  showSidebar = true,
  storageMode = 'local',
  onStorageModeChange
}) => {
  return (
    <div className="toolbar">
      <ToolbarLogo 
        onToggleSidebar={onToggleSidebar}
        showSidebar={showSidebar}
      />
      
      <TitleEditor 
        title={title}
        onTitleChange={onTitleChange}
      />
      
      <ActionButtons
        onExport={onExport}
        onImport={onImport}
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomReset={onZoomReset}
        onShowShortcutHelper={onShowShortcutHelper}
        onShowLocalStoragePanel={onShowLocalStoragePanel}
        onAutoLayout={onAutoLayout}
        isLocalMode={isLocalMode}
      />

      {onStorageModeChange && (
        <StorageModeSwitch
          currentMode={storageMode}
          onModeChange={onStorageModeChange}
        />
      )}
      
      <ToolbarStyles />
    </div>
  );
};

export default memo(Toolbar);