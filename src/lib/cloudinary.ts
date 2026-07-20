export interface CloudinaryUploadResult {
  secure_url: string;
  public_id: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
}

export async function uploadDirectToCloudinary(
  file: File | Blob,
  cloudName?: string,
  uploadPreset?: string
): Promise<CloudinaryUploadResult> {
  const activeCloudName =
    cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const activePreset =
    uploadPreset || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!activeCloudName || !activePreset) {
    throw new Error(
      "Cloudinary configuration is missing. Ensure NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME and NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET are set."
    );
  }

  const url = `https://api.cloudinary.com/v1_1/${activeCloudName}/image/upload`;

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", activePreset);

  const res = await fetch(url, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Cloudinary upload failed (HTTP ${res.status})`
    );
  }

  const result = await res.json();

  // Replace default Cloudinary base URL with custom domain/prefix if configured
  const urlPrefix = process.env.NEXT_PUBLIC_CLOUDINARY_URL_PREFIX;
  if (urlPrefix && result.secure_url) {
    const defaultBase = `https://res.cloudinary.com/${activeCloudName}`;
    if (result.secure_url.startsWith(defaultBase)) {
      result.secure_url = result.secure_url.replace(defaultBase, urlPrefix);
    }
  }

  return result;
}

export async function uploadRawDirectToCloudinary(
  blob: Blob,
  fileName: string,
  cloudName?: string,
  uploadPreset?: string
): Promise<{ secure_url: string; public_id: string; bytes: number }> {
  const activeCloudName =
    cloudName || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const activePreset =
    uploadPreset || process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!activeCloudName || !activePreset) {
    throw new Error(
      `Cloudinary configuration missing! NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (${activeCloudName ? "OK" : "MISSING"}) or NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET (${activePreset ? "OK" : "MISSING"}).`
    );
  }

  const rawUrl = `https://api.cloudinary.com/v1_1/${activeCloudName}/raw/upload`;

  const formData = new FormData();
  formData.append("file", blob, fileName);
  formData.append("upload_preset", activePreset);

  let res = await fetch(rawUrl, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    // Attempt fallback to /auto/upload if /raw/upload endpoint returns error
    const autoUrl = `https://api.cloudinary.com/v1_1/${activeCloudName}/auto/upload`;
    const fallbackRes = await fetch(autoUrl, {
      method: "POST",
      body: formData,
    });

    if (fallbackRes.ok) {
      return fallbackRes.json();
    }

    const errorData = await res.json().catch(() => ({}));
    throw new Error(
      errorData?.error?.message || `Cloudinary raw upload failed (HTTP ${res.status})`
    );
  }

  return res.json();
}

