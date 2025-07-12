import React, { memo } from 'react';
import type { MapLink } from '../../types';

interface MapLinkItemProps {
  link: MapLink;
  onRemoveLink: (linkId: string) => void;
  onNavigateToMap: (mapId: string) => void;
}

export const MapLinkItem: React.FC<MapLinkItemProps> = memo(({
  link,
  onRemoveLink,
  onNavigateToMap
}) => {
  const handleNavigate = () => {
    onNavigateToMap(link.targetMapId);
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemoveLink(link.id);
  };

  return (
    <div className="map-link-item" onClick={handleNavigate}>
      <div className="link-header">
        <div className="link-title">
          <strong>{link.targetMapTitle}</strong>
          <span className="link-icon">→</span>
        </div>
        <button
          className="remove-button"
          onClick={handleRemove}
          title="リンクを削除"
          type="button"
        >
          ×
        </button>
      </div>
      
      {link.description && (
        <div className="link-description">
          {link.description}
        </div>
      )}
      
      <div className="link-meta">
        <small>
          作成日: {new Date(link.createdAt).toLocaleDateString('ja-JP')}
        </small>
      </div>
    </div>
  );
});