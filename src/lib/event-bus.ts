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

  async emit(event: string, payload: any): Promise<void> {
    this.initSystemHandlers();
    const callbacks = this.listeners.get(event);
    if (!callbacks || callbacks.size === 0) return;

    for (const callback of callbacks) {
      try {
        await callback(payload);
      } catch (err) {
        console.error(`[EventBus] Error in event listener for '${event}':`, err);
      }
    }
  }

  private initSystemHandlers() {
    if (this.initializedSystemHandlers) return;
    this.initializedSystemHandlers = true;

    // Item 6: Automatic event-driven updates for search_index, system_stats, and dashboard_cache
    this.subscribe("entity.saved", async (payload: { type: string; id: string; title: string; subtitle?: string; keywords?: string; url: string }) => {
      try {
        const { upsertSearchEntry } = await import("@/features/search/search-index");
        const { rebuildSystemStatsCache } = await import("@/features/stats/actions");
        const { rebuildDashboardCache } = await import("@/features/dashboard/cache");
        const { rebuildAllAnalyticsCache } = await import("@/features/analytics/core");

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
          rebuildAllAnalyticsCache(),
        ]);
      } catch (err) {
        console.error("[EventBus] Error in entity.saved handler:", err);
      }
    });

    this.subscribe("entity.deleted", async (payload: { type: string; id: string }) => {
      try {
        const { deleteSearchEntry } = await import("@/features/search/search-index");
        const { rebuildSystemStatsCache } = await import("@/features/stats/actions");
        const { rebuildDashboardCache } = await import("@/features/dashboard/cache");
        const { rebuildAllAnalyticsCache } = await import("@/features/analytics/core");

        await deleteSearchEntry(payload.type, payload.id);

        await Promise.all([
          rebuildSystemStatsCache(),
          rebuildDashboardCache(true),
          rebuildAllAnalyticsCache(),
        ]);
      } catch (err) {
        console.error("[EventBus] Error in entity.deleted handler:", err);
      }
    });
  }
}

export const eventBus = new EventBus();
