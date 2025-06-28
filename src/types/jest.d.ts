/**
 * Jest type definitions for test files
 */

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeInTheDocument(): R;
      toHaveStyle(css: Record<string, any>): R;
      toHaveClass(className: string): R;
    }
  }

  // Mock function types
  type MockFn<T extends (...args: any[]) => any> = jest.MockedFunction<T>;
  
  // Storage mock interface
  interface MockStorage extends Storage {
    length: number;
    key(index: number): string | null;
    getItem: jest.MockedFunction<(key: string) => string | null>;
    setItem: jest.MockedFunction<(key: string, value: string) => void>;
    removeItem: jest.MockedFunction<(key: string) => void>;
    clear: jest.MockedFunction<() => void>;
  }

  // Mock location interface
  interface MockLocation {
    href: string;
    assign: jest.MockedFunction<(url: string) => void>;
    reload: jest.MockedFunction<() => void>;
  }

  // Crypto mock interface
  interface MockCrypto {
    getRandomValues: jest.MockedFunction<(array: Uint8Array) => Uint8Array>;
  }

  // Global mock declarations
  var localStorage: MockStorage;
  var sessionStorage: MockStorage;
  var fetch: jest.MockedFunction<typeof globalThis.fetch>;
  var crypto: MockCrypto;
  var atob: jest.MockedFunction<(data: string) => string>;
  var btoa: jest.MockedFunction<(data: string) => string>;
}

export {};