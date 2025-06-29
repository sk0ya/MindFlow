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

export interface Node {
  id: string;
  text: string;
  x: number;
  y: number;
  children: Node[];
  collapsed?: boolean;
  color?: string;
  fontSize?: number;
}

export interface MindMapData {
  id: string;
  title: string;
  rootNode: Node;
  updatedAt: string;
  category?: string;
}

export type StorageMode = 'local' | 'cloud';