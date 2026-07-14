import { SyncLogsView } from "@/features/sync/components/SyncLogsView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sync Audit Logs | Admin CMS",
  description: "View detailed execution logs and sync history for external data providers.",
};

export default async function SyncLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ provider?: string }>;
}) {
  const params = await searchParams;
  return <SyncLogsView initialProvider={params.provider} />;
}
