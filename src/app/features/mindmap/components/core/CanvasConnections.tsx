import React, { memo } from 'react';
import Connection from '../../../../shared/components/ui/Connection';
import { calculateNodeSize, getToggleButtonPosition, getBranchColor } from '../../../../shared/utils/nodeUtils';
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
            // const rootSize = calculateNodeSize(node, undefined, false, settings.fontSize); // Unused variable
            const rootCenter = node.x; // ノードの中央
            const childLeftEdge = child.x - childSize.width / 2;
            connections.push({ 
              from: { x: rootCenter, y: node.y }, 
              to: { x: childLeftEdge, y: child.y }, 
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
          
          // 親からトグルボタンへの接続線（親ノードの右端からトグルボタンの左端へ）
          const parentColor = normalizedData ? getBranchColor(node.id, normalizedData) : (node.color || '#666');
          const parentRightEdge = node.x + nodeSize.width / 2; // ノードの右端
          const toggleLeftEdge = toggleX - 8; // トグルボタンの半径分左にずらす
          connections.push({
            from: { x: parentRightEdge, y: node.y },
            to: { x: toggleLeftEdge, y: toggleY },
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
            const childLeftEdge = child.x - childSize.width / 2;
            
            // 子ノードへの方向を判定
            const dy = child.y - toggleY;
            let toggleConnectionX, toggleConnectionY;
            
            if (Math.abs(dy) < 10) {
              // 水平方向：トグルボタンの右端から
              toggleConnectionX = toggleX + 8;
              toggleConnectionY = toggleY;
            } else {
              // 上下方向：角度ベースで円周上の点を計算
              const dx = childLeftEdge - toggleX;
              const angle = Math.atan2(dy, dx);
              toggleConnectionX = toggleX + Math.cos(angle) * 8;
              toggleConnectionY = toggleY + Math.sin(angle) * 8;
            }
            
            connections.push({
              from: { x: toggleConnectionX, y: toggleConnectionY },
              to: { x: childLeftEdge, y: child.y },
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
        
        // 親からトグルボタンへの接続線（親ノードの右端からトグルボタンの左端へ）
        const collapsedColor = normalizedData ? getBranchColor(node.id, normalizedData) : (node.color || '#666');
        const parentRightEdge = node.x + nodeSize.width / 2; // ノードの右端
        const toggleLeftEdge = toggleX - 8; // トグルボタンの半径分左にずらす
        connections.push({
          from: { x: parentRightEdge, y: node.y },
          to: { x: toggleLeftEdge, y: toggleY },
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