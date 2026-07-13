"use server";

import { revalidatePath } from "next/cache";

export interface CloudinaryUsageMetric {
  usage: number;
  limit: number;
  used_percent: number;
}

export interface CloudinaryUsageData {
  plan: string;
  storage: CloudinaryUsageMetric;
  bandwidth: CloudinaryUsageMetric;
  resources: number;
  objects: CloudinaryUsageMetric;
}

export interface CloudinaryResource {
  public_id: string;
  format: string;
  version: number;
  resource_type: string;
  type: string;
  created_at: string;
  bytes: number;
  width: number;
  height: number;
  url: string;
  secure_url: string;
}

export async function getCloudinaryUsage() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      success: false,
      error: "Cloudinary credentials (CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured in environment.",
    };
  }

  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/usage`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        next: { revalidate: 30 }, // Cache usage stats for 30 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    return { success: true, usage: data as CloudinaryUsageData };
  } catch (error: any) {
    console.error("Error fetching Cloudinary usage stats:", error);
    return { success: false, error: error.message || String(error) };
  }
}

export async function getCloudinaryResources() {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return {
      success: false,
      error: "Cloudinary credentials (CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) are not configured.",
    };
  }

  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    // Fetch up to 100 images
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image?max_results=100`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
        },
        next: { revalidate: 5 }, // Cache files for 5 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary API returned HTTP ${response.status}`);
    }

    const data = await response.json();
    
    // Apply custom URL prefix mapping if set
    const urlPrefix = process.env.NEXT_PUBLIC_CLOUDINARY_URL_PREFIX;
    const resources = ((data.resources || []) as CloudinaryResource[]).map((res) => {
      let secureUrl = res.secure_url;
      if (urlPrefix && secureUrl) {
        const defaultBase = `https://res.cloudinary.com/${cloudName}`;
        if (secureUrl.startsWith(defaultBase)) {
          secureUrl = secureUrl.replace(defaultBase, urlPrefix);
        }
      }
      return { ...res, secure_url: secureUrl };
    });

    return { success: true, resources };
  } catch (error: any) {
    console.error("Error fetching Cloudinary resources list:", error);
    return { success: false, error: error.message || String(error) };
  }
}

export async function deleteCloudinaryResource(publicId: string) {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return { success: false, error: "Cloudinary credentials not configured." };
  }

  try {
    const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Cloudinary API returned HTTP ${response.status}`);
    }

    revalidatePath("/storage");
    return { success: true };
  } catch (error: any) {
    console.error("Error deleting Cloudinary resource:", error);
    return { success: false, error: error.message || String(error) };
  }
}
