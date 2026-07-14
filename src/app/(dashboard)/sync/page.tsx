import { SyncCenterDashboard } from "@/features/sync/components/SyncCenterDashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sync Center | Admin CMS",
  description: "Manage external data provider syncs for Trakt, Last.fm, and local database integrations.",
};

export default function SyncPage() {
  return <SyncCenterDashboard />;
}
