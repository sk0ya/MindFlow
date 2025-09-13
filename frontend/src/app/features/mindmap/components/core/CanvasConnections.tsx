import React, { memo } from 'react';
import Connection from '../../../../shared/components/ui/Connection';
import { calculateNodeSize, getToggleButtonPosition, getBranchColor, getNodeLeftX } from '../../../../shared/utils/nodeUtils';
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
  isFromRoot?: boolean;
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
  const { settings, normalizedData } = useMindMapStore();
  const connections: ConnectionData[] = [];
  
  allNodes.forEach(node => {
    if (node.children && node.children.length > 0) {
      const isRootNode = node.id === 'root';
      
      if (!node.collapsed) {
        if (isRootNode) {
          // ルートノードの場合は直接接続（ルートノードの右端から子ノードの左端へ）
          node.children.forEach((child: MindMapNode) => {
            const color = normalizedData ? getBranchColor(child.id, normalizedData) : (child.color || '#666');
            const childSize = calculateNodeSize(child, undefined, false, settings.fontSize);
            const rootCenter = node.x; // ノードの中央
            const childLeftX = getNodeLeftX(child, childSize.width);
            connections.push({ 
              from: { x: rootCenter, y: node.y }, 
              to: { x: childLeftX, y: child.y }, 
              hasToggleButton: false,
              color: color,
              isFromRoot: true
            });
          });
        } else {
          // 非ルートノードの場合はトグルボタン経由
          const nodeSize = calculateNodeSize(node, undefined, false, settings.fontSize);
          const togglePosition = getToggleButtonPosition(node, data.rootNode, nodeSize, settings.fontSize);
          const toggleX = togglePosition.x;
          const toggleY = togglePosition.y;
          
          // 親からトグルボタンへの接続線（親ノードの右端からトグルボタンの中心へ）
          const parentColor = normalizedData ? getBranchColor(node.id, normalizedData) : (node.color || '#666');
          const parentLeftX = getNodeLeftX(node, nodeSize.width);
          const parentRightEdge = parentLeftX + nodeSize.width; // ノードの右端
          connections.push({
            from: { x: parentRightEdge, y: node.y },
            to: { x: toggleX, y: toggleY },
            hasToggleButton: false,
            color: parentColor
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
            const childColor = normalizedData ? getBranchColor(child.id, normalizedData) : (child.color || '#666');
            const childSize = calculateNodeSize(child, undefined, false, settings.fontSize);
            const childLeftX = getNodeLeftX(child, childSize.width);
            
            connections.push({
              from: { x: toggleX, y: toggleY },
              to: { x: childLeftX, y: child.y },
              hasToggleButton: false,
              color: childColor
            });
          });
        }
      } else {
        // 折りたたまれている場合
        const nodeSize = calculateNodeSize(node, undefined, false, settings.fontSize);
        const togglePosition = getToggleButtonPosition(node, data.rootNode, nodeSize, settings.fontSize);
        const toggleX = togglePosition.x;
        const toggleY = togglePosition.y;
        
        // 親からトグルボタンへの接続線（親ノードの右端からトグルボタンの中心へ）
        const collapsedColor = normalizedData ? getBranchColor(node.id, normalizedData) : (node.color || '#666');
        const parentLeftX = getNodeLeftX(node, nodeSize.width);
        const parentRightEdge = parentLeftX + nodeSize.width; // ノードの右端
        connections.push({
          from: { x: parentRightEdge, y: node.y },
          to: { x: toggleX, y: toggleY },
          hasToggleButton: false,
          color: collapsedColor
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
            color={conn.color}
            isFromRoot={conn.isFromRoot}
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