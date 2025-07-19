// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private timers = new Map<string, number>();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  // Start timing an operation
  startTimer(operation: string): void {
    this.timers.set(operation, Date.now());
  }

  // End timing and return duration
  endTimer(operation: string): number {
    const startTime = this.timers.get(operation);
    if (!startTime) {
      console.warn(`Timer for operation "${operation}" was not started`);
      return 0;
    }

    const duration = Date.now() - startTime;
    this.timers.delete(operation);
    return duration;
  }

  // Measure async operation
  async measureAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    this.startTimer(operation);
    try {
      const result = await fn();
      const duration = this.endTimer(operation);
      console.log(`Operation "${operation}" completed in ${duration}ms`);
      return result;
    } catch (error) {
      this.endTimer(operation);
      throw error;
    }
  }

  // Measure sync operation
  measure<T>(operation: string, fn: () => T): T {
    this.startTimer(operation);
    try {
      const result = fn();
      const duration = this.endTimer(operation);
      console.log(`Operation "${operation}" completed in ${duration}ms`);
      return result;
    } catch (error) {
      this.endTimer(operation);
      throw error;
    }
  }

  // Get memory usage (Node.js only)
  getMemoryUsage(): NodeJS.MemoryUsage | null {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  }

  // Log performance metrics
  logPerformanceMetrics(): void {
    const memory = this.getMemoryUsage();
    if (memory) {
      console.log('Memory Usage:', {
        rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
        heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
        heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
        external: `${Math.round(memory.external / 1024 / 1024)} MB`,
      });
    }
  }
}