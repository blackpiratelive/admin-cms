/**
 * Telemetry and performance monitoring module.
 * Measures query latency and enforces performance budgets across operations.
 */

export interface PerformanceBudgetConfig {
  cachedOverviewMaxMs: number;
  memoryIndexRankingsMaxMs: number;
  timelineQueryMaxMs: number;
  fullRebuildMaxMs: number;
}

export const ANALYTICS_PERFORMANCE_BUDGET: PerformanceBudgetConfig = {
  cachedOverviewMaxMs: 100,
  memoryIndexRankingsMaxMs: 100,
  timelineQueryMaxMs: 200,
  fullRebuildMaxMs: 300,
};

export async function measureTelemetry<T>(
  operationName: string,
  budgetMs: number,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;

    if (duration > budgetMs) {
      console.warn(
        `[Telemetry Warning] Operation '${operationName}' exceeded performance budget of ${budgetMs}ms (took ${duration.toFixed(2)}ms)`
      );
    } else {
      console.log(
        `[Telemetry OK] '${operationName}' completed in ${duration.toFixed(2)}ms (budget: ${budgetMs}ms)`
      );
    }

    return result;
  } catch (err) {
    const duration = performance.now() - start;
    console.error(
      `[Telemetry Error] Operation '${operationName}' failed after ${duration.toFixed(2)}ms:`,
      err
    );
    throw err;
  }
}
