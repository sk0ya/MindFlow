/**
 * CloudSync テストスイート
 * クラウド同期機能の包括的テスト
 */

// Mock dependencies and test functions first
const mockApiClient = {
  post: jest.fn(),
  get: jest.fn(),
  put: jest.fn(),
  delete: jest.fn()
};

const mockWebSocket = {
  readyState: 1, // WebSocket.OPEN
  send: jest.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  close: vi.fn()
};

global.WebSocket = vi.fn(() => mockWebSocket);
global.navigator = { onLine: true };
global.window = { 
  addEventListener: vi.fn(), 
  removeEventListener: vi.fn(),
  location: { hostname: 'localhost' }
};

describe('VectorClock', () => {
  let vectorClock;

  beforeEach(() => {
    vectorClock = new VectorClock();
  });

  it('should initialize empty clock', () => {
    expect(vectorClock.toJSON()).toEqual({});
  });

  it('should increment user clock', () => {
    vectorClock.increment('user1');
    expect(vectorClock.toJSON()).toEqual({ 'user_user1': 1 });
    
    vectorClock.increment('user1');
    expect(vectorClock.toJSON()).toEqual({ 'user_user1': 2 });
  });

  it('should merge vector clocks correctly', () => {
    const clock1 = new VectorClock({ 'user_1': 3, 'user_2': 1 });
    const clock2 = { 'user_1': 2, 'user_2': 4, 'user_3': 1 };
    
    clock1.update(clock2);
    
    expect(clock1.toJSON()).toEqual({
      'user_1': 3, // max(3, 2)
      'user_2': 4, // max(1, 4)
      'user_3': 1  // max(0, 1)
    });
  });

  it('should detect concurrent operations', () => {
    const clock1 = { 'user_1': 2, 'user_2': 1 };
    const clock2 = { 'user_1': 1, 'user_2': 2 };
    
    const vc = new VectorClock(clock1);
    expect(vc.compare(clock2)).toBe('concurrent');
  });

  it('should detect happens-before relationship', () => {
    const clock1 = { 'user_1': 1, 'user_2': 1 };
    const clock2 = { 'user_1': 2, 'user_2': 1 };
    
    const vc = new VectorClock(clock1);
    expect(vc.compare(clock2)).toBe('before');
  });
});

describe('SyncStateManager', () => {
  let syncStateManager;

  beforeEach(() => {
    syncStateManager = new SyncStateManager();
  });

  afterEach(() => {
    syncStateManager.cleanup();
  });

  it('should initialize with default state', () => {
    expect(syncStateManager.state.isOnline).toBe(true);
    expect(syncStateManager.state.isConnected).toBe(false);
    expect(syncStateManager.state.pendingOperations).toEqual([]);
  });

  it('should update state correctly', () => {
    const listener = vi.fn();
    syncStateManager.subscribe(listener);
    
    syncStateManager.updateState({ isConnected: true });
    
    expect(syncStateManager.state.isConnected).toBe(true);
    expect(listener).toHaveBeenCalled();
  });

  it('should manage user sessions', () => {
    const userId = 'user123';
    const sessionInfo = { username: 'testuser', avatar: 'avatar.png' };
    
    syncStateManager.addUserSession(userId, sessionInfo);
    
    expect(syncStateManager.state.activeUsers.has(userId)).toBe(true);
    expect(syncStateManager.state.activeUsers.get(userId)).toMatchObject(sessionInfo);
  });

  it('should track editing state', () => {
    const nodeId = 'node123';
    const userId = 'user123';
    
    syncStateManager.startEditing(nodeId, userId);
    
    expect(syncStateManager.state.editingUsers.has(nodeId)).toBe(true);
    expect(syncStateManager.state.editingUsers.get(nodeId).has(userId)).toBe(true);
    
    syncStateManager.endEditing(nodeId, userId);
    
    expect(syncStateManager.state.editingUsers.has(nodeId)).toBe(false);
  });

  it('should increment vector clock', () => {
    const userId = 'user123';
    
    syncStateManager.incrementVectorClock(userId);
    
    expect(syncStateManager.state.vectorClock[`user_${userId}`]).toBe(1);
  });
});

