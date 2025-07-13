import React from 'react';
import { MindMapNode } from '../../../types';

interface MenuHeaderProps {
  selectedNode: MindMapNode;
}

const MenuHeader: React.FC<MenuHeaderProps> = ({ selectedNode }) => {
  return (
    <div className="menu-header">
      <span className="node-title">"{selectedNode.text}"</span>
    </div>
  );
};

export default MenuHeader;
