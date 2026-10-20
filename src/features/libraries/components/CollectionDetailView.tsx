"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addPhotosToCollectionAction,
  getCollectionDetailAction,
  regenerateCollectionShareTokenAction,
  removeItemFromCollectionAction,
  setCollectionCoverAction,
  setCollectionVisibilityAction,
} from "../actions/collections";
import {
  getCollectionPreviewPath,
  type CollectionVisibility,
} from "../collection-helpers";
import type { CollectionDetail } from "../collection-types";
import { CollectionContentTab } from "./CollectionContentTab";
import { CollectionCoverPickerModal } from "./CollectionCoverPickerModal";
import { CollectionHero } from "./CollectionHero";
import { CollectionInsightsTab } from "./CollectionInsightsTab";
import { CollectionPhotoPickerModal } from "./CollectionPhotoPickerModal";
import { CollectionSettingsTab } from "./CollectionSettingsTab";
import { CollectionSharingTab } from "./CollectionSharingTab";
import { CollectionTabs, type CollectionTab } from "./CollectionTabs";

export type { CollectionTab } from "./CollectionTabs";

interface CollectionDetailViewProps {
  initialDetail: CollectionDetail;
  initialTab: CollectionTab;
}

export function CollectionDetailView({
  initialDetail,
  initialTab,
}: CollectionDetailViewProps) {
  const router = useRouter();
  const [detail, setDetail] = useState(initialDetail);
  const [tab, setTab] = useState<CollectionTab>(initialTab);
  const [photoPickerOpen, setPhotoPickerOpen] = useState(false);
  const [coverPickerOpen, setCoverPickerOpen] = useState(false);

  const slug = detail.collection.slug;
  const collectionId = detail.collection.id;

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const refreshDetail = useCallback(async () => {
    const next = await getCollectionDetailAction(slug);
    if (next) setDetail(next);
    return next;
  }, [slug]);

  const changeTab = (next: CollectionTab) => {
    setTab(next);
    router.replace(`/libraries/collections/${slug}?tab=${next}`, {
      scroll: false,
    });
  };

  const removeItem = async (itemType: string, itemId: string) => {
    const result = await removeItemFromCollectionAction(collectionId, itemType, itemId);
    if (result.success) await refreshDetail();
    return result;
  };

  const setCover = async (photoId: string | null) => {
    const result = await setCollectionCoverAction(collectionId, photoId);
    if (result.success) await refreshDetail();
    return result;
  };

  const changeVisibility = async (visibility: CollectionVisibility) => {
    const result = await setCollectionVisibilityAction(collectionId, visibility);
    if (result.success) await refreshDetail();
    return result;
  };

  const regenerateShareLink = async () => {
    const result = await regenerateCollectionShareTokenAction(collectionId);
    if (result.success) await refreshDetail();
    return result;
  };

  const previewPath = detail.sharePath
    ? getCollectionPreviewPath(detail.sharePath)
    : null;

  return (
    <div className="collection-detail">
      <CollectionHero
        detail={detail}
        previewPath={previewPath}
        onChangeCover={() => setCoverPickerOpen(true)}
        onShare={() => changeTab("sharing")}
      />

      <CollectionTabs
        activeTab={tab}
        onChange={changeTab}
        contentCount={detail.counts.total}
      />

      <div className="collection-tab-body">
        {tab === "content" && (
          <CollectionContentTab
            detail={detail}
            onOpenPhotoPicker={() => setPhotoPickerOpen(true)}
            onRemoveItem={removeItem}
          />
        )}
        {tab === "sharing" && (
          <CollectionSharingTab
            detail={detail}
            onVisibilityChange={changeVisibility}
            onRegenerate={regenerateShareLink}
          />
        )}
        {tab === "insights" && <CollectionInsightsTab detail={detail} />}
        {tab === "settings" && (
          <CollectionSettingsTab
            detail={detail}
            onRefresh={refreshDetail}
            onOpenCoverPicker={() => setCoverPickerOpen(true)}
            onResetCover={() => setCover(null)}
            onDeleted={() => {
              router.push("/libraries/collections");
              router.refresh();
            }}
          />
        )}
      </div>

      <CollectionPhotoPickerModal
        isOpen={photoPickerOpen}
        onClose={() => setPhotoPickerOpen(false)}
        collectionName={detail.collection.name}
        existingPhotoIds={detail.photos.map((photo) => photo.id)}
        onAdd={(photoIds) => addPhotosToCollectionAction(collectionId, photoIds)}
        onSuccess={() => {
          void refreshDetail();
        }}
      />

      <CollectionCoverPickerModal
        isOpen={coverPickerOpen}
        collectionName={detail.collection.name}
        photos={detail.photos}
        currentCoverId={detail.collection.coverPhotoId}
        onClose={() => setCoverPickerOpen(false)}
        onSelect={setCover}
      />
    </div>
  );
}
