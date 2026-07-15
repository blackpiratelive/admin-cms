import { NextRequest } from "next/server";
import { syncRegistry } from "@/features/sync/registry";
import { calculateLastFmPlayedDatesAction } from "@/features/sync/providers/lastfm/actions";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, target, mode, batchSize } = body;

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
        if (action === "calculate_dates") {
          log("Starting manual date calculation from local scrobbles...");
          const res = await calculateLastFmPlayedDatesAction(log);
          log(`Finished date calculation! Artists: ${res.updatedArtists}, Albums: ${res.updatedAlbums}, Tracks: ${res.updatedTracks}`);
          sendEvent({ type: "done", success: true, result: res });
        } else {
          const provider = syncRegistry.getProvider("lastfm");
          if (!provider) {
            log("Error: Last.fm sync provider not registered.");
            sendEvent({ type: "done", success: false, error: "Provider not found" });
            return;
          }

          log(`Initializing Last.fm sync (Target: ${target || "scrobbles"}, Mode: ${mode || "incremental"})...`);
          const res = await provider.sync({
            target: target || "scrobbles",
            mode: mode || "incremental",
            batchSize: batchSize ? parseInt(batchSize, 10) : 50,
            onProgress: (msg: string) => log(msg),
          });

          if (res.success) {
            log(`Sync process finished successfully! Created: ${res.itemsCreated}, Updated: ${res.itemsUpdated}`);
            sendEvent({ type: "done", success: true, result: res });
          } else {
            log(`Sync completed with error: ${res.errorMessage || "Unknown error"}`);
            sendEvent({ type: "done", success: false, error: res.errorMessage });
          }
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
