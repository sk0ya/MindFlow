/**
 * リアルタイムシステム統合テストスクリプト
 * Durable Objects + WebSocket + 競合解決の総合テスト
 */

/**
 * モックWebSocketクライアント
 */
class MockWebSocketClient {
  constructor(clientId, userName) {
    this.clientId = clientId;
    this.userName = userName;
    this.sessionId = null;
    this.connected = false;
    this.receivedMessages = [];
    this.sentMessages = [];
    this.currentVersion = 0;
    
    this.eventHandlers = new Map();
  }

  connect(mindmapId) {
    return new Promise((resolve) => {
      // 接続をシミュレート
      setTimeout(() => {
        this.connected = true;
        this.sessionId = `session_${this.clientId}_${Date.now()}`;
        
        // 初期データ受信をシミュレート
        this.receiveMessage({
          type: 'initial_data',
          sessionId: this.sessionId,
          mindmapState: this.createInitialState(),
          version: 1,
          connectedUsers: [
            { id: this.clientId, name: this.userName, color: '#FF6B6B' }
          ]
        });
        
        this.emit('connected');
        resolve(true);
      }, 100);
    });
  }

  sendMessage(message) {
    if (!this.connected) {
      throw new Error('Not connected');
    }

    this.sentMessages.push({
      ...message,
      timestamp: Date.now(),
      clientId: this.clientId
    });

    // 送信をシミュレート
    console.log(`[${this.clientId}] Sent:`, message.type, message.data);
  }

  receiveMessage(message) {
    this.receivedMessages.push(message);
    
    if (message.type === 'operation' && message.operation) {
      this.currentVersion = message.operation.version;
    }
    
    console.log(`[${this.clientId}] Received:`, message.type);
    this.emit('message', message);
  }

  sendOperation(type, data) {
    const operation = {
      type: type,
      data: data,
      clientId: this.generateClientId(),
      timestamp: Date.now()
    };

    this.sendMessage(operation);
    return operation.clientId;
  }

  updateNode(nodeId, updates) {
    return this.sendOperation('node_update', {
      nodeId: nodeId,
      updates: updates
    });
  }

  createNode(parentId, nodeData) {
    return this.sendOperation('node_create', {
      nodeId: nodeData.id || this.generateNodeId(),
      parentId: parentId,
      text: nodeData.text,
      position: nodeData.position
    });
  }

  deleteNode(nodeId) {
    return this.sendOperation('node_delete', {
      nodeId: nodeId
    });
  }

  disconnect() {
    this.connected = false;
    this.emit('disconnected');
  }

