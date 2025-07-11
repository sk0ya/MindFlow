import React, { memo } from 'react';
import Toolbar from '../common/Toolbar';
import type { MindMapData } from '../../../shared/types';

interface MindMapHeaderProps {
  data: MindMapData;
  onTitleChange: (title: string) => void;
  onExport: () => void;
  onImport: (file: File) => Promise<void>;
  onUndo: () => Promise<void>;
  onRedo: () => Promise<void>;
  canUndo: boolean;
  canRedo: boolean;
  zoom: number;
  onZoomReset: () => void;
  onShowLocalStoragePanel: () => void;
  onShowShortcutHelper: () => void;
}

const MindMapHeader: React.FC<MindMapHeaderProps> = ({
  data,
  onTitleChange,
  onExport,
  onImport,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  zoom,
  onZoomReset,
  onShowLocalStoragePanel,
  onShowShortcutHelper
}) => {
  return (
    <Toolbar
      title={data.title}
      onTitleChange={onTitleChange}
      onExport={onExport}
      onImport={onImport}
      onUndo={onUndo}
      onRedo={onRedo}
      canUndo={canUndo}
      canRedo={canRedo}
      zoom={zoom}
      onZoomReset={onZoomReset}
      onShowLocalStoragePanel={onShowLocalStoragePanel}
      onShowShortcutHelper={onShowShortcutHelper}
    />
  );
};

export default memo(MindMapHeader);