describe('OperationQueue', () => {
  let operationQueue;
  let syncStateManager;

  beforeEach(() => {
    syncStateManager = new SyncStateManager();
    operationQueue = new OperationQueue(syncStateManager, mockApiClient);
  });

  afterEach(() => {
    operationQueue.cleanup();
    syncStateManager.cleanup();
  });

  it('should add operation to queue', async () => {
    const operation = {
      operation_type: 'create',
      target_type: 'node',
      target_id: 'node123',
      mindmap_id: 'map123',
      data: { text: 'test node' }
    };

    const promise = operationQueue.addOperation(operation);
    
    expect(operationQueue.queue.length).toBe(1);
    expect(syncStateManager.state.pendingOperations.length).toBe(1);
    
    // Simulate successful API response
    mockApiClient.post.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true, vector_clock: { 'user_test': 1 } })
    });

    await promise;
    
    expect(operationQueue.queue.length).toBe(0);
  });

  it('should retry failed operations', async () => {
    const operation = {
      operation_type: 'update',
      target_type: 'node',
      target_id: 'node123',
      mindmap_id: 'map123',
      data: { text: 'updated text' }
    };

    // Simulate API failure then success
    mockApiClient.post
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true })
      });

    const promise = operationQueue.addOperation(operation);
    
    // Wait for retry
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    await promise;
    
    expect(mockApiClient.post).toHaveBeenCalledTimes(2);
  });

  it('should handle permanent failures', async () => {
    const operation = {
      operation_type: 'delete',
      target_type: 'node',
      target_id: 'node123',
      mindmap_id: 'map123',
      data: {}
    };

    // Simulate permanent failure
    mockApiClient.post.mockRejectedValue(new Error('Permanent error'));

    await expect(operationQueue.addOperation(operation)).rejects.toThrow();
    
    // After max retries, operation should be in conflict queue
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    expect(syncStateManager.state.conflictQueue.length).toBe(1);
  });
});

describe('OperationTransformer', () => {
  let transformer;

  beforeEach(() => {
    transformer = new OperationTransformer();
  });

  it('should transform concurrent update operations', () => {
    const op1 = {
      id: 'op1',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'Text A' },
      timestamp: '2025-01-24T10:00:00.000Z',
      userId: 'user1'
    };

    const op2 = {
      id: 'op2',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'Text B' },
      timestamp: '2025-01-24T10:00:01.000Z',
      userId: 'user2'
    };

    const result = transformer.transform(op1, op2);

    // op2 should win (later timestamp)
    expect(result.op1Prime.data.text).toBe('Text B');
    expect(result.op2Prime.data.text).toBe('Text B');
  });

  it('should handle update vs delete conflict', () => {
    const updateOp = {
      id: 'op1',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'Updated text' }
    };

    const deleteOp = {
      id: 'op2',
      operation_type: 'delete',
      target_id: 'node123',
      data: {}
    };

    const result = transformer.transform(updateOp, deleteOp);

    // Delete should win
    expect(result.op1Prime.operation_type).toBe('noop');
    expect(result.op2Prime.operation_type).toBe('delete');
  });

  it('should handle concurrent move operations', () => {
    const move1 = {
      id: 'op1',
      operation_type: 'move',
      target_id: 'node123',
      data: { x: 100, y: 200 },
      timestamp: '2025-01-24T10:00:00.000Z',
      userId: 'user1'
    };

    const move2 = {
      id: 'op2',
      operation_type: 'move',
      target_id: 'node123',
      data: { x: 150, y: 250 },
      timestamp: '2025-01-24T10:00:01.000Z',
      userId: 'user2'
    };

    const result = transformer.transform(move1, move2);

    // Later operation should win
    expect(result.op1Prime.operation_type).toBe('noop');
    expect(result.op2Prime.operation_type).toBe('move');
  });

  it('should not transform unrelated operations', () => {
    const op1 = {
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'Text A' }
    };

    const op2 = {
      operation_type: 'update',
      target_id: 'node456',
      data: { text: 'Text B' }
    };

    const result = transformer.transform(op1, op2);

    expect(result.op1Prime).toEqual(op1);
    expect(result.op2Prime).toEqual(op2);
  });
});

