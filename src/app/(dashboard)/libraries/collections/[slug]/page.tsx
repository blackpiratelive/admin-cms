import React from "react";
import { notFound } from "next/navigation";
import { getCollectionDetailAction } from "@/features/libraries/actions/collections";
import {
  CollectionDetailView,
  type CollectionTab,
} from "@/features/libraries/components/CollectionDetailView";

export const dynamic = "force-dynamic";

interface CollectionDetailPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}

const TABS = new Set<CollectionTab>(["content", "sharing", "insights", "settings"]);

function readTab(searchParams: { tab?: string | string[] }): CollectionTab {
  const value = typeof searchParams.tab === "string"
    ? searchParams.tab
    : Array.isArray(searchParams.tab)
      ? searchParams.tab[0]
      : undefined;
  return value && TABS.has(value as CollectionTab) ? (value as CollectionTab) : "content";
}

export default async function CollectionDetailPage({
  params,
  searchParams,
}: CollectionDetailPageProps) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const detail = await getCollectionDetailAction(slug);

  if (!detail) notFound();

  return <CollectionDetailView initialDetail={detail} initialTab={readTab({ tab })} />;
}
