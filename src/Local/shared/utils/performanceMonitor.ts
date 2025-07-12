// Performance monitoring and benchmarking utilities
export interface PerformanceMetrics {
  renderTime: number;
  nodeCount: number;
  connectionCount: number;
  memoryUsage: number;
  cacheHitRate: number;
  fps: number;
  frameTime: number;
}

export interface BenchmarkResult {
  operation: string;
  duration: number;
  nodeCount: number;
  success: boolean;
  timestamp: number;
  metrics?: PerformanceMetrics;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private measurements: Map<string, number> = new Map();
  private benchmarkResults: BenchmarkResult[] = [];
  private frameTimeHistory: number[] = [];
  private maxHistorySize = 60; // Keep 60 frames for FPS calculation

  private constructor() {
    this.startFrameMonitoring();
  }

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Performance measurement
  startMeasurement(label: string): void {
    this.measurements.set(label, performance.now());
  }

  endMeasurement(label: string): number {
    const startTime = this.measurements.get(label);
    if (startTime === undefined) {
      console.warn(`No measurement found for label: ${label}`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.measurements.delete(label);
    return duration;
  }

  // Benchmark runner
  async runBenchmark(
    operation: string,
    nodeCount: number,
    benchmarkFn: () => Promise<void> | void
  ): Promise<BenchmarkResult> {
    const startTime = performance.now();
    let success = true;
    let metrics: PerformanceMetrics | undefined;

    try {
      // Record initial metrics
      const initialMemory = this.getMemoryUsage();
      
      // Run the benchmark function
      await benchmarkFn();
      
      // Record final metrics
      const finalMemory = this.getMemoryUsage();
      const renderTime = performance.now() - startTime;
      
      metrics = {
        renderTime,
        nodeCount,
        connectionCount: this.estimateConnectionCount(nodeCount),
        memoryUsage: finalMemory - initialMemory,
        cacheHitRate: 0, // To be filled by cache system
        fps: this.getCurrentFPS(),
        frameTime: this.getAverageFrameTime()
      };

    } catch (error) {
      success = false;
      console.error(`Benchmark failed for ${operation}:`, error);
    }

    const duration = performance.now() - startTime;
    const result: BenchmarkResult = {
      operation,
      duration,
      nodeCount,
      success,
      timestamp: Date.now(),
      metrics
    };

    this.benchmarkResults.push(result);
    
    // Keep only last 100 results
    if (this.benchmarkResults.length > 100) {
      this.benchmarkResults.shift();
    }

    return result;
  }

  // Frame monitoring
  private startFrameMonitoring(): void {
    let lastFrameTime = performance.now();
    
    const measureFrame = () => {
      const currentTime = performance.now();
      const frameTime = currentTime - lastFrameTime;
      
      this.frameTimeHistory.push(frameTime);
      if (this.frameTimeHistory.length > this.maxHistorySize) {
        this.frameTimeHistory.shift();
      }
      
      lastFrameTime = currentTime;
      requestAnimationFrame(measureFrame);
    };
    
    requestAnimationFrame(measureFrame);
  }

  // Get current FPS
  getCurrentFPS(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const averageFrameTime = this.getAverageFrameTime();
    return Math.round(1000 / averageFrameTime);
  }

  // Get average frame time
  getAverageFrameTime(): number {
    if (this.frameTimeHistory.length === 0) return 0;
    
    const sum = this.frameTimeHistory.reduce((a, b) => a + b, 0);
    return sum / this.frameTimeHistory.length;
  }

  // Memory usage monitoring
  getMemoryUsage(): number {
    if ('memory' in performance && typeof (performance as unknown as { memory?: unknown }).memory === 'object') {
      const memoryInfo = (performance as unknown as { memory: { usedJSHeapSize?: number } }).memory;
      if (typeof memoryInfo.usedJSHeapSize === 'number') {
        return memoryInfo.usedJSHeapSize / 1024 / 1024; // MB
      }
    }
    return 0;
  }

  // Estimate connection count based on node count
  private estimateConnectionCount(nodeCount: number): number {
    // Assuming tree structure, connections = nodes - 1
    return Math.max(0, nodeCount - 1);
  }

  // Get benchmark results
  getBenchmarkResults(): BenchmarkResult[] {
    return [...this.benchmarkResults];
  }

  // Get results for specific operation
  getResultsForOperation(operation: string): BenchmarkResult[] {
    return this.benchmarkResults.filter(r => r.operation === operation);
  }

  // Calculate performance statistics
  getPerformanceStats(): {
    averageRenderTime: number;
    maxRenderTime: number;
    minRenderTime: number;
    averageFPS: number;
    memoryTrend: number;
  } {
    const results = this.benchmarkResults.filter(r => r.success && r.metrics);
    
    if (results.length === 0) {
      return {
        averageRenderTime: 0,
        maxRenderTime: 0,
        minRenderTime: 0,
        averageFPS: 0,
        memoryTrend: 0
      };
    }

    const renderTimes = results.map(r => r.duration);
    const fpss = results.map(r => r.metrics?.fps ?? 0);
    const memoryUsages = results.map(r => r.metrics?.memoryUsage ?? 0);

    return {
      averageRenderTime: renderTimes.reduce((a, b) => a + b) / renderTimes.length,
      maxRenderTime: Math.max(...renderTimes),
      minRenderTime: Math.min(...renderTimes),
      averageFPS: fpss.reduce((a, b) => a + b) / fpss.length,
      memoryTrend: memoryUsages.length > 1 ? 
        memoryUsages[memoryUsages.length - 1] - memoryUsages[0] : 0
    };
  }

  // Clear all data
  clear(): void {
    this.measurements.clear();
    this.benchmarkResults.length = 0;
    this.frameTimeHistory.length = 0;
  }

  // Export results for analysis
  exportResults(): string {
    const data = {
      benchmarkResults: this.benchmarkResults,
      performanceStats: this.getPerformanceStats(),
      currentFPS: this.getCurrentFPS(),
      memoryUsage: this.getMemoryUsage(),
      timestamp: Date.now()
    };
    
    return JSON.stringify(data, null, 2);
  }
}

// Hook for React components
export const usePerformanceMonitor = () => {
  const monitor = PerformanceMonitor.getInstance();

  const measureRender = (nodeCount: number) => {
    return monitor.runBenchmark('render', nodeCount, () => {
      // This will be measured by the component render cycle
    });
  };

  const measureLayout = (nodeCount: number, layoutFn: () => void) => {
    return monitor.runBenchmark('layout', nodeCount, layoutFn);
  };

  const measureInteraction = (interactionType: string, nodeCount: number, interactionFn: () => void) => {
    return monitor.runBenchmark(interactionType, nodeCount, interactionFn);
  };

  const startMeasure = (label: string) => monitor.startMeasurement(label);
  const endMeasure = (label: string) => monitor.endMeasurement(label);

  return {
    measureRender,
    measureLayout,
    measureInteraction,
    startMeasure,
    endMeasure,
    getStats: () => monitor.getPerformanceStats(),
    getCurrentFPS: () => monitor.getCurrentFPS(),
    getMemoryUsage: () => monitor.getMemoryUsage(),
    exportResults: () => monitor.exportResults(),
    clear: () => monitor.clear()
  };
};

// Performance thresholds for warnings
export const PERFORMANCE_THRESHOLDS = {
  RENDER_TIME_WARNING: 16, // ms - one frame at 60fps
  RENDER_TIME_CRITICAL: 33, // ms - two frames at 60fps
  MEMORY_USAGE_WARNING: 100, // MB
  MEMORY_USAGE_CRITICAL: 200, // MB
  FPS_WARNING: 45,
  FPS_CRITICAL: 30,
  NODE_COUNT_WARNING: 1000,
  NODE_COUNT_CRITICAL: 5000
};

// Performance warning checker
export const checkPerformanceWarnings = (metrics: PerformanceMetrics): string[] => {
  const warnings: string[] = [];

  if (metrics.renderTime > PERFORMANCE_THRESHOLDS.RENDER_TIME_CRITICAL) {
    warnings.push(`Critical render time: ${metrics.renderTime.toFixed(2)}ms`);
  } else if (metrics.renderTime > PERFORMANCE_THRESHOLDS.RENDER_TIME_WARNING) {
    warnings.push(`Slow render time: ${metrics.renderTime.toFixed(2)}ms`);
  }

  if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_USAGE_CRITICAL) {
    warnings.push(`Critical memory usage: ${metrics.memoryUsage.toFixed(2)}MB`);
  } else if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_USAGE_WARNING) {
    warnings.push(`High memory usage: ${metrics.memoryUsage.toFixed(2)}MB`);
  }

  if (metrics.fps < PERFORMANCE_THRESHOLDS.FPS_CRITICAL) {
    warnings.push(`Critical FPS: ${metrics.fps}`);
  } else if (metrics.fps < PERFORMANCE_THRESHOLDS.FPS_WARNING) {
    warnings.push(`Low FPS: ${metrics.fps}`);
  }

  if (metrics.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_CRITICAL) {
    warnings.push(`Critical node count: ${metrics.nodeCount}`);
  } else if (metrics.nodeCount > PERFORMANCE_THRESHOLDS.NODE_COUNT_WARNING) {
    warnings.push(`High node count: ${metrics.nodeCount}`);
  }

  return warnings;
};