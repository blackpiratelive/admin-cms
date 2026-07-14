import React from "react";
import { getMovieDetailAction } from "@/features/libraries/actions/movies";
import { getCollectionsAction } from "@/features/libraries/actions/collections";
import { MovieDetailView } from "@/features/libraries/components/MovieDetailView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const p = await params;
  const traktId = parseInt(p.id, 10);
  const data = await getMovieDetailAction(traktId);
  return {
    title: data ? `${data.movie.title} - Movies Library` : "Movie Detail",
  };
}

export default async function MovieDetailPage({ params }: PageProps) {
  const p = await params;
  const traktId = parseInt(p.id, 10);
  if (isNaN(traktId)) notFound();

  const data = await getMovieDetailAction(traktId);
  if (!data) notFound();

  const collections = await getCollectionsAction();

  return <MovieDetailView movieData={data} allCollections={collections} />;
}
