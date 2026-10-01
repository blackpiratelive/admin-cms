"use client";

import React from "react";
import { PhotoPickerModal, BatchPhotoConnectItem } from "@/components/PhotoPickerModal";
import { connectPersonPhotosBatchAction } from "@/features/people/actions";

export type { BatchPhotoConnectItem };

export interface PersonPhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  onSuccess?: () => void;
}

export function PersonPhotoPickerModal({
  isOpen,
  onClose,
  personId,
  personName,
  onSuccess,
}: PersonPhotoPickerModalProps) {
  return (
    <PhotoPickerModal
      isOpen={isOpen}
      onClose={onClose}
      entityName={personName}
      entityType="person"
      entityId={personId}
      defaultVerb="appears_in"
      title={`Add Photos of ${personName}`}
      subtitle="Choose existing gallery photos, pick from Cloudinary, or upload new files"
      onConnectPhotos={(photos, verb) =>
        connectPersonPhotosBatchAction(personId, photos, verb)
      }
      onSuccess={onSuccess}
    />
  );
}
