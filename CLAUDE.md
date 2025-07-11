# CLAUDE.md

This file provides comprehensive guidance to Claude Code (claude.ai/code) when working with this MindFlow application.

## Project Overview

MindFlow is a **React-based mindmap application** inspired by MindMeister. Currently implemented as a **local-only** application with plans for cloud synchronization in the future.

### Current Features
- **Local Storage**: All data stored in browser's localStorage
- **SVG-based rendering**: Smooth and scalable mindmap visualization
- **Rich node editing**: Text formatting, colors, attachments
- **Drag & Drop**: Intuitive node reorganization
- **Multiple mindmaps**: Create and manage multiple mindmaps
- **Export/Import**: JSON-based data portability
- **Performance Optimized**: Virtualization and Web Workers for large mindmaps
- **Undo/Redo**: Full command history with keyboard shortcuts
- **Smart Caching**: Intelligent performance optimization
- **Performance Monitoring**: Built-in performance dashboard

## Architecture

### Frontend Structure (`src/Local/`)
```
src/Local/
├── components/
│   ├── common/                # Shared UI components
│   │   ├── Connection.tsx     # SVG connections
│   │   ├── ContextMenu.tsx    # Right-click menu
│   │   ├── Toolbar.tsx        # Main toolbar
│   │   └── KeyboardShortcutHelper.tsx # Keyboard shortcuts
│   ├── mindmap/               # Core mindmap components
│   │   ├── MindMapApp.tsx     # Main application container
│   │   ├── MindMapCanvas.tsx  # SVG rendering engine
│   │   ├── MindMapSidebar.tsx # Side panel
│   │   ├── Node.tsx           # Individual node component
│   │   ├── NodeCustomizationPanel.tsx # Node styling
│   │   ├── canvas/            # Canvas-specific components
│   │   └── node/              # Node-specific components
│   ├── files/                 # File handling components
│   │   ├── FileActionMenu.tsx # File operations menu
│   │   └── ImageModal.tsx     # Image viewer
│   └── performance/           # Performance optimization
│       ├── LazyComponents.tsx # Lazy loading
│       ├── PerformanceDashboard.tsx # Performance monitoring
│       └── VirtualizedCanvas.tsx # Viewport rendering
├── core/                      # Core business logic
│   ├── commands/              # Command pattern implementation
│   │   ├── Command.ts         # Base command interface
│   │   └── nodeCommands/      # Node-specific commands
│   ├── data/                  # Data layer
│   │   └── normalizedStore.ts # Normalized data structure
│   ├── hooks/                 # Core hooks
│   │   ├── useMindMap.ts      # Main orchestrator
│   │   ├── useMindMapZustand.ts # Zustand state management
│   │   ├── useCommandHistory.ts # Undo/redo functionality
│   │   └── useKeyboardShortcuts.ts # Keyboard handling
│   ├── services/              # Business logic services
│   │   ├── mindMapService.ts  # MindMap operations
│   │   └── index.ts           # Service exports
│   ├── storage/               # Data persistence
│   │   ├── LocalEngine.ts     # Local storage engine
│   │   └── storageUtils.ts    # Storage utilities
│   └── store/                 # State management
│       └── mindMapStore.ts    # Zustand store
├── features/                  # Feature-specific modules
│   ├── files/                 # File handling features
│   │   ├── fileOptimization.ts # File optimization
│   │   ├── fileValidation.ts  # File validation
│   │   └── useMindMapFiles.ts # File operations hook
│   └── mindmap/               # MindMap features
│       ├── useMindMapData.ts  # Data operations
│       └── useMindMapMulti.ts # Multi-map support
├── shared/                    # Shared utilities
│   ├── constants/             # Application constants
│   ├── types/                 # TypeScript definitions
│   │   ├── brandedTypes.ts    # Branded types for type safety
│   │   ├── dataTypes.ts       # Data structure types
│   │   ├── errors.ts          # Error types
│   │   ├── result.ts          # Result pattern types
│   │   └── index.ts           # Type exports
│   └── utils/                 # Utility functions
│       ├── autoLayout.ts      # Auto-layout algorithms
│       ├── dataIntegrityChecker.ts # Data validation
│       ├── lodash-utils.ts    # Utility functions
│       └── logger.ts          # Logging utilities
├── hooks/                     # Performance hooks
│   ├── useLayoutWorker.ts     # Web worker for layout
│   └── useSmartCache.ts       # Intelligent caching
├── utils/                     # Performance utilities
│   └── performanceMonitor.ts  # Performance monitoring
└── workers/                   # Web Workers
    └── layoutWorker.ts        # Layout computation worker
```

