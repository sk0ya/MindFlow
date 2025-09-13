import React from 'react';

interface NodeCustomizations {
  fontSize: string;
  fontWeight: string;
  fontStyle: string;
}

interface NodeFontPanelProps {
  customizations: NodeCustomizations;
  onCustomizationChange: (property: keyof NodeCustomizations, value: string) => void;
}

const NodeFontPanel: React.FC<NodeFontPanelProps> = React.memo(({
  customizations,
  onCustomizationChange
}) => {
  return (
    <div className="section">
      <label>フォント</label>
      <div className="font-controls">
        <select
          value={customizations.fontSize}
          onChange={(e) => onCustomizationChange('fontSize', e.target.value)}
          className="font-size-select"
        >
          <option value="12px">小 (12px)</option>
          <option value="14px">標準 (14px)</option>
          <option value="16px">大 (16px)</option>
          <option value="18px">特大 (18px)</option>
          <option value="20px">最大 (20px)</option>
        </select>

        <div className="font-style-buttons">
          <button
            className={`style-btn ${customizations.fontWeight === 'bold' ? 'active' : ''}`}
            onClick={() => onCustomizationChange('fontWeight', 
              customizations.fontWeight === 'bold' ? 'normal' : 'bold'
            )}
            title="太字"
          >
            <strong>B</strong>
          </button>
          <button
            className={`style-btn ${customizations.fontStyle === 'italic' ? 'active' : ''}`}
            onClick={() => onCustomizationChange('fontStyle', 
              customizations.fontStyle === 'italic' ? 'normal' : 'italic'
            )}
            title="斜体"
          >
            <em>I</em>
          </button>
        </div>
      </div>
    </div>
  );
});

NodeFontPanel.displayName = 'NodeFontPanel';

export default NodeFontPanel;