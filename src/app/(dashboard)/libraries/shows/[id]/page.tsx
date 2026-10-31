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
  const showId = parseInt(p.id, 10);
  const data = await getShowDetailAction(showId);
  return {
    title: data ? `${data.show.title} - TV Shows Library` : "TV Show Detail",
  };
}

export default async function ShowDetailPage({ params }: PageProps) {
  const p = await params;
  const showId = parseInt(p.id, 10);
  if (isNaN(showId)) notFound();

  const data = await getShowDetailAction(showId);
  if (!data) notFound();

  const collections = (await getCollectionsAction()).filter((collection) => collection.kind !== "photo");

  return <ShowDetailView showData={data} allCollections={collections} />;
}
