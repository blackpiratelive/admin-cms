import { getCloudinaryResources } from "@/features/media/cloudinaryActions";
import { SettingsDashboard } from "./SettingsDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Settings | Personal CMS",
  description: "Configure system options and import markdown post files.",
};

export default async function SettingsPage() {
  const result = await getCloudinaryResources();
  const cloudinaryImages = result.success && result.resources ? result.resources : [];

  return (
    <SettingsDashboard cloudinaryImages={cloudinaryImages} />
  );
}