describe('ConflictResolver', () => {
  let conflictResolver;
  let syncStateManager;

  beforeEach(() => {
    syncStateManager = new SyncStateManager();
    conflictResolver = new ConflictResolver(syncStateManager);
  });

  afterEach(() => {
    conflictResolver.cleanup();
    syncStateManager.cleanup();
  });

  it('should detect conflicts using vector clocks', () => {
    const localClock = { 'user_1': 2, 'user_2': 1 };
    const remoteClock = { 'user_1': 1, 'user_2': 2 };

    const hasConflict = conflictResolver.detectConflict(remoteClock, localClock);

    expect(hasConflict).toBe(true);
  });

  it('should resolve conflicts automatically', async () => {
    const incomingOperation = {
      id: 'remote_op',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'Remote text' },
      vector_clock: { 'user_1': 1, 'user_2': 2 },
      mindmap_id: 'map123'
    };

    const localOperations = [{
      id: 'local_op',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'Local text' },
      vector_clock: { 'user_1': 2, 'user_2': 1 }
    }];

    // Add to operation history
    conflictResolver.addToHistory('map123', localOperations[0]);

    const result = await conflictResolver.resolveConflict(incomingOperation, localOperations);

    expect(result.shouldApply).toBe(true);
    expect(result.conflictInfo).toBeDefined();
    expect(result.conflictInfo.conflictCount).toBe(1);
  });

  it('should handle manual conflict resolution', async () => {
    const conflictId = 'conflict123';
    const conflict = {
      incomingOperation: {
        id: 'remote_op',
        data: { text: 'Remote text' }
      },
      localOperations: [{
        id: 'local_op',
        data: { text: 'Local text' }
      }]
    };

    conflictResolver.pendingConflicts.set(conflictId, conflict);

    const userChoice = {
      strategy: 'accept_remote'
    };

    const result = await conflictResolver.resolveManually(conflictId, userChoice);

    expect(result.resolutionStrategy).toBe('accept_remote');
    expect(result.resolvedOperation).toEqual(conflict.incomingOperation);
  });

  it('should maintain conflict statistics', () => {
    conflictResolver.conflictStats.totalConflicts = 10;
    conflictResolver.conflictStats.resolvedConflicts = 8;
    conflictResolver.conflictStats.manualResolutions = 2;

    const stats = conflictResolver.getConflictStats('map123');

    expect(stats.totalConflicts).toBe(10);
    expect(stats.resolvedConflicts).toBe(8);
    expect(stats.manualResolutions).toBe(2);
  });
});

describe('Integration Tests', () => {
  let syncStateManager;
  let operationQueue;
  let conflictResolver;

  beforeEach(() => {
    syncStateManager = new SyncStateManager();
    operationQueue = new OperationQueue(syncStateManager, mockApiClient);
    conflictResolver = new ConflictResolver(syncStateManager);
  });

  afterEach(() => {
    operationQueue.cleanup();
    conflictResolver.cleanup();
    syncStateManager.cleanup();
  });

  it('should handle complete sync workflow', async () => {
    // 1. Add operation to queue
    const operation = {
      operation_type: 'create',
      target_type: 'node',
      target_id: 'node123',
      mindmap_id: 'map123',
      data: { text: 'test node' }
    };

    // Mock successful API response
    mockApiClient.post.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ 
        success: true, 
        vector_clock: { 'user_test': 1 }
      })
    });

    // 2. Process operation
    await operationQueue.addOperation(operation);

    // 3. Verify state updates
    expect(syncStateManager.state.vectorClock['user_test']).toBe(1);
    expect(operationQueue.queue.length).toBe(0);

    // 4. Simulate incoming remote operation
    const remoteOperation = {
      id: 'remote_op',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'remote update' },
      vector_clock: { 'user_test': 1, 'user_remote': 1 },
      mindmap_id: 'map123'
    };

    // 5. Process remote operation (no conflict expected)
    const resolution = await conflictResolver.resolveConflict(remoteOperation);

    expect(resolution.shouldApply).toBe(true);
    expect(resolution.conflictInfo).toBeNull();
  });

  it('should handle offline scenario', async () => {
    // Simulate offline state
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: false
    });

    syncStateManager.updateState({ isOnline: false, isConnected: false });

    const operation = {
      operation_type: 'update',
      target_type: 'node',
      target_id: 'node123',
      mindmap_id: 'map123',
      data: { text: 'offline update' }
    };

    // Operation should be queued but not processed
    const promise = operationQueue.addOperation(operation);
    
    expect(operationQueue.queue.length).toBe(1);

    // Simulate coming back online
    Object.defineProperty(navigator, 'onLine', {
      writable: true,
      value: true
    });

    syncStateManager.updateState({ isOnline: true, isConnected: true });

    // Mock API response for when back online
    mockApiClient.post.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ success: true })
    });

    // Process queue
    await operationQueue.processQueue();

    expect(operationQueue.queue.length).toBe(0);
  });

  it('should handle complex conflict scenario', async () => {
    // Setup: Two users editing the same node simultaneously
    const user1Operation = {
      id: 'user1_op',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'User 1 edit' },
      vector_clock: { 'user_1': 2, 'user_2': 1 },
      timestamp: '2025-01-24T10:00:00.000Z',
      userId: 'user1',
      mindmap_id: 'map123'
    };

    const user2Operation = {
      id: 'user2_op',
      operation_type: 'update',
      target_id: 'node123',
      data: { text: 'User 2 edit' },
      vector_clock: { 'user_1': 1, 'user_2': 2 },
      timestamp: '2025-01-24T10:00:01.000Z',
      userId: 'user2',
      mindmap_id: 'map123'
    };

    // Add first operation to history
    conflictResolver.addToHistory('map123', user1Operation);

    // Process second operation (should detect conflict)
    const resolution = await conflictResolver.resolveConflict(user2Operation);

    expect(resolution.conflictInfo.conflictCount).toBeGreaterThan(0);
    expect(resolution.shouldApply).toBe(true);
    
    // User 2's operation should win (later timestamp)
    expect(resolution.resolvedOperation.data.text).toBe('User 2 edit');
  });
});

