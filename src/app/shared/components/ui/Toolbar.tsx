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
  storageMode?: 'local' | 'cloud';
  onStorageModeChange?: (mode: 'local' | 'cloud') => void;
  onToggleNotesPanel?: () => void;
  showNotesPanel?: boolean;
  onExport?: () => void;
  onImport?: () => void;
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
  storageMode = 'local',
  onStorageModeChange,
  onToggleNotesPanel,
  showNotesPanel = false,
  onExport,
  onImport
}) => {
  return (
    <div className="toolbar">
      <ToolbarLogo />
      
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
        onToggleNotesPanel={onToggleNotesPanel}
        showNotesPanel={showNotesPanel}
        onExport={onExport}
        onImport={onImport}
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