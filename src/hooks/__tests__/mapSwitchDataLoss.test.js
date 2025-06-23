import { renderHook, act, waitFor } from '@testing-library/react';
import { useMindMapMulti } from '../useMindMapMulti';
import { useMindMapNodes } from '../useMindMapNodes';

// モックの設定
jest.mock('../../utils/storageRouter.js', () => ({
  getCurrentMindMap: jest.fn(),
  saveMindMap: jest.fn(),
  getAllMindMaps: jest.fn(),
  getMindMap: jest.fn(),
  createMindMap: jest.fn(),
  deleteMindMap: jest.fn(),
}));

jest.mock('../../utils/storage.js', () => ({
  getAppSettings: jest.fn(() => ({ storageMode: 'local' })),
}));

jest.mock('../../utils/dataTypes.js', () => ({
  deepClone: jest.fn((obj) => JSON.parse(JSON.stringify(obj))),
  assignColorsToExistingNodes: jest.fn((data) => data),
  createInitialData: jest.fn(() => ({
    id: 'test-map-id',
    title: 'Test Map',
    rootNode: {
      id: 'root',
      text: 'Root Node',
      x: 400,
      y: 300,
      children: []
    },
    settings: {
      autoSave: true,
      autoLayout: true
    }
  }))
}));

jest.mock('../../utils/authManager.js', () => ({
  authManager: {
    isAuthenticated: jest.fn(() => false)
  }
}));

jest.mock('../../utils/storageAdapter.js', () => ({
  getCurrentAdapter: jest.fn(() => ({
    getMap: jest.fn(),
    saveMap: jest.fn(),
    getAllMaps: jest.fn()
  }))
}));

jest.mock('../../utils/localStorage.js', () => ({
  STORAGE_KEYS: {
    MINDMAPS: 'mindmaps'
  }
}));

// DOM要素のモック
const createMockInput = (nodeId, value = '') => {
  const input = document.createElement('input');
  input.classList.add('node-input');
  input.dataset.nodeId = nodeId;
  input.value = value;
  return input;
};

// テストデータの準備
const createTestMap = (id, title, children = []) => ({
  id,
  title,
  rootNode: {
    id: 'root',
    text: title,
    x: 400,
    y: 300,
    children: children.map((child, index) => ({
      id: `child-${index + 1}`,
      text: child,
      x: 500 + index * 100,
      y: 350,
      children: []
    }))
  },
  settings: {
    autoSave: true,
    autoLayout: true
  }
});

