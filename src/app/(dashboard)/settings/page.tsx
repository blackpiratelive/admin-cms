import { getCloudinaryResources } from "@/features/media/cloudinaryActions";
import { getCloudflareUsageStats } from "@/features/gallery/actions";
import { SettingsDashboard } from "./SettingsDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings | Personal CMS",
  description: "Configure system options, inspect Cloudflare R2 usage stats, and import markdown post files.",
};

export default async function SettingsPage() {
  const [cloudinaryRes, r2Stats] = await Promise.all([
    getCloudinaryResources(),
    getCloudflareUsageStats(),
  ]);

  const cloudinaryImages = cloudinaryRes.success && cloudinaryRes.resources ? cloudinaryRes.resources : [];

  return (
    <SettingsDashboard
      cloudinaryImages={cloudinaryImages}
      r2Stats={r2Stats}
    />
  );
}
