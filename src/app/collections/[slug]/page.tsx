import React, { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicCollectionAction } from "@/features/libraries/actions/collections";
import { PublicCollectionContent } from "@/features/libraries/components/public/PublicCollectionContent";

export const dynamic = "force-dynamic";

interface PublicCollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ share?: string | string[] }>;
}

const getCollectionForRequest = cache(async (slug: string, token?: string) =>
  getPublicCollectionAction(slug, token)
);

function readToken(searchParams: { share?: string | string[] }): string | undefined {
  return typeof searchParams.share === "string"
    ? searchParams.share
    : Array.isArray(searchParams.share)
      ? searchParams.share[0]
      : undefined;
}

function coverFor(detail: NonNullable<Awaited<ReturnType<typeof getPublicCollectionAction>>>): string | undefined {
  return (
    detail.photos[0]?.mediumUrl ||
    detail.movies[0]?.posterUrl ||
    detail.shows[0]?.posterUrl ||
    detail.people[0]?.avatarUrl ||
    undefined
  );
}

export async function generateMetadata({ params, searchParams }: PublicCollectionPageProps): Promise<Metadata> {
  const { slug } = await params;
  const { share } = await searchParams;
  const detail = await getCollectionForRequest(slug, readToken({ share }));

  if (!detail) {
    return {
      title: "Collection Not Found",
      robots: { index: false, follow: false },
    };
  }

  const cover = coverFor(detail);
  const description =
    detail.collection.description ||
    `${detail.collection.name} — a curated collection of photographs, films, music, and people.`;
  const isPublic = detail.collection.visibility === "public";

  return {
    title: detail.collection.name,
    description,
    robots: isPublic ? undefined : { index: false, follow: false },
    alternates: isPublic ? { canonical: `/collections/${detail.collection.slug}` } : undefined,
    openGraph: {
      type: "website",
      title: detail.collection.name,
      description,
      images: cover ? [{ url: cover }] : undefined,
    },
    twitter: {
      card: cover ? "summary_large_image" : "summary",
      title: detail.collection.name,
      description,
      images: cover ? [cover] : undefined,
    },
  };
}

export default async function PublicCollectionPage({ params, searchParams }: PublicCollectionPageProps) {
  const { slug } = await params;
  const { share } = await searchParams;
  const detail = await getCollectionForRequest(slug, readToken({ share }));

  if (!detail) notFound();

  return <PublicCollectionContent detail={detail} />;
}