## Key Data Structures

### MindMap Data Structure
```typescript
interface MindMapData {
  id: string;
  title: string;
  rootNode: MindMapNode;
  createdAt: string;
  updatedAt: string;
  settings?: {
    autoSave: boolean;
    autoLayout: boolean;
  };
}

interface MindMapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  children: MindMapNode[];
  fontSize?: number;
  fontWeight?: string;
  collapsed?: boolean;
  color?: string;
  attachments?: FileAttachment[];
  mapLinks?: MapLink[];
}

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // Base64 encoded
  uploadedAt: string;
}
```

## Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Start development server (port 3001)
npm run build        # Build for production
npm run preview      # Preview production build
npm run serve        # Serve production build from dist folder
```

## Development Guidelines

### Component Development
- Use **functional components** with hooks
- Apply **useCallback** and **useMemo** for performance optimization
- Implement **proper cleanup** in useEffect hooks
- Follow **TypeScript strict mode** requirements

### State Management
- **Zustand store** for centralized state management
- **Normalized data structure** for O(1) operations
- **Command pattern** for undo/redo functionality
- **localStorage** for data persistence
- **Result pattern** for robust error handling

### Performance Best Practices
- Use **React.memo** for expensive components
- **Virtualization** implemented for large node counts
- **Web Workers** for heavy computations
- **Smart caching** for optimal performance
- **Performance monitoring** dashboard available

## Current Architecture Issues & Improvement Plan

### Identified Structural Problems

Despite the solid architectural foundation, several critical issues remain that impact maintainability and performance:

#### 🔴 Critical Issues (High Priority)

1. **Component Complexity Overload**
   - `MindMapApp.tsx`: 395 lines with excessive responsibilities
   - `Node.tsx`: 745 lines mixing rendering, editing, and event handling
   - `MindMapCanvas.tsx`: 674 lines with complex drag/drop and rendering logic
   - **Impact**: Difficult debugging, testing complexity, performance bottlenecks

2. **Hook Architecture Complexity**
   - Multiple abstraction layers: `useMindMap` → `useMindMapZustand` → `useMindMapStore`
   - Component-specific hooks creating tight coupling
   - **Impact**: Unclear data flow, debugging difficulties, reusability issues

3. **Type System Fragmentation**
   - Type definitions scattered across multiple files
   - Risk of circular dependencies
   - **Impact**: Maintenance overhead, potential runtime errors

#### 🟡 Performance Issues (Medium Priority)

4. **Missing Performance Optimizations**
   - No `React.memo` on expensive components
   - Unnecessary re-renders throughout component tree
   - **Impact**: Poor performance with large mindmaps

5. **Feature Organization Problems**
   - Related code scattered across different directories
   - Difficult to locate and maintain feature-specific logic
   - **Impact**: Slow development, increased bugs

### Improvement Implementation Plan

#### Phase 1: Component Decomposition (Week 1-2)
**Target**: Reduce component complexity by 60%

1. **MindMapApp.tsx Refactoring**
   ```typescript
   // Split into focused components:
   <MindMapApp>
     <MindMapHeader />        // Toolbar & title management
     <MindMapWorkspace>       // Main content area
       <MindMapCanvas />      // Canvas rendering
       <MindMapSidebar />     // Side panels
     </MindMapWorkspace>
     <MindMapModals />        // Modal dialogs
   </MindMapApp>
   ```

2. **Node.tsx Decomposition**
   ```typescript
   // Split by responsibility:
   <Node>
     <NodeRenderer />         // Visual rendering
     <NodeEditor />           // Text editing
     <NodeDragHandler />      // Drag & drop
     <NodeAttachments />      // File attachments
   </Node>
   ```

#### Phase 2: Hook Simplification (Week 3)
**Target**: Reduce hook complexity by 50%

1. **Simplified Hook Architecture**
   ```typescript
   // Clear separation of concerns:
   useMindMapData()      // Data operations only
   useMindMapUI()        // UI state management
   useMindMapActions()   // User actions
   useMindMapSync()      // Persistence layer
   ```

2. **Performance Optimization**
   - Add `React.memo` to expensive components
   - Implement proper `useCallback` and `useMemo` usage
   - Optimize Zustand store selectors

#### Phase 3: Type System & Organization (Week 4)
**Target**: Eliminate type fragmentation

1. **Unified Type System**
   ```typescript
   src/shared/types/
   ├── index.ts           // Main exports
   ├── mindmap.ts         // Core types
   ├── ui.ts             // UI types
   └── storage.ts        // Storage types
   ```

2. **Feature-Based Organization**
   ```typescript
   src/Local/features/
   ├── mindmap/
   │   ├── components/
   │   ├── hooks/
   │   ├── services/
   │   └── types/
   └── files/
       ├── components/
       ├── hooks/
       └── services/
   ```

### Success Metrics

#### Immediate Goals (Phase 1)
- **Component Size**: <200 lines per component
- **Performance**: <100ms render times
- **Maintainability**: Reduce cyclomatic complexity by 40%

#### Long-term Goals (Phase 2-3)
- **Test Coverage**: >80% code coverage
- **Type Safety**: Eliminate all `any` types
- **Bundle Size**: <500KB production build

## Common Development Tasks

### Adding a New Feature
1. Start with the data model in `shared/types/dataTypes.ts`
2. Add business logic to appropriate service in `core/services/`
3. Implement commands if needed in `core/commands/`
4. Update Zustand store in `core/store/mindMapStore.ts`
5. Create/modify components in appropriate domain folder
6. Test with various mindmap sizes using performance dashboard

### Current Development Priority
**Focus on Component Decomposition (Phase 1)**
- Start with `MindMapApp.tsx` refactoring (highest impact)
- Follow the component decomposition plan above
- Target: <200 lines per component
- Maintain existing functionality while improving structure

### Debugging Node Operations
```typescript
// Enable debug logging
localStorage.setItem('mindflow_debug', 'true');

