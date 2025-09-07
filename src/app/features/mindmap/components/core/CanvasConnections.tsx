import React, { memo } from 'react';
import Connection from '../../../../shared/components/ui/Connection';
import { calculateNodeSize, getToggleButtonPosition } from '../../../../shared/utils/nodeUtils';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import type { MindMapNode, MindMapData } from '@shared/types';

interface ConnectionData {
  from: MindMapNode | { x: number; y: number };
  to: MindMapNode | { x: number; y: number };
  hasToggleButton: boolean;
  nodeId?: string;
  isCollapsed?: boolean;
  isToggleConnection?: boolean;
  color?: string;
}

interface CanvasConnectionsProps {
  allNodes: MindMapNode[];
  data: MindMapData;
  onToggleCollapse: (nodeId: string) => void;
}

const CanvasConnections: React.FC<CanvasConnectionsProps> = ({ 
  allNodes, 
  data, 
  onToggleCollapse 
}) => {
  const { settings } = useMindMapStore();
  const connections: ConnectionData[] = [];
  
  allNodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      const isRootNode = node.id === 'root';
      
      if (!node.collapsed) {
        if (isRootNode) {
          // ルートノードの場合は直接接続
          node.children.forEach((child: MindMapNode) => {
            connections.push({ 
              from: node, 
              to: child, 
              hasToggleButton: false,
              color: child.color || '#666'
            });
          });
        } else {
          // 非ルートノードの場合はトグルボタン経由
          const nodeSize = calculateNodeSize(node, undefined, false, settings.fontSize);
          const togglePosition = getToggleButtonPosition(node, data.rootNode, nodeSize, settings.fontSize);
          const toggleX = togglePosition.x;
          const toggleY = togglePosition.y;
          
          // 親からトグルボタンへの接続線
          connections.push({
            from: node,
            to: { x: toggleX, y: toggleY },
            hasToggleButton: false,
            isToggleConnection: true,
            color: node.color || '#666'
          });
          
          // トグルボタン自体
          connections.push({
            from: { x: toggleX, y: toggleY },
            to: { x: toggleX, y: toggleY },
            hasToggleButton: true,
            nodeId: node.id,
            isCollapsed: false
          });
          
          // トグルボタンから各子要素への線
          node.children.forEach((child: MindMapNode) => {
            connections.push({
              from: { x: toggleX, y: toggleY },
              to: child,
              hasToggleButton: false,
              color: node.color || '#666'
            });
          });
        }
      } else {
        // 折りたたまれている場合
        const nodeSize = calculateNodeSize(node, undefined, false, settings.fontSize);
        const togglePosition = getToggleButtonPosition(node, data.rootNode, nodeSize, settings.fontSize);
        const toggleX = togglePosition.x;
        const toggleY = togglePosition.y;
        
        // 親からトグルボタンへの接続線
        connections.push({
          from: node,
          to: { x: toggleX, y: toggleY },
          hasToggleButton: false,
          isToggleConnection: true,
          color: node.color || '#666'
        });
        
        // トグルボタン自体
        connections.push({ 
          from: { x: toggleX, y: toggleY },
          to: { x: toggleX, y: toggleY }, 
          hasToggleButton: true,
          nodeId: node.id,
          isCollapsed: true
        });
      }
    }
  });

  return (
    <>
      <g className="connection-lines">
        {connections.filter(conn => !conn.hasToggleButton).map((conn, index) => (
          <Connection
            key={`${'id' in conn.from ? conn.from.id : 'toggle'}-${'id' in conn.to ? conn.to.id : 'toggle'}-${index}`}
            from={conn.from}
            to={conn.to}
            hasToggleButton={false}
            onToggleCollapse={onToggleCollapse}
            nodeId={conn.nodeId || ''}
            isToggleConnection={conn.isToggleConnection}
            color={conn.color}
          />
        ))}
      </g>

      <g className="toggle-buttons">
        {connections.filter(conn => conn.hasToggleButton).map((conn, index) => (
          <Connection
            key={`toggle-${conn.nodeId}-${index}`}
            from={conn.from}
            to={conn.to}
            hasToggleButton={true}
            onToggleCollapse={onToggleCollapse}
            nodeId={conn.nodeId || ''}
            isCollapsed={conn.isCollapsed}
          />
        ))}
      </g>
    </>
  );
};

export default memo(CanvasConnections);