import React from "react";
import { notFound } from "next/navigation";
import { getCollectionDetailAction } from "@/features/libraries/actions/collections";
import { CollectionDetailView } from "@/features/libraries/components/CollectionDetailView";

export const dynamic = "force-dynamic";

interface CollectionDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CollectionDetailPage({ params }: CollectionDetailPageProps) {
  const { slug } = await params;
  const detail = await getCollectionDetailAction(slug);

  if (!detail) notFound();

  return <CollectionDetailView detail={detail} />;
}
