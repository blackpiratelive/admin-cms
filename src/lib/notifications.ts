export type NotificationType = "success" | "error" | "info" | "loading";

export interface Toast {
  id: string;
  type: NotificationType;
  title?: string;
  message: string;
  duration?: number;
}

type Listener = (toasts: Toast[]) => void;

class NotificationManager {
  private toasts: Toast[] = [];
  private listeners: Set<Listener> = new Set();

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener([...this.toasts]));
  }

  show(toast: Omit<Toast, "id">): string {
    const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const duration = toast.duration ?? (toast.type === "loading" ? 0 : 4000);
    const newToast: Toast = { ...toast, id, duration };

    this.toasts = [...this.toasts, newToast];
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }

    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  update(id: string, toast: Partial<Omit<Toast, "id">>) {
    const existing = this.toasts.find((t) => t.id === id);
    if (!existing) return;

    const duration = toast.duration ?? (toast.type === "loading" ? 0 : 4000);
    this.toasts = this.toasts.map((t) => (t.id === id ? { ...t, ...toast, duration } : t));
    this.notify();

    if (duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, duration);
    }
  }

  /**
   * Run a DB write or async operation in background while instantly notifying the user.
   */
  async bg<T>({
    title,
    loadingMessage,
    successMessage,
    errorMessage,
    task,
    onSuccess,
    onError,
  }: {
    title?: string;
    loadingMessage?: string;
    successMessage?: string | ((res: T) => string);
    errorMessage?: string | ((err: any) => string);
    task: () => Promise<T>;
    onSuccess?: (res: T) => void;
    onError?: (err: any) => void;
  }): Promise<void> {
    let toastId: string | null = null;
    if (loadingMessage) {
      toastId = this.show({
        type: "loading",
        title: title || "Saving...",
        message: loadingMessage,
        duration: 0,
      });
    }

    // Execute in background non-blocking
    (async () => {
      try {
        const result = await task();
        const msg =
          typeof successMessage === "function"
            ? successMessage(result)
            : successMessage || "DB write completed successfully.";

        if (toastId) {
          this.update(toastId, {
            type: "success",
            title: title || "Saved",
            message: msg,
            duration: 4000,
          });
        } else {
          this.show({
            type: "success",
            title: title || "Saved",
            message: msg,
            duration: 4000,
          });
        }

        if (onSuccess) onSuccess(result);
      } catch (err: any) {
        console.error("Background operation failed:", err);
        const errorMsg =
          typeof errorMessage === "function"
            ? errorMessage(err)
            : errorMessage || err?.message || "Operation failed.";

        if (toastId) {
          this.update(toastId, {
            type: "error",
            title: title || "Error",
            message: errorMsg,
            duration: 6000,
          });
        } else {
          this.show({
            type: "error",
            title: title || "Error",
            message: errorMsg,
            duration: 6000,
          });
        }

        if (onError) onError(err);
      }
    })();
  }
}

export const notify = new NotificationManager();
