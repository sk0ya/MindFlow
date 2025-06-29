/**
 * Performance monitoring hook
 * Tracks component render times and provides optimization recommendations
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PERFORMANCE_CONSTANTS } from '../types';

export interface PerformanceMetrics {
  renderTime: number;
  renderCount: number;
  averageRenderTime: number;
  slowRenders: number;
  memoryUsage?: number;
  componentName?: string;
}

export interface PerformanceWarning {
  type: 'slow_render' | 'excessive_renders' | 'memory_leak' | 'missing_deps';
  message: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
  metrics?: Partial<PerformanceMetrics>;
}

export const usePerformanceMonitor = (componentName?: string, enableLogging: boolean = false) => {
  const renderStartTime = useRef<number>(Date.now());
  const renderTimes = useRef<number[]>([]);
  const renderCount = useRef<number>(0);
  const [warnings, setWarnings] = useState<PerformanceWarning[]>([]);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    renderTime: 0,
    renderCount: 0,
    averageRenderTime: 0,
    slowRenders: 0,
    componentName
  });

  // Start timing at the beginning of render
  renderStartTime.current = Date.now();

  // Complete timing at the end of render
  useEffect(() => {
    const renderTime = Date.now() - renderStartTime.current;
    renderCount.current += 1;
    renderTimes.current.push(renderTime);

    // Keep only last 50 render times
    if (renderTimes.current.length > 50) {
      renderTimes.current.shift();
    }

    const averageRenderTime = renderTimes.current.reduce((a, b) => a + b, 0) / renderTimes.current.length;
    const slowRenders = renderTimes.current.filter(time => time > PERFORMANCE_CONSTANTS.RENDER_TIME_WARNING).length;

    // Get memory usage if available
    let memoryUsage: number | undefined;
    if ('memory' in performance && (performance as any).memory) {
      memoryUsage = (performance as any).memory.usedJSHeapSize;
    }

    const newMetrics: PerformanceMetrics = {
      renderTime,
      renderCount: renderCount.current,
      averageRenderTime,
      slowRenders,
      memoryUsage,
      componentName
    };

    setMetrics(newMetrics);

    // Performance warnings
    const newWarnings: PerformanceWarning[] = [];

    // Slow render warning
    if (renderTime > PERFORMANCE_CONSTANTS.RENDER_TIME_WARNING) {
      newWarnings.push({
        type: 'slow_render',
        message: `Slow render detected: ${renderTime}ms`,
        severity: renderTime > PERFORMANCE_CONSTANTS.RENDER_TIME_WARNING * 3 ? 'high' : 'medium',
        recommendation: 'Consider memoizing components or optimizing expensive calculations',
        metrics: newMetrics
      });
    }

    // Excessive renders warning
    if (renderCount.current > 10 && averageRenderTime > PERFORMANCE_CONSTANTS.RENDER_TIME_WARNING / 2) {
      newWarnings.push({
        type: 'excessive_renders',
        message: `High render frequency with slow renders: ${renderCount.current} renders, ${averageRenderTime.toFixed(2)}ms average`,
        severity: 'medium',
        recommendation: 'Check for missing dependencies in useEffect or unnecessary state updates',
        metrics: newMetrics
      });
    }

    // Memory warning
    if (memoryUsage && memoryUsage > PERFORMANCE_CONSTANTS.MEMORY_WARNING) {
      newWarnings.push({
        type: 'memory_leak',
        message: `High memory usage: ${(memoryUsage / 1024 / 1024).toFixed(2)}MB`,
        severity: 'high',
        recommendation: 'Check for memory leaks, cleanup event listeners, and clear references',
        metrics: newMetrics
      });
    }

    if (newWarnings.length > 0) {
      setWarnings(prev => [...prev, ...newWarnings]);
      
      if (enableLogging) {
        newWarnings.forEach(warning => {
          const prefix = warning.severity === 'high' ? '🚨' : warning.severity === 'medium' ? '⚠️' : 'ℹ️';
          console.warn(`${prefix} Performance Warning (${componentName || 'Unknown'}):`, warning);
        });
      }
    }

    // Log metrics in development
    if (enableLogging && process.env.NODE_ENV === 'development') {
      console.log(`📊 Performance (${componentName || 'Unknown'}):`, newMetrics);
    }
  });

  const clearWarnings = useCallback(() => {
    setWarnings([]);
  }, []);

  const resetMetrics = useCallback(() => {
    renderTimes.current = [];
    renderCount.current = 0;
    setMetrics({
      renderTime: 0,
      renderCount: 0,
      averageRenderTime: 0,
      slowRenders: 0,
      componentName
    });
    clearWarnings();
  }, [componentName, clearWarnings]);

  return {
    metrics,
    warnings,
    clearWarnings,
    resetMetrics
  };
};

// Hook for measuring specific operations
export const useOperationTimer = () => {
  const timers = useRef<Map<string, number>>(new Map());

  const startTimer = useCallback((operationName: string) => {
    timers.current.set(operationName, Date.now());
  }, []);

  const endTimer = useCallback((operationName: string): number => {
    const startTime = timers.current.get(operationName);
    if (!startTime) {
      console.warn(`Timer "${operationName}" was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    timers.current.delete(operationName);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`⏱️ ${operationName}: ${duration}ms`);
    }

    return duration;
  }, []);

  const timeOperation = useCallback(async <T>(
    operationName: string,
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> => {
    startTimer(operationName);
    try {
      const result = await operation();
      const duration = endTimer(operationName);
      return { result, duration };
    } catch (error) {
      endTimer(operationName);
      throw error;
    }
  }, [startTimer, endTimer]);

  return {
    startTimer,
    endTimer,
    timeOperation
  };
};

// Global performance collector
class PerformanceCollector {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private readonly maxMetricsPerComponent = 100;

  addMetrics(componentName: string, metrics: PerformanceMetrics): void {
    if (!this.metrics.has(componentName)) {
      this.metrics.set(componentName, []);
    }

    const componentMetrics = this.metrics.get(componentName)!;
    componentMetrics.push(metrics);

    // Keep only recent metrics
    if (componentMetrics.length > this.maxMetricsPerComponent) {
      componentMetrics.shift();
    }
  }

  getMetrics(componentName?: string): PerformanceMetrics[] | Map<string, PerformanceMetrics[]> {
    if (componentName) {
      return this.metrics.get(componentName) || [];
    }
    return this.metrics;
  }

  getAverageMetrics(componentName: string): PerformanceMetrics | null {
    const metrics = this.metrics.get(componentName);
    if (!metrics || metrics.length === 0) return null;

    const totals = metrics.reduce(
      (acc, metric) => ({
        renderTime: acc.renderTime + metric.renderTime,
        renderCount: acc.renderCount + metric.renderCount,
        averageRenderTime: acc.averageRenderTime + metric.averageRenderTime,
        slowRenders: acc.slowRenders + metric.slowRenders,
        memoryUsage: (acc.memoryUsage || 0) + (metric.memoryUsage || 0)
      }),
      { renderTime: 0, renderCount: 0, averageRenderTime: 0, slowRenders: 0, memoryUsage: 0 }
    );

    return {
      renderTime: totals.renderTime / metrics.length,
      renderCount: totals.renderCount / metrics.length,
      averageRenderTime: totals.averageRenderTime / metrics.length,
      slowRenders: totals.slowRenders / metrics.length,
      memoryUsage: totals.memoryUsage / metrics.length,
      componentName
    };
  }

  getSlowestComponents(limit: number = 5): Array<{ name: string; averageRenderTime: number }> {
    const results: Array<{ name: string; averageRenderTime: number }> = [];

    for (const [name, metrics] of this.metrics) {
      const average = this.getAverageMetrics(name);
      if (average) {
        results.push({ name, averageRenderTime: average.averageRenderTime });
      }
    }

    return results
      .sort((a, b) => b.averageRenderTime - a.averageRenderTime)
      .slice(0, limit);
  }

  clear(): void {
    this.metrics.clear();
  }

  generateReport(): string {
    const report: string[] = ['📊 Performance Report', ''];
    
    const slowest = this.getSlowestComponents();
    if (slowest.length > 0) {
      report.push('🐌 Slowest Components:');
      slowest.forEach((comp, index) => {
        report.push(`${index + 1}. ${comp.name}: ${comp.averageRenderTime.toFixed(2)}ms`);
      });
      report.push('');
    }

    let totalComponents = 0;
    let totalWarnings = 0;

    for (const [name, metrics] of this.metrics) {
      totalComponents++;
      const recent = metrics[metrics.length - 1];
      if (recent && recent.renderTime > PERFORMANCE_CONSTANTS.RENDER_TIME_WARNING) {
        totalWarnings++;
      }
    }

    report.push(`📈 Total Components Monitored: ${totalComponents}`);
    report.push(`⚠️ Components with Performance Warnings: ${totalWarnings}`);

    if (totalWarnings > 0) {
      report.push('');
      report.push('💡 Recommendations:');
      report.push('- Use React.memo for expensive components');
      report.push('- Optimize useEffect dependencies');
      report.push('- Consider component splitting');
      report.push('- Use useCallback and useMemo for expensive operations');
    }

    return report.join('\n');
  }
}

export const globalPerformanceCollector = new PerformanceCollector();

// Development-only performance reporting
if (process.env.NODE_ENV === 'development') {
  // Log performance report every 30 seconds
  setInterval(() => {
    const report = globalPerformanceCollector.generateReport();
    if (report.includes('Performance Warnings: 0') === false) {
      console.group('📊 MindFlow Performance Report');
      console.log(report);
      console.groupEnd();
    }
  }, 30000);
}