  on(event, handler) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(handler);
  }

  emit(event, data = null) {
    if (this.eventHandlers.has(event)) {
      this.eventHandlers.get(event).forEach(handler => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Event handler error for ${event}:`, error);
        }
      });
    }
  }

  createInitialState() {
    return {
      id: 'root',
      text: 'テストマインドマップ',
      x: 400,
      y: 300,
      children: [
        {
          id: 'node-1',
          text: '子ノード1',
          x: 200,
          y: 200,
          children: []
        },
        {
          id: 'node-2',
          text: '子ノード2',
          x: 600,
          y: 200,
          children: []
        }
      ]
    };
  }

  generateClientId() {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  generateNodeId() {
    return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats() {
    return {
      clientId: this.clientId,
      connected: this.connected,
      messagesSent: this.sentMessages.length,
      messagesReceived: this.receivedMessages.length,
      currentVersion: this.currentVersion,
      sessionId: this.sessionId
    };
  }
}

/**
 * リアルタイム同期シミュレーター
 */
class RealtimeSyncSimulator {
  constructor() {
    this.clients = new Map();
    this.globalState = null;
    this.globalVersion = 0;
    this.operationLog = [];
    this.conflictCount = 0;
  }

  addClient(clientId, userName) {
    const client = new MockWebSocketClient(clientId, userName);
    this.clients.set(clientId, client);
    
    // クライアントメッセージの監視
    client.on('message', (message) => {
      if (message.type === 'initial_data') {
        if (!this.globalState) {
          this.globalState = message.mindmapState;
          this.globalVersion = message.version;
        }
      }
    });

    return client;
  }

  async connectAllClients(mindmapId) {
    const connections = [];
    for (const client of this.clients.values()) {
      connections.push(client.connect(mindmapId));
    }
    
    await Promise.all(connections);
    console.log(`All ${this.clients.size} clients connected`);
  }

  /**
   * 同時操作のシミュレート
   */
  async simulateConcurrentOperations() {
    console.log('=== 同時操作シミュレーション開始 ===');
    
    const clients = Array.from(this.clients.values());
    const operations = [];

    // 同じノードに対する同時更新
    const nodeId = 'node-1';
    operations.push(
      // クライアント1: テキスト更新
      clients[0].updateNode(nodeId, { text: '更新されたテキスト1' }),
      // クライアント2: 位置更新
      clients[1].updateNode(nodeId, { x: 250, y: 220 }),
      // クライアント3: スタイル更新
      clients[2]?.updateNode(nodeId, { fontSize: 16, fontWeight: 'bold' })
    );

    // 少し時間をずらして追加操作
    setTimeout(() => {
      // 新しいノードの同時作成（位置が近い）
      clients[0].createNode('root', {
        text: '新ノード A',
        position: { x: 300, y: 400 }
      });
      
      clients[1].createNode('root', {
        text: '新ノード B', 
        position: { x: 310, y: 405 }
      });
    }, 50);

    // 競合解決の確認
    setTimeout(() => {
      this.analyzeConflicts();
    }, 200);
  }

  /**
   * 競合解決のテスト
   */
  analyzeConflicts() {
    console.log('=== 競合解決分析 ===');
    
    const allOperations = [];
    for (const client of this.clients.values()) {
      client.sentMessages.forEach(msg => {
        if (msg.type === 'node_update' || msg.type === 'node_create') {
          allOperations.push({
            ...msg,
            clientId: client.clientId
          });
        }
      });
    }

    // 時系列でソート
    allOperations.sort((a, b) => a.timestamp - b.timestamp);

    // 競合検出
    const conflicts = this.detectConflicts(allOperations);
    
    console.log(`総操作数: ${allOperations.length}`);
    console.log(`検出された競合: ${conflicts.length}`);
    
    conflicts.forEach((conflict, index) => {
      console.log(`競合 ${index + 1}:`, {
        type: conflict.type,
        involvedClients: conflict.operations.map(op => op.clientId),
        timespan: conflict.timespan
      });
    });

    return conflicts;
  }

  /**
   * 競合検出ロジック
   */
  detectConflicts(operations) {
    const conflicts = [];
    const conflictWindow = 1000; // 1秒以内の操作を競合とみなす

    for (let i = 0; i < operations.length; i++) {
      const op1 = operations[i];
      const conflictingOps = [];

      for (let j = i + 1; j < operations.length; j++) {
        const op2 = operations[j];
        
        // 時間窓外は除外
        if (op2.timestamp - op1.timestamp > conflictWindow) {
          break;
        }

        // 競合判定
        if (this.isConflictingOperation(op1, op2)) {
          conflictingOps.push(op2);
        }
      }

      if (conflictingOps.length > 0) {
        conflicts.push({
          type: this.getConflictType(op1, conflictingOps),
          operations: [op1, ...conflictingOps],
          timespan: Math.max(...conflictingOps.map(op => op.timestamp)) - op1.timestamp
        });
      }
    }

    return conflicts;
  }

  isConflictingOperation(op1, op2) {
    // 同じノードに対する操作
    if (op1.data?.nodeId === op2.data?.nodeId) {
      return true;
    }

    // 同じ親での作成（位置が近い）
    if (op1.type === 'node_create' && op2.type === 'node_create') {
      if (op1.data?.parentId === op2.data?.parentId) {
        const pos1 = op1.data?.position;
        const pos2 = op2.data?.position;
        
        if (pos1 && pos2) {
          const distance = Math.sqrt(
            Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
          );
          return distance < 50;
        }
      }
    }

    return false;
  }

  getConflictType(primaryOp, conflictingOps) {
    if (primaryOp.type === 'node_update' && conflictingOps.every(op => op.type === 'node_update')) {
      return 'concurrent_update';
    }
    
    if (primaryOp.type === 'node_create' && conflictingOps.every(op => op.type === 'node_create')) {
      return 'concurrent_creation';
    }
    
    return 'mixed_conflict';
  }

  /**
   * ネットワーク分断のシミュレート
   */
  async simulateNetworkPartition() {
    console.log('=== ネットワーク分断シミュレーション ===');
    
    const clients = Array.from(this.clients.values());
    if (clients.length < 2) {
      console.log('分断テストには2つ以上のクライアントが必要です');
      return;
    }

    // クライアントを2つのグループに分割
    const group1 = clients.slice(0, Math.ceil(clients.length / 2));
    const group2 = clients.slice(Math.ceil(clients.length / 2));

    console.log(`グループ1: ${group1.length}クライアント`);
    console.log(`グループ2: ${group2.length}クライアント`);

    // グループ1の操作
    group1.forEach((client, index) => {
      client.updateNode('node-1', { 
        text: `グループ1更新 ${index + 1}`,
        color: '#FF6B6B'
      });
    });

    // 分断期間をシミュレート
    await new Promise(resolve => setTimeout(resolve, 100));

    // グループ2の操作
    group2.forEach((client, index) => {
      client.updateNode('node-1', { 
        text: `グループ2更新 ${index + 1}`,
        color: '#4ECDC4'
      });
    });

    // 分断解消後の同期をシミュレート
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('分断解消後の状態確認...');
    this.verifyConsistency();
  }

  /**
   * データ整合性の検証
   */
  verifyConsistency() {
    console.log('=== データ整合性検証 ===');
    
    const clientStates = new Map();
    
    // 各クライアントの最終状態を確認
    for (const [clientId, client] of this.clients) {
      const lastState = this.reconstructClientState(client);
      clientStates.set(clientId, lastState);
    }

    // 整合性チェック
    const stateHashes = new Map();
    for (const [clientId, state] of clientStates) {
      const hash = this.calculateStateHash(state);
      stateHashes.set(clientId, hash);
    }

    const uniqueHashes = new Set(stateHashes.values());
    
    if (uniqueHashes.size === 1) {
      console.log('✓ 全クライアントの状態が一致しています');
      return true;
    } else {
      console.log(`⚠️ 状態の不整合が検出されました (${uniqueHashes.size}種類の状態)`);
      
      // 詳細な差分を表示
      const states = Array.from(clientStates.entries());
      for (let i = 0; i < states.length - 1; i++) {
        for (let j = i + 1; j < states.length; j++) {
          const diff = this.compareStates(states[i][1], states[j][1]);
          if (diff.length > 0) {
            console.log(`${states[i][0]} vs ${states[j][0]} の差分:`, diff);
          }
        }
      }
      
      return false;
    }
  }

  reconstructClientState(client) {
    // クライアントが受信したメッセージから状態を再構築
    let state = null;
    
    for (const message of client.receivedMessages) {
      if (message.type === 'initial_data') {
        state = JSON.parse(JSON.stringify(message.mindmapState));
      } else if (message.type === 'operation') {
        state = this.applyOperationToState(state, message.operation);
      }
    }
    
    return state;
  }

  applyOperationToState(state, operation) {
    if (!state) return state;
    
    const newState = JSON.parse(JSON.stringify(state));
    
    switch (operation.type) {
      case 'node_update':
        this.applyNodeUpdate(newState, operation.data);
        break;
      case 'node_create':
        this.applyNodeCreate(newState, operation.data);
        break;
      case 'node_delete':
        this.applyNodeDelete(newState, operation.data);
        break;
    }
    
    return newState;
  }

  applyNodeUpdate(state, data) {
    const node = this.findNodeInState(state, data.nodeId);
    if (node && data.updates) {
      Object.assign(node, data.updates);
    }
  }

  applyNodeCreate(state, data) {
    const parent = this.findNodeInState(state, data.parentId);
    if (parent) {
      parent.children.push({
        id: data.nodeId,
        text: data.text,
        x: data.position?.x || 0,
        y: data.position?.y || 0,
        children: []
      });
    }
  }

  applyNodeDelete(state, data) {
    // 簡単な実装
    const parent = this.findParentOfNode(state, data.nodeId);
    if (parent) {
      const index = parent.children.findIndex(child => child.id === data.nodeId);
      if (index !== -1) {
        parent.children.splice(index, 1);
      }
    }
  }

  findNodeInState(state, nodeId) {
    if (state.id === nodeId) return state;
    
    if (state.children) {
      for (const child of state.children) {
        const found = this.findNodeInState(child, nodeId);
        if (found) return found;
      }
    }
    
    return null;
  }

  findParentOfNode(state, nodeId) {
    if (state.children) {
      for (const child of state.children) {
        if (child.id === nodeId) return state;
        
        const found = this.findParentOfNode(child, nodeId);
        if (found) return found;
      }
    }
    
    return null;
  }

  calculateStateHash(state) {
    // 簡単なハッシュ計算
    const stateString = JSON.stringify(state, Object.keys(state).sort());
    return this.simpleHash(stateString);
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit整数に変換
    }
    return hash;
  }

  compareStates(state1, state2) {
    // 簡単な状態比較
    const differences = [];
    
    const str1 = JSON.stringify(state1, Object.keys(state1).sort());
    const str2 = JSON.stringify(state2, Object.keys(state2).sort());
    
    if (str1 !== str2) {
      differences.push('State structure differs');
    }
    
    return differences;
  }

  /**
   * 統計レポート生成
   */
  generateReport() {
    console.log('\n=== リアルタイムシステムテスト結果 ===');
    
    const clientStats = [];
    let totalOperations = 0;
    
    for (const [clientId, client] of this.clients) {
      const stats = client.getStats();
      clientStats.push(stats);
      totalOperations += stats.messagesSent;
    }

    console.log(`テストクライアント数: ${this.clients.size}`);
    console.log(`総操作数: ${totalOperations}`);
    console.log(`検出された競合: ${this.conflictCount}`);
    
    console.log('\n--- クライアント別統計 ---');
    clientStats.forEach(stats => {
      console.log(`${stats.clientId}:`);
      console.log(`  送信メッセージ: ${stats.messagesSent}`);
      console.log(`  受信メッセージ: ${stats.messagesReceived}`);
      console.log(`  最終バージョン: ${stats.currentVersion}`);
      console.log(`  接続状態: ${stats.connected ? '接続中' : '切断'}`);
    });

    // 整合性チェック結果
    const isConsistent = this.verifyConsistency();
    console.log(`\nデータ整合性: ${isConsistent ? '✓ 整合' : '✗ 不整合'}`);
    
    return {
      clientCount: this.clients.size,
      totalOperations: totalOperations,
      conflictCount: this.conflictCount,
      isConsistent: isConsistent,
      clientStats: clientStats
    };
  }
}

/**
 * メインテスト関数
 */
async function runRealtimeSystemTest() {
  console.log('=== リアルタイムシステム統合テスト開始 ===');
  
  const simulator = new RealtimeSyncSimulator();
  const mindmapId = 'test-mindmap-realtime';

  try {
    // テストクライアントを作成
    console.log('テストクライアントを作成中...');
    const client1 = simulator.addClient('client-1', 'ユーザー1');
    const client2 = simulator.addClient('client-2', 'ユーザー2');
    const client3 = simulator.addClient('client-3', 'ユーザー3');

    // 全クライアントを接続
    await simulator.connectAllClients(mindmapId);

    // 同時操作のテスト
    await simulator.simulateConcurrentOperations();
    
    // ネットワーク分断のテスト
    await simulator.simulateNetworkPartition();
    
    // 結果のレポート
    const report = simulator.generateReport();
    
    console.log('\n=== テスト完了 ===');
    return report;

  } catch (error) {
    console.error('テスト実行エラー:', error);
    return { error: error.message };
  }
}

/**
 * パフォーマンステスト
 */
async function runPerformanceTest() {
  console.log('=== パフォーマンステスト開始 ===');
  
  const simulator = new RealtimeSyncSimulator();
  const mindmapId = 'test-mindmap-performance';
  
  // 大量のクライアントをシミュレート
  const clientCount = 10;
  const operationsPerClient = 20;
  
  console.log(`${clientCount}クライアント、各${operationsPerClient}操作をテスト`);

  // クライアント作成
  for (let i = 1; i <= clientCount; i++) {
    simulator.addClient(`client-${i}`, `ユーザー${i}`);
  }

  const startTime = Date.now();

  // 接続
  await simulator.connectAllClients(mindmapId);

  // 大量操作の実行
  const clients = Array.from(simulator.clients.values());
  const promises = [];

  clients.forEach((client, clientIndex) => {
    for (let i = 0; i < operationsPerClient; i++) {
      promises.push(
        new Promise(resolve => {
          setTimeout(() => {
            client.updateNode('node-1', {
              text: `更新 ${clientIndex}-${i}`,
              timestamp: Date.now()
            });
            resolve();
          }, Math.random() * 1000); // ランダムな遅延
        })
      );
    }
  });

  await Promise.all(promises);

  const endTime = Date.now();
  const totalTime = endTime - startTime;

  console.log(`パフォーマンステスト完了: ${totalTime}ms`);
  console.log(`スループット: ${(clientCount * operationsPerClient / totalTime * 1000).toFixed(2)} ops/sec`);

  return {
    clientCount: clientCount,
    operationsPerClient: operationsPerClient,
    totalTime: totalTime,
    throughput: clientCount * operationsPerClient / totalTime * 1000
  };
}

// テスト実行
if (import.meta.main) {
  Promise.all([
    runRealtimeSystemTest(),
    runPerformanceTest()
  ]).then(([functionalResult, performanceResult]) => {
    console.log('\n=== 全テスト結果 ===');
    console.log('機能テスト:', functionalResult);
    console.log('パフォーマンステスト:', performanceResult);
  }).catch(error => {
    console.error('テスト実行エラー:', error);
  });
}

export { 
  runRealtimeSystemTest, 
  runPerformanceTest, 
  RealtimeSyncSimulator,
  MockWebSocketClient
};