import React, { memo } from 'react';
import Toolbar from '../../../../shared/components/ui/Toolbar';
import type { MindMapData } from '@shared/types';

interface MindMapHeaderProps {
  data: MindMapData;
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
  storageMode?: 'local' | 'cloud';
  onStorageModeChange?: (mode: 'local' | 'cloud') => void;
}

const MindMapHeader: React.FC<MindMapHeaderProps> = ({
  data,
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
    <Toolbar
      title={data.title}
      onTitleChange={onTitleChange}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      zoom={zoom}
      onZoomReset={onZoomReset}
      onShowShortcutHelper={onShowShortcutHelper}
      onAutoLayout={onAutoLayout}
      onToggleSidebar={onToggleSidebar}
      showSidebar={showSidebar}
      storageMode={storageMode}
      onStorageModeChange={onStorageModeChange}
    />
  );
};

export default memo(MindMapHeader);