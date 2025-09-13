import React from 'react';
import { useTheme } from '../../hooks/useTheme';

interface Position {
  x: number;
  y: number;
}

interface ConnectionProps {
  from: Position;
  to: Position;
  hasToggleButton?: boolean;
  onToggleCollapse: (nodeId: string) => void;
  nodeId: string;
  isCollapsed?: boolean;
  isToggleConnection?: boolean;
  color?: string;
  isFromRoot?: boolean;
}

const Connection: React.FC<ConnectionProps> = ({ 
  from, 
  to, 
  hasToggleButton = false, 
  onToggleCollapse, 
  nodeId, 
  isCollapsed = false, 
  // isToggleConnection = false,  // Unused parameter
  color = '#666',
  isFromRoot = false
}) => {
  const { theme } = useTheme();
  
  // テーマに応じたトグルボタンの配色
  const getToggleColors = () => {
    if (theme === 'dark') {
      // ダークテーマ: アクセント付きグレー
      return {
        expandedFill: '#2d3748',
        expandedStroke: '#4299e1',
        collapsedFill: '#4a5568', 
        collapsedStroke: '#ed8936'
      };
    } else {
      // ライトテーマ: 従来の緑・黄色
      return {
        expandedFill: '#34a853',
        expandedStroke: 'white',
        collapsedFill: '#ff9800',
        collapsedStroke: 'white'
      };
    }
  };
  
  const toggleColors = getToggleColors();
  const createPath = (from: Position, to: Position): string => {
    if (hasToggleButton && from.x === to.x && from.y === to.y) {
      return '';
    }
    
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < 10) {
      return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    }
    
    // プロップスで渡されたルートノード判定を使用
    
    // 方向に応じて制御点を調整
    let controlX1, controlY1, controlX2, controlY2;
    
    if (Math.abs(dy) < 10) {
      // 純粋に水平方向の場合：右端から水平に進む
      controlX1 = from.x + Math.abs(dx) * 0.6;
      controlY1 = from.y;
      controlX2 = to.x - Math.abs(dx) * 0.6;
      controlY2 = to.y;
    } else if (isFromRoot) {
      // ルートノードからの接続線：子ノードの方向に応じて曲がる
      controlX1 = from.x + Math.abs(dx) * 0.3;
      if (dy > 0) {
        // 子ノードが下にある場合：下向きに曲がる
        controlY1 = from.y + Math.min(40, Math.abs(dy) * 0.4);
      } else {
        // 子ノードが上にある場合：上向きに曲がる
        controlY1 = from.y - Math.min(40, Math.abs(dy) * 0.4);
      }
      controlX2 = to.x - Math.abs(dx) * 0.6;
      controlY2 = to.y;
    } else if (dy > 0) {
      // 下向きの場合：まず下に向かう（目標地点より下には行かない）
      const downwardOffset = Math.min(30, Math.abs(dy) * 0.3 + 15);
      controlX1 = from.x;
      controlY1 = Math.max(from.y + downwardOffset, to.y); // 目標地点より下には行かない
      controlX2 = to.x - Math.abs(dx) * 0.4;
      controlY2 = to.y;
    } else {
      // 上向きの場合：まず上に向かう（目標地点より上には行かない）
      const upwardOffset = Math.min(30, Math.abs(dy) * 0.3 + 15);
      controlX1 = from.x;
      controlY1 = Math.min(from.y - upwardOffset, to.y);
      controlX2 = to.x - Math.abs(dx) * 0.4;
      controlY2 = to.y;
    }
    
    return `M ${from.x} ${from.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${to.x} ${to.y}`;
  };

  const path = createPath(from, to);

  return (
    <g>
      {path && (
        <path
          d={path}
          stroke={color}
          strokeWidth="3"
          fill="none"
          opacity="0.8"
          strokeDasharray="none"
        />
      )}
      
      {hasToggleButton && (
        <>
          <circle
            cx={to.x}
            cy={to.y}
            r="8"
            fill={isCollapsed ? toggleColors.collapsedFill : toggleColors.expandedFill}
            stroke={isCollapsed ? toggleColors.collapsedStroke : toggleColors.expandedStroke}
            strokeWidth="2"
            style={{ 
              cursor: 'pointer',
              filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.2))'
            }}
            onClick={(e) => {
              e.stopPropagation();
              onToggleCollapse(nodeId);
            }}
          />
          <text
            x={to.x}
            y={to.y + 3}
            textAnchor="middle"
            fill="white"
            fontSize="11"
            fontWeight="bold"
            style={{ pointerEvents: 'none' }}
          >
            {isCollapsed ? '+' : '−'}
          </text>
        </>
      )}
    </g>
  );
};

export default Connection;
