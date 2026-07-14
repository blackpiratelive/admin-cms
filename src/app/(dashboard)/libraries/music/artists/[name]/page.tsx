import React from "react";
import { getArtistDetailAction } from "@/features/libraries/actions/music";
import { getCollectionsAction } from "@/features/libraries/actions/collections";
import { ArtistDetailView } from "@/features/libraries/components/ArtistDetailView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ name: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const p = await params;
  const artistName = decodeURIComponent(p.name);
  const data = await getArtistDetailAction(artistName);
  return {
    title: data ? `${data.artist.artistName} - Music Library` : "Artist Detail",
  };
}

export default async function ArtistDetailPage({ params }: PageProps) {
  const p = await params;
  const artistName = decodeURIComponent(p.name);

  const data = await getArtistDetailAction(artistName);
  if (!data) notFound();

  const collections = await getCollectionsAction();

  return <ArtistDetailView artistData={data} allCollections={collections} />;
}
