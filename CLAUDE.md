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

## Architecture

### Frontend Structure (`src/Local/`)
```
src/Local/
├── components/
│   ├── MindMapApp.tsx         # Main application container
│   ├── MindMapCanvas.tsx      # SVG rendering engine
│   ├── MindMapNode.tsx        # Individual node component
│   ├── ContextMenu.tsx        # Right-click menu
│   ├── CustomizationPanel.tsx # Node styling options
│   ├── FileModal.tsx          # File attachment modal
│   └── MapModal.tsx           # Map management modal
├── hooks/
│   ├── useMindMap.ts          # Main orchestrator hook
│   ├── useMindMapData.ts      # Data persistence
│   ├── useMindMapNodes.ts     # Node operations
│   ├── useMindMapLayout.ts    # Layout calculations
│   ├── useUIState.ts          # UI state management
│   ├── useFileHandlers.ts     # File operations
│   └── useMapHandlers.ts      # Map management
├── types/
│   └── index.ts               # TypeScript definitions
└── utils/
    ├── dataUtils.ts           # Data manipulation
    ├── colorUtils.ts          # Color scheme logic
    └── layoutUtils.ts         # Layout algorithms
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
- **Local state** for UI-only concerns
- **Custom hooks** for shared logic
- **localStorage** for data persistence
- **Context API** avoided for performance reasons

### Performance Best Practices
- Use **React.memo** for expensive components
- Implement **virtualization** for large node counts (planned)
- Optimize **re-renders** with proper dependency arrays
- Batch **DOM updates** when possible

## Current Architecture Issues & Improvement Plan

### Critical Issues Identified

1. **Excessive Hook Coupling**: Main `useMindMap` hook composes 5+ other hooks with complex dependencies
2. **O(n) Tree Operations**: Node finding/manipulation has poor performance with large mindmaps
3. **Props Drilling**: MindMapApp component passes 50+ props down the tree
4. **Scattered State**: UI state fragmented across multiple hooks
5. **Inconsistent Error Handling**: Mix of console.log, alert, and thrown errors

### Improvement Roadmap

#### Phase 1: Core Foundation (High Priority)
- **Normalized Data Structure**: Replace nested tree with lookup tables for O(1) operations
- **Unified State Management**: Implement Zustand for centralized state
- **Type Safety**: Add branded types and Result pattern for error handling

#### Phase 2: Business Logic (Medium Priority)
- **Command Pattern**: Implement for undo/redo functionality
- **Domain Services**: Extract business logic from hooks/components
- **Component Simplification**: Break down large components

#### Phase 3: Performance (Lower Priority)
- **Virtualization**: Viewport-based rendering for large mindmaps
- **Web Workers**: Offload heavy computations
- **Caching Strategy**: Intelligent memoization

### Expected Outcomes
- **50% reduction** in component complexity
- **O(1) node operations** instead of O(n)
- **90% faster** rendering for large mindmaps
- **Better maintainability** with clear separation of concerns

## Common Development Tasks

### Adding a New Feature
1. Start with the data model in `types/index.ts`
2. Create/modify hooks in `hooks/` directory
3. Update components as needed
4. Test with various mindmap sizes

### Debugging Node Operations
```typescript
// Enable debug logging
localStorage.setItem('mindflow_debug', 'true');

// Check current mindmap data
const data = JSON.parse(localStorage.getItem('mindMapData') || '{}');
console.log('Current mindmap:', data);

// Monitor performance
console.time('findNode');
const node = findNode(nodeId);
console.timeEnd('findNode');
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
2. **Performance**: Degrades with very large mindmaps
3. **File Handling**: No streaming, all in-memory
4. **Single User**: No collaboration features

### Best Practices
1. **Save frequently**: Use Ctrl+S to ensure data persistence
2. **Export regularly**: Backup important mindmaps as JSON
3. **Limit attachments**: Keep file sizes reasonable
4. **Test performance**: Monitor with large datasets

Remember: This is a local-only application. All data lives in the browser's localStorage and will be lost if browser data is cleared. Always export important mindmaps for backup.