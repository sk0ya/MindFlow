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
}

const Connection: React.FC<ConnectionProps> = ({ 
  from, 
  to, 
  hasToggleButton = false, 
  onToggleCollapse, 
  nodeId, 
  isCollapsed = false, 
  isToggleConnection = false, 
  color = '#666' 
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
    
    const controlDistance = Math.min(distance * 0.5, 100);
    
    const angle = Math.atan2(dy, dx);
    const controlX1 = from.x + Math.cos(angle) * controlDistance;
    const controlY1 = from.y;
    const controlX2 = to.x - Math.cos(angle) * controlDistance;
    const controlY2 = to.y;
    
    return `M ${from.x} ${from.y} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${to.x} ${to.y}`;
  };

  const path = createPath(from, to);

  return (
    <g>
      {path && (
        <path
          d={path}
          stroke={isToggleConnection ? "#999" : color}
          strokeWidth={isToggleConnection ? "2" : "3"}
          fill="none"
          opacity={isToggleConnection ? "0.5" : "0.8"}
          strokeDasharray={isToggleConnection ? "5,5" : "none"}
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
