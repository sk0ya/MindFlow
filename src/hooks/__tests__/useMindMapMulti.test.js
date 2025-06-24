import { renderHook, act, waitFor } from '@testing-library/react';
import { useMindMapMulti } from '../useMindMapMulti';

// モックの設定
jest.mock('../../utils/storageAdapter.js', () => ({
  getCurrentAdapter: jest.fn(),
}));

jest.mock('../../utils/storageRouter.js', () => ({
  getCurrentMindMap: jest.fn(),
  getAllMindMaps: jest.fn(),
  createNewMindMap: jest.fn(),
  deleteMindMap: jest.fn(),
  saveMindMap: jest.fn(),
  isCloudStorageEnabled: jest.fn()
}));

jest.mock('../../utils/dataTypes.js', () => ({
  deepClone: jest.fn((obj) => JSON.parse(JSON.stringify(obj))),
  assignColorsToExistingNodes: jest.fn((data) => data),
  createInitialData: jest.fn(() => ({
    id: `map_${Date.now()}_0_${Math.random().toString(36).substr(2, 10)}`,
    title: 'New Map',
    rootNode: {
      id: 'root',
      text: 'New Map',
      x: 400,
      y: 300,
      children: []
    },
    category: '未分類'
  }))
}));

jest.mock('../../utils/storageUtils.js', () => ({
  getAppSettings: jest.fn(() => ({ storageMode: 'local' }))
}));

jest.mock('../../utils/realtimeSync.js', () => ({
  realtimeSync: {
    updateMap: jest.fn(),
    deleteMap: jest.fn()
  }
}));

// テスト用のサンプルデータ
const createTestMap1 = () => ({
  id: 'map1',
  title: 'Test Map 1',
  category: '仕事',
  rootNode: {
    id: 'root',
    text: 'Root 1',
    x: 400,
    y: 300,
    children: [
      {
        id: 'node1',
        text: 'Child 1',
        x: 600,
        y: 250,
        children: []
      }
    ]
  },
  updatedAt: '2024-01-01T00:00:00Z'
});

const createTestMap2 = () => ({
  id: 'map2',
  title: 'Test Map 2',
  category: '個人',
  rootNode: {
    id: 'root',
    text: 'Root 2',
    x: 400,
    y: 300,
    children: []
  },
  updatedAt: '2024-01-02T00:00:00Z'
});

// DOM入力要素のモック
const createMockInput = (nodeId, value) => {
  const input = document.createElement('input');
  input.classList.add('node-input');
  input.dataset.nodeId = nodeId;
  input.value = value;
  return input;
};

