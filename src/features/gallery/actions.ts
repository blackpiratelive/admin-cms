"use server";

import { db, ensureDbInitialized } from "@/db";
import { gallery, type GalleryPhoto } from "@/db/schema";
import { count, desc, eq, sql } from "drizzle-orm";
import { galleryPhotoInputSchema, type GalleryPhotoInput, generatePhotoSlug } from "./schema";
import { triggerVercelDeployHook } from "@/lib/deploy-hook";
import { revalidatePath } from "next/cache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

interface GetPresignedUrlsInput {
  folderSlug: string;
  year?: string;
  month?: string;
  originalExtension?: string;
}

export interface UploadSignedTarget {
  key: string;
  uploadUrl: string;
  publicUrl: string;
}

export interface PresignedUrlsResult {
  folderPath: string;
  urls: {
    thumbnail: UploadSignedTarget;
    medium: UploadSignedTarget;
    large: UploadSignedTarget;
    original: UploadSignedTarget;
  };
}

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
}

export async function getPresignedGalleryUrls(
  input: GetPresignedUrlsInput
): Promise<{ success: boolean; data?: PresignedUrlsResult; error?: string }> {
  try {
    const now = new Date();
    const year = input.year || now.getFullYear().toString();
    const month = input.month || String(now.getMonth() + 1).padStart(2, "0");
    const cleanSlug = generatePhotoSlug(input.folderSlug);
    const ext = (input.originalExtension || "jpg").replace(/^\.+/, "").toLowerCase();

    const folderPath = `gallery/${year}/${month}/${cleanSlug}`;

    const files = {
      thumbnail: { key: `${folderPath}/thumb.webp`, contentType: "image/webp" },
      medium: { key: `${folderPath}/medium.webp`, contentType: "image/webp" },
      large: { key: `${folderPath}/large.webp`, contentType: "image/webp" },
      original: { key: `${folderPath}/original.${ext}`, contentType: `image/${ext === "png" ? "png" : "jpeg"}` },
    };

    const s3 = getR2Client();
    const bucket = process.env.R2_BUCKET_NAME || "gallery";
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || process.env.S3_CUSTOM_DOMAIN;

    const urls: Partial<Record<keyof typeof files, UploadSignedTarget>> = {};

    for (const [type, info] of Object.entries(files) as [keyof typeof files, { key: string; contentType: string }][]) {
      let uploadUrl: string;
      let publicUrl: string;

      if (s3) {
        const command = new PutObjectCommand({
          Bucket: bucket,
          Key: info.key,
          ContentType: info.contentType,
        });
        uploadUrl = await getSignedUrl(s3, command, { expiresIn: 3600 });
        publicUrl = publicDomain
          ? `${publicDomain.replace(/\/$/, "")}/${info.key}`
          : `https://${bucket}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${info.key}`;
      } else {
        // Fallback local mock signed URL for dev environment without R2 credentials
        uploadUrl = `/api/gallery/local-upload?key=${encodeURIComponent(info.key)}`;
        publicUrl = `/uploads/${info.key}`;
      }

      urls[type] = {
        key: info.key,
        uploadUrl,
        publicUrl,
      };
    }

    return {
      success: true,
      data: {
        folderPath,
        urls: urls as PresignedUrlsResult["urls"],
      },
    };
  } catch (err: any) {
    console.error("Error generating presigned gallery upload URLs:", err);
    return { success: false, error: err.message || "Failed to generate presigned upload URLs." };
  }
}

export async function saveGalleryPhoto(input: GalleryPhotoInput) {
  try {
    await ensureDbInitialized();
    const validated = galleryPhotoInputSchema.parse(input);
    const now = new Date().toISOString();

    const id = validated.id || crypto.randomUUID();
    const slug = validated.slug && validated.slug.trim() !== "" 
      ? generatePhotoSlug(validated.slug) 
      : generatePhotoSlug(validated.title);

    const existing = validated.id ? await getGalleryPhotoById(validated.id) : null;

    const recordData = {
      id,
      title: validated.title,
      slug,
      description: validated.description || null,
      originalUrl: validated.originalUrl,
      largeUrl: validated.largeUrl,
      mediumUrl: validated.mediumUrl,
      thumbnailUrl: validated.thumbnailUrl,
      width: validated.width || null,
      height: validated.height || null,
      fileSize: validated.fileSize || null,
      mimeType: validated.mimeType || null,
      camera: validated.camera || null,
      lens: validated.lens || null,
      focalLength: validated.focalLength || null,
      aperture: validated.aperture || null,
      shutterSpeed: validated.shutterSpeed || null,
      iso: validated.iso || null,
      takenAt: validated.takenAt || null,
      latitude: validated.latitude || null,
      longitude: validated.longitude || null,
      locationName: validated.locationName || null,
      locationId: validated.locationId || null,
      tripId: validated.tripId || null,
      visibility: validated.visibility,
      featured: validated.featured ? 1 : 0,
      processingStatus: validated.processingStatus,
      tags: JSON.stringify(validated.tags),
      album: validated.album || null,
      shortUrl: validated.shortUrl || null,
      updatedAt: now,
    };

    if (existing) {
      await db.update(gallery).set(recordData).where(eq(gallery.id, id));
    } else {
      await db.insert(gallery).values({
        ...recordData,
        createdAt: now,
      });
    }

    // Trigger Hugo rebuild via deploy hook on successful publish
    if (validated.visibility === "public") {
      await triggerVercelDeployHook();
    }

    usageStatsCache = null;
    revalidatePath("/gallery");
    revalidatePath("/");
    return { success: true, id, slug };
  } catch (error: any) {
    console.error("Error saving gallery photo:", error);
    return { success: false, error: error.message || "Failed to save photo metadata." };
  }
}

