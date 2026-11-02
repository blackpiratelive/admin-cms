import { getHealthHubDataAction } from "@/features/health/actions";
import { HealthDashboard } from "@/features/health/components/HealthDashboard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Health & Hair Regrowth | Admin CMS",
  description: "Weekly scalp photos, Minoxidil logs, streaks & adherence tracking.",
};

export default async function HealthPage({
  searchParams,
}: {
  searchParams?: Promise<{ profile?: string }> | { profile?: string };
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const data = await getHealthHubDataAction(resolvedParams.profile);

  return <HealthDashboard initialData={data} />;
}