describe('useMindMapMulti - Map Switching Tests', () => {
  let mockAdapter;
  let mockSetData;
  let mockUpdateData;

  beforeEach(() => {
    mockSetData = jest.fn();
    mockUpdateData = jest.fn();
    
    mockAdapter = {
      getAllMaps: jest.fn().mockResolvedValue([]),
      getMap: jest.fn(),
      saveMap: jest.fn().mockResolvedValue(),
      deleteMap: jest.fn().mockResolvedValue(true),
      createMap: jest.fn(),
      updateMap: jest.fn().mockResolvedValue()
    };

    const { getCurrentAdapter } = require('../../utils/storageAdapter.js');
    getCurrentAdapter.mockReturnValue(mockAdapter);

    // Reset storage router mocks
    const storageRouter = require('../../utils/storageRouter.js');
    storageRouter.getAllMindMaps.mockReset();
    storageRouter.getAllMindMaps.mockResolvedValue([]);
    storageRouter.saveMindMap.mockReset();
    storageRouter.saveMindMap.mockResolvedValue();
    storageRouter.deleteMindMap.mockReset();
    storageRouter.deleteMindMap.mockResolvedValue();

    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('マップ切り替え時の編集保護', () => {
    test('編集中のノードがある場合、切り替え前に保存される', async () => {
      const testData = createTestMap1();
      const { result } = renderHook(() => useMindMapMulti(testData, mockSetData, mockUpdateData));

      const mockSetSelectedNodeId = jest.fn();
      const mockSetEditingNodeId = jest.fn();
      const mockSetEditText = jest.fn();
      const mockFinishEdit = jest.fn();
      
      // 編集中の状態を模擬
      const mockInput = createMockInput('node1', 'edited text');
      document.body.appendChild(mockInput);
      mockInput.focus();

      const targetMap = createTestMap2();
      mockAdapter.getMap.mockResolvedValue(targetMap);

      await act(async () => {
        await result.current.switchToMap(
          'map2',
          false,
          mockSetSelectedNodeId,
          mockSetEditingNodeId, 
          mockSetEditText,
          null,
          null,
          mockFinishEdit
        );
      });

      // finishEdit が適切なオプションで呼ばれることを確認
      expect(mockFinishEdit).toHaveBeenCalledWith(
        'node1',
        'edited text',
        expect.objectContaining({
          skipMapSwitchDelete: true,
          allowDuringEdit: true,
          source: 'mapSwitch'
        })
      );

      // マップが切り替わることを確認
      expect(mockSetData).toHaveBeenCalledWith(targetMap);
    });

    test('編集中でない場合は通常通り切り替わる', async () => {
      const testData = createTestMap1();
      const { result } = renderHook(() => useMindMapMulti(testData, mockSetData, mockUpdateData));

      const mockSetSelectedNodeId = jest.fn();
      const mockSetEditingNodeId = jest.fn();
      const mockSetEditText = jest.fn();
      const mockFinishEdit = jest.fn();

      const targetMap = createTestMap2();
      mockAdapter.getMap.mockResolvedValue(targetMap);

      await act(async () => {
        await result.current.switchToMap(
          'map2',
          false,
          mockSetSelectedNodeId,
          mockSetEditingNodeId,
          mockSetEditText,
          null,
          null,
          mockFinishEdit
        );
      });

      // finishEdit は呼ばれない
      expect(mockFinishEdit).not.toHaveBeenCalled();
      
      // マップが切り替わることを確認
      expect(mockSetData).toHaveBeenCalledWith(targetMap);
      expect(mockSetEditingNodeId).toHaveBeenCalledWith(null);
      expect(mockSetEditText).toHaveBeenCalledWith('');
    });

    test('空の編集テキストでも保護される', async () => {
      const testData = createTestMap1();
      const { result } = renderHook(() => useMindMapMulti(testData, mockSetData, mockUpdateData));

      const mockFinishEdit = jest.fn();
      
      // 空の編集中状態を模擬
      const mockInput = createMockInput('node1', '');
      document.body.appendChild(mockInput);
      mockInput.focus();

      const targetMap = createTestMap2();
      mockAdapter.getMap.mockResolvedValue(targetMap);

      await act(async () => {
        await result.current.switchToMap(
          'map2', false, jest.fn(), jest.fn(), jest.fn(), null, null, mockFinishEdit
        );
      });

      // 空のテキストでもfinishEditが呼ばれる（削除保護付き）
      expect(mockFinishEdit).toHaveBeenCalledWith(
        'node1',
        '',
        expect.objectContaining({
          skipMapSwitchDelete: true
        })
      );
    });
  });

  describe('マップデータの整合性チェック', () => {
    test('破損したマップデータの場合はエラーが発生する', async () => {
      const testData = createTestMap1();
      const { result } = renderHook(() => useMindMapMulti(testData, mockSetData, mockUpdateData));

      // 破損したデータ（rootNodeがない）
      const brokenMap = { id: 'map2', title: 'Broken Map' };
      mockAdapter.getMap.mockResolvedValue(brokenMap);

      // console.error とalertをモック
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await act(async () => {
        await result.current.switchToMap('map2', false, jest.fn(), jest.fn(), jest.fn());
      });

      expect(consoleSpy).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('マップの切り替えに失敗しました')
      );

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });

    test('rootNode.childrenが配列でない場合は修正される', async () => {
      const testData = createTestMap1();
      const { result } = renderHook(() => useMindMapMulti(testData, mockSetData, mockUpdateData));

      const mapWithoutChildren = {
        id: 'map2',
        title: 'Map Without Children Array',
        rootNode: {
          id: 'root',
          text: 'Root',
          x: 400,
          y: 300
          // children プロパティがない
        }
      };

      mockAdapter.getMap.mockResolvedValue(mapWithoutChildren);

      await act(async () => {
        await result.current.switchToMap('map2', false, jest.fn(), jest.fn(), jest.fn());
      });

      // setData が呼ばれた際に children が配列として修正されている
      expect(mockSetData).toHaveBeenCalledWith(
        expect.objectContaining({
          rootNode: expect.objectContaining({
            children: []
          })
        })
      );
    });
  });

  describe('マップ一覧管理', () => {
    test('getAllMindMaps が正しく動作する', async () => {
      const mockMaps = [createTestMap1(), createTestMap2()];
      
      const storageRouter = require('../../utils/storageRouter.js');
      storageRouter.getAllMindMaps.mockResolvedValue(mockMaps);

      const { result } = renderHook(() => useMindMapMulti(null, mockSetData, mockUpdateData));

      await waitFor(() => {
        expect(result.current.allMindMaps).toEqual(mockMaps);
      });
    });

    test('createMindMap で新しいマップが作成される', async () => {
      const { result } = renderHook(() => useMindMapMulti(null, mockSetData, mockUpdateData));

      const mockCreatedMap = {
        id: 'new-map-id',
        title: 'New Map',
        category: 'テスト'
      };
      mockAdapter.createMap.mockResolvedValue(mockCreatedMap);
      mockAdapter.getMap.mockResolvedValue(mockCreatedMap);

      const createdId = await act(async () => {
        return result.current.createMindMap('New Map', 'テスト');
      });

      expect(createdId).toBe('new-map-id');
      expect(mockAdapter.createMap).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Map',
          category: 'テスト'
        })
      );
    });

    test('deleteMindMapById でマップが削除される', async () => {
      const mockMaps = [createTestMap1(), createTestMap2()];
      
      const storageRouter = require('../../utils/storageRouter.js');
      storageRouter.getAllMindMaps.mockResolvedValue(mockMaps);
      storageRouter.deleteMindMap.mockResolvedValue(true);

      const { result } = renderHook(() => useMindMapMulti(createTestMap1(), mockSetData, mockUpdateData));

      await waitFor(() => {
        expect(result.current.allMindMaps).toHaveLength(2);
      });

      const deleteResult = await act(async () => {
        return result.current.deleteMindMapById('map1');
      });

      expect(deleteResult).toBe(true);
      expect(storageRouter.deleteMindMap).toHaveBeenCalledWith('map1');
    });
  });

  describe('カテゴリー管理', () => {
    test('getAvailableCategories で重複のないカテゴリ一覧が取得される', async () => {
      const mockMaps = [
        { ...createTestMap1(), category: '仕事' },
        { ...createTestMap2(), category: '個人' },
        { id: 'map3', title: 'Map 3', category: '仕事' }, // 重複
        { id: 'map4', title: 'Map 4', category: '' } // 空
      ];

      const storageRouter = require('../../utils/storageRouter.js');
      storageRouter.getAllMindMaps.mockResolvedValue(mockMaps);

      const { result } = renderHook(() => useMindMapMulti(null, mockSetData, mockUpdateData));

      await waitFor(() => {
        expect(result.current.allMindMaps).toHaveLength(4);
      });

      const categories = result.current.getAvailableCategories();
      
      expect(categories).toContain('未分類'); // デフォルト
      expect(categories).toContain('仕事');
      expect(categories).toContain('個人');
      expect(categories).toHaveLength(3); // 重複排除されている
    });

    test('changeMapCategory でカテゴリが変更される', async () => {
      const mockMaps = [createTestMap1()];
      
      const storageRouter = require('../../utils/storageRouter.js');
      storageRouter.getAllMindMaps.mockResolvedValue(mockMaps);
      storageRouter.saveMindMap.mockResolvedValue();

      const { result } = renderHook(() => useMindMapMulti(createTestMap1(), mockSetData, mockUpdateData));

      await act(async () => {
        await result.current.changeMapCategory('map1', '新カテゴリ');
      });

      // Verify that setData was called - it might be called with a function
      expect(mockSetData).toHaveBeenCalled();
      
      // Check the function was called with the right parameter
      const callArgs = mockSetData.mock.calls[0][0];
      if (typeof callArgs === 'function') {
        // If called with a function, test the function result
        const testPrevState = createTestMap1();
        const result = callArgs(testPrevState);
        expect(result).toEqual(
          expect.objectContaining({
            category: '新カテゴリ'
          })
        );
      } else {
        // If called with object directly
        expect(callArgs).toEqual(
          expect.objectContaining({
            category: '新カテゴリ'
          })
        );
      }
    });
  });

  describe('エラーハンドリング', () => {
    test('ネットワークエラー時の適切な処理', async () => {
      const testData = createTestMap1();
      const { result } = renderHook(() => useMindMapMulti(testData, mockSetData, mockUpdateData));

      mockAdapter.getMap.mockRejectedValue(new Error('Network error'));
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();

      await act(async () => {
        await result.current.switchToMap('map2', false, jest.fn(), jest.fn(), jest.fn());
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        '❌ マップ切り替え失敗:', 
        expect.any(Error)
      );
      
      expect(alertSpy).toHaveBeenCalledWith(
        'マップの切り替えに失敗しました: Network error'
      );

      consoleSpy.mockRestore();
      alertSpy.mockRestore();
    });

    test('マップ作成失敗時の処理', async () => {
      const { result } = renderHook(() => useMindMapMulti(null, mockSetData, mockUpdateData));

      mockAdapter.createMap.mockRejectedValue(new Error('Creation failed'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      await act(async () => {
        try {
          await result.current.createMindMap('Failed Map', 'テスト');
        } catch (error) {
          // Expected to throw error
          expect(error.message).toBe('Creation failed');
        }
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});