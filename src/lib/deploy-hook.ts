export async function triggerVercelDeployHook() {
  const hookUrl = process.env.VERCEL_DEPLOY_HOOK;
  if (!hookUrl) {
    console.log("No VERCEL_DEPLOY_HOOK configured. Skipping deploy trigger.");
    return { status: "skipped", message: "No hook URL configured" };
  }

  try {
    const res = await fetch(hookUrl, { method: "POST" });
    if (!res.ok) {
      console.error("Vercel deploy hook failed with status:", res.status);
      return { status: "error", error: `Deploy hook returned HTTP ${res.status}` };
    }
    return { status: "success" };
  } catch (err) {
    console.error("Error calling Vercel deploy hook:", err);
    return { status: "error", error: String(err) };
  }
}

/**
 * Triggers Vercel Deploy Hook asynchronously in a background microtask
 * so caller Server Actions return immediately without awaiting HTTP network latency.
 */
export function triggerVercelDeployHookBackground(): void {
  queueMicrotask(async () => {
    try {
      const res = await triggerVercelDeployHook();
      if (res.status === "success" || res.status === "error") {
        const { logActivity } = await import("@/features/activity/actions");
        await logActivity(
          "deploy_hook_triggered",
          "deploy",
          "vercel",
          `Vercel Deploy Hook: ${res.status}`,
          res
        );
      }
    } catch (err) {
      console.error("[DeployHook] Error in background deploy hook execution:", err);
    }
  });
}

