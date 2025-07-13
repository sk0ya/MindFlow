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
├── Local/core/               # Zustand store, hooks, utilities
├── Local/features/           # MindMap, Files, UI features
├── Cloud/hooks/              # State management hooks
├── Cloud/components/         # Cloud-specific components
├── shared/                   # Cross-mode components and types
└── StorageSelection/         # Mode initialization
```

### State Management Patterns

**Local Mode**:
- Normalized store: `{nodes: {[id]: Node}, rootIds: string[], ui: UIState}`
- Hook: `useMindMapSimplified()` with data/UI/map operations
- Persistence: Debounced LocalStorage saves

**Cloud Mode**:
- Direct tree manipulation with `useMindMap()`
- Dual persistence: `useCloudData()` handles IndexedDB + API sync
- Offline-first with background synchronization

### Type System
- Branded types for IDs: `NodeId`, `MapId`, `FileId`, `UserId`
- Unified interfaces in `src/shared/types/`
- Runtime type guards for data validation
- Path aliases: `@/` maps to `src/`

### Backend (Cloudflare Worker)
- Located in `cloudflare-worker/` directory
- D1 database with comprehensive schema
- Real-time collaboration via WebSockets
- Operational Transformation for conflict resolution

## Development Guidelines

### Working with Both Modes
- Always check which mode you're working in (`src/Local/` vs `src/Cloud/`)
- Local mode uses normalized data - access via store selectors
- Cloud mode uses tree traversal - direct node manipulation
- Shared types are in `src/shared/types/`

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
- Feature-based organization within each mode
- Shared components avoid duplication
- Branded types prevent ID mix-ups across domains
- Clear separation between storage implementations

## Important Notes

- The app can switch between storage modes at runtime
- Both modes share the same UI components but different state management
- Real-time features only available in Cloud mode
- Local mode supports larger datasets more efficiently
- TypeScript strict mode enabled - maintain type safety