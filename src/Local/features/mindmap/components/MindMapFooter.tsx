import React, { memo } from 'react';
import type { MindMapData } from '@shared/types';

interface MindMapFooterProps {
  data: MindMapData;
}

const MindMapFooter: React.FC<MindMapFooterProps> = ({ data }) => {
  return (
    <footer className="footer">
      <div>
        <span className="footer-brand">© 2024 MindFlow</span>
        <span className="stats">
          ノード数: {data?.rootNode ? 'N/A' : 0} | 
          最終更新: {data?.updatedAt ? new Date(data.updatedAt).toLocaleString('ja-JP') : 'N/A'}
        </span>
      </div>
    </footer>
  );
};

export default memo(MindMapFooter);