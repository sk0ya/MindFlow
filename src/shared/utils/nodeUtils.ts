/**
 * Node utility functions extracted from existing codebase logic
 * These functions provide safe, reusable operations on MindMapNode structures
 */

import type { MindMapNode, Position } from '../types/core';
import { LAYOUT_CONSTANTS, TYPOGRAPHY_CONSTANTS, DEFAULT_VALUES } from '../types/constants';

/**
 * Safely find a node by ID in the tree structure
 * Extracted from existing recursive search logic
 */
export const findNode = (nodeId: string, rootNode: MindMapNode): MindMapNode | null => {
  if (!rootNode || !nodeId) return null;
  
  if (rootNode.id === nodeId) {
    return rootNode;
  }
  
  if (rootNode.children) {
    for (const child of rootNode.children) {
      const found = findNode(nodeId, child);
      if (found) return found;
    }
  }
  
  return null;
};

/**
 * Find the parent of a specific node
 * Extracted from existing parent-finding logic
 */
export const findParentNode = (nodeId: string, rootNode: MindMapNode): MindMapNode | null => {
  if (!rootNode || !nodeId) return null;
  
  if (rootNode.children) {
    for (const child of rootNode.children) {
      if (child.id === nodeId) {
        return rootNode;
      }
      const found = findParentNode(nodeId, child);
      if (found) return found;
    }
  }
  
  return null;
};

/**
 * Get all descendant nodes of a given node
 * Extracted from existing traversal logic
 */
export const getAllDescendants = (node: MindMapNode): MindMapNode[] => {
  if (!node) return [];
  
  const descendants: MindMapNode[] = [];
  
  if (node.children) {
    for (const child of node.children) {
      descendants.push(child);
      descendants.push(...getAllDescendants(child));
    }
  }
  
  return descendants;
};

/**
 * Count total nodes in a tree
 * Useful for performance monitoring
 */
export const countNodes = (rootNode: MindMapNode): number => {
  if (!rootNode) return 0;
  
  let count = 1; // Count the root node
  
  if (rootNode.children) {
    for (const child of rootNode.children) {
      count += countNodes(child);
    }
  }
  
  return count;
};

/**
 * Calculate the depth of a specific node
 * Extracted from existing level calculation logic
 */
export const getNodeDepth = (nodeId: string, rootNode: MindMapNode, currentDepth = 0): number => {
  if (!rootNode || !nodeId) return -1;
  
  if (rootNode.id === nodeId) {
    return currentDepth;
  }
  
  if (rootNode.children) {
    for (const child of rootNode.children) {
      const depth = getNodeDepth(nodeId, child, currentDepth + 1);
      if (depth !== -1) return depth;
    }
  }
  
  return -1;
};

/**
 * Check if a node would create a circular reference
 * Extracted from existing validation logic
 */
export const wouldCreateCircularReference = (
  nodeId: string, 
  potentialParentId: string, 
  rootNode: MindMapNode
): boolean => {
  if (nodeId === potentialParentId) return true;
  
  const descendants = getAllDescendants(findNode(nodeId, rootNode) || { id: '', text: '', x: 0, y: 0, children: [] });
  return descendants.some(node => node.id === potentialParentId);
};

/**
 * Calculate distance between two positions
 * Extracted from existing collision detection logic
 */
export const calculateDistance = (pos1: Position, pos2: Position): number => {
  const dx = pos1.x - pos2.x;
  const dy = pos1.y - pos2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

/**
 * Check if two nodes would collide at given positions
 * Extracted from existing layout logic
 */
export const wouldNodesCollide = (
  pos1: Position, 
  pos2: Position, 
  minDistance = LAYOUT_CONSTANTS.MIN_NODE_DISTANCE
): boolean => {
  return calculateDistance(pos1, pos2) < minDistance;
};

/**
 * Create a new node with safe defaults
 * Extracted from existing node creation logic
 */
export const createNewNode = (
  id: string,
  text: string = DEFAULT_VALUES.NODE.TEXT,
  position: Position = { x: 0, y: 0 }
): MindMapNode => {
  return {
    id,
    text,
    x: position.x,
    y: position.y,
    children: [],
    fontSize: DEFAULT_VALUES.NODE.FONT_SIZE,
    fontWeight: DEFAULT_VALUES.NODE.FONT_WEIGHT,
    color: DEFAULT_VALUES.NODE.COLOR
  };
};

/**
 * Clone a node with all its properties
 * Extracted from existing copy logic
 */
export const cloneNode = (node: MindMapNode, generateNewIds = false): MindMapNode => {
  const newNode: MindMapNode = {
    ...node,
    id: generateNewIds ? `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` : node.id,
    children: node.children?.map(child => cloneNode(child, generateNewIds)) || []
  };
  
  return newNode;
};

/**
 * Validate node text according to application rules
 * Extracted from existing validation logic
 */
export const validateNodeText = (text: string): { isValid: boolean; error?: string } => {
  if (typeof text !== 'string') {
    return { isValid: false, error: 'Text must be a string' };
  }
  
  if (text.length > 500) {
    return { isValid: false, error: 'Text must be less than 500 characters' };
  }
  
  return { isValid: true };
};

/**
 * Calculate optimal font size based on text length
 * Extracted from existing auto-sizing logic
 */
export const calculateOptimalFontSize = (text: string, baseSize = TYPOGRAPHY_CONSTANTS.FONT_SIZES.MD): number => {
  if (!text) return baseSize;
  
  const length = text.length;
  
  if (length <= 10) return TYPOGRAPHY_CONSTANTS.FONT_SIZES.LG;
  if (length <= 20) return TYPOGRAPHY_CONSTANTS.FONT_SIZES.MD;
  if (length <= 50) return TYPOGRAPHY_CONSTANTS.FONT_SIZES.SM;
  
  return TYPOGRAPHY_CONSTANTS.FONT_SIZES.XS;
};

/**
 * Get siblings of a node (nodes with the same parent)
 * Extracted from existing sibling operations logic
 */
export const getSiblings = (nodeId: string, rootNode: MindMapNode): MindMapNode[] => {
  const parent = findParentNode(nodeId, rootNode);
  if (!parent) return [];
  
  return parent.children?.filter(child => child.id !== nodeId) || [];
};

/**
 * Get the index of a node among its siblings
 * Extracted from existing ordering logic
 */
export const getNodeIndex = (nodeId: string, rootNode: MindMapNode): number => {
  const parent = findParentNode(nodeId, rootNode);
  if (!parent) return -1;
  
  return parent.children?.findIndex(child => child.id === nodeId) || -1;
};