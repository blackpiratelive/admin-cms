type EventCallback = (payload: any) => void | Promise<void>;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

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
}

export const eventBus = new EventBus();
