import React, { useState, useCallback, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { marked } from 'marked';
import type { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor';
import type { MindMapData, MindMapNode } from '@shared/types';
import { convertMindMapToOutline, convertOutlineToMindMap } from '../../../../shared/utils/outlineUtils';
import { useMindMapStore } from '../../../../core/store/mindMapStore';
import './OutlineWorkspace.css';

interface OutlineWorkspaceProps {
  data: MindMapData;
  onSave: (updatedData: MindMapData) => void;
  onClose?: () => void;
  hasSidebar?: boolean;
}

const OutlineWorkspace: React.FC<OutlineWorkspaceProps> = ({ 
  data, 
  onSave,
  onClose,
  hasSidebar = false 
}) => {
  const { settings, updateSetting } = useMindMapStore();
  const [outlineText, setOutlineText] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const widgetRegistryRef = useRef<Map<string, {
    widget: editor.IContentWidget,
    decorationId: string,
    metadata: { attachments: any[], links: any[] }
  }>>(new Map());

  // ノードIDでノードを検索するヘルパー関数
  const findNodeById = (node: MindMapNode, id: string): MindMapNode | null => {
    if (node.id === id) return node;
    for (const child of node.children) {
      const found = findNodeById(child, id);
      if (found) return found;
    }
    return null;
  };


  // 初回のみアウトラインテキストとメタデータを設定
  const initialDataRef = useRef<string>('');
  const currentMetadataRef = useRef<Map<string, { attachments: any[], links: any[] }>>(new Map());
  
  useEffect(() => {
    // 初回またはデータが完全に異なる場合のみ更新
    const currentDataId = data.id || 'unknown';
    
    if (initialDataRef.current === '' || initialDataRef.current !== currentDataId) {
      initialDataRef.current = currentDataId;
      
      const outline = convertMindMapToOutline(data);
      setOutlineText(outline);
      setHasUnsavedChanges(false);
      
      // ノードのメタデータを抽出
      const metadata = new Map<string, { attachments: any[], links: any[] }>();
      const extractMetadata = (node: MindMapNode) => {
        if (node.attachments?.length || node.links?.length) {
          metadata.set(node.id, {
            attachments: node.attachments || [],
            links: node.links || []
          });
        }
        node.children?.forEach(extractMetadata);
      };
      extractMetadata(data.rootNode);
      
      // refに直接保存
      currentMetadataRef.current = metadata;
      
      // Widget registryをリセット
      widgetRegistryRef.current.clear();
    }
    
  }, [data]);


  // アウトラインモード離脱時のクリーンアップ
  useEffect(() => {
    return () => {
      // コンポーネントアンマウント時にWidgetとdecorationを破棄
      if (editorRef.current) {
        widgetRegistryRef.current.forEach((widgetInfo) => {
          editorRef.current!.removeContentWidget(widgetInfo.widget);
          editorRef.current!.deltaDecorations([widgetInfo.decorationId], []);
        });
        widgetRegistryRef.current.clear();
      }
    };
  }, []);

  // 自動保存機能を完全に削除

  const handleTextChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      setOutlineText(value);
      setHasUnsavedChanges(true);
      // 自動保存は完全に無効化
    }
  }, []);

  const handleManualSave = useCallback(() => {
    try {
      if (!editorRef.current) {
        console.error('Editor not available');
        return;
      }
      
      const currentLineToMetadataMap = new Map<number, { nodeId: string, attachments: any[], links: any[] }>();
      const editorModel = editorRef.current.getModel();
      
      if (!editorModel) {
        console.error('Editor model not available');
        return;
      }
      
      widgetRegistryRef.current.forEach((widgetInfo, nodeId) => {
        if (widgetInfo.metadata.attachments.length > 0 || widgetInfo.metadata.links.length > 0) {
          // BELOW positioning により Widget は自動で追従するので、直接現在位置を使用
          const widgetPosition = widgetInfo.widget.getPosition();
          if (widgetPosition && widgetPosition.position) {
            const currentLine = widgetPosition.position.lineNumber;
            
            currentLineToMetadataMap.set(currentLine, {
              nodeId,
              attachments: widgetInfo.metadata.attachments,
              links: widgetInfo.metadata.links
            });
          }
        }
      });
      
      const updatedData = convertOutlineToMindMap(outlineText, data, currentLineToMetadataMap);
      onSave(updatedData);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Manual save failed:', error);
      alert('保存中にエラーが発生しました。マークダウンの形式を確認してください。');
    }
  }, [outlineText, data, onSave]);

  const handleEditorKeyDown = useCallback((e: any) => {
    if ((e.metaKey || e.ctrlKey) && e.keyCode === 83) { // Ctrl+S
      e.preventDefault();
      handleManualSave();
    }
  }, [handleManualSave]);

  const createContentWidgetWithDecoration = useCallback((editor: editor.IStandaloneCodeEditor, nodeId: string, lineNumber: number, metadata: { attachments: any[], links: any[] }) => {
    // まず decoration を作成してアンカーにする
    const decorations = editor.deltaDecorations([], [{
      range: new monaco.Range(lineNumber, 1, lineNumber, 1),
      options: {
        isWholeLine: true, // 行全体を対象にして削除時の検出を確実にする
        className: `outline-widget-anchor-${nodeId}`, // 識別用クラス
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges
      }
    }]);
    
    const decorationId = decorations[0];
    
    // Widgetを作成（decorationの位置に基づく）
    const widget: editor.IContentWidget = {
      getId: () => `attachment-widget-${nodeId}`,
      getDomNode: () => {
        const domNode = document.createElement('div');
        domNode.className = 'outline-attachment-widget';
        domNode.style.cssText = `
          background: var(--bg-secondary, #f8f9fa);
          border: 1px solid var(--border-color, #dee2e6);
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          color: var(--text-muted, #6c757d);
          margin-left: 8px;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          cursor: help;
          opacity: 0.8;
          font-weight: 500;
          white-space: nowrap;
          vertical-align: middle;
        `;
        
        const items: string[] = [];
        if (metadata.attachments.length > 0) {
          items.push(`📎${metadata.attachments.length}`);
        }
        if (metadata.links.length > 0) {
          items.push(`🔗${metadata.links.length}`);
        }
        
        if (items.length === 0) return domNode;
        
        const displayText = items.join(' | ');
        domNode.textContent = displayText;
        
        // ツールチップ
        const tooltipContent = [`ノードID: ${nodeId}`];
        if (metadata.attachments.length > 0) {
          tooltipContent.push('', '添付ファイル:');
          metadata.attachments.forEach(att => {
            tooltipContent.push(`• ${att.name} (${(att.size / 1024).toFixed(1)}KB)`);
          });
        }
        if (metadata.links.length > 0) {
          tooltipContent.push('', 'リンク:');
          metadata.links.forEach(() => {
            tooltipContent.push(`• マップへのリンク`);
          });
        }
        
        domNode.title = tooltipContent.join('\n');
        return domNode;
      },
      getPosition: () => {
        // decorationの現在位置を取得
        const decorationRange = editor.getModel()?.getDecorationRange(decorationId);
        if (decorationRange) {
          // 行の末尾にWidgetを配置
          const model = editor.getModel();
          const lineContent = model?.getLineContent(decorationRange.startLineNumber) || '';
          const position = new monaco.Position(decorationRange.startLineNumber, lineContent.length + 1);
          return {
            position,
            preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
          };
        }
        // fallback
        const model = editor.getModel();
        const lineContent = model?.getLineContent(lineNumber) || '';
        return {
          position: new monaco.Position(lineNumber, lineContent.length + 1),
          preference: [monaco.editor.ContentWidgetPositionPreference.EXACT]
        };
      }
    };
    
    editor.addContentWidget(widget);
    
    // Widget registryに登録
    widgetRegistryRef.current.set(nodeId, {
      widget,
      decorationId,
      metadata
    });
    
    return widget;
  }, []);



  const setupContentWidgets = useCallback((editor: editor.IStandaloneCodeEditor) => {
    const editorModel = editor.getModel();
    if (!editorModel) return;

    // refから直接メタデータを取得
    const metadata = currentMetadataRef.current;

    // 既存のwidgetとdecorationを削除
    widgetRegistryRef.current.forEach((widgetInfo) => {
      editor.removeContentWidget(widgetInfo.widget);
      // decorationも削除
      editor.deltaDecorations([widgetInfo.decorationId], []);
    });
    widgetRegistryRef.current.clear();

    // メタデータがない場合は処理を中止
    if (metadata.size === 0) {
      return;
    }

    // 各ノードのテキストがある行番号にWidgetを作成
    let widgetCount = 0;
    
    // 全ノードを順序通りに処理してWidgetを作成
    const createWidgetsForNode = (node: MindMapNode, level: number = 1) => {
      // rootノード以外で、メタデータがある場合
      if (level >= 1 && metadata.has(node.id)) {
        const nodeMetadata = metadata.get(node.id)!;
        
        if (nodeMetadata.attachments.length > 0 || nodeMetadata.links.length > 0) {
          // そのノードのテキストがある行を探す
          const lineCount = editorModel.getLineCount();
          
          for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
            const lineContent = editorModel.getLineContent(lineNumber);
            const headingMatch = lineContent.match(/^(#+)\s+(.+)$/);
            
            if (headingMatch) {
              if (headingMatch[2].trim() === node.text && headingMatch[1].length === level) {
                createContentWidgetWithDecoration(editor, node.id, lineNumber, nodeMetadata);
                widgetCount++;
                break;
              }
            }
          }
        }
      }
      
      // 子ノードを再帰処理
      node.children?.forEach(child => createWidgetsForNode(child, level + 1));
    };
    
    createWidgetsForNode(data.rootNode, 0);
  }, [createContentWidgetWithDecoration, data]);


  // 自動保存関連のクリーンアップは不要（削除済み）

  return (
    <div className={`outline-workspace ${hasSidebar ? 'with-sidebar' : ''} ${settings.theme === 'dark' ? 'dark-theme' : ''}`}>
      <div className="outline-workspace-header">
        <div className="outline-workspace-title">
          <span>{data?.rootNode?.text || 'アウトライン編集'}</span>
          {hasUnsavedChanges && (
            <span className="outline-workspace-status">
              未保存の変更
            </span>
          )}
        </div>
        <div className="outline-workspace-actions">
          <button
            className={`outline-workspace-toggle-btn ${settings.vimMode ? 'active' : ''}`}
            onClick={() => updateSetting('vimMode', !settings.vimMode)}
            title="Vimモード"
          >
            Vim
          </button>
          <button
            className={`outline-workspace-toggle-btn ${showPreview ? 'active' : ''}`}
            onClick={() => setShowPreview(!showPreview)}
            title="プレビューモード"
          >
            📖
          </button>
          <button
            className="outline-workspace-save-btn"
            onClick={handleManualSave}
            disabled={!hasUnsavedChanges}
          >
            保存 (Ctrl+S)
          </button>
          {onClose && (
            <button
              className="outline-workspace-close-btn"
              onClick={onClose}
            >
              閉じる
            </button>
          )}
        </div>
      </div>
      
      <div className="outline-workspace-editor">
        {showPreview ? (
          <div 
            className={`outline-preview ${settings.theme === 'dark' ? 'dark-theme' : ''}`}
            dangerouslySetInnerHTML={{ __html: marked(outlineText) }}
          />
        ) : (
          <Editor
            height="100%"
            language="markdown"
            theme={settings.theme === 'dark' ? 'vs-dark' : 'vs'}
            value={outlineText}
            onChange={handleTextChange}
            onMount={(editor) => {
              editorRef.current = editor;
              editor.onKeyDown(handleEditorKeyDown);
              editor.focus();
              
              // Vimモードの設定
              if (settings.vimMode) {
                import('monaco-vim').then((MonacoVim) => {
                  MonacoVim.initVimMode(editor, document.getElementById('vim-status'));
                });
              }

              // エディタマウント後に即座にWidget作成を実行
              // 少し遅延させてエディタが完全に初期化されるのを待つ
              setTimeout(() => {
                setupContentWidgets(editor);
              }, 50);
              
              // decorationベースのWidget追従のためにレイアウト更新を監視
              const layoutDisposable = editor.onDidChangeModelContent(() => {
                // Widget位置をレイアウト更新
                const widgetsToRemove: string[] = [];
                
                widgetRegistryRef.current.forEach((widgetInfo, nodeId) => {
                  // decorationが有効かチェック
                  const decorationRange = editor.getModel()?.getDecorationRange(widgetInfo.decorationId);
                  
                  if (!decorationRange) {
                    // decorationが削除されている場合、Widgetも削除
                    editor.removeContentWidget(widgetInfo.widget);
                    widgetsToRemove.push(nodeId);
                  } else {
                    // decorationが残っている場合、レイアウト更新
                    editor.layoutContentWidget(widgetInfo.widget);
                  }
                });
                
                // 削除されたWidgetをregistryから除去
                widgetsToRemove.forEach(nodeId => {
                  widgetRegistryRef.current.delete(nodeId);
                });
              });
              
              return () => {
                layoutDisposable.dispose();
              };
            }}
            options={{
              fontSize: settings.fontSize,
              fontFamily: settings.fontFamily,
              lineNumbers: 'on',
              wordWrap: 'on',
              scrollBeyondLastLine: false,
              minimap: { enabled: false },
              folding: true,
              foldingHighlight: false,
              automaticLayout: true,
              padding: { top: 16, bottom: 16 },
              scrollbar: {
                vertical: 'visible',
                horizontal: 'visible',
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false,
              },
              renderWhitespace: 'boundary',
              renderControlCharacters: false,
            }}
          />
        )}
        {settings.vimMode && !showPreview && (
          <div id="vim-status" className="vim-status-line"></div>
        )}
      </div>
    </div>
  );
};

export default OutlineWorkspace;