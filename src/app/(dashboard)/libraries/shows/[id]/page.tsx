import React from "react";
import { getShowDetailAction } from "@/features/libraries/actions/shows";
import { getCollectionsAction } from "@/features/libraries/actions/collections";
import { ShowDetailView } from "@/features/libraries/components/ShowDetailView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const p = await params;
  const traktId = parseInt(p.id, 10);
  const data = await getShowDetailAction(traktId);
  return {
    title: data ? `${data.show.title} - TV Shows Library` : "TV Show Detail",
  };
}

export default async function ShowDetailPage({ params }: PageProps) {
  const p = await params;
  const traktId = parseInt(p.id, 10);
  if (isNaN(traktId)) notFound();

  const data = await getShowDetailAction(traktId);
  if (!data) notFound();

  const collections = await getCollectionsAction();

  return <ShowDetailView showData={data} allCollections={collections} />;
}
