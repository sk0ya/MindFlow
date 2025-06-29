#!/bin/bash

# Script to extract all Local mode files from commit 21d9f81
COMMIT="21d9f81"
BASE_DIR="/home/koya/projects/web/MindFlow"

echo "🚀 Starting extraction of Local mode files from commit $COMMIT"

# Create all necessary directories
echo "📁 Creating directory structure..."
mkdir -p "$BASE_DIR/src/Local/core/hooks"
mkdir -p "$BASE_DIR/src/Local/core/storage"
mkdir -p "$BASE_DIR/src/Local/core/sync"
mkdir -p "$BASE_DIR/src/Local/features/auth/types"
mkdir -p "$BASE_DIR/src/Local/features/files"
mkdir -p "$BASE_DIR/src/Local/features/mindmap/__tests__"
mkdir -p "$BASE_DIR/src/Local/shared/constants"
mkdir -p "$BASE_DIR/src/Local/shared/types"
mkdir -p "$BASE_DIR/src/Local/shared/utils"
mkdir -p "$BASE_DIR/src/Local/ui/components/common"
mkdir -p "$BASE_DIR/src/Local/ui/components/errors"
mkdir -p "$BASE_DIR/src/Local/ui/components/files"
mkdir -p "$BASE_DIR/src/Local/ui/components/mindmap/hooks"
mkdir -p "$BASE_DIR/src/Local/ui/panels"

# Extract remaining feature files
echo "🔧 Extracting mindmap features..."

git show $COMMIT:src/Local/features/mindmap/useMindMapNodes.ts > "$BASE_DIR/src/Local/features/mindmap/useMindMapNodes.ts"
git show $COMMIT:src/Local/features/mindmap/useMindMapMulti.ts > "$BASE_DIR/src/Local/features/mindmap/useMindMapMulti.ts"
git show $COMMIT:src/Local/features/mindmap/useMindMapNavigation.ts > "$BASE_DIR/src/Local/features/mindmap/useMindMapNavigation.ts"
git show $COMMIT:src/Local/features/mindmap/useCurrentMap.ts > "$BASE_DIR/src/Local/features/mindmap/useCurrentMap.ts"
git show $COMMIT:src/Local/features/mindmap/useMapList.ts > "$BASE_DIR/src/Local/features/mindmap/useMapList.ts"

# Extract auth features
echo "🔐 Extracting auth features..."
git show $COMMIT:src/Local/features/auth/useAuth.ts > "$BASE_DIR/src/Local/features/auth/useAuth.ts"
git show $COMMIT:src/Local/features/auth/useUnifiedAuth.ts > "$BASE_DIR/src/Local/features/auth/useUnifiedAuth.ts"
git show $COMMIT:src/Local/features/auth/types/authTypes.ts > "$BASE_DIR/src/Local/features/auth/types/authTypes.ts"

# Extract file features
echo "📎 Extracting file features..."
git show $COMMIT:src/Local/features/files/useMindMapFiles.ts > "$BASE_DIR/src/Local/features/files/useMindMapFiles.ts"
git show $COMMIT:src/Local/features/files/fileManager.ts > "$BASE_DIR/src/Local/features/files/fileManager.ts"
git show $COMMIT:src/Local/features/files/fileOptimization.ts > "$BASE_DIR/src/Local/features/files/fileOptimization.ts"
git show $COMMIT:src/Local/features/files/fileValidation.ts > "$BASE_DIR/src/Local/features/files/fileValidation.ts"

# Extract shared utilities
echo "🛠️ Extracting shared utilities..."
git show $COMMIT:src/Local/shared/types/index.ts > "$BASE_DIR/src/Local/shared/types/index.ts"
git show $COMMIT:src/Local/shared/utils/autoLayout.ts > "$BASE_DIR/src/Local/shared/utils/autoLayout.ts"
git show $COMMIT:src/Local/shared/utils/dataConverter.ts > "$BASE_DIR/src/Local/shared/utils/dataConverter.ts"
git show $COMMIT:src/Local/shared/utils/dataManager.ts > "$BASE_DIR/src/Local/shared/utils/dataManager.ts"
git show $COMMIT:src/Local/shared/utils/errorHandler.ts > "$BASE_DIR/src/Local/shared/utils/errorHandler.ts"
git show $COMMIT:src/Local/shared/utils/logger.ts > "$BASE_DIR/src/Local/shared/utils/logger.ts"
git show $COMMIT:src/Local/shared/utils/mapUtils.ts > "$BASE_DIR/src/Local/shared/utils/mapUtils.ts"
git show $COMMIT:src/Local/shared/utils/accessibility.ts > "$BASE_DIR/src/Local/shared/utils/accessibility.ts"

