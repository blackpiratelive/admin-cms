export interface PerformanceBudget {
  targetMs: number;
}

export const BUDGETS = {
  dashboard: 300,
  listPage: 200,
  search: 100,
  detailPage: 150,
  writeOps: 1000,
};

/**
 * Measure execution duration of async functions and log warnings if budgets are exceeded.
 */
export async function measurePerformance<T>(
  name: string,
  fn: () => Promise<T>,
  budgetMs: number = 300
): Promise<T> {
  const start = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - start;
    if (process.env.NODE_ENV === "development" || duration > budgetMs) {
      if (duration > budgetMs) {
        console.warn(
          `⏱️ [PERF BUDGET WARN] '${name}' took ${duration.toFixed(1)}ms (Exceeded budget of ${budgetMs}ms)`
        );
      } else {
        console.log(`⏱️ [PERF LOG] '${name}' completed in ${duration.toFixed(1)}ms`);
      }
    }
    return result;
  } catch (err) {
    const duration = performance.now() - start;
    console.error(`⏱️ [PERF ERROR] '${name}' failed after ${duration.toFixed(1)}ms:`, err);
    throw err;
  }
}