export async function getGalleryPhotos(): Promise<GalleryPhoto[]> {
  try {
    await ensureDbInitialized();
    return await db.select().from(gallery).orderBy(desc(gallery.createdAt));
  } catch (error) {
    console.error("Error fetching gallery photos:", error);
    return [];
  }
}

export async function getGalleryPhotoById(id: string): Promise<GalleryPhoto | null> {
  try {
    await ensureDbInitialized();
    const results = await db.select().from(gallery).where(eq(gallery.id, id));
    return results[0] || null;
  } catch (error) {
    console.error("Error fetching gallery photo by ID:", error);
    return null;
  }
}

export async function getGalleryPhotoBySlug(slug: string): Promise<GalleryPhoto | null> {
  try {
    await ensureDbInitialized();
    const results = await db.select().from(gallery).where(eq(gallery.slug, slug));
    return results[0] || null;
  } catch (error) {
    console.error("Error fetching gallery photo by slug:", error);
    return null;
  }
}

export async function deleteGalleryPhoto(id: string) {
  try {
    await ensureDbInitialized();
    await db.delete(gallery).where(eq(gallery.id, id));
    usageStatsCache = null;
    revalidatePath("/gallery");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting gallery photo:", error);
    return { success: false, error: error.message || "Failed to delete photo." };
  }
}

export interface CloudflareUsageStats {
  configured: boolean;
  bucketName: string;
  totalPhotos: number;
  totalObjects: number;
  usedBytes: number;
  usedFormatted: string;
  storageLimitFormatted: string;
  percentStorageUsed: number;
  classALimitFormatted: string;
  classBLimitFormatted: string;
  egressLimitFormatted: string;
}

const USAGE_STATS_TTL_MS = 30_000;
let usageStatsCache: { expiresAt: number; value: CloudflareUsageStats } | null = null;

export async function getCloudflareUsageStats(): Promise<CloudflareUsageStats> {
  if (usageStatsCache && usageStatsCache.expiresAt > Date.now()) {
    return usageStatsCache.value;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME || "gallery";

  const isConfigured = Boolean(accountId && accessKeyId && secretAccessKey);

  let totalPhotos = 0;
  let totalBytes = 0;

  try {
    await ensureDbInitialized();
    const [totals] = await db
      .select({
        totalPhotos: count(),
        originalBytes: sql<number>`coalesce(sum(${gallery.fileSize}), 0)`,
      })
      .from(gallery);
    totalPhotos = totals?.totalPhotos ?? 0;
    // The pipeline stores an original and three derivatives. This estimate avoids
    // enumerating every object when R2 is temporarily unavailable.
    totalBytes = Math.round((totals?.originalBytes ?? 0) * 1.4);
  } catch (e) {
    console.error("Error calculating local DB gallery stats:", e);
  }

  const s3 = getR2Client();
  let r2ObjectCount = totalPhotos * 4;
  if (s3) {
    try {
      const { ListObjectsV2Command } = await import("@aws-sdk/client-s3");
      const command = new ListObjectsV2Command({ Bucket: bucketName });
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 100));
      const res = await Promise.race([s3.send(command), timeoutPromise]);
      if (res && "Contents" in res && res.Contents && res.Contents.length > 0) {
        r2ObjectCount = res.Contents.length;
        const actualR2Bytes = res.Contents.reduce((acc, obj) => acc + (obj.Size || 0), 0);
        if (actualR2Bytes > 0) {
          totalBytes = actualR2Bytes;
        }
      }
    } catch (e) {
      // Fall back to estimated totalBytes from Turso DB
    }
  }

  const FREE_STORAGE_BYTES = 10 * 1024 * 1024 * 1024; // 10 GB
  const percentStorageUsed = Math.min(100, Number(((totalBytes / FREE_STORAGE_BYTES) * 100).toFixed(2)));

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 MB";
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const result = {
    configured: isConfigured,
    bucketName: isConfigured ? bucketName : "gallery (Local Dev Fallback)",
    totalPhotos,
    totalObjects: r2ObjectCount,
    usedBytes: totalBytes,
    usedFormatted: formatSize(totalBytes),
    storageLimitFormatted: "10 GB / month (Free Tier)",
    percentStorageUsed,
    classALimitFormatted: "1,000,000 requests / month (Free Tier)",
    classBLimitFormatted: "10,000,000 requests / month (Free Tier)",
    egressLimitFormatted: "Unlimited ($0 Egress)",
  };
  usageStatsCache = { value: result, expiresAt: Date.now() + USAGE_STATS_TTL_MS };
  return result;
}
