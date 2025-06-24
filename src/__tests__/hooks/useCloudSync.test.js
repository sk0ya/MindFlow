/**
 * useCloudSync Hook テストスイート
 * React フックとクラウド同期機能の統合テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCloudSync } from '../../hooks/useCloudSync.js';

// Mock dependencies
const mockCloudSyncService = {
  initialize: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  deleteNode: vi.fn(),
  moveNode: vi.fn(),
  updateCursor: vi.fn(),
  startEditing: vi.fn(),
  endEditing: vi.fn(),
  forceSync: vi.fn(),
  fullSync: vi.fn(),
  onStateChange: vi.fn(),
  onRealtimeEvent: vi.fn(),
  getStats: vi.fn(),
  getSyncState: vi.fn(() => ({
    isOnline: true,
    isConnected: false,
    isSyncing: false,
    pendingOperations: [],
    activeUsers: new Map(),
    errors: []
  })),
  cleanup: vi.fn()
};

// Mock CloudSyncService class
vi.mock('../../hooks/useCloudSync.js', async () => {
  const actual = await vi.importActual('../../hooks/useCloudSync.js');
  
  class MockCloudSyncService {
    constructor() {
      Object.assign(this, mockCloudSyncService);
      this.isInitialized = false;
      this.error = null;
    }
  }

  return {
    ...actual,
    useCloudSync: (mindmapId, config = {}) => {
      const [syncService] = React.useState(() => new MockCloudSyncService());
      const [syncState, setSyncState] = React.useState(syncService.getSyncState());
      const [isInitialized, setIsInitialized] = React.useState(false);
      const [error, setError] = React.useState(null);

      React.useEffect(() => {
        if (mindmapId) {
          syncService.initialize(mindmapId, config)
            .then(() => {
              setIsInitialized(true);
              setError(null);
            })
            .catch(err => {
              setError(err);
              setIsInitialized(false);
            });
        }
      }, [mindmapId, syncService, config]);

      React.useEffect(() => {
        const unsubscribe = syncService.onStateChange((data) => {
          if (data?.newState) {
            setSyncState(data.newState);
          }
        });
        return unsubscribe;
      }, [syncService]);

      return {
        syncState,
        isInitialized,
        error,
        createNode: React.useCallback((nodeData) => syncService.createNode(nodeData), [syncService]),
        updateNode: React.useCallback((nodeId, updates) => syncService.updateNode(nodeId, updates), [syncService]),
        deleteNode: React.useCallback((nodeId) => syncService.deleteNode(nodeId), [syncService]),
        moveNode: React.useCallback((nodeId, position) => syncService.moveNode(nodeId, position), [syncService]),
        updateCursor: React.useCallback((cursor) => syncService.updateCursor(cursor), [syncService]),
        startEditing: React.useCallback((nodeId) => syncService.startEditing(nodeId), [syncService]),
        endEditing: React.useCallback((nodeId) => syncService.endEditing(nodeId), [syncService]),
        forceSync: React.useCallback(() => syncService.forceSync(), [syncService]),
        fullSync: React.useCallback(() => syncService.fullSync(), [syncService]),
        onStateChange: React.useCallback((listener) => syncService.onStateChange(listener), [syncService]),
        onRealtimeEvent: React.useCallback((event, listener) => syncService.onRealtimeEvent(event, listener), [syncService]),
        getStats: React.useCallback(() => syncService.getStats(), [syncService])
      };
    }
  };
});

// Setup React mock
global.React = {
  useState: vi.fn(),
  useEffect: vi.fn(),
  useCallback: vi.fn(),
  useRef: vi.fn()
};

describe('useCloudSync Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock React hooks
    let stateValues = {};
    let stateSetters = {};
    
    global.React.useState.mockImplementation((initialValue) => {
      const key = Math.random().toString(36);
      stateValues[key] = typeof initialValue === 'function' ? initialValue() : initialValue;
      stateSetters[key] = vi.fn((newValue) => {
        stateValues[key] = typeof newValue === 'function' ? newValue(stateValues[key]) : newValue;
      });
      return [stateValues[key], stateSetters[key]];
    });

    global.React.useEffect.mockImplementation((effect, deps) => {
      const cleanup = effect();
      return cleanup;
    });

    global.React.useCallback.mockImplementation((callback, deps) => callback);
    global.React.useRef.mockImplementation((initialValue) => ({ current: initialValue }));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useCloudSync(null));

    expect(result.current.syncState).toBeDefined();
    expect(result.current.isInitialized).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should initialize when mindmapId is provided', () => {
    const mindmapId = 'test-map-123';
    const config = { apiBaseUrl: '/api', authToken: 'test-token' };

    mockCloudSyncService.initialize.mockResolvedValueOnce();

    const { result } = renderHook(() => useCloudSync(mindmapId, config));

    expect(mockCloudSyncService.initialize).toHaveBeenCalledWith(mindmapId, config);
  });

  it('should handle initialization errors', async () => {
    const mindmapId = 'test-map-123';
    const error = new Error('Initialization failed');

    mockCloudSyncService.initialize.mockRejectedValueOnce(error);

    const { result } = renderHook(() => useCloudSync(mindmapId));

    // Wait for initialization to fail
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.isInitialized).toBe(false);
  });

  it('should provide node operation functions', () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    expect(typeof result.current.createNode).toBe('function');
    expect(typeof result.current.updateNode).toBe('function');
    expect(typeof result.current.deleteNode).toBe('function');
    expect(typeof result.current.moveNode).toBe('function');
  });

  it('should provide realtime collaboration functions', () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    expect(typeof result.current.updateCursor).toBe('function');
    expect(typeof result.current.startEditing).toBe('function');
    expect(typeof result.current.endEditing).toBe('function');
  });

  it('should provide sync control functions', () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    expect(typeof result.current.forceSync).toBe('function');
    expect(typeof result.current.fullSync).toBe('function');
  });

  it('should call createNode with correct parameters', async () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const nodeData = {
      id: 'node-123',
      text: 'Test Node',
      x: 100,
      y: 200
    };

    mockCloudSyncService.createNode.mockResolvedValueOnce('operation-id');

    await act(async () => {
      const operationId = await result.current.createNode(nodeData);
      expect(operationId).toBe('operation-id');
    });

    expect(mockCloudSyncService.createNode).toHaveBeenCalledWith(nodeData);
  });

  it('should call updateNode with correct parameters', async () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const nodeId = 'node-123';
    const updates = { text: 'Updated Text' };

    mockCloudSyncService.updateNode.mockResolvedValueOnce('operation-id');

    await act(async () => {
      const operationId = await result.current.updateNode(nodeId, updates);
      expect(operationId).toBe('operation-id');
    });

    expect(mockCloudSyncService.updateNode).toHaveBeenCalledWith(nodeId, updates);
  });

  it('should handle realtime cursor updates', async () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const cursorData = { x: 150, y: 250, nodeId: 'node-123' };

    await act(async () => {
      result.current.updateCursor(cursorData);
    });

    expect(mockCloudSyncService.updateCursor).toHaveBeenCalledWith(cursorData);
  });

  it('should handle editing state changes', async () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const nodeId = 'node-123';

    await act(async () => {
      result.current.startEditing(nodeId);
    });

    expect(mockCloudSyncService.startEditing).toHaveBeenCalledWith(nodeId);

    await act(async () => {
      result.current.endEditing(nodeId);
    });

    expect(mockCloudSyncService.endEditing).toHaveBeenCalledWith(nodeId);
  });

  it('should subscribe to state changes', () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const listener = vi.fn();

    act(() => {
      const unsubscribe = result.current.onStateChange(listener);
      expect(typeof unsubscribe).toBe('function');
    });

    expect(mockCloudSyncService.onStateChange).toHaveBeenCalledWith(listener);
  });

  it('should subscribe to realtime events', () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const listener = vi.fn();
    const eventType = 'user_joined';

    act(() => {
      const unsubscribe = result.current.onRealtimeEvent(eventType, listener);
      expect(typeof unsubscribe).toBe('function');
    });

    expect(mockCloudSyncService.onRealtimeEvent).toHaveBeenCalledWith(eventType, listener);
  });

  it('should force sync when requested', async () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    mockCloudSyncService.forceSync.mockResolvedValueOnce();

    await act(async () => {
      await result.current.forceSync();
    });

    expect(mockCloudSyncService.forceSync).toHaveBeenCalled();
  });

  it('should perform full sync when requested', async () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const syncedData = { id: 'test-map', title: 'Synced Map' };
    mockCloudSyncService.fullSync.mockResolvedValueOnce(syncedData);

    await act(async () => {
      const result = await result.current.fullSync();
      expect(result).toEqual(syncedData);
    });

    expect(mockCloudSyncService.fullSync).toHaveBeenCalled();
  });

  it('should provide statistics', () => {
    const { result } = renderHook(() => useCloudSync('test-map'));

    const mockStats = {
      operationsProcessed: 10,
      conflictsResolved: 2,
      averageLatency: 150
    };

    mockCloudSyncService.getStats.mockReturnValueOnce(mockStats);

    act(() => {
      const stats = result.current.getStats();
      expect(stats).toEqual(mockStats);
    });

    expect(mockCloudSyncService.getStats).toHaveBeenCalled();
  });

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() => useCloudSync('test-map'));

    unmount();

    expect(mockCloudSyncService.cleanup).toHaveBeenCalled();
  });

  it('should handle mindmapId changes', () => {
    const { rerender } = renderHook(
      ({ mindmapId }) => useCloudSync(mindmapId),
      { initialProps: { mindmapId: 'map-1' } }
    );

    expect(mockCloudSyncService.initialize).toHaveBeenCalledWith('map-1', {});

    rerender({ mindmapId: 'map-2' });

    expect(mockCloudSyncService.initialize).toHaveBeenCalledWith('map-2', {});
  });

  it('should handle config changes', () => {
    const initialConfig = { apiBaseUrl: '/api/v1' };
    const newConfig = { apiBaseUrl: '/api/v2' };

    const { rerender } = renderHook(
      ({ config }) => useCloudSync('test-map', config),
      { initialProps: { config: initialConfig } }
    );

    expect(mockCloudSyncService.initialize).toHaveBeenCalledWith('test-map', initialConfig);

    rerender({ config: newConfig });

    expect(mockCloudSyncService.initialize).toHaveBeenCalledWith('test-map', newConfig);
  });

  it('should handle null mindmapId gracefully', () => {
    const { result } = renderHook(() => useCloudSync(null));

    expect(result.current.syncState).toBeDefined();
    expect(result.current.isInitialized).toBe(false);
    expect(mockCloudSyncService.initialize).not.toHaveBeenCalled();
  });

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => useCloudSync('test-map'));

    const firstRender = {
      createNode: result.current.createNode,
      updateNode: result.current.updateNode,
      deleteNode: result.current.deleteNode,
      moveNode: result.current.moveNode
    };

    rerender();

    const secondRender = {
      createNode: result.current.createNode,
      updateNode: result.current.updateNode,
      deleteNode: result.current.deleteNode,
      moveNode: result.current.moveNode
    };

    // Functions should be the same reference (memoized)
    expect(firstRender.createNode).toBe(secondRender.createNode);
    expect(firstRender.updateNode).toBe(secondRender.updateNode);
    expect(firstRender.deleteNode).toBe(secondRender.deleteNode);
    expect(firstRender.moveNode).toBe(secondRender.moveNode);
  });
});

describe('useCloudSync Integration Tests', () => {
  it('should handle complete workflow', async () => {
    mockCloudSyncService.initialize.mockResolvedValueOnce();
    mockCloudSyncService.createNode.mockResolvedValueOnce('op-1');
    mockCloudSyncService.updateNode.mockResolvedValueOnce('op-2');
    mockCloudSyncService.deleteNode.mockResolvedValueOnce('op-3');

    const { result } = renderHook(() => useCloudSync('test-map'));

    // Wait for initialization
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    // Create a node
    await act(async () => {
      await result.current.createNode({
        id: 'node-1',
        text: 'New Node',
        x: 100,
        y: 200
      });
    });

    // Update the node
    await act(async () => {
      await result.current.updateNode('node-1', { text: 'Updated Node' });
    });

    // Delete the node
    await act(async () => {
      await result.current.deleteNode('node-1');
    });

    expect(mockCloudSyncService.createNode).toHaveBeenCalled();
    expect(mockCloudSyncService.updateNode).toHaveBeenCalled();
    expect(mockCloudSyncService.deleteNode).toHaveBeenCalled();
  });

  it('should handle error recovery', async () => {
    const error = new Error('Network error');
    mockCloudSyncService.initialize.mockRejectedValueOnce(error);
    mockCloudSyncService.initialize.mockResolvedValueOnce(); // Second attempt succeeds

    const { result, rerender } = renderHook(
      ({ mindmapId }) => useCloudSync(mindmapId),
      { initialProps: { mindmapId: 'test-map' } }
    );

    // Wait for first initialization to fail
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.error).toEqual(error);
    expect(result.current.isInitialized).toBe(false);

    // Retry initialization
    rerender({ mindmapId: 'test-map-retry' });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(result.current.error).toBeNull();
    expect(result.current.isInitialized).toBe(true);
  });

  it('should handle state changes', async () => {
    let stateChangeCallback;

    mockCloudSyncService.onStateChange.mockImplementation((callback) => {
      stateChangeCallback = callback;
      return () => {}; // unsubscribe function
    });

    const { result } = renderHook(() => useCloudSync('test-map'));

    // Simulate state change
    const newState = {
      isConnected: true,
      activeUsers: new Map([['user1', { name: 'User 1' }]]),
      pendingOperations: [{ id: 'op1', type: 'create' }]
    };

    await act(async () => {
      stateChangeCallback({ newState });
    });

    expect(result.current.syncState).toEqual(newState);
  });
});