/**
 * Type definitions for test utilities and mock data
 */

// Mind Map data types for tests
export interface TestNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: TestNode[];
  attachments?: any[];
  mapLinks?: any[];
  fontSize?: number;
  fontWeight?: string;
  color?: string;
  collapsed?: boolean;
}

export interface TestMindMapData {
  id: string;
  title: string;
  rootNode: TestNode;
  settings?: {
    autoSave: boolean;
    autoLayout: boolean;
  };
  updatedAt?: string;
  createdAt?: string;
}

// Mock function types for hooks
export type MockUpdateDataFunction = jest.MockedFunction<
  (data: TestMindMapData, options?: any) => Promise<void>
>;

export type MockAuthManager = {
  isAuthenticated: jest.MockedFunction<() => boolean>;
  getAuthToken: jest.MockedFunction<() => string | null>;
  authenticatedFetch: jest.MockedFunction<(...args: any[]) => Promise<any>>;
};

// Storage router mock types
export interface MockStorageRouter {
  getCurrentMindMap: jest.MockedFunction<() => Promise<TestMindMapData | null>>;
  saveMindMap: jest.MockedFunction<(data: TestMindMapData) => Promise<void>>;
  isCloudStorageEnabled: jest.MockedFunction<() => boolean>;
  getAllMindMaps: jest.MockedFunction<() => Promise<TestMindMapData[]>>;
  getMindMap: jest.MockedFunction<(id: string) => Promise<TestMindMapData | null>>;
}

// Storage utils mock types
export interface MockStorageUtils {
  getAppSettings: jest.MockedFunction<() => any>;
}

// Data types mock
export interface MockDataTypes {
  deepClone: jest.MockedFunction<(obj: any) => any>;
  assignColorsToExistingNodes: jest.MockedFunction<(data: any) => any>;
  createInitialData: jest.MockedFunction<() => TestMindMapData>;
}

// Update options
export interface UpdateOptions {
  source?: string;
  skipHistory?: boolean;
  allowDuringEdit?: boolean;
  skipMapSwitchDelete?: boolean;
}

declare global {
  namespace jest {
    interface Expect {
      objectContaining(obj: Record<string, any>): any;
      arrayContaining(arr: any[]): any;
      any(constructor: any): any;
      stringMatching(regex: string | RegExp): any;
    }
  }
}

export {};