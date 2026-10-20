import React from "react";
import { getCollectionsOverviewAction } from "@/features/libraries/actions/collections";
import { CollectionsManager } from "@/features/libraries/components/CollectionsManager";

export const metadata = {
  title: "Collections - Admin CMS",
};

export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collections = await getCollectionsOverviewAction();

  return <CollectionsManager collections={collections} />;
}