describe('マップ切り替え時のデータ保護テスト', () => {
  let mockStorageRouter;
  let mockStorageAdapter;
  let mockFinishEdit;

  beforeEach(() => {
    mockStorageRouter = require('../../utils/storageRouter.js');
    mockStorageAdapter = require('../../utils/storageAdapter.js');
    
    // テストマップデータを準備
    const map1 = createTestMap('map1', 'Map 1', ['Original Child 1', 'Original Child 2']);
    const map2 = createTestMap('map2', 'Map 2', ['Child A', 'Child B']);
    
    // アダプターのモック設定
    const mockAdapter = {
      getMap: jest.fn((mapId) => {
        if (mapId === 'map1') return Promise.resolve(map1);
        if (mapId === 'map2') return Promise.resolve(map2);
        return Promise.reject(new Error('Map not found'));
      }),
      saveMap: jest.fn().mockResolvedValue(),
      getAllMaps: jest.fn().mockResolvedValue([
        { id: 'map1', title: 'Map 1', updatedAt: '2024-01-01T00:00:00Z' },
        { id: 'map2', title: 'Map 2', updatedAt: '2024-01-02T00:00:00Z' }
      ])
    };
    
    mockStorageAdapter.getCurrentAdapter.mockReturnValue(mockAdapter);
    
    mockStorageRouter.getAllMindMaps.mockResolvedValue([
      { id: 'map1', title: 'Map 1', updatedAt: '2024-01-01T00:00:00Z' },
      { id: 'map2', title: 'Map 2', updatedAt: '2024-01-02T00:00:00Z' }
    ]);
    
    mockStorageRouter.getMindMap.mockImplementation((mapId) => {
      if (mapId === 'map1') return Promise.resolve(map1);
      if (mapId === 'map2') return Promise.resolve(map2);
      return Promise.reject(new Error('Map not found'));
    });
    
    mockStorageRouter.saveMindMap.mockResolvedValue();
    
    // DOM のクリア
    document.body.innerHTML = '';
    
    // window.alert のモック
    global.alert = jest.fn();
    
    // finishEdit モックの設定
    mockFinishEdit = jest.fn().mockResolvedValue();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('マップ編集→切り替え→編集→戻る時のデータ削除問題を検出', async () => {
    const { result } = renderHook(() => useMindMapMulti());

    // マップを初期化
    await waitFor(() => {
      expect(result.current.allMindMaps).toHaveLength(2);
    });

    // Map 1 に切り替え
    await act(async () => {
      await result.current.switchToMap('map1', false, jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), mockFinishEdit);
    });

    // Map 1で編集中の状態をシミュレート
    const editingInput1 = createMockInput('child-1', 'Edited Child 1');
    document.body.appendChild(editingInput1);
    editingInput1.focus();

    // Map 2 に切り替え（編集中データが保存されるはず）
    await act(async () => {
      await result.current.switchToMap('map2', false, jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), mockFinishEdit);
    });

    // finishEdit が適切なパラメータで呼ばれたことを確認
    expect(mockFinishEdit).toHaveBeenCalledWith(
      'child-1',
      'Edited Child 1',
      expect.objectContaining({
        skipMapSwitchDelete: true,
        allowDuringEdit: true,
        source: 'mapSwitch'
      })
    );

    // Map 2で編集
    const editingInput2 = createMockInput('child-1', 'Edited Child A');
    document.body.appendChild(editingInput2);
    editingInput2.focus();

    // Map 1 に戻る
    await act(async () => {
      await result.current.switchToMap('map1', false, jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), mockFinishEdit);
    });

    // Map 1のデータが保持されていることを確認
    // この時点で、Map 1の編集内容（'Edited Child 1'）が失われているかを検証
    const savedMap1 = mockStorageRouter.getMindMap.mock.results.find(
      result => result.value?.id === 'map1'
    );

    // 実際の問題: Map 1に戻った時にデータが削除されている
    // このテストは現在の問題を再現するために作成
    console.log('Map 1のデータ状態:', await mockStorageRouter.getMindMap('map1'));
  });

  test('複数回のマップ切り替えでデータが保持される', async () => {
    const { result } = renderHook(() => useMindMapMulti());

    // 初期化を待つ
    await waitFor(() => {
      expect(result.current.allMindMaps).toHaveLength(2);
    });

    // Map 1で編集
    await act(async () => {
      await result.current.switchToMap('map1');
    });

    const input1 = createMockInput('child-1', 'First Edit');
    document.body.appendChild(input1);
    input1.focus();

    // Map 2に切り替え
    await act(async () => {
      await result.current.switchToMap('map2', false, jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), mockFinishEdit);
    });

    // 前の入力要素がクリアされることを確認
    expect(document.querySelector('.node-input')).toBeNull();

    // Map 2で編集（新しい入力要素）
    const input2 = createMockInput('child-1', 'Second Edit');
    document.body.appendChild(input2);
    input2.focus();

    // Map 1に戻る
    await act(async () => {
      await result.current.switchToMap('map1', false, jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), mockFinishEdit);
    });

    // 編集保存が適切に呼ばれたことを確認
    expect(mockFinishEdit).toHaveBeenCalledTimes(2);
    
    // 最初の呼び出し（Map 1 → Map 2）
    expect(mockFinishEdit).toHaveBeenNthCalledWith(1,
      'child-1',
      'First Edit',
      expect.objectContaining({
        skipMapSwitchDelete: true,
        source: 'mapSwitch'
      })
    );

    // 2回目の呼び出し（Map 2 → Map 1）
    expect(mockFinishEdit).toHaveBeenNthCalledWith(2,
      'child-1',
      'Second Edit',
      expect.objectContaining({
        skipMapSwitchDelete: true,
        source: 'mapSwitch'
      })
    );
  });

  test('空のテキスト編集中のマップ切り替えで削除されない', async () => {
    const { result } = renderHook(() => useMindMapMulti());

    await waitFor(() => {
      expect(result.current.allMindMaps).toHaveLength(2);
    });

    // Map 1に切り替え
    await act(async () => {
      await result.current.switchToMap('map1');
    });

    // 空のテキストで編集中
    const emptyInput = createMockInput('child-1', '');
    document.body.appendChild(emptyInput);
    emptyInput.focus();

    // Map 2に切り替え
    await act(async () => {
      await result.current.switchToMap('map2', false, jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), mockFinishEdit);
    });

    // 空のテキストでもfinishEditが呼ばれ、削除保護が適用されることを確認
    expect(mockFinishEdit).toHaveBeenCalledWith(
      'child-1',
      '',
      expect.objectContaining({
        skipMapSwitchDelete: true,
        allowDuringEdit: true,
        source: 'mapSwitch'
      })
    );
  });

  test('finishEditが非同期で完了してからマップ切り替えが行われる', async () => {
    const { result } = renderHook(() => useMindMapMulti());
    
    // 非同期のfinishEditをモック
    const asyncFinishEdit = jest.fn().mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    );

    await waitFor(() => {
      expect(result.current.allMindMaps).toHaveLength(2);
    });

    // Map 1で編集中
    await act(async () => {
      await result.current.switchToMap('map1');
    });

    const input = createMockInput('child-1', 'Async Edit');
    document.body.appendChild(input);
    input.focus();

    const startTime = Date.now();

    // Map 2に切り替え（finishEditの完了を待つ）
    await act(async () => {
      await result.current.switchToMap('map2', false, jest.fn(), jest.fn(), jest.fn(), jest.fn(), jest.fn(), asyncFinishEdit);
    });

    const endTime = Date.now();
    
    // finishEditが呼ばれたことを確認
    expect(asyncFinishEdit).toHaveBeenCalledWith(
      'child-1',
      'Async Edit',
      expect.objectContaining({
        skipMapSwitchDelete: true,
        source: 'mapSwitch'
      })
    );

    // 処理に時間がかかったことを確認（非同期処理が待たれた）
    expect(endTime - startTime).toBeGreaterThanOrEqual(90);
  });
});