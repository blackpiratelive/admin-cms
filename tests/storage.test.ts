import { describe, it, expect } from "vitest";
import { getStorageProvider, LocalStorageProvider } from "@/features/media/storage";

describe("Media Storage Abstraction", () => {
  it("returns LocalStorageProvider by default", () => {
    const provider = getStorageProvider();
    expect(provider).toBeInstanceOf(LocalStorageProvider);
  });

  it("handles file upload abstraction cleanly", async () => {
    const provider = new LocalStorageProvider();
    const mockFile = new File(["dummy content"], "photo.jpg", { type: "image/jpeg" });

    const result = await provider.uploadFile(mockFile, "covers");
    expect(result.url).toContain("/api/media/uploads/covers/");
    expect(result.key).toContain("covers/");
  });
});