describe('Performance Tests', () => {
  it('should handle large number of operations efficiently', async () => {
    const syncStateManager = new SyncStateManager();
    const operationQueue = new OperationQueue(syncStateManager, mockApiClient);

    // Mock fast API responses
    mockApiClient.post.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    );

    const startTime = Date.now();
    const promises = [];

    // Add 100 operations
    for (let i = 0; i < 100; i++) {
      const operation = {
        operation_type: 'create',
        target_type: 'node',
        target_id: `node${i}`,
        mindmap_id: 'map123',
        data: { text: `Node ${i}` }
      };

      promises.push(operationQueue.addOperation(operation));
    }

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should complete within reasonable time (5 seconds)
    expect(duration).toBeLessThan(5000);
    expect(operationQueue.queue.length).toBe(0);

    operationQueue.cleanup();
    syncStateManager.cleanup();
  });

  it('should efficiently resolve multiple conflicts', async () => {
    const syncStateManager = new SyncStateManager();
    const conflictResolver = new ConflictResolver(syncStateManager);

    const startTime = Date.now();

    // Create 50 conflicting operations
    for (let i = 0; i < 50; i++) {
      const operation = {
        id: `op${i}`,
        operation_type: 'update',
        target_id: 'node123',
        data: { text: `Edit ${i}` },
        vector_clock: { [`user_${i}`]: 1 },
        mindmap_id: 'map123'
      };

      await conflictResolver.resolveConflict(operation);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;

    // Should resolve conflicts efficiently
    expect(duration).toBeLessThan(1000);

    conflictResolver.cleanup();
    syncStateManager.cleanup();
  });
});

describe('Error Handling', () => {
  it('should gracefully handle network errors', async () => {
    const syncStateManager = new SyncStateManager();
    const operationQueue = new OperationQueue(syncStateManager, mockApiClient);

    const operation = {
      operation_type: 'create',
      target_type: 'node',
      target_id: 'node123',
      mindmap_id: 'map123',
      data: { text: 'test' }
    };

    // Simulate network error
    mockApiClient.post.mockRejectedValue(new Error('Network failed'));

    await expect(operationQueue.addOperation(operation)).rejects.toThrow();

    // Operation should be retried
    expect(operationQueue.queue[0].retryCount).toBeGreaterThan(0);

    operationQueue.cleanup();
    syncStateManager.cleanup();
  });

  it('should handle malformed operations', async () => {
    const syncStateManager = new SyncStateManager();
    const conflictResolver = new ConflictResolver(syncStateManager);

    const malformedOperation = {
      // Missing required fields
      data: { text: 'test' }
    };

    await expect(
      conflictResolver.resolveConflict(malformedOperation)
    ).rejects.toThrow();

    conflictResolver.cleanup();
    syncStateManager.cleanup();
  });

  it('should recover from corrupted state', () => {
    const syncStateManager = new SyncStateManager();

    // Simulate corrupted state
    syncStateManager.state.vectorClock = null;
    syncStateManager.state.pendingOperations = null;

    // Should recover gracefully
    expect(() => {
      syncStateManager.updateState({ isConnected: true });
    }).not.toThrow();

    syncStateManager.cleanup();
  });
});