import React from 'react';

const SidebarStyles: React.FC = () => (
  <style>{`
    .mindmap-sidebar {
      width: 280px;
      height: calc(100vh - 60px);
      background: #ffffff;
      border-right: 1px solid rgba(148, 163, 184, 0.2);
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 48px;
      top: 60px;
      z-index: 100;
      overflow: hidden;
      box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.05);
    }

    [data-theme="dark"] .mindmap-sidebar {
      background: #1f2937;
      border-right: 1px solid rgba(75, 85, 99, 0.3);
      box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.2);
    }

    .mindmap-sidebar.collapsed {
      width: 50px;
      height: calc(100vh - 60px);
      background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
      border-right: 2px solid #dee2e6;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 8px;
      position: fixed;
      left: 0;
      top: 60px;
      z-index: 100;
      overflow: hidden;
    }

    [data-theme="dark"] .mindmap-sidebar.collapsed {
      background: linear-gradient(to bottom, #374151, #4b5563);
      border-right: 2px solid #6b7280;
    }

    .sidebar-header {
      padding: 8px !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(248, 250, 252, 0.5);
      backdrop-filter: blur(10px);
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
      position: relative !important;
      z-index: 100 !important;
      width: 100% !important;
      overflow: visible !important;
    }

    [data-theme="dark"] .sidebar-header {
      border-bottom: 1px solid rgba(75, 85, 99, 0.2);
      background: rgba(31, 41, 55, 0.8);
    }

    .sidebar-title {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #333;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    [data-theme="dark"] .sidebar-title {
      color: #e5e7eb;
    }

    .header-top {
      display: flex;
      align-items: center;
      gap: 4px;
      width: 100%;
    }

    .header-actions {
      display: flex !important;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
      justify-content: flex-start;
      width: 100%;
      margin: 0;
      overflow: visible !important;
    }

    .sidebar-collapse-toggle {
      background: rgba(51, 65, 85, 0.08);
      border: 1px solid rgba(51, 65, 85, 0.12);
      color: #475569;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .sidebar-collapse-toggle:hover {
      background: rgba(51, 65, 85, 0.12);
      color: #1e293b;
      transform: scale(1.05);
    }

    [data-theme="dark"] .sidebar-collapse-toggle {
      background: rgba(75, 85, 99, 0.3);
      border: 1px solid rgba(107, 114, 128, 0.4);
      color: #d1d5db;
    }

    [data-theme="dark"] .sidebar-collapse-toggle:hover {
      background: rgba(107, 114, 128, 0.4);
      color: #f3f4f6;
      transform: scale(1.05);
    }

    .sidebar-expand-toggle {
      background: rgba(51, 65, 85, 0.08);
      border: 1px solid rgba(51, 65, 85, 0.12);
      color: #475569;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      transition: all 0.2s ease;
      margin-bottom: 12px;
    }

    .sidebar-expand-toggle:hover {
      background: rgba(51, 65, 85, 0.12);
      color: #1e293b;
      transform: scale(1.05);
    }

    [data-theme="dark"] .sidebar-expand-toggle {
      background: rgba(75, 85, 99, 0.3);
      border: 1px solid rgba(107, 114, 128, 0.4);
      color: #d1d5db;
    }

    [data-theme="dark"] .sidebar-expand-toggle:hover {
      background: rgba(107, 114, 128, 0.4);
      color: #f3f4f6;
      transform: scale(1.05);
    }

    .selected-folder-info {
      background: rgba(0, 120, 212, 0.1);
      border: 1px solid rgba(0, 120, 212, 0.3);
      border-radius: 6px;
      padding: 8px 12px;
      font-size: 12px;
      color: #0078d4;
      text-align: center;
    }

    .search-container {
      display: flex;
      gap: 8px;
    }

    .search-input {
      flex: 1;
      padding: 10px 12px;
      border: 1px solid rgba(148, 163, 184, 0.3);
      border-radius: 10px;
      font-size: 14px;
      background: rgba(248, 250, 252, 0.8);
      transition: all 0.2s ease;
      color: #333;
    }

    .search-input:focus {
      outline: none;
      border-color: rgba(59, 130, 246, 0.5);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      background: white;
    }

    [data-theme="dark"] .search-input {
      background: rgba(55, 65, 81, 0.8);
      border: 1px solid rgba(75, 85, 99, 0.4);
      color: #e5e7eb;
    }

    [data-theme="dark"] .search-input:focus {
      background: #374151;
      border-color: rgba(59, 130, 246, 0.6);
    }

    [data-theme="dark"] .search-input::placeholder {
      color: #9ca3af;
    }

    .map-control-buttons {
      display: flex;
      gap: 2px;
      margin: 0;
      justify-content: flex-start;
    }

    .control-button {
      background: rgba(248, 250, 252, 0.9);
      border: 1px solid rgba(148, 163, 184, 0.2);
      border-radius: 8px;
      padding: 0;
      margin: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: all 0.2s ease;
      width: 36px;
      height: 36px;
      min-width: 36px;
      min-height: 36px;
    }

    .control-button:hover {
      background: rgba(236, 239, 244, 0.9);
      border-color: rgba(148, 163, 184, 0.3);
      transform: translateY(-1px);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .control-button.add-map:hover {
      background: rgba(16, 185, 129, 0.1);
      border-color: rgba(16, 185, 129, 0.3);
      color: #059669;
    }

    .control-button.add-folder:hover {
      background: rgba(251, 191, 36, 0.1);
      border-color: rgba(251, 191, 36, 0.3);
      color: #d97706;
    }

    .control-button.expand-all:hover {
      background: rgba(59, 130, 246, 0.1);
      border-color: rgba(59, 130, 246, 0.3);
      color: #2563eb;
    }

    .control-button.collapse-all:hover {
      background: rgba(107, 114, 128, 0.1);
      border-color: rgba(107, 114, 128, 0.3);
      color: #374151;
    }

    [data-theme="dark"] .control-button {
      background: rgba(55, 65, 81, 0.9);
      border: 1px solid rgba(75, 85, 99, 0.3);
      color: #e5e7eb;
      margin: 0;
    }

    [data-theme="dark"] .control-button:hover {
      background: rgba(75, 85, 99, 0.9);
      border-color: rgba(107, 114, 128, 0.4);
    }

    [data-theme="dark"] .control-button.add-map:hover {
      background: rgba(16, 185, 129, 0.15);
      border-color: rgba(16, 185, 129, 0.4);
      color: #10b981;
    }

    [data-theme="dark"] .control-button.add-folder:hover {
      background: rgba(251, 191, 36, 0.15);
      border-color: rgba(251, 191, 36, 0.4);
      color: #fbbf24;
    }

    [data-theme="dark"] .control-button.expand-all:hover {
      background: rgba(59, 130, 246, 0.15);
      border-color: rgba(59, 130, 246, 0.4);
      color: #3b82f6;
    }

    [data-theme="dark"] .control-button.collapse-all:hover {
      background: rgba(156, 163, 175, 0.15);
      border-color: rgba(156, 163, 175, 0.4);
      color: #d1d5db;
    }

    .action-button {
      background: linear-gradient(135deg, #10b981, #059669) !important;
      color: white !important;
      border: none !important;
      border-radius: 10px !important;
      width: 36px !important;
      height: 36px !important;
      min-width: 36px !important;
      min-height: 36px !important;
      max-width: 36px !important;
      max-height: 36px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 16px !important;
      font-weight: bold !important;
      transition: all 0.2s ease;
      box-shadow: 0 2px 4px rgba(16, 185, 129, 0.2) !important;
      pointer-events: auto !important;
      z-index: 1000 !important;
      position: relative !important;
      visibility: visible !important;
      opacity: 1 !important;
      flex-shrink: 0 !important;
      overflow: visible !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .action-button:hover {
      background: linear-gradient(135deg, #059669, #047857);
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
    }

    .action-button.category {
      background: #ff9800 !important;
    }

    .action-button.category:hover {
      background: #f57c00 !important;
    }


    .toggle-button {
      background: #6c757d;
      color: white;
      border: none;
      border-radius: 4px;
      width: 28px;
      height: 28px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      transition: all 0.2s ease;
    }

    .toggle-button:hover {
      background: #5a6268;
    }

    .collapsed-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 16px;
    }

    .maps-content {
      flex: 1;
      overflow-y: auto;
      padding: 0;
    }

    .maps-content-wrapper {
      flex: 1;
      overflow-y: auto;
      position: relative;
      min-height: 200px;
    }

    .maps-content-wrapper.drag-over-root {
      background: rgba(34, 197, 94, 0.05);
      border: 2px dashed rgba(34, 197, 94, 0.3);
      border-radius: 8px;
      margin: 8px;
    }

    .category-group {
      margin: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      transition: all 0.15s ease;
      overflow: hidden;
    }

    .category-group.drag-over {
      background-color: rgba(59, 130, 246, 0.05);
      border: 2px dashed rgba(59, 130, 246, 0.3);
    }

    /* Drag and Drop Visual Feedback */
    .category-header[draggable="true"] {
      cursor: grab;
    }

    .category-header[draggable="true"]:active {
      cursor: grabbing;
      opacity: 0.7;
    }

    .map-item[draggable="true"] {
      cursor: grab;
    }

    .map-item[draggable="true"]:active {
      cursor: grabbing;
      opacity: 0.7;
    }

    /* Drop zone highlighting */
    .category-header.drag-over {
      background: rgba(34, 197, 94, 0.1) !important;
      border: 2px dashed rgba(34, 197, 94, 0.5);
      transform: scale(1.02);
      transition: all 0.2s ease;
    }

    /* Drag preview ghost */
    .category-header:active {
      transform: rotate(2deg);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }

    .map-item:active {
      transform: rotate(1deg);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .category-header {
      padding: 8px 12px;
      background: transparent;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      font-size: 13px;
      color: #333;
      transition: all 0.15s ease;
      border-bottom: none;
      height: 32px;
    }

    .category-header:hover {
      background: rgba(229, 229, 229, 0.6);
    }

    [data-theme="dark"] .category-header {
      color: #d1d5db;
    }

    [data-theme="dark"] .category-header:hover {
      background: rgba(75, 85, 99, 0.6);
    }

    .category-header.selected {
      background: #0078d4;
      color: white;
    }

    .category-header.selected .category-folder-icon,
    .category-header.selected .category-expand-icon,
    .category-header.selected .category-name,
    .category-header.selected .category-count {
      color: white;
    }

    .category-expand-icon {
      font-size: 10px;
      color: #666;
      width: 12px;
      text-align: center;
      transition: transform 0.15s ease;
    }

    .category-folder-icon {
      font-size: 14px;
      color: #dcb67a;
    }

    .category-name {
      flex: 1;
      font-size: 13px;
      color: #333;
    }

    .category-count {
      font-size: 11px;
      color: #888;
      background: rgba(200, 200, 200, 0.3);
      padding: 1px 6px;
      border-radius: 10px;
      min-width: 18px;
      text-align: center;
    }

    [data-theme="dark"] .category-expand-icon {
      color: #9ca3af;
    }

    [data-theme="dark"] .category-folder-icon {
      color: #f59e0b;
    }

    [data-theme="dark"] .category-name {
      color: #d1d5db;
    }

    [data-theme="dark"] .category-count {
      color: #9ca3af;
      background: rgba(75, 85, 99, 0.4);
    }

    .category-maps {
      background: transparent;
      padding-left: 18px;
    }

    .map-item {
      padding: 4px 12px;
      margin: 0;
      border-radius: 0;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.15s ease;
      position: relative;
      height: 28px;
      font-size: 13px;
    }

    .map-item:hover {
      background: rgba(229, 229, 229, 0.6);
      transform: none;
    }

    [data-theme="dark"] .map-item:hover {
      background: rgba(75, 85, 99, 0.6);
    }

    .map-item.active {
      background: #0078d4;
      color: white;
      border-left: none;
      box-shadow: none;
    }

    .map-item.active .map-title {
      color: white;
    }

    .map-item.active .map-meta {
      color: rgba(255, 255, 255, 0.8);
    }

    .map-info {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .map-file-icon {
      font-size: 14px;
      flex-shrink: 0;
    }

    .map-details {
      flex: 1;
      min-width: 0;
    }

    .map-title {
      font-size: 13px;
      font-weight: 400;
      color: #333;
      margin-bottom: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .map-meta {
      display: none;
      gap: 8px;
      font-size: 11px;
      color: #888;
      margin-top: 2px;
    }

    [data-theme="dark"] .map-title {
      color: #d1d5db;
    }

    [data-theme="dark"] .map-meta {
      color: #9ca3af;
    }

    .node-count,
    .update-date {
      white-space: nowrap;
    }

    /* Action buttons removed - now using context menu
    .map-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .map-item:hover .map-actions {
      opacity: 1;
    }

    .action-btn {
      background: none;
      border: none;
      padding: 6px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: all 0.2s ease;
      color: #6b7280;
    }

    .action-btn:hover {
      background: rgba(107, 114, 128, 0.1);
      color: #374151;
      transform: scale(1.1);
    }

    .action-btn.delete:hover {
      background: rgba(239, 68, 68, 0.1);
      color: #dc2626;
    }
    */

    .title-input {
      width: 100%;
      border: 1px solid #4285f4;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 14px;
      font-weight: 500;
      background: white;
    }

    .title-input:focus {
      outline: none;
      box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    }

    .empty-state {
      padding: 40px 20px;
      text-align: center;
      color: #6c757d;
    }

    .empty-icon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.5;
    }

    .empty-title {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 8px;
      color: #495057;
    }

    .empty-description {
      font-size: 14px;
      line-height: 1.5;
    }

    [data-theme="dark"] .empty-state {
      color: #9ca3af;
    }

    [data-theme="dark"] .empty-title {
      color: #d1d5db;
    }

    /* Context Menu Styles */
    .context-menu {
      background: white;
      border: 1px solid #ccc;
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 4px 0;
      min-width: 180px;
      font-size: 13px;
      z-index: 9999;
    }

    .context-menu-item {
      padding: 8px 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: background-color 0.15s ease;
      color: #333;
    }

    .context-menu-item:hover {
      background-color: #f0f0f0;
    }

    .context-menu-item.disabled {
      color: #999;
      cursor: not-allowed;
    }

    .context-menu-item.disabled:hover {
      background-color: transparent;
    }

    [data-theme="dark"] .context-menu {
      background: #374151;
      border: 1px solid #6b7280;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    }

    [data-theme="dark"] .context-menu-item {
      color: #d1d5db;
    }

    [data-theme="dark"] .context-menu-item:hover {
      background-color: #4b5563;
    }

    [data-theme="dark"] .context-menu-item.disabled {
      color: #6b7280;
    }

    .context-menu-icon {
      width: 16px;
      text-align: center;
      flex-shrink: 0;
    }

    .context-menu-label {
      flex: 1;
    }

    .context-menu-separator {
      height: 1px;
      background-color: #e0e0e0;
      margin: 4px 0;
    }

    [data-theme="dark"] .context-menu-separator {
      background-color: #6b7280;
    }

    /* 検索ハイライト */
    .search-highlight {
      background-color: #fef3c7;
      color: #d97706;
      padding: 1px 2px;
      border-radius: 2px;
      font-weight: 600;
      box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.2);
    }

    .search-highlight:first-child {
      margin-left: 0;
    }

    .search-highlight:last-child {
      margin-right: 0;
    }

    /* フォルダ名のハイライト */
    .category-name .search-highlight {
      background-color: #ecfdf5;
      color: #059669;
      box-shadow: 0 0 0 1px rgba(5, 150, 105, 0.2);
    }

    /* マップタイトルのハイライト */
    .map-title .search-highlight {
      background-color: #fef3c7;
      color: #d97706;
      box-shadow: 0 0 0 1px rgba(217, 119, 6, 0.2);
    }

    [data-theme="dark"] .search-highlight {
      background-color: #92400e;
      color: #fbbf24;
      box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.3);
    }

    [data-theme="dark"] .category-name .search-highlight {
      background-color: #065f46;
      color: #34d399;
      box-shadow: 0 0 0 1px rgba(52, 211, 153, 0.3);
    }

    [data-theme="dark"] .map-title .search-highlight {
      background-color: #92400e;
      color: #fbbf24;
      box-shadow: 0 0 0 1px rgba(251, 191, 36, 0.3);
    }
  `}</style>
);

export default SidebarStyles;