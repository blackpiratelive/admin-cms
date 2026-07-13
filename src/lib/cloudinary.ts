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

  return await res.json();
}
