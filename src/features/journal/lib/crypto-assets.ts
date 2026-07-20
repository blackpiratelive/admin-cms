/**
 * Client-Side Binary E2EE Cryptography & Image Pipeline for Journal Assets.
 * Encrypts/decrypts image ArrayBuffers independently using the Journal DEK (AES-256-GCM).
 */

import { uploadRawDirectToCloudinary } from "@/lib/cloudinary";
import { createJournalAssetAction, getJournalAssetByIdAction } from "../actions";
import { JournalAssetRecord } from "@/db/schema";

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export async function encryptArrayBuffer(
  buffer: ArrayBuffer,
  dekKey: CryptoKey
): Promise<{ encryptedBuffer: ArrayBuffer; iv: string }> {
  const ivBytes = window.crypto.getRandomValues(new Uint8Array(12)); // 96-bit AES-GCM IV
  const encrypted = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: ivBytes },
    dekKey,
    buffer
  );

  return {
    encryptedBuffer: encrypted,
    iv: arrayBufferToBase64(ivBytes.buffer),
  };
}

export async function decryptArrayBuffer(
  encryptedBuffer: ArrayBuffer,
  ivBase64: string,
  dekKey: CryptoKey
): Promise<ArrayBuffer> {
  const ivBuffer = base64ToArrayBuffer(ivBase64);
  return window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: ivBuffer },
    dekKey,
    encryptedBuffer
  );
}

export interface ProcessedImageResult {
  compressedBlob: Blob;
  thumbnailBlob: Blob;
  width: number;
  height: number;
  originalSize: number;
  compressedSize: number;
  thumbnailSize: number;
  mimeType: string;
}

async function canvasToBlobFallback(canvas: HTMLCanvasElement, primaryMime: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) return resolve(blob);
        // Fallback to image/jpeg if primary mime (e.g. image/webp) is unsupported for canvas export
        canvas.toBlob(
          (fallbackBlob) => {
            if (fallbackBlob) return resolve(fallbackBlob);
            reject(new Error("Canvas export failed for image"));
          },
          "image/jpeg",
          quality
        );
      },
      primaryMime,
      quality
    );
  });
}

/**
 * Strips EXIF metadata by re-drawing image to Canvas, compresses original (90% quality),
 * and generates a 512px max dimension thumbnail. Fallbacks to raw file bytes if decoding/canvas fails.
 */
