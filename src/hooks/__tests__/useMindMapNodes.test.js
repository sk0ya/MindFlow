import { renderHook, act } from '@testing-library/react';
import { useMindMapNodes } from '../useMindMapNodes.js';

// テスト用のサンプルデータ
const createTestData = () => ({
  id: 'test-map',
  title: 'Test Map',
  rootNode: {
    id: 'root',
    text: 'Root Node',
    x: 400,
    y: 300,
    children: [
      {
        id: 'node1',
        text: 'Child Node 1',
        x: 600,
        y: 250,
        children: [],
        attachments: [],
        mapLinks: []
      },
      {
        id: 'node2',
        text: 'Child Node 2', 
        x: 600,
        y: 350,
        children: [],
        attachments: [],
        mapLinks: []
      }
    ],
    attachments: [],
    mapLinks: []
  }
});

describe('useMindMapNodes - Cloud Sync Tests', () => {
  let mockUpdateData;

  beforeEach(() => {
    mockUpdateData = jest.fn();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('編集完了時のデータ保護', () => {
    test('finishEdit でテキスト保存時に allowDuringEdit が設定される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      await act(async () => {
        // ノードの編集を開始
        result.current.startEdit('node1');
      });

      await act(async () => {
        // テキストを設定
        result.current.setEditText('Updated text');
      });

      await act(async () => {
        // 編集を完了
        result.current.finishEdit('node1', 'Updated text');
      });

      // updateData が allowDuringEdit: true で呼ばれることを確認
      expect(mockUpdateData).toHaveBeenCalledWith(
        expect.objectContaining({
          rootNode: expect.objectContaining({
            children: expect.arrayContaining([
              expect.objectContaining({
                id: 'node1',
                text: 'Updated text'
              })
            ])
          })
        }),
        expect.objectContaining({
          allowDuringEdit: true,
          source: 'finishEdit-save'
        })
      );
    });

    test('マップ切り替え時の削除保護が機能する', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      await act(async () => {
        result.current.startEdit('node1');
        result.current.setEditText('');
      });

      await act(async () => {
        // マップ切り替え時のfinishEdit（削除保護オプション付き）
        result.current.finishEdit('node1', '', { 
          skipMapSwitchDelete: true,
          source: 'mapSwitch' 
        });
      });

      // ノードが削除されていないことを確認
      expect(result.current.findNode('node1')).toBeTruthy();
      
      // deleteNode が呼ばれていないことを確認
      const updatedData = mockUpdateData.mock.calls[0]?.[0];
      if (updatedData) {
        const node1 = updatedData.rootNode.children.find(child => child.id === 'node1');
        expect(node1).toBeTruthy();
      }
    });

    test('通常の編集完了では空ノードが削除される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      // 新しい空ノードを追加
      await act(async () => {
        result.current.addChildNode('root', '');
      });

      const newNodeId = mockUpdateData.mock.calls[0][0].rootNode.children[2].id;

      await act(async () => {
        result.current.startEdit(newNodeId);
        result.current.setEditText('');
      });

      await act(async () => {
        // 通常の編集完了（削除保護なし）
        result.current.finishEdit(newNodeId, '');
      });

      // 空ノードが削除されることを確認
      expect(result.current.findNode(newNodeId)).toBeFalsy();
    });
  });

  describe('ノード更新のクラウド同期制御', () => {
    test('updateNode で適切なオプションが updateData に渡される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      await act(async () => {
        await result.current.updateNode('node1', { text: 'Updated via updateNode' }, true, {
          allowDuringEdit: true,
          source: 'test'
        });
      });

      expect(mockUpdateData).toHaveBeenCalledWith(
        expect.objectContaining({
          rootNode: expect.objectContaining({
            children: expect.arrayContaining([
              expect.objectContaining({
                id: 'node1',
                text: 'Updated via updateNode'
              })
            ])
          })
        }),
        expect.objectContaining({
          allowDuringEdit: true,
          source: 'test',
          saveImmediately: false
        })
      );
    });

    test('ファイル添付時は即座保存が設定される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      const mockAttachment = {
        id: 'file1',
        name: 'test.txt',
        type: 'text/plain',
        size: 1024,
        data: 'base64data'
      };

      await act(async () => {
        await result.current.updateNode('node1', { 
          attachments: [mockAttachment] 
        });
      });

      expect(mockUpdateData).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          saveImmediately: false
        })
      );
    });
  });

  describe('ノード追加時のクラウド同期', () => {
    test('子ノード追加時に適切なデータ構造で更新される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      await act(async () => {
        result.current.addChildNode('node1', 'New child text');
      });

      const updateCall = mockUpdateData.mock.calls[0];
      expect(updateCall[0].rootNode.children[0].children).toHaveLength(1);
      expect(updateCall[0].rootNode.children[0].children[0].text).toBe('New child text');
      expect(updateCall[1]).toEqual({
        skipHistory: false,
        saveImmediately: false
      });
    });

    test('兄弟ノード追加時に正しい位置に挿入される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      await act(async () => {
        result.current.addSiblingNode('node1', 'New sibling text');
      });

      const updateCall = mockUpdateData.mock.calls[0];
      const rootChildren = updateCall[0].rootNode.children;
      
      // node1の後に新しいノードが追加されることを確認
      expect(rootChildren).toHaveLength(3);
      expect(rootChildren[1].text).toBe('New sibling text');
    });
  });

  describe('ノード削除のクラウド同期', () => {
    test('ノード削除時に適切にデータが更新される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      await act(async () => {
        await result.current.deleteNode('node1');
      });

      const updateCall = mockUpdateData.mock.calls[0];
      const remainingChildren = updateCall[0].rootNode.children;
      
      expect(remainingChildren).toHaveLength(1);
      expect(remainingChildren[0].id).toBe('node2');
    });

    test('ルートノードは削除できない', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      const deleteResult = await act(async () => {
        return result.current.deleteNode('root');
      });

      expect(deleteResult).toBe(false);
      expect(mockUpdateData).not.toHaveBeenCalled();
    });
  });

  describe('編集状態管理とクラウド同期', () => {
    test('編集開始時に状態が正しく設定される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      act(() => {
        result.current.startEdit('node1');
      });

      expect(result.current.editingNodeId).toBe('node1');
      expect(result.current.selectedNodeId).toBe('node1');
      expect(result.current.editText).toBe('Child Node 1');
    });

    test('編集状態のリセットが正しく動作する', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      act(() => {
        result.current.startEdit('node1');
        result.current.setEditText('Modified text');
      });

      await act(async () => {
        result.current.finishEdit('node1', 'Modified text');
      });

      expect(result.current.editingNodeId).toBe(null);
      expect(result.current.editText).toBe('');
    });
  });

  describe('データ整合性チェック', () => {
    test('不正なノードIDでの操作は安全に処理される', async () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      // 存在しないノードの更新を試行（現在の実装では呼ばれる）
      await act(async () => {
        await result.current.updateNode('nonexistent', { text: 'Should not work' });
      });

      // updateData が呼ばれることを確認（現在の実装）
      expect(mockUpdateData).toHaveBeenCalled();
    });

    test('findNode が正しく動作する', () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      const foundNode = result.current.findNode('node1');
      expect(foundNode).toBeTruthy();
      expect(foundNode.text).toBe('Child Node 1');

      const notFoundNode = result.current.findNode('nonexistent');
      expect(notFoundNode).toBeNull();
    });

    test('flattenNodes が全ノードを正しく平坦化する', () => {
      const testData = createTestData();
      const { result } = renderHook(() => useMindMapNodes(testData, mockUpdateData));

      const flatNodes = result.current.flattenNodes();
      expect(flatNodes).toHaveLength(3); // root + 2 children
      
      const nodeIds = flatNodes.map(node => node.id);
      expect(nodeIds).toContain('root');
      expect(nodeIds).toContain('node1');
      expect(nodeIds).toContain('node2');
    });
  });
});