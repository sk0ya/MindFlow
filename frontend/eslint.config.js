import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['node_modules/**', 'dist/**', '.vite/**', 'build/**'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true
        },
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react': reactPlugin,
      'react-hooks': reactHooksPlugin
    },
    rules: {
      // 危険な型パターンを防止する最重要ルール
      '@typescript-eslint/no-explicit-any': 'error',
      
      // 型アサーション制限
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/prefer-as-const': 'warn',
      
      // null/undefined安全性 (IndexedDBでは初期化チェック後に!を使用)
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/no-non-null-asserted-optional-chain': 'error',
      
      // 未使用変数・関数
      '@typescript-eslint/no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        ignoreRestSiblings: true
      }],
      
      // React固有ルール
      'react/prop-types': 'off', // TypeScriptで型チェックするため
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      
      // 基本的なJavaScript/TypeScriptルール
      'no-console': ['warn', { allow: ['warn', 'error', 'log'] }],
      'no-debugger': 'error',
      'no-alert': 'error',
      'no-var': 'error',
      'prefer-const': 'error',
      'no-undef': 'off', // TypeScriptで処理
      
      // Import/Export
      'no-duplicate-imports': 'error'
    },
    settings: {
      react: {
        version: 'detect'
      }
    }
  },
  {
    // JavaScript files (less strict)
    files: ['**/*.js', '**/*.mjs'],
    rules: {
      '@typescript-eslint/no-var-requires': 'off'
    }
  },
  {
    // Configuration files
    files: ['*.config.js', '.eslintrc.cjs'],
    languageOptions: {
      globals: {
        module: true,
        require: true,
        __dirname: true,
        process: true
      }
    }
  }
];