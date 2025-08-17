import React, { memo } from 'react';
import type { MindMapData } from '@shared/types';

interface MindMapFooterProps {
  data: MindMapData;
}

const MindMapFooter: React.FC<MindMapFooterProps> = ({ data: _data }) => {
  return (
    <footer className="footer">
    </footer>
  );
};

export default memo(MindMapFooter);