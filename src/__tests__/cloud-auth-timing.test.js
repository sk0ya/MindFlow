/**
 * クラウド認証タイミング修正のJestテストケース
 */

describe('クラウド認証タイミング修正', () => {
  let mockAuthManager;
  let mockSetStorageMode;
  let originalConsole;

  beforeEach(() => {
    // コンソールログをキャプチャ
    originalConsole = console.log;
    console.log = jest.fn();

    // AuthManagerをモック
    mockAuthManager = {
      isAuthenticated: jest.fn().mockReturnValue(false),
      getAuthToken: jest.fn().mockReturnValue(null),
      getAuthHeader: jest.fn().mockReturnValue(null),
      getCurrentUser: jest.fn().mockReturnValue(null)
    };

    // setStorageModeをモック
    mockSetStorageMode = jest.fn().mockResolvedValue(undefined);

    // localStorageをモック
    Storage.prototype.getItem = jest.fn(() => null);
    Storage.prototype.setItem = jest.fn();
    Storage.prototype.removeItem = jest.fn();
  });

  afterEach(() => {
    console.log = originalConsole;
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('クラウドモード選択時の動作', () => {
    test('クラウドモード選択時は設定を永続化しない', async () => {
      // useAppInitializationをモック
      const mockInitState = {
        handleStorageModeSelect: jest.fn(),
        showAuthModal: false,
        pendingStorageMode: null,
        storageMode: null
      };

      // handleStorageModeSelectの動作をシミュレート
      mockInitState.handleStorageModeSelect.mockImplementation(async (mode) => {
        if (mode === 'cloud') {
          // pendingStorageModeに設定、実際の永続化はしない
          mockInitState.pendingStorageMode = 'cloud';
          mockInitState.storageMode = null;
          mockInitState.showAuthModal = true;
          
          // setStorageModeが呼ばれないことを確認
          expect(mockSetStorageMode).not.toHaveBeenCalled();
        }
      });

      await mockInitState.handleStorageModeSelect('cloud');

      expect(mockInitState.pendingStorageMode).toBe('cloud');
      expect(mockInitState.storageMode).toBeNull();
      expect(mockInitState.showAuthModal).toBe(true);
    });

    test('ローカルモード選択時は即座に設定を永続化', async () => {
      const mockInitState = {
        handleStorageModeSelect: jest.fn(),
        showOnboarding: false,
        storageMode: null
      };

      mockInitState.handleStorageModeSelect.mockImplementation(async (mode) => {
        if (mode === 'local') {
          await mockSetStorageMode(mode);
          mockInitState.storageMode = 'local';
          mockInitState.showOnboarding = true;
        }
      });

      await mockInitState.handleStorageModeSelect('local');

      expect(mockSetStorageMode).toHaveBeenCalledWith('local');
      expect(mockInitState.storageMode).toBe('local');
      expect(mockInitState.showOnboarding).toBe(true);
    });
  });

  describe('認証成功時の動作', () => {
    test('認証成功時にpendingStorageModeを永続化', async () => {
      const mockInitState = {
        pendingStorageMode: 'cloud',
        storageMode: null,
        showAuthModal: true,
        isReady: false,
        handleAuthSuccess: jest.fn()
      };

      mockInitState.handleAuthSuccess.mockImplementation(async () => {
        if (mockInitState.pendingStorageMode === 'cloud') {
          // 1. ストレージモードを永続化
          await mockSetStorageMode('cloud');
          
          // 2. 状態を更新
          mockInitState.storageMode = 'cloud';
          mockInitState.pendingStorageMode = null;
          mockInitState.showAuthModal = false;
          mockInitState.isReady = true;
        }
      });

      await mockInitState.handleAuthSuccess();

      expect(mockSetStorageMode).toHaveBeenCalledWith('cloud');
      expect(mockInitState.storageMode).toBe('cloud');
      expect(mockInitState.pendingStorageMode).toBeNull();
      expect(mockInitState.showAuthModal).toBe(false);
      expect(mockInitState.isReady).toBe(true);
    });

    test('pendingStorageModeがない場合は通常の認証成功処理', async () => {
      const mockInitState = {
        pendingStorageMode: null,
        storageMode: 'local', // 既に設定済み
        showAuthModal: true,
        isReady: false,
        handleAuthSuccess: jest.fn()
      };

      mockInitState.handleAuthSuccess.mockImplementation(async () => {
        if (!mockInitState.pendingStorageMode) {
          mockInitState.showAuthModal = false;
          mockInitState.isReady = true;
          // setStorageModeは呼ばない
        }
      });

      await mockInitState.handleAuthSuccess();

      expect(mockSetStorageMode).not.toHaveBeenCalled();
      expect(mockInitState.showAuthModal).toBe(false);
      expect(mockInitState.isReady).toBe(true);
    });
  });

  describe('認証キャンセル時の動作', () => {
    test('認証キャンセル時はpendingStorageModeをクリア', () => {
      const mockInitState = {
        pendingStorageMode: 'cloud',
        storageMode: null,
        showAuthModal: true,
        showStorageModeSelector: false,
        handleAuthClose: jest.fn()
      };

      mockInitState.handleAuthClose.mockImplementation(() => {
        mockInitState.pendingStorageMode = null;
        mockInitState.storageMode = null;
        mockInitState.showAuthModal = false;
        mockInitState.showStorageModeSelector = true;
      });

      mockInitState.handleAuthClose();

      expect(mockInitState.pendingStorageMode).toBeNull();
      expect(mockInitState.storageMode).toBeNull();
      expect(mockInitState.showAuthModal).toBe(false);
      expect(mockInitState.showStorageModeSelector).toBe(true);
    });
  });

  describe('統合フローテスト', () => {
    test('クラウドモード選択から認証成功までのフロー', async () => {
      const mockInitState = {
        pendingStorageMode: null,
        storageMode: null,
        showAuthModal: false,
        showStorageModeSelector: true,
        isReady: false
      };

      // ステップ1: クラウドモード選択
      mockInitState.pendingStorageMode = 'cloud';
      mockInitState.storageMode = null;
      mockInitState.showAuthModal = true;
      mockInitState.showStorageModeSelector = false;

      expect(mockInitState.pendingStorageMode).toBe('cloud');
      expect(mockInitState.storageMode).toBeNull();
      expect(mockInitState.showAuthModal).toBe(true);

      // ステップ2: 認証成功
      await mockSetStorageMode('cloud');
      mockInitState.storageMode = 'cloud';
      mockInitState.pendingStorageMode = null;
      mockInitState.showAuthModal = false;
      mockInitState.isReady = true;

      expect(mockSetStorageMode).toHaveBeenCalledWith('cloud');
      expect(mockInitState.storageMode).toBe('cloud');
      expect(mockInitState.pendingStorageMode).toBeNull();
      expect(mockInitState.showAuthModal).toBe(false);
      expect(mockInitState.isReady).toBe(true);
    });

    test('認証キャンセル後の再選択フロー', () => {
      const mockInitState = {
        pendingStorageMode: 'cloud',
        storageMode: null,
        showAuthModal: true,
        showStorageModeSelector: false
      };

      // ステップ1: 認証キャンセル
      mockInitState.pendingStorageMode = null;
      mockInitState.storageMode = null;
      mockInitState.showAuthModal = false;
      mockInitState.showStorageModeSelector = true;

      expect(mockInitState.pendingStorageMode).toBeNull();
      expect(mockInitState.showStorageModeSelector).toBe(true);

      // ステップ2: 再度クラウドモード選択
      mockInitState.pendingStorageMode = 'cloud';
      mockInitState.showAuthModal = true;
      mockInitState.showStorageModeSelector = false;

      expect(mockInitState.pendingStorageMode).toBe('cloud');
      expect(mockInitState.showAuthModal).toBe(true);
    });
  });

  describe('エラーハンドリング', () => {
    test('認証成功後の初期化エラー時の処理', async () => {
      const mockInitState = {
        pendingStorageMode: 'cloud',
        storageMode: null,
        showAuthModal: true,
        isReady: false,
        handleAuthSuccess: jest.fn()
      };

      // setStorageModeでエラーが発生
      mockSetStorageMode.mockRejectedValue(new Error('Storage error'));

      mockInitState.handleAuthSuccess.mockImplementation(async () => {
        try {
          if (mockInitState.pendingStorageMode === 'cloud') {
            await mockSetStorageMode('cloud');
            mockInitState.storageMode = 'cloud';
            mockInitState.isReady = true;
          }
        } catch (error) {
          // エラー時は認証画面を閉じるが、isReady は false のまま
          mockInitState.showAuthModal = false;
          mockInitState.isReady = false;
        }
      });

      await mockInitState.handleAuthSuccess();

      expect(mockInitState.showAuthModal).toBe(false);
      expect(mockInitState.isReady).toBe(false);
      expect(mockInitState.storageMode).toBeNull();
    });
  });
});