// Cloud mode basic types

export interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: MindMapNode[];
  fontSize?: number;
  fontWeight?: string;
  collapsed?: boolean;
  color?: string;
}

export interface MindMapData {
  id: string;
  title: string;
  rootNode: MindMapNode;
  createdAt: string;
  updatedAt: string;
  settings: {
    autoSave: boolean;
    autoLayout: boolean;
  };
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}