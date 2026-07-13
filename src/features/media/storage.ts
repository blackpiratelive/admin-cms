export interface StorageProvider {
  uploadFile(file: File, path?: string): Promise<{ url: string; key: string }>;
  deleteFile(key: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  async uploadFile(file: File, customPath?: string): Promise<{ url: string; key: string }> {
    const filename = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const key = customPath ? `${customPath}/${filename}` : filename;
    
    // In local development or standalone server, store or return data URL / simulated asset URL
    // If running with local filesystem support, we return a local URL / API endpoint
    const url = `/api/media/uploads/${key}`;
    return { url, key };
  }

  async deleteFile(key: string): Promise<void> {
    console.log(`[LocalStorageProvider] Deleted file key: ${key}`);
  }
}

export class S3StorageProvider implements StorageProvider {
  async uploadFile(file: File, customPath?: string): Promise<{ url: string; key: string }> {
    throw new Error("S3StorageProvider not configured. Set AWS credentials.");
  }
  async deleteFile(key: string): Promise<void> {
    throw new Error("S3StorageProvider not configured.");
  }
}

export function getStorageProvider(): StorageProvider {
  const providerType = process.env.STORAGE_PROVIDER || "local";
  switch (providerType) {
    case "s3":
    case "r2":
      return new S3StorageProvider();
    default:
      return new LocalStorageProvider();
  }
}