// Check current mindmap data (normalized structure)
const store = useMindMapStore.getState();
console.log('Current mindmap:', store.currentMindMap);
console.log('Normalized nodes:', store.normalizedNodes);

// Monitor performance with built-in monitoring
import { performanceMonitor } from '@/utils/performanceMonitor';
performanceMonitor.startMeasure('findNode');
const node = store.getNode(nodeId); // O(1) operation
performanceMonitor.endMeasure('findNode');

// View performance dashboard
// Access at /performance-dashboard in dev mode
```

### Testing Drag & Drop
1. Check parent-child relationships
2. Verify circular reference prevention
3. Test with collapsed/expanded nodes
4. Validate visual feedback

## File Size Limits
- **Attachments**: 10MB per file
- **Total Storage**: ~5MB localStorage limit
- **Performance**: Noticeable slowdown >100 nodes

## Security Considerations
- All data stored client-side
- No server communication
- Base64 encoding for file attachments
- XSS prevention in text rendering

## Future Enhancements (Planned)

### Cloud Synchronization
- User authentication system
- Real-time collaboration
- Cloud storage backend
- Conflict resolution

### Advanced Features
- Node templates
- Markdown support
- Image node types
- Presentation mode
- Mobile app

## Important Notes

### Current Limitations
1. **Browser Storage**: Limited by localStorage quota
2. **Performance**: Optimized for large mindmaps with virtualization
3. **File Handling**: Optimized with compression and validation
4. **Single User**: No collaboration features (planned for future)

### Best Practices
1. **Save frequently**: Use Ctrl+S to ensure data persistence
2. **Export regularly**: Backup important mindmaps as JSON
3. **Limit attachments**: Keep file sizes reasonable
4. **Test performance**: Monitor with large datasets

Remember: This is a local-only application. All data lives in the browser's localStorage and will be lost if browser data is cleared. Always export important mindmaps for backup.