// Branded types for type safety
export type NodeId = string & { readonly __brand: unique symbol };
export type MapId = string & { readonly __brand: unique symbol };
export type FileId = string & { readonly __brand: unique symbol };

// Type guards for branded types
export const isNodeId = (value: string): value is NodeId => {
  return typeof value === 'string' && value.length > 0;
};

export const isMapId = (value: string): value is MapId => {
  return typeof value === 'string' && value.length > 0;
};

export const isFileId = (value: string): value is FileId => {
  return typeof value === 'string' && value.length > 0;
};

// Factory functions for branded types
export const createNodeId = (value: string): NodeId => {
  if (!isNodeId(value)) {
    throw new Error(`Invalid NodeId: ${value}`);
  }
  return value;
};

export const createMapId = (value: string): MapId => {
  if (!isMapId(value)) {
    throw new Error(`Invalid MapId: ${value}`);
  }
  return value;
};

export const createFileId = (value: string): FileId => {
  if (!isFileId(value)) {
    throw new Error(`Invalid FileId: ${value}`);
  }
  return value;
};