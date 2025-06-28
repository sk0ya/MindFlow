export default {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  moduleNameMapper: {
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
    '^@/(.*)$': '<rootDir>/src/$1',
    '^lodash-es$': 'lodash',
    // TypeScript/JavaScript module resolution
    '^(.+)\\.js$': '$1',
    '^(.+)\\.ts$': '$1'
  },
  // Environment variables for import.meta.env
  globals: {
    'import.meta': {
      env: {
        VITE_API_BASE_URL: 'http://localhost:8787/api',
        VITE_GITHUB_CLIENT_ID: 'test-client-id',
        DEV: true,
        NODE_ENV: 'test'
      }
    }
  },
  transform: {
    '^.+\\.(js|jsx|ts|tsx)$': ['babel-jest', {
      presets: [
        ['@babel/preset-env', { targets: { node: 'current' } }],
        ['@babel/preset-react', { runtime: 'automatic' }],
        '@babel/preset-typescript'
      ]
    }]
  },
  transformIgnorePatterns: [
    'node_modules/(?!(lodash-es)/)'
  ],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.(js|jsx|ts|tsx)',
    '<rootDir>/src/**/*.(test|spec).(js|jsx|ts|tsx)'
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/dist/',
    '<rootDir>/src/__tests__/sync/cloudSync.test.js',
    '<rootDir>/src/__tests__/hooks/useCloudSync.test.js'
  ],
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/main.jsx',
    '!src/**/*.stories.{js,jsx,ts,tsx}',
    '!src/setupTests.js'
  ],
  coverageReporters: ['text', 'lcov', 'html'],
  testTimeout: 10000
};