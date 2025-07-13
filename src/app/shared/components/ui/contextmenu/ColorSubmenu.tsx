import React from 'react';

export interface ColorOption {
  color: string;
  label: string;
}

interface ColorSubmenuProps {
  colors: ColorOption[];
  onColorSelect: (color: string) => void;
}

const ColorSubmenu: React.FC<ColorSubmenuProps> = ({ colors, onColorSelect }) => {
  return (
    <div className="submenu">
      {colors.map((colorItem, index) => (
        <div
          key={index}
          className="submenu-item"
          onClick={() => onColorSelect(colorItem.color)}
        >
          <div 
            className="color-indicator" 
            style={{ backgroundColor: colorItem.color }}
          />
          <span>{colorItem.label}</span>
        </div>
      ))}
    </div>
  );
};

export default ColorSubmenu;
