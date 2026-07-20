import {
  getGlobalAnalyticsAction,
  getMemoryIndexRankingsAction,
  getUnifiedTimelineAction,
  getHistoricalSnapshotsAction,
} from "@/features/analytics/actions";
import { AnalyticsDashboardClient } from "./AnalyticsDashboardClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Analytics & Memory Discovery Engine - Personal CMS",
  description: "Comprehensive Analytics Engine, Statistics Module and Memory Discovery Index",
};

export default async function AnalyticsPage() {
  const [overview, memoryScores, timeline, snapshots] = await Promise.all([
    getGlobalAnalyticsAction(),
    getMemoryIndexRankingsAction("all", 30),
    getUnifiedTimelineAction(50, 0),
    getHistoricalSnapshotsAction("daily"),
  ]);

  return (
    <AnalyticsDashboardClient
      initialOverview={overview}
      initialMemoryScores={memoryScores}
      initialTimeline={timeline}
      initialSnapshots={snapshots}
    />
  );
}
