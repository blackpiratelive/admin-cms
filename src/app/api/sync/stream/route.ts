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
      const sendEvent = (eventData: Record<string, any>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(eventData)}\n\n`));
      };

      const log = (message: string) => {
        const time = new Date().toLocaleTimeString();
        sendEvent({ type: "log", time, message });
      };

      try {
        const provider = syncRegistry.getProvider(slug);
        if (!provider) {
          log(`Error: Provider '${slug}' is not registered.`);
          sendEvent({ type: "done", success: false, error: `Provider '${slug}' not found` });
          return;
        }

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
        controller.close();
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