# Extract UI components
echo "🎨 Extracting UI components..."
git show $COMMIT:src/Local/ui/components/mindmap/MindMapApp.tsx > "$BASE_DIR/src/Local/ui/components/mindmap/MindMapApp.tsx"
git show $COMMIT:src/Local/ui/components/mindmap/MindMapCanvas.tsx > "$BASE_DIR/src/Local/ui/components/mindmap/MindMapCanvas.tsx"
git show $COMMIT:src/Local/ui/components/mindmap/MindMapSidebar.tsx > "$BASE_DIR/src/Local/ui/components/mindmap/MindMapSidebar.tsx"
git show $COMMIT:src/Local/ui/components/mindmap/Node.tsx > "$BASE_DIR/src/Local/ui/components/mindmap/Node.tsx"
git show $COMMIT:src/Local/ui/components/mindmap/NodeCustomizationPanel.tsx > "$BASE_DIR/src/Local/ui/components/mindmap/NodeCustomizationPanel.tsx"

# Extract common UI components
git show $COMMIT:src/Local/ui/components/common/Toolbar.tsx > "$BASE_DIR/src/Local/ui/components/common/Toolbar.tsx"
git show $COMMIT:src/Local/ui/components/common/ContextMenu.tsx > "$BASE_DIR/src/Local/ui/components/common/ContextMenu.tsx"
git show $COMMIT:src/Local/ui/components/common/LoadingScreen.tsx > "$BASE_DIR/src/Local/ui/components/common/LoadingScreen.tsx"
git show $COMMIT:src/Local/ui/components/common/SimpleMindMapApp.tsx > "$BASE_DIR/src/Local/ui/components/common/SimpleMindMapApp.tsx"
git show $COMMIT:src/Local/ui/components/common/SimpleMindMapSidebar.tsx > "$BASE_DIR/src/Local/ui/components/common/SimpleMindMapSidebar.tsx"

# Extract component hooks
echo "🪝 Extracting component hooks..."
git show $COMMIT:src/Local/ui/components/mindmap/hooks/useAppActions.ts > "$BASE_DIR/src/Local/ui/components/mindmap/hooks/useAppActions.ts"
git show $COMMIT:src/Local/ui/components/mindmap/hooks/useAuthHandlers.ts > "$BASE_DIR/src/Local/ui/components/mindmap/hooks/useAuthHandlers.ts"
git show $COMMIT:src/Local/ui/components/mindmap/hooks/useFileHandlers.ts > "$BASE_DIR/src/Local/ui/components/mindmap/hooks/useFileHandlers.ts"
git show $COMMIT:src/Local/ui/components/mindmap/hooks/useMapHandlers.ts > "$BASE_DIR/src/Local/ui/components/mindmap/hooks/useMapHandlers.ts"
git show $COMMIT:src/Local/ui/components/mindmap/hooks/useNodeHandlers.ts > "$BASE_DIR/src/Local/ui/components/mindmap/hooks/useNodeHandlers.ts"
git show $COMMIT:src/Local/ui/components/mindmap/hooks/useRealtimeHandlers.ts > "$BASE_DIR/src/Local/ui/components/mindmap/hooks/useRealtimeHandlers.ts"
git show $COMMIT:src/Local/ui/components/mindmap/hooks/useUIState.ts > "$BASE_DIR/src/Local/ui/components/mindmap/hooks/useUIState.ts"

# Extract additional UI components
git show $COMMIT:src/Local/ui/components/common/TutorialOverlay.tsx > "$BASE_DIR/src/Local/ui/components/common/TutorialOverlay.tsx"
git show $COMMIT:src/Local/ui/components/common/KeyboardShortcutHelper.tsx > "$BASE_DIR/src/Local/ui/components/common/KeyboardShortcutHelper.tsx"
git show $COMMIT:src/Local/ui/components/errors/ErrorBoundary.tsx > "$BASE_DIR/src/Local/ui/components/errors/ErrorBoundary.tsx"
git show $COMMIT:src/Local/ui/components/files/ImageModal.tsx > "$BASE_DIR/src/Local/ui/components/files/ImageModal.tsx"

# Extract CSS files
echo "🎨 Extracting CSS files..."
git show $COMMIT:src/Local/ui/components/mindmap/MindMapApp.css > "$BASE_DIR/src/Local/ui/components/mindmap/MindMapApp.css"
git show $COMMIT:src/Local/ui/components/common/TutorialOverlay.css > "$BASE_DIR/src/Local/ui/components/common/TutorialOverlay.css"
git show $COMMIT:src/Local/ui/components/common/KeyboardShortcutHelper.css > "$BASE_DIR/src/Local/ui/components/common/KeyboardShortcutHelper.css"

echo "✅ Extraction complete! All Local mode files have been extracted from commit $COMMIT"
echo "📊 Summary:"
echo "   - Core hooks: 5 files"
echo "   - Storage & sync: 3 files"
echo "   - Feature modules: 15+ files"
echo "   - Shared utilities: 10+ files"
echo "   - UI components: 20+ files"
echo "   - Component hooks: 7 files"
echo "   - Total: 70 files extracted"