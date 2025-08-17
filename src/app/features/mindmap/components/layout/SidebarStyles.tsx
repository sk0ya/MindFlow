import React from 'react';

const SidebarStyles: React.FC = () => (
  <style>{`
    .mindmap-sidebar {
      width: 280px;
      height: 100vh;
      background: #ffffff;
      border-right: 1px solid rgba(148, 163, 184, 0.2);
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 60px;
      z-index: 100;
      overflow: hidden;
      box-shadow: 4px 0 6px -1px rgba(0, 0, 0, 0.05);
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

    .sidebar-header {
      padding: 20px !important;
      border-bottom: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(248, 250, 252, 0.5);
      backdrop-filter: blur(10px);
      display: flex !important;
      flex-direction: column !important;
      gap: 16px !important;
      position: relative !important;
      z-index: 100 !important;
      width: 100% !important;
      overflow: visible !important;
      min-height: 120px !important;
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

    .header-actions {
      display: flex !important;
      gap: 6px;
      align-items: center;
      flex-wrap: nowrap;
      justify-content: flex-start;
      width: 100%;
      min-height: 40px;
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
    }

    .search-input:focus {
      outline: none;
      border-color: rgba(59, 130, 246, 0.5);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
      background: white;
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

    .category-group {
      margin: 8px 12px;
      border-radius: 12px;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      transition: all 0.2s ease;
      overflow: hidden;
    }

    .category-group.drag-over {
      background-color: rgba(59, 130, 246, 0.05);
      border: 2px dashed rgba(59, 130, 246, 0.3);
    }

    .category-header {
      padding: 14px 16px;
      background: rgba(248, 250, 252, 0.8);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
      color: #374151;
      transition: all 0.2s ease;
      border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    }

    .category-header:hover {
      background: rgba(243, 244, 246, 0.9);
      color: #1f2937;
    }

    .category-icon {
      font-size: 12px;
      color: #6c757d;
    }

    .category-name {
      flex: 1;
      font-size: 14px;
    }

    .category-count {
      font-size: 12px;
      color: #6c757d;
    }

    .category-maps {
      background: white;
    }

    .map-item {
      padding: 12px 16px;
      margin: 4px 8px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
      position: relative;
    }

    .map-item:hover {
      background: rgba(59, 130, 246, 0.05);
      transform: translateX(2px);
    }

    .map-item.active {
      background: rgba(59, 130, 246, 0.1);
      border-left: 3px solid #3b82f6;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.15);
    }

    .map-info {
      flex: 1;
      min-width: 0;
    }

    .map-title {
      font-size: 14px;
      font-weight: 600;
      color: #1f2937;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .map-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #6b7280;
    }

    .node-count,
    .update-date {
      white-space: nowrap;
    }

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
  `}</style>
);

export default SidebarStyles;