import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Node as MindMapNode } from '../../Local/components/mindmap/Node';

describe('MindMapNode', () => {
  const mockProps = {
    node: {
      id: 'test-node',
      text: 'Test Node',
      x: 100,
      y: 100,
      children: []
    },
    isSelected: false,
    isEditing: false,
    onSelect: jest.fn(),
    onStartEdit: jest.fn(),
    onFinishEdit: jest.fn(),
    onAddChild: jest.fn(),
    onAddSibling: jest.fn(),
    onDelete: jest.fn(),
    onRightClick: jest.fn(),
    onFileUpload: jest.fn(),
    onRemoveFile: jest.fn(),
    onShowImageModal: jest.fn(),
    onShowFileActionMenu: jest.fn(),
    onShowNodeMapLinks: jest.fn(),
    editText: '',
    setEditText: jest.fn(),
    zoom: 1,
    pan: { x: 0, y: 0 },
    svgRef: { current: null }
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders node with correct text', () => {
    render(<MindMapNode {...mockProps} />);
    
    expect(screen.getByText('Test Node')).toBeInTheDocument();
  });

  test('calls onSelect when clicked', () => {
    render(<MindMapNode {...mockProps} />);
    
    const nodeElement = screen.getByText('Test Node');
    fireEvent.click(nodeElement);
    
    expect(mockProps.onSelect).toHaveBeenCalledWith('test-node');
  });

  test('calls onStartEdit when double-clicked', () => {
    render(<MindMapNode {...mockProps} />);
    
    const nodeElement = screen.getByText('Test Node');
    fireEvent.doubleClick(nodeElement);
    
    expect(mockProps.onStartEdit).toHaveBeenCalledWith('test-node');
  });

  test('shows input field when editing', () => {
    render(<MindMapNode {...mockProps} isEditing={true} />);
    
    const input = screen.getByDisplayValue('');
    expect(input).toBeInTheDocument();
  });

  test('calls onRightClick on right-click', () => {
    render(<MindMapNode {...mockProps} />);
    
    const nodeElement = screen.getByText('Test Node');
    fireEvent.contextMenu(nodeElement);
    
    expect(mockProps.onRightClick).toHaveBeenCalledWith(
      expect.any(Object),
      'test-node'
    );
  });

  test('handles node with custom styling', () => {
    const styledNode = {
      ...mockProps.node,
      color: '#ff0000',
      fontSize: 18,
      fontWeight: 'bold'
    };

    render(<MindMapNode {...mockProps} node={styledNode} />);
    
    const nodeElement = screen.getByText('Test Node');
    expect(nodeElement).toBeInTheDocument();
  });

  test('handles collapsed state', () => {
    const collapsedNode = {
      ...mockProps.node,
      collapsed: true,
      children: [
        {
          id: 'child1',
          text: 'Child 1',
          x: 200,
          y: 150,
          children: []
        }
      ]
    };

    render(<MindMapNode {...mockProps} node={collapsedNode} />);
    
    // Test that the node itself is still rendered
    expect(screen.getByText('Test Node')).toBeInTheDocument();
  });
});