export async function processImageFile(file: File): Promise<ProcessedImageResult> {
  try {
    return await new Promise<ProcessedImageResult>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => reject(new Error("Failed to decode image"));
        img.onload = async () => {
          try {
            const width = img.naturalWidth || img.width || 800;
            const height = img.naturalHeight || img.height || 600;
            const originalSize = file.size;
            const targetMime = file.type === "image/png" ? "image/png" : "image/webp";

            // 1. Process Compressed Full-Size Image (EXIF Stripped)
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas 2D context unavailable");
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBlob = await canvasToBlobFallback(canvas, targetMime, 0.9);

            // 2. Process 512px Max-Side Thumbnail
            const MAX_THUMB = 512;
            let thumbW = width;
            let thumbH = height;
            if (thumbW > MAX_THUMB || thumbH > MAX_THUMB) {
              if (thumbW > thumbH) {
                thumbH = Math.round((thumbH * MAX_THUMB) / thumbW);
                thumbW = MAX_THUMB;
              } else {
                thumbW = Math.round((thumbW * MAX_THUMB) / thumbH);
                thumbH = MAX_THUMB;
              }
            }

            const thumbCanvas = document.createElement("canvas");
            thumbCanvas.width = thumbW;
            thumbCanvas.height = thumbH;
            const thumbCtx = thumbCanvas.getContext("2d");
            if (!thumbCtx) throw new Error("Thumb canvas context unavailable");
            thumbCtx.drawImage(img, 0, 0, thumbW, thumbH);

            const thumbnailBlob = await canvasToBlobFallback(thumbCanvas, "image/webp", 0.85);

            resolve({
              compressedBlob,
              thumbnailBlob,
              width,
              height,
              originalSize,
              compressedSize: compressedBlob.size,
              thumbnailSize: thumbnailBlob.size,
              mimeType: targetMime,
            });
          } catch (err) {
            reject(err);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  } catch (err) {
    console.warn("Image canvas processing failed, using raw file bytes fallback:", err);
    return {
      compressedBlob: file,
      thumbnailBlob: file,
      width: 800,
      height: 600,
      originalSize: file.size,
      compressedSize: file.size,
      thumbnailSize: file.size,
      mimeType: file.type || "image/jpeg",
    };
  }
}


/**
 * End-to-End Image Upload Pipeline:
 * Processes image -> Encrypts original & thumbnail with DEK -> Uploads encrypted blobs to Cloudinary -> Saves asset record in DB.
 */
export async function processAndUploadEncryptedJournalAsset({
  file,
  dekKey,
  entryId,
  assetRole = "attachment",
  onProgress,
}: {
  file: File;
  dekKey: CryptoKey;
  entryId?: string;
  assetRole?: "inline" | "attachment";
  onProgress?: (progressPercent: number, statusText: string) => void;
}): Promise<JournalAssetRecord> {
  onProgress?.(10, "Processing & compressing image...");
  const processed = await processImageFile(file);

  onProgress?.(35, "Encrypting original & thumbnail (AES-256-GCM)...");
  const [origBuf, thumbBuf] = await Promise.all([
    processed.compressedBlob.arrayBuffer(),
    processed.thumbnailBlob.arrayBuffer(),
  ]);

  const [origEnc, thumbEnc] = await Promise.all([
    encryptArrayBuffer(origBuf, dekKey),
    encryptArrayBuffer(thumbBuf, dekKey),
  ]);

  onProgress?.(60, "Uploading encrypted blobs to Cloudinary...");
  const origBlob = new Blob([origEnc.encryptedBuffer], { type: "application/octet-stream" });
  const thumbBlob = new Blob([thumbEnc.encryptedBuffer], { type: "application/octet-stream" });

  const randomAssetId = `jasset_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const [origUpload, thumbUpload] = await Promise.all([
    uploadRawDirectToCloudinary(origBlob, `${randomAssetId}_orig.enc`),
    uploadRawDirectToCloudinary(thumbBlob, `${randomAssetId}_thumb.enc`),
  ]);

  onProgress?.(90, "Saving encrypted asset record...");
  const record = await createJournalAssetAction({
    id: randomAssetId,
    assetType: "image",
    mimeType: processed.mimeType,
    width: processed.width,
    height: processed.height,
    originalSize: processed.originalSize,
    compressedSize: processed.compressedSize,
    thumbnailSize: processed.thumbnailSize,
    cloudinaryOriginalPublicId: origUpload.public_id,
    cloudinaryThumbnailPublicId: thumbUpload.public_id,
    originalIv: origEnc.iv,
    thumbnailIv: thumbEnc.iv,
    encryptionVersion: 1,
    entryId,
    assetRole,
  });

  onProgress?.(100, "Upload completed");
  return record!;
}

/**
 * Downloads encrypted blob from Cloudinary raw URL, decrypts with DEK, and returns a temporary Object URL.
 */
export async function downloadAndDecryptJournalAssetBlob({
  cloudinaryPublicId,
  iv,
  dekKey,
  mimeType = "image/webp",
}: {
  cloudinaryPublicId: string;
  iv: string;
  dekKey: CryptoKey;
  mimeType?: string;
}): Promise<string> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const rawUrl = `https://res.cloudinary.com/${cloudName}/raw/upload/${cloudinaryPublicId}`;

  const res = await fetch(rawUrl);
  if (!res.ok) {
    throw new Error(`Failed to fetch encrypted asset (HTTP ${res.status})`);
  }

  const encryptedBuffer = await res.arrayBuffer();
  const decryptedBuffer = await decryptArrayBuffer(encryptedBuffer, iv, dekKey);

  const decryptedBlob = new Blob([decryptedBuffer], { type: mimeType });
  return URL.createObjectURL(decryptedBlob);
}
