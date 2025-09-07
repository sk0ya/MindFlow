/**
 * Shared constants and type definitions for application-wide use
 */

// File handling constants
export const FILE_CONSTANTS = {
  MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/pdf',
    'application/json',
    'text/markdown'
  ],
  IMAGE_TYPES: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp'
  ]
} as const;

// Layout and coordinate constants
export const LAYOUT_CONSTANTS = {
  // Node positioning
  VERTICAL_SPACING: 80,
  MIN_NODE_DISTANCE: 50,
  SIBLING_SPACING: 60,
  CHILD_OFFSET_X: 200,
  CHILD_OFFSET_Y: 100,

  // Grid settings
  GRID_SIZE: 20,
  SNAP_THRESHOLD: 10,

  // Canvas bounds
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 5.0,
  DEFAULT_ZOOM: 1.0,
  ZOOM_STEP: 0.1,
  PAN_SENSITIVITY: 1.0,

  // Animation
  ANIMATION_DURATION: 300,
  EASING: 'ease-out',
  TRANSITION_DELAY: 50,

  // Performance thresholds
  MAX_VISIBLE_NODES: 1000,
  COLLISION_CHECK_LIMIT: 100,
  LAYOUT_BATCH_SIZE: 50
} as const;

// Typography constants
export const TYPOGRAPHY_CONSTANTS = {
  FONT_SIZES: {
    XS: 10,
    SM: 12,
    MD: 14,
    LG: 16,
    XL: 18,
    XXL: 20
  },
  FONT_WEIGHTS: {
    NORMAL: 'normal',
    BOLD: 'bold',
    LIGHT: '300',
    MEDIUM: '500',
    SEMI_BOLD: '600'
  },
  LINE_HEIGHTS: {
    TIGHT: 1.2,
    NORMAL: 1.4,
    LOOSE: 1.6
  }
} as const;


// Application defaults
export const DEFAULT_VALUES = {
  MINDMAP: {
    TITLE: '新しいマインドマップ',
    ROOT_TEXT: 'Main Topic',
    ROOT_POSITION: { x: 400, y: 300 },
    SETTINGS: {
      autoSave: true,
      autoLayout: false,
      snapToGrid: false,
      showGrid: false,
      animationEnabled: true
    }
  },
  NODE: {
    TEXT: '',
    FONT_SIZE: 14,
    FONT_WEIGHT: 'normal',
    COLOR: '#000000',
    BACKGROUND_COLOR: 'transparent'
  }
} as const;

// Storage configuration
export const STORAGE_CONSTANTS = {
  LOCAL_STORAGE_KEYS: {
    MINDMAPS: 'mindflow_mindmaps',
    CURRENT_MAP: 'mindflow_current_map',
    APP_SETTINGS: 'mindflow_app_settings',
    AUTH_TOKEN: 'auth_token',
    AUTH_USER: 'auth_user',
    STORAGE_MODE: 'mindflow_storage_mode'
  },
  COMPRESSION: {
    QUALITY: 0.8,
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1080
  },
  AUTO_SAVE_DELAY: 2000
} as const;

// Validation rules
export const VALIDATION_CONSTANTS = {
  NODE_TEXT: {
    MIN_LENGTH: 0,
    MAX_LENGTH: 500
  },
  MAP_TITLE: {
    MIN_LENGTH: 1,
    MAX_LENGTH: 100
  },
  EMAIL: {
    PATTERN: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  },
  FILE_NAME: {
    MAX_LENGTH: 255,
    INVALID_CHARS: /[<>:"/\\|?*]/g
  }
} as const;

// API configuration
export const API_CONSTANTS = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || 'https://mindflow-api-production.shigekazukoya.workers.dev',
  ENDPOINTS: {
    AUTH: '/api/auth',
    MINDMAPS: '/api/mindmaps',
    FILES: '/api/files',
    HEALTH: '/api/health'
  },
  TIMEOUTS: {
    DEFAULT: 10000,
    UPLOAD: 30000,
    AUTH: 15000
  }
} as const;

// Keyboard shortcuts
export const KEYBOARD_SHORTCUTS = {
  NAVIGATION: {
    SELECT_UP: 'ArrowUp',
    SELECT_DOWN: 'ArrowDown',
    SELECT_LEFT: 'ArrowLeft',
    SELECT_RIGHT: 'ArrowRight'
  },
  EDITING: {
    START_EDIT: ' ', // Space
    FINISH_EDIT: 'Enter',
    CANCEL_EDIT: 'Escape',
    ADD_CHILD: 'Tab',
    ADD_SIBLING: 'Enter',
    DELETE_NODE: 'Delete'
  },
  APPLICATION: {
    SAVE: 'Ctrl+S',
    UNDO: 'Ctrl+Z',
    REDO: 'Ctrl+Y',
    ZOOM_IN: 'Ctrl+=',
    ZOOM_OUT: 'Ctrl+-',
    ZOOM_RESET: 'Ctrl+0',
    TOGGLE_HELP: 'F1'
  }
} as const;


// Performance monitoring
export const PERFORMANCE_CONSTANTS = {
  RENDER_TIME_WARNING: 16, // ms (60fps threshold)
  MEMORY_WARNING: 100 * 1024 * 1024, // 100MB
  NODE_COUNT_WARNING: 1000,
  MAX_HISTORY_SIZE: 50,
  DEBOUNCE_DELAY: 300,
  AUTO_SAVE_INTERVAL: 2000,
  THROTTLE_LIMIT: 100
} as const;

// Error handling constants
export const ERROR_CONSTANTS = {
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  TIMEOUT_DURATION: 10000,
  LOG_LEVEL: {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3,
    CRITICAL: 4
  },
  SEVERITY_COLORS: {
    low: '#3498db',
    medium: '#f39c12',
    high: '#e74c3c',
    critical: '#8e44ad'
  }
} as const;

// UI constants extracted from common usage
export const UI_CONSTANTS = {
  MODAL_Z_INDEX: 1000,
  TOOLTIP_DELAY: 500,
  NOTIFICATION_DURATION: 3000,
  SIDEBAR_WIDTH: 280,
  TOOLBAR_HEIGHT: 60,
  PANEL_MIN_WIDTH: 200,
  PANEL_MAX_WIDTH: 400,
  CONTEXT_MENU_WIDTH: 180,
  BORDER_RADIUS: {
    SMALL: 4,
    MEDIUM: 8,
    LARGE: 12
  },
  SHADOW: {
    LIGHT: '0 2px 4px rgba(0,0,0,0.1)',
    MEDIUM: '0 4px 8px rgba(0,0,0,0.15)',
    HEAVY: '0 8px 16px rgba(0,0,0,0.2)'
  }
} as const;