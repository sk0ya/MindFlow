// Extended types that inherit from shared types but add cloud-specific features
import type { Node as SharedNode, FileAttachment as SharedFileAttachment, MapLink as SharedMapLink, MindMapData as SharedMindMapData } from '../../../shared/types/app.js';

// Extended Node type for cloud storage with additional features
export interface ExtendedMindMapNode extends SharedNode {
  // Cloud-specific extensions can be added here in the future
  lastModified?: string;
  syncStatus?: 'synced' | 'pending' | 'conflict';
}

// Extended MindMapData type for cloud storage
export interface ExtendedMindMapData extends SharedMindMapData {
  rootNode: ExtendedMindMapNode;
  // Cloud-specific extensions
  lastSyncedAt?: string;
  collaborators?: string[];
  version?: number;
}

// Type compatibility helpers
export function toSharedNode(node: ExtendedMindMapNode): SharedNode {
  const { lastModified, syncStatus, ...sharedProps } = node;
  return sharedProps;
}

export function toExtendedNode(node: SharedNode): ExtendedMindMapNode {
  return {
    ...node,
    lastModified: new Date().toISOString(),
    syncStatus: 'synced'
  };
}

export function toSharedMindMapData(data: ExtendedMindMapData): SharedMindMapData {
  const { lastSyncedAt, collaborators, version, ...sharedProps } = data;
  return {
    ...sharedProps,
    rootNode: toSharedNode(data.rootNode)
  };
}

export function toExtendedMindMapData(data: SharedMindMapData): ExtendedMindMapData {
  return {
    ...data,
    rootNode: toExtendedNode(data.rootNode),
    lastSyncedAt: new Date().toISOString(),
    version: 1
  };
}