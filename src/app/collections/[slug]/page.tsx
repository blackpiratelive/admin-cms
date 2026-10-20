import React, { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicCollectionAction } from "@/features/libraries/actions/collections";
import { CollectionViewTracker } from "@/features/libraries/components/CollectionViewTracker";
import { PublicCollectionContent } from "@/features/libraries/components/public/PublicCollectionContent";
import { getKnockoutPath } from "@/features/libraries/collection-knockout";
import type { PublicCollectionDetail } from "@/features/libraries/collection-types";

export const dynamic = "force-dynamic";

interface PublicCollectionPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ share?: string | string[]; preview?: string | string[] }>;
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

function readPreview(searchParams: { preview?: string | string[] }): boolean {
  const value = typeof searchParams.preview === "string"
    ? searchParams.preview
    : Array.isArray(searchParams.preview)
      ? searchParams.preview[0]
      : undefined;
  return value === "1" || value === "true";
}

function coverFor(detail: PublicCollectionDetail): string | undefined {
  return detail.coverUrl || undefined;
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
  const { share, preview } = await searchParams;
  const token = readToken({ share });
  const isPreview = readPreview({ preview });
  const detail = await getCollectionForRequest(slug, token);

  if (!detail) notFound();

  const knockoutPath =
    detail.collection.kind === "photo" && detail.collection.knockoutEnabled !== 0
      ? getKnockoutPath(detail.collection.slug, { token, preview: isPreview })
      : null;

  return (
    <>
      <CollectionViewTracker
        slug={detail.collection.slug}
        token={token}
        preview={isPreview}
      />
      <PublicCollectionContent
        detail={detail}
        knockoutPath={knockoutPath}
        preview={isPreview}
      />
    </>
  );
}
