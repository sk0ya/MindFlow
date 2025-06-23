import { renderHook, act } from '@testing-library/react';

// モック設定をシンプルに
jest.mock('../../utils/storageRouter.js');
jest.mock('../../utils/storage.js');
jest.mock('../../utils/dataTypes.js');
jest.mock('../../utils/authManager.js');

// テスト用のシンプルなモック実装
const mockSaveMindMap = jest.fn();
const mockIsCloudStorageEnabled = jest.fn(() => true);
const mockGetAppSettings = jest.fn(() => ({ storageMode: 'cloud' }));
const mockCreateInitialData = jest.fn(() => ({
  id: 'test-id',
  title: 'Test Map',
  rootNode: { id: 'root', text: 'Root', x: 400, y: 300, children: [] }
}));

// モックの設定
beforeEach(() => {
  jest.clearAllMocks();
  
  // モックの実装を設定
  require('../../utils/storageRouter.js').saveMindMap = mockSaveMindMap;
  require('../../utils/storageRouter.js').isCloudStorageEnabled = mockIsCloudStorageEnabled;
  require('../../utils/storage.js').getAppSettings = mockGetAppSettings;
  require('../../utils/dataTypes.js').createInitialData = mockCreateInitialData;
  require('../../utils/dataTypes.js').assignColorsToExistingNodes = jest.fn(data => data);
  
  // DOM のクリア
  document.body.innerHTML = '';
});

describe('useMindMapData - Simple Cloud Sync Tests', () => {
  test('モジュールをインポートできる', () => {
    const { useMindMapData } = require('../useMindMapData');
    expect(useMindMapData).toBeDefined();
  });

  test('編集中は自動保存をスキップする', async () => {
    const { useMindMapData } = require('../useMindMapData');
    const { result } = renderHook(() => useMindMapData(true));

    // データが初期化されるまで待つ
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // 編集中の入力フィールドをシミュレート
    const mockInput = document.createElement('input');
    mockInput.classList.add('node-input');
    mockInput.value = 'editing text';
    document.body.appendChild(mockInput);
    mockInput.focus();

    // 自動保存を実行
    await act(async () => {
      if (result.current.saveImmediately) {
        await result.current.saveImmediately();
      }
    });

    // saveMindMap が呼ばれていないことを確認
    expect(mockSaveMindMap).not.toHaveBeenCalled();
  });

  test('編集中でない場合は自動保存が実行される', async () => {
    const { useMindMapData } = require('../useMindMapData');
    const { result } = renderHook(() => useMindMapData(true));

    // データが初期化されるまで待つ
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    // 編集中の要素がない状態で自動保存を実行
    await act(async () => {
      if (result.current.saveImmediately) {
        await result.current.saveImmediately();
      }
    });

    // saveMindMap が呼ばれることを確認
    expect(mockSaveMindMap).toHaveBeenCalled();
  });
});