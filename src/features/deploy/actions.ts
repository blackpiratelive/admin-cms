"use server";

import { triggerVercelDeployHook } from "@/lib/deploy-hook";
import { revalidatePath } from "next/cache";

export async function manualDeployAction() {
  const now = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const result = await triggerVercelDeployHook();

  revalidatePath("/");

  if (result.status === "success") {
    return {
      success: true,
      timestamp: now,
      message: `Hugo rebuild triggered at ${now}`,
    };
  } else if (result.status === "skipped") {
    return {
      success: false,
      timestamp: now,
      message: "No VERCEL_DEPLOY_HOOK configured in .env",
    };
  } else {
    return {
      success: false,
      timestamp: now,
      message: result.error || "Deploy hook failed",
    };
  }
}
