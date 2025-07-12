import React from 'react';

const SidebarStyles: React.FC = () => (
  <style>{`
    .mindmap-sidebar {
      width: 280px;
      height: 100vh;
      background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
      border-right: 2px solid #dee2e6;
      display: flex;
      flex-direction: column;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      overflow: hidden;
    }

    .mindmap-sidebar.collapsed {
      width: 50px;
      height: 100vh;
      background: linear-gradient(to bottom, #f8f9fa, #e9ecef);
      border-right: 2px solid #dee2e6;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 8px;
      position: fixed;
      left: 0;
      top: 0;
      z-index: 100;
      overflow: hidden;
    }

    .sidebar-header {
      padding: 20px;
      border-bottom: 1px solid #dee2e6;
      background: white;
      display: flex;
      flex-direction: column;
      gap: 16px;
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
      display: flex;
      gap: 6px;
      align-items: center;
    }

    .search-container {
      display: flex;
      gap: 8px;
    }

    .search-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
    }

    .search-input:focus {
      outline: none;
      border-color: #4285f4;
      box-shadow: 0 0 0 2px rgba(66, 133, 244, 0.2);
    }

    .action-button {
      background: #34a853;
      color: white;
      border: none;
      border-radius: 6px;
      width: 32px;
      height: 32px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: bold;
      transition: all 0.2s ease;
    }

    .action-button:hover {
      background: #2d8a47;
      transform: scale(1.05);
    }

    .action-button.category {
      background: #ff9800;
    }

    .action-button.category:hover {
      background: #f57c00;
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
      border-bottom: 1px solid #dee2e6;
      transition: background-color 0.2s ease;
    }

    .category-group.drag-over {
      background-color: rgba(66, 133, 244, 0.1);
    }

    .category-header {
      padding: 12px 20px;
      background: #f8f9fa;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
      color: #495057;
      transition: background-color 0.2s ease;
    }

    .category-header:hover {
      background: #e9ecef;
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
      padding: 12px 20px;
      border-bottom: 1px solid #f1f3f4;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.2s ease;
      position: relative;
    }

    .map-item:hover {
      background: #f8f9fa;
    }

    .map-item.active {
      background: #e3f2fd;
      border-left: 4px solid #2196f3;
    }

    .map-info {
      flex: 1;
      min-width: 0;
    }

    .map-title {
      font-size: 14px;
      font-weight: 500;
      color: #333;
      margin-bottom: 4px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .map-meta {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #6c757d;
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
      padding: 4px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      transition: background-color 0.2s ease;
    }

    .action-btn:hover {
      background: #f0f0f0;
    }

    .action-btn.delete:hover {
      background: #ffebee;
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