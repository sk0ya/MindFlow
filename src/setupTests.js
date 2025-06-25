/**
 * Jest Setup File
 * Test environment setup and global mocks
 */

import '@testing-library/jest-dom';

// Mock environment variables
const mockEnv = {
  VITE_GITHUB_CLIENT_ID: 'test-client-id',
  VITE_GITHUB_REDIRECT_URI: 'http://localhost:3000/callback',
  VITE_API_BASE_URL: 'http://localhost:3000/api'
};

// Mock import.meta.env for Jest compatibility
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        ...mockEnv,
        NODE_ENV: 'test',
        DEV: true
      }
    }
  },
  writable: true
});

// Alternative approach for import.meta.env
if (typeof globalThis !== 'undefined') {
  globalThis.import = globalThis.import || {};
  globalThis.import.meta = globalThis.import.meta || {};
  globalThis.import.meta.env = globalThis.import.meta.env || {
    ...mockEnv,
    NODE_ENV: 'test',
    DEV: true
  };
}

// Mock fetch globally
global.fetch = jest.fn();

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    assign: jest.fn(),
    reload: jest.fn()
  },
  writable: true
});

// Mock sessionStorage
Object.defineProperty(window, 'sessionStorage', {
  value: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn()
  },
  writable: true
});

// Mock crypto for Node.js environment
Object.defineProperty(global, 'crypto', {
  value: {
    getRandomValues: jest.fn((arr) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    })
  }
});

// Mock atob/btoa for JWT decoding
global.atob = jest.fn((str) => Buffer.from(str, 'base64').toString('binary'));
global.btoa = jest.fn((str) => Buffer.from(str, 'binary').toString('base64'));