import '@testing-library/jest-dom';

// Import type definitions
import './types/jest.d.ts';

// モックしたい外部依存関係をここで設定
(global as any).ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Create properly typed storage mock
const createStorageMock = (): MockStorage => ({
  length: 0,
  key: jest.fn((_index: number) => null),
  getItem: jest.fn((_key: string) => null),
  setItem: jest.fn((_key: string, _value: string) => {}),
  removeItem: jest.fn((_key: string) => {}),
  clear: jest.fn(() => {})
});

// localStorage のモック
(global as any).localStorage = createStorageMock();

// sessionStorage のモック
(global as any).sessionStorage = createStorageMock();

// window.location のモック
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: jest.fn(),
    replace: jest.fn(),
    reload: jest.fn(),
  },
  writable: true
});

// fetch のモック
(global as any).fetch = jest.fn();

// コンソールエラーを抑制（テスト中の意図的なエラーテスト用）
const originalError = console.error;
beforeAll(() => {
  console.error = (...args) => {
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: ReactDOM.render is deprecated')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});