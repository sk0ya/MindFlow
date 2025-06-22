// MindFlowアプリに直接注入するデバッグスクリプト
// ブラウザのコンソールでこのスクリプトを実行してください

(function() {
    console.log('🔍 MindFlowキーイベント監視開始');
    
    let eventCount = 0;
    const eventLog = [];
    
    function logEvent(event, phase, element) {
        eventCount++;
        const logEntry = {
            id: eventCount,
            timestamp: Date.now(),
            type: event.type,
            key: event.key,
            phase: phase,
            target: getElementInfo(event.target),
            currentTarget: getElementInfo(event.currentTarget),
            element: getElementInfo(element),
            defaultPrevented: event.defaultPrevented,
            propagationStopped: event.cancelBubble || false,
            bubbles: event.bubbles,
            composed: event.composed
        };
        
        eventLog.push(logEntry);
        
        if (event.key === 'Tab' || event.key === 'Enter') {
            console.log(`🎹 [${eventCount}] ${event.type.toUpperCase()} ${phase.toUpperCase()}:`, {
                key: event.key,
                target: logEntry.target,
                currentTarget: logEntry.currentTarget,
                element: logEntry.element,
                defaultPrevented: event.defaultPrevented,
                stopped: event.cancelBubble
            });
        }
    }
    
    function getElementInfo(element) {
        if (!element) return 'null';
        
        let info = element.tagName.toLowerCase();
        if (element.id) info += `#${element.id}`;
        if (element.className) {
            const classes = element.className.toString().split(' ').filter(c => c.trim()).slice(0, 3);
            if (classes.length > 0) info += `.${classes.join('.')}`;
        }
        
        // React component name from fiber
        try {
            const fiberKey = Object.keys(element).find(key => key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'));
            if (fiberKey) {
                const fiber = element[fiberKey];
                if (fiber && fiber.type && fiber.type.name) {
                    info += ` [${fiber.type.name}]`;
                }
            }
        } catch (e) {
            // ignore
        }
        
        return info;
    }
    
    // 全ての要素にイベントリスナーを追加
    function attachListeners(element) {
        const events = ['keydown', 'keyup', 'keypress'];
        const phases = [
            { name: 'capture', useCapture: true },
            { name: 'target', useCapture: false }
        ];
        
        events.forEach(eventType => {
            phases.forEach(phase => {
                element.addEventListener(eventType, function(e) {
                    logEvent(e, phase.name, element);
                }, phase.useCapture);
            });
        });
    }
    
    // 既存の要素に監視を追加
    attachListeners(document);
    attachListeners(document.body);
    
    // すべての入力要素
    document.querySelectorAll('input, textarea').forEach(attachListeners);
    
    // すべてのSVG要素
    document.querySelectorAll('svg, svg *').forEach(attachListeners);
    
    // MindFlowの主要コンポーネント要素
    document.querySelectorAll('.mindmap-app, .mindmap-canvas-container, .node, foreignObject').forEach(attachListeners);
    
    // 新しく追加される要素も監視
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            mutation.addedNodes.forEach(function(node) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    attachListeners(node);
                    
                    // 子要素も再帰的に監視
                    node.querySelectorAll('*').forEach(attachListeners);
                }
            });
        });
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // グローバル関数として公開
    window.debugMindFlow = {
        getEventLog: () => eventLog,
        clearLog: () => {
            eventLog.length = 0;
            eventCount = 0;
            console.log('🧹 イベントログクリア');
        },
        analyzeTabEnter: () => {
            const tabEnterEvents = eventLog.filter(e => e.key === 'Tab' || e.key === 'Enter');
            console.log('📊 Tab/Enterイベント分析:', tabEnterEvents);
            
            if (tabEnterEvents.length === 0) {
                console.log('❌ Tab/Enterイベントが検出されていません');
                return;
            }
            
            // フェーズ別集計
            const byPhase = tabEnterEvents.reduce((acc, e) => {
                const key = `${e.key}-${e.phase}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(e);
                return acc;
            }, {});
            
            console.log('📈 フェーズ別イベント数:', Object.keys(byPhase).map(key => `${key}: ${byPhase[key].length}`));
            
            // preventDefault済みイベント
            const preventedEvents = tabEnterEvents.filter(e => e.defaultPrevented);
            console.log('🚫 preventDefault済み:', preventedEvents.length);
            
            // 要素別集計
            const byElement = tabEnterEvents.reduce((acc, e) => {
                if (!acc[e.target]) acc[e.target] = 0;
                acc[e.target]++;
                return acc;
            }, {});
            
            console.log('🎯 要素別イベント数:', byElement);
            
            return {
                total: tabEnterEvents.length,
                byPhase,
                prevented: preventedEvents.length,
                byElement
            };
        },
        startRealTimeLogging: () => {
            console.log('🚀 リアルタイムロギング開始 - Tab/Enterキーのみ表示');
            window.debugRealTime = true;
        },
        stopRealTimeLogging: () => {
            window.debugRealTime = false;
            console.log('⏹️ リアルタイムロギング停止');
        }
    };
    
    console.log('✅ 監視セットアップ完了！使用方法:');
    console.log('  debugMindFlow.analyzeTabEnter() - Tab/Enterイベント分析');
    console.log('  debugMindFlow.getEventLog() - 全イベントログ取得');
    console.log('  debugMindFlow.clearLog() - ログクリア');
    console.log('  debugMindFlow.startRealTimeLogging() - リアルタイム表示開始');
})();