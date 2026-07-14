import { describe, it, expect } from "vitest";
import { generateSlug, microblogInputSchema } from "@/features/microblog/schema";
import { hasImages } from "@/features/microblog/MicroblogList";

describe("Microblog Schema & Slugs", () => {
  it("generates valid slug from markdown content", () => {
    const slug1 = generateSlug("Hello World! This is my first post");
    expect(slug1).toContain("hello-world-this-is-my-first-post");

    const slug2 = generateSlug("   Complex!@#$% Special Characters & Symbols ");
    expect(slug2).toContain("complex-special-characters-symbols");
  });

  it("validates microblog schema with defaults", () => {
    const input = {
      contentMarkdown: "Testing microblog content markdown",
      tags: ["hugo", "turso"],
    };

    const parsed = microblogInputSchema.parse(input);
    expect(parsed.contentMarkdown).toBe("Testing microblog content markdown");
    expect(parsed.status).toBe("draft");
    expect(parsed.tags).toEqual(["hugo", "turso"]);
  });

  it("parses comma separated string tags into array", () => {
    const input = {
      contentMarkdown: "Tags test",
      tags: "tech,  nextjs , drizzle",
    };

    const parsed = microblogInputSchema.parse(input);
    expect(parsed.tags).toEqual(["tech", "nextjs", "drizzle"]);
  });

  it("validates microblog schema with images default", () => {
    const input = {
      contentMarkdown: "Testing microblog content markdown",
      tags: ["hugo", "turso"],
      images: ["https://media.com/1.jpg", "https://media.com/2.jpg"],
    };

    const parsed = microblogInputSchema.parse(input);
    expect(parsed.images).toEqual(["https://media.com/1.jpg", "https://media.com/2.jpg"]);
  });

  it("parses comma separated string images into array", () => {
    const input = {
      contentMarkdown: "Images test",
      tags: [],
      images: "https://media.com/1.jpg, https://media.com/2.jpg",
    };

    const parsed = microblogInputSchema.parse(input);
    expect(parsed.images).toEqual(["https://media.com/1.jpg", "https://media.com/2.jpg"]);
  });

  it("fails validation when content markdown is empty", () => {
    expect(() => {
      microblogInputSchema.parse({ contentMarkdown: "" });
    }).toThrow();
  });
});

describe("MicroblogList Helpers", () => {
  it("correctly identifies microblogs with images attached", () => {
    const basePost = {
      id: "1",
      slug: "test-post",
      contentMarkdown: "Content",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
      publishedAt: null,
      status: "draft" as const,
      tags: "[]",
      coverImageUrl: null,
      images: "[]",
      shortUrl: null,
      locationId: null,
      tripId: null,
    };

    // No images
    expect(hasImages(basePost)).toBe(false);

    // With cover image
    expect(hasImages({ ...basePost, coverImageUrl: "https://example.com/cover.jpg" })).toBe(true);

    // With images JSON array
    expect(
      hasImages({ ...basePost, images: JSON.stringify(["https://example.com/photo.jpg"]) })
    ).toBe(true);

    // With empty images JSON array
    expect(hasImages({ ...basePost, images: "[]" })).toBe(false);
  });
});

