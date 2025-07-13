# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
- `npm run dev` - Start Vite development server (port 3001)
- `npm run build` - Full build with validation
- `npm run preview` - Preview production build

### Type Checking
- `npm run type-check` - Standard TypeScript checking
- `npm run type-check:strict` - Strict checking using tsconfig.strict.json
- `npm run type-check:local` - Strict checking for src/Local directory only

### Testing
- `npm run test` - Run all tests
- `npm run test:watch` - Watch mode
- `npm run test:coverage` - With coverage reports
- `npm run test:cloud-sync` - Cloud sync specific tests
- `npm run test:integration` - Integration tests
- `npm run test:unit` - Unit tests only

### Code Quality
- `npm run lint` - ESLint checking
- `npm run lint:fix` - Auto-fix linting issues
- `npm run scan:unsafe` - Detect unsafe TypeScript patterns

## Architecture Overview

MindFlow is a React-based mind mapping application with dual storage modes:

### Dual Architecture Pattern
The app implements **two separate architectures** for different storage modes:

1. **Local Mode** (`src/Local/`):
   - Zustand store with Immer for state management
   - Normalized data structure for O(1) node operations
   - LocalStorage persistence with auto-save
   - Rich undo/redo history (50 operations)

2. **Cloud Mode** (`src/Cloud/`):
   - React hooks pattern with useState/useCallback
   - Tree-based data structure (non-normalized)
   - IndexedDB + Cloudflare Workers API dual-layer persistence
   - Real-time sync with conflict resolution

### Entry Points
- `src/main.tsx` - React 18 entry point
- `src/App.tsx` - Mode routing with lazy loading
- `src/StorageSelection/` - Storage mode selection UI

### Key Components Structure

```
src/
├── Local/                    # Local storage mode implementation
│   ├── core/                 # Core state management
│   │   ├── store/
│   │   │   ├── slices/       # Zustand store slices (data, ui, history, node)
│   │   │   └── mindMapStore.ts # Combined store
│   │   ├── hooks/            # Core hooks (useMindMapSimplified, useKeyboardShortcuts)
│   │   └── data/             # Data normalization utilities
│   ├── features/
│   │   ├── mindmap/          # Main mindmap feature
│   │   │   ├── components/
│   │   │   │   ├── app/      # App-level components
│   │   │   │   ├── canvas/   # Canvas rendering components
│   │   │   │   ├── node/     # Node-specific components
│   │   │   │   └── sidebar/  # Sidebar components
│   │   │   └── hooks/        # Feature-specific hooks
│   │   └── files/            # File handling feature
│   └── shared/               # Local-specific shared code
│       ├── components/       # Reusable UI components
│       ├── constants/        # Split into logical modules
│       ├── types/            # Type definitions
│       └── utils/            # Utility functions
├── Cloud/                    # Cloud storage mode implementation
├── shared/                   # Cross-mode shared code
│   ├── types/                # Unified type system
│   ├── components/           # Shared components (ErrorBoundary)
│   └── utils/                # Environment utilities
└── StorageSelection/         # Mode initialization
```

### State Management Patterns

**Local Mode (Modular Zustand Store)**:
- **Data Slice**: Manages mind map data and normalization
- **UI Slice**: Handles all UI state (panels, modals, selection)
- **History Slice**: Undo/redo functionality with 50-operation history
- **Node Slice**: All node CRUD operations and editing state
- Normalized store: `{nodes: {[id]: Node}, rootIds: string[], ui: UIState}`
- Hook: `useMindMapSimplified()` with data/UI/map operations
- Persistence: Debounced LocalStorage saves

**Cloud Mode**:
- Direct tree manipulation with `useMindMap()`
- Dual persistence: `useCloudData()` handles IndexedDB + API sync
- Offline-first with background synchronization

### Type System & Import Organization
- **Branded types** for IDs: `NodeId`, `MapId`, `FileId`, `UserId`
- **Unified interfaces** in `src/shared/types/`
- **Runtime type guards** for data validation
- **Path aliases** configured in tsconfig.json:
  - `@/*` → `src/*`
  - `@local/*` → `src/Local/*`
  - `@cloud/*` → `src/Cloud/*`
  - `@shared/*` → `src/shared/*`
- **Barrel exports** for clean imports:
  - `import { Component } from '@local/shared'`
  - `import { useMindMapSimplified } from '@local/core'`

### Backend (Cloudflare Worker)
- Located in `cloudflare-worker/` directory
- D1 database with comprehensive schema
- Real-time collaboration via WebSockets
- Operational Transformation for conflict resolution

## Development Guidelines

### Working with Both Modes
- Always check which mode you're working in (`src/Local/` vs `src/Cloud/`)
- **Local mode**: Uses normalized data - access via store selectors and slices
- **Cloud mode**: Uses tree traversal - direct node manipulation
- **Shared types** are in `src/shared/types/`
- Use **barrel exports** for cleaner imports: `import { Component } from '@local/shared'`

### Local Mode Development
- **Store changes**: Modify the appropriate slice in `src/Local/core/store/slices/`
- **New components**: Add to feature-specific directories with proper barrel exports
- **State access**: Use `useMindMapStore()` with specific selectors for performance
- **Constants**: Add to appropriate module in `src/Local/shared/constants/`

### Testing Strategy
- Unit tests for individual components and hooks
- Integration tests for cross-component workflows
- Cloud sync tests for real-time collaboration
- Coverage reporting with Jest

### Performance Considerations
- Local mode optimized for large mind maps (normalized data)
- Cloud mode optimized for real-time collaboration
- Both use React.memo and useCallback for performance
- SVG rendering for scalable graphics

### File Organization
- **Feature-based organization** within each mode with barrel exports
- **Shared components** avoid duplication across modes
- **Branded types** prevent ID mix-ups across domains
- **Clear separation** between storage implementations
- **Modular constants** split by domain (layout, colors, typography, etc.)

### Environment Variables
- **Vite environment**: Use `import.meta.env` instead of `process.env`
- **Environment utilities**: Use `isDevelopment()`, `isProduction()` from `@shared/utils/env`
- **Cross-environment compatibility**: Environment utilities work in both browser and Node.js

## Important Notes

- The app can switch between storage modes at runtime
- Both modes share the same UI components but different state management
- **Real-time features** only available in Cloud mode
- **Local mode** supports larger datasets more efficiently with normalized store
- **Store architecture**: Modular slices (data, ui, history, node) for better maintainability
- **TypeScript strict mode** enabled - maintain type safety
- **Performance optimized** with React.memo, useCallback, and normalized data structures