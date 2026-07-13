import { describe, it, expect } from "vitest";
import { generatePhotoSlug, galleryPhotoInputSchema } from "@/features/gallery/schema";

describe("Gallery Schema & Slugs", () => {
  it("generates clean photo slugs from titles or filenames", () => {
    const slug1 = generatePhotoSlug("Sunrise at Puri Beach.JPG");
    expect(slug1).toBe("sunrise-at-puri-beach");

    const slug2 = generatePhotoSlug("  Special & Complex @ Photo #123.png ");
    expect(slug2).toBe("special-complex-photo-123");

    const slug3 = generatePhotoSlug("");
    expect(slug3).toMatch(/^photo-/);
  });

  it("validates gallery photo input schema with defaults", () => {
    const input = {
      title: "Golden Hour Sunrise",
      slug: "golden-hour-sunrise",
      originalUrl: "/uploads/gallery/2026/07/golden-hour-sunrise/original.jpg",
      largeUrl: "/uploads/gallery/2026/07/golden-hour-sunrise/large.webp",
      mediumUrl: "/uploads/gallery/2026/07/golden-hour-sunrise/medium.webp",
      thumbnailUrl: "/uploads/gallery/2026/07/golden-hour-sunrise/thumb.webp",
      camera: "Sony ILCE-7RM4",
      lens: "FE 24-70mm F2.8 GM",
      iso: 100,
      tags: ["sunset", "sea", "landscape"],
    };

    const parsed = galleryPhotoInputSchema.parse(input);
    expect(parsed.title).toBe("Golden Hour Sunrise");
    expect(parsed.visibility).toBe("public");
    expect(parsed.processingStatus).toBe("ready");
    expect(parsed.featured).toBe(false);
    expect(parsed.tags).toEqual(["sunset", "sea", "landscape"]);
  });

  it("parses comma separated tag strings into array", () => {
    const input = {
      title: "Mountain Fog",
      slug: "mountain-fog",
      originalUrl: "https://r2.domain.com/orig.jpg",
      largeUrl: "https://r2.domain.com/large.webp",
      mediumUrl: "https://r2.domain.com/medium.webp",
      thumbnailUrl: "https://r2.domain.com/thumb.webp",
      tags: "mountains,  fog, trekking , 2026",
    };

    const parsed = galleryPhotoInputSchema.parse(input);
    expect(parsed.tags).toEqual(["mountains", "fog", "trekking", "2026"]);
  });

  it("fails validation when required URLs are missing", () => {
    expect(() => {
      galleryPhotoInputSchema.parse({
        title: "Incomplete Photo",
        slug: "incomplete-photo",
      });
    }).toThrow();
  });
});
