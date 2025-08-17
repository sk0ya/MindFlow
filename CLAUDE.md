# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
- `npm run dev` - Start development server with Vite
- `npm run build` - Build production version (includes validation)
- `npm run preview` - Preview built app locally 
- `npm run serve` - Serve production build

### Testing & Quality
- `npm run type-check` - Run TypeScript type checking
- `npm run type-check:strict` - Run strict TypeScript checking
- `npm run lint` - Run ESLint on source files
- `npm run lint:fix` - Fix auto-fixable ESLint issues
- `npm run test` - Run Jest test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

### Specialized Testing
- `npm run test:cloud-sync` - Test cloud synchronization features
- `npm run test:integration` - Run integration tests for sync and hooks
- `npm run test:unit` - Run unit tests for utilities

### Security & Safety
- `npm run scan:unsafe` - Detect unsafe patterns in code
- `npm run scan:unsafe-ci` - Run unsafe pattern detection for CI
- `npm run validate` - Run validation checks before build

## Project Architecture

### High-Level Structure
This is a React-based mindmap application with a modular architecture supporting multiple storage modes:

- **Storage Modes**: Local (localStorage/IndexedDB) and Cloud
- **Entry Point**: `src/App.tsx` dynamically imports the main app based on storage mode
- **Main App**: Located in `src/app/` with modular feature-based organization

### Core Architecture Components

#### Storage System (`src/app/core/storage/`)
- **StorageAdapterFactory**: Creates appropriate storage adapters based on configuration
- **Adapters**: LocalStorageAdapter, CloudStorageAdapter
- Two storage modes support different use cases:
  - `local`: Pure local storage using localStorage and IndexedDB
  - `cloud`: Cloud-based storage with authentication

#### State Management (`src/app/core/`)
- **Hooks-based Architecture**: Specialized hooks for different concerns
  - `useMindMap`: Main orchestrating hook that combines all others
  - `useMindMapData`: Data and node operations
  - `useMindMapUI`: UI state management
  - `useMindMapActions`: Actions and history management
  - `useMindMapPersistence`: Storage and persistence logic
- **Zustand Store**: Located in `src/app/core/store/` with slices for different domains
- **Auto-save**: Debounced auto-save with manual save override

#### Feature Structure (`src/app/features/`)
- **MindMap Feature** (`mindmap/`): Core mindmap functionality
  - Layout components (header, sidebar, workspace, canvas)
  - Core components (nodes, connections, drag handlers)
  - Modals and panels for various interactions
- **Files Feature** (`files/`): File import/export and attachment handling

#### Shared Resources (`src/app/shared/`)
- UI components, constants, types, and utilities used across features
- Note: There's also a `src/shared/` for project-wide shared resources

### Key Technical Details

#### Magic Link Authentication
The app detects magic link tokens in URL parameters (`?token=...`) and automatically switches to cloud mode for authenticated users.

#### Storage Mode Persistence
Storage mode selection is persisted in localStorage as `mindflow_storage_mode`.

#### Data Model
- Normalized data structure for efficient updates
- Auto-layout system for node positioning
- History management with undo/redo (up to 50 operations)
- Real-time auto-save with debouncing (300ms)

### Important Patterns

#### Import Paths
After recent refactoring, the project uses relative imports instead of path aliases. When editing files in `src/app/`, use relative paths like `../../shared/types` instead of absolute imports.

#### Authentication Flow
Cloud mode wraps the app with `AuthProvider`. Local mode bypasses authentication entirely.

#### Component Lazy Loading
The main app component is lazy-loaded to support the dynamic storage mode switching pattern.

### Development Notes

#### Type Safety
The project has strict TypeScript checking. Always run `npm run type-check` before committing changes.

#### Testing Strategy
- Unit tests for utilities and pure functions
- Integration tests for hooks and sync functionality  
- Specialized tests for cloud sync features

#### Security
The project includes automated unsafe pattern detection. Run security scans before deploying.

# TODO
- マークダウンエディタの組み込み
- マップのNodeとエディタの結合
- エディタ情報のDBへの保存
- マップのエクスポート/インポート
- マップ間のジャンプ
- ログイン失敗の修正