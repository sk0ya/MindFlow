import React, { memo } from 'react';
import ToolbarLogo from './toolbar/ToolbarLogo';
import TitleEditor from './toolbar/TitleEditor';
import ActionButtons from './toolbar/ActionButtons';
import StorageModeSwitch from './toolbar/StorageModeSwitch';
import ToolbarStyles from './toolbar/ToolbarStyles';

interface ToolbarProps {
  title: string;
  onTitleChange: (title: string) => void;
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onShowShortcutHelper: () => void;
  onAutoLayout?: () => void;
  onToggleSidebar?: () => void;
  showSidebar?: boolean;
  storageMode?: 'local' | 'cloud' | 'hybrid';
  onStorageModeChange?: (mode: 'local' | 'cloud' | 'hybrid') => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  title,
  onTitleChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onShowShortcutHelper,
  onAutoLayout,
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
        onUndo={onUndo}
        onRedo={onRedo}
        canUndo={canUndo}
        canRedo={canRedo}
        zoom={zoom}
        onZoomReset={onZoomReset}
        onShowShortcutHelper={onShowShortcutHelper}
        onAutoLayout={onAutoLayout}
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