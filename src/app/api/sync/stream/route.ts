import { NextRequest } from "next/server";
import { syncRegistry } from "@/features/sync/registry";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { slug, mode, target, batchSize } = body;

  if (!slug) {
    return new Response(JSON.stringify({ error: "Provider slug is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let isStreamClosed = false;

      const sendEvent = (eventData: Record<string, any>) => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
        } catch {
          isStreamClosed = true;
        }
      };

      const log = (message: string) => {
        const time = new Date().toLocaleTimeString();
        sendEvent({ type: "log", time, message });
      };

      // Periodic keepalive comment to prevent proxy idle timeouts
      const keepaliveTimer = setInterval(() => {
        if (isStreamClosed) return;
        try {
          controller.enqueue(encoder.encode(`: keepalive\n\n`));
        } catch {
          isStreamClosed = true;
        }
      }, 10_000);

      // Watchdog timer (270s) to safely catch tasks approaching Vercel's 300s limit
      let watchdogTimer: NodeJS.Timeout | null = null;

      try {
        const provider = syncRegistry.getProvider(slug);
        if (!provider) {
          log(`Error: Provider '${slug}' is not registered.`);
          sendEvent({ type: "done", success: false, error: `Provider '${slug}' not found` });
          return;
        }

        watchdogTimer = setTimeout(async () => {
          if (isStreamClosed) return;
          log("⚠️ Task approaching Vercel 300-second runtime limit (270s elapsed). Pausing gracefully.");
          sendEvent({
            type: "done",
            success: false,
            error: "Vercel Runtime Timeout Warning: Execution approached 300s limit. Partial progress was committed. Please run sync again to continue incrementally.",
          });
          try {
            await provider.cancelSync();
          } catch {}
          isStreamClosed = true;
          try {
            controller.close();
          } catch {}
        }, 270_000);

        log(`Initializing ${provider.name} sync (Mode: ${mode || "incremental"})...`);

        const res = await provider.sync({
          mode: mode || "incremental",
          target,
          batchSize: batchSize ? parseInt(String(batchSize), 10) : undefined,
          onProgress: (msg: string) => log(msg),
        });

        if (res.success) {
          const created = res.itemsCreated ?? 0;
          const updated = res.itemsUpdated ?? 0;
          log(`Sync finished successfully! Created: ${created}, Updated: ${updated}`);
          sendEvent({ type: "done", success: true, result: res });
        } else {
          log(`Sync completed with error: ${res.errorMessage || "Unknown error"}`);
          sendEvent({ type: "done", success: false, error: res.errorMessage });
        }
      } catch (err: any) {
        log(`Fatal error during execution: ${err.message || String(err)}`);
        sendEvent({ type: "done", success: false, error: err.message || String(err) });
      } finally {
        clearInterval(keepaliveTimer);
        if (watchdogTimer) clearTimeout(watchdogTimer);
        if (!isStreamClosed) {
          isStreamClosed = true;
          try {
            controller.close();
          } catch {}
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
