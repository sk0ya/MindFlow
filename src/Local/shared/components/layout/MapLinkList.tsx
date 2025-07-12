import React, { memo } from 'react';
import { MapLinkItem } from './MapLinkItem';
import type { MindMapNode, MapLink } from '../../types';

interface MapLinkListProps {
  selectedNode: MindMapNode | null;
  onRemoveLink: (nodeId: string, linkId: string) => void;
  onNavigateToMap: (mapId: string) => void;
}

export const MapLinkList: React.FC<MapLinkListProps> = memo(({
  selectedNode,
  onRemoveLink,
  onNavigateToMap
}) => {
  if (!selectedNode || !selectedNode.mapLinks || selectedNode.mapLinks.length === 0) {
    return (
      <div className="existing-links-section">
        <h4>既存のリンク</h4>
        <p className="no-links-message">このノードにはまだリンクがありません</p>
      </div>
    );
  }

  const handleRemoveLink = (linkId: string) => {
    onRemoveLink(selectedNode.id, linkId);
  };

  return (
    <div className="existing-links-section">
      <h4>既存のリンク ({selectedNode.mapLinks.length}件)</h4>
      <div className="links-container">
        {selectedNode.mapLinks.map((link: MapLink) => (
          <MapLinkItem
            key={link.id}
            link={link}
            onRemoveLink={handleRemoveLink}
            onNavigateToMap={onNavigateToMap}
          />
        ))}
      </div>
    </div>
  );
});