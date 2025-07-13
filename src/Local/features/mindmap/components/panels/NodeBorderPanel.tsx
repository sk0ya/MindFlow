import React from 'react';

interface NodeCustomizations {
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
  borderStyle: string;
  borderWidth: string;
}

interface NodeBorderPanelProps {
  customizations: NodeCustomizations;
  onCustomizationChange: (property: keyof NodeCustomizations, value: string) => void;
}

const NodeBorderPanel: React.FC<NodeBorderPanelProps> = React.memo(({
  customizations,
  onCustomizationChange
}) => {
  return (
    <div className="section">
      <label>境界線</label>
      <div className="border-controls">
        <select
          value={customizations.borderStyle}
          onChange={(e) => onCustomizationChange('borderStyle', e.target.value)}
          className="border-style-select"
        >
          <option value="solid">実線</option>
          <option value="dashed">破線</option>
          <option value="dotted">点線</option>
          <option value="none">なし</option>
        </select>
        <select
          value={customizations.borderWidth}
          onChange={(e) => onCustomizationChange('borderWidth', e.target.value)}
          className="border-width-select"
        >
          <option value="1px">細 (1px)</option>
          <option value="2px">標準 (2px)</option>
          <option value="3px">太 (3px)</option>
          <option value="4px">極太 (4px)</option>
        </select>
      </div>
    </div>
  );
});

NodeBorderPanel.displayName = 'NodeBorderPanel';

export default NodeBorderPanel;