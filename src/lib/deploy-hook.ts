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
