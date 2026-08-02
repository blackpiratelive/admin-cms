type EventCallback = (payload: any) => void | Promise<void>;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private initializedSystemHandlers = false;

  subscribe(event: string, callback: EventCallback): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);

    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  emit(event: string, payload: any): void {
    this.initSystemHandlers();
    const callbacks = this.listeners.get(event);
    if (!callbacks || callbacks.size === 0) return;

    // Execute event listeners asynchronously in background microtask without blocking caller Server Action thread
    queueMicrotask(() => {
      for (const callback of callbacks) {
        try {
          Promise.resolve(callback(payload)).catch((err) =>
            console.error(`[EventBus] Error in async event listener for '${event}':`, err)
          );
        } catch (err) {
          console.error(`[EventBus] Error launching listener for '${event}':`, err);
        }
      }
    });
  }

  private initSystemHandlers() {
    if (this.initializedSystemHandlers) return;
    this.initializedSystemHandlers = true;

    // Non-blocking background handlers for search_index, system_stats, dashboard_cache, and analytics
    this.subscribe("entity.saved", async (payload: { type: string; id: string; title: string; subtitle?: string; keywords?: string; url: string }) => {
      try {
        const { upsertSearchEntry } = await import("@/features/search/search-index");
        const { rebuildSystemStatsCache } = await import("@/features/stats/actions");
        const { rebuildDashboardCache } = await import("@/features/dashboard/cache");
        const { scheduleBackgroundAnalyticsRebuild } = await import("@/features/analytics/core");

        await upsertSearchEntry({
          entityType: payload.type,
          entityId: payload.id,
          title: payload.title,
          subtitle: payload.subtitle,
          keywords: payload.keywords,
          url: payload.url,
        });

        await Promise.all([
          rebuildSystemStatsCache(),
          rebuildDashboardCache(true),
        ]);

        // Schedule heavy analytics recalculation asynchronously with 5s sliding window debouncing
        scheduleBackgroundAnalyticsRebuild(5000);
      } catch (err) {
        console.error("[EventBus] Error in entity.saved handler:", err);
      }
    });

    this.subscribe("entity.deleted", async (payload: { type: string; id: string }) => {
      try {
        const { deleteSearchEntry } = await import("@/features/search/search-index");
        const { rebuildSystemStatsCache } = await import("@/features/stats/actions");
        const { rebuildDashboardCache } = await import("@/features/dashboard/cache");
        const { scheduleBackgroundAnalyticsRebuild } = await import("@/features/analytics/core");

        await deleteSearchEntry(payload.type, payload.id);

        await Promise.all([
          rebuildSystemStatsCache(),
          rebuildDashboardCache(true),
        ]);

        // Schedule heavy analytics recalculation asynchronously with 5s sliding window debouncing
        scheduleBackgroundAnalyticsRebuild(5000);
      } catch (err) {
        console.error("[EventBus] Error in entity.deleted handler:", err);
      }
    });
  }
}

export const eventBus = new EventBus();
