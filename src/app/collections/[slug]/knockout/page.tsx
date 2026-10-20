import React, { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import {
  getCollectionKnockoutDeckAction,
  getCollectionKnockoutSummaryAction,
} from "@/features/libraries/actions/collection-knockout";
import { PublicCollectionKnockout } from "@/features/libraries/components/public/PublicCollectionKnockout";
import {
  getAlbumPath,
  getKnockoutPath,
} from "@/features/libraries/collection-knockout";

export const dynamic = "force-dynamic";

interface KnockoutPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ share?: string | string[]; preview?: string | string[] }>;
}

function readToken(searchParams: { share?: string | string[] }): string | undefined {
  return typeof searchParams.share === "string"
    ? searchParams.share
    : Array.isArray(searchParams.share)
      ? searchParams.share[0]
      : undefined;
}

function readPreview(searchParams: { preview?: string | string[] }): boolean {
  const value =
    typeof searchParams.preview === "string"
      ? searchParams.preview
      : Array.isArray(searchParams.preview)
        ? searchParams.preview[0]
        : undefined;
  return value === "1" || value === "true";
}

const getDeckForRequest = cache(async (slug: string, token?: string) =>
  getCollectionKnockoutDeckAction(slug, token)
);

export async function generateMetadata({
  params,
  searchParams,
}: KnockoutPageProps): Promise<Metadata> {
  const { slug } = await params;
  const token = readToken(await searchParams);
  const result = await getDeckForRequest(slug, token);

  if (!result || result.state !== "ready") {
    return {
      title: "Knockout Not Found",
      robots: { index: false, follow: false },
    };
  }

  const { deck } = result;
  const title = `Best Pic Knockout · ${deck.collection.name}`;
  const description = `A blind photo knockout for ${deck.collection.name}. Two photos at a time, one champion at the end.`;
  const isPublic = deck.collection.visibility === "public";

  return {
    title,
    description,
    robots: { index: false, follow: isPublic },
    alternates: isPublic
      ? { canonical: `/collections/${deck.collection.slug}/knockout` }
      : undefined,
    openGraph: {
      type: "website",
      title,
      description,
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default async function CollectionKnockoutPage({
  params,
  searchParams,
}: KnockoutPageProps) {
  const { slug } = await params;
  const { share, preview } = await searchParams;
  const token = readToken({ share });
  const isPreview = readPreview({ preview });

  const [result, summary] = await Promise.all([
    getDeckForRequest(slug, token),
    getCollectionKnockoutSummaryAction(slug, token),
  ]);

  if (!result) notFound();

  if (result.state === "disabled") {
    redirect(getAlbumPath(slug, { token, preview: isPreview }));
  }

  const { deck } = result;
  const albumPath = getAlbumPath(deck.collection.slug, { token, preview: isPreview });
  const knockoutPath = getKnockoutPath(deck.collection.slug, {
    token,
    preview: isPreview,
  });

  return (
    <PublicCollectionKnockout
      deck={deck}
      summary={summary}
      token={token}
      preview={isPreview}
      albumPath={albumPath}
      knockoutPath={knockoutPath}
    />
  );
}
