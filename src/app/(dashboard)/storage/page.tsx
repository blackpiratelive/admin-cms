import { getCloudinaryUsage, getCloudinaryResources } from "@/features/media/cloudinaryActions";
import { StorageDashboard } from "./StorageDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Cloudinary Storage | Personal CMS",
  description: "Manage media uploads and view usage statistics from Cloudinary",
};

export default async function StoragePage() {
  const usageResult = await getCloudinaryUsage();
  const resourcesResult = await getCloudinaryResources();

  return (
    <StorageDashboard
      initialUsage={usageResult.success && usageResult.usage ? usageResult.usage : null}
      initialResources={resourcesResult.success && resourcesResult.resources ? resourcesResult.resources : []}
      error={usageResult.success && resourcesResult.success ? null : (usageResult.error || resourcesResult.error || "Failed to fetch Cloudinary data")}
    />
  );
}
