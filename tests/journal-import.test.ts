import { describe, it, expect, vi } from "vitest";
import JSZip from "jszip";

describe("Journal Import Zip & Data Processing", () => {
  it("creates and parses a valid journal zip archive with journal.json and images", async () => {
    const zip = new JSZip();

    const sampleJournalJson = [
      {
        entryDate: "2026-07-20",
        title: "Test Import Entry",
        content: "This is a test imported journal entry.",
        entryType: "daily",
        mood: "happy",
        tags: ["test", "import"],
        images: ["test_photo.jpg"],
      },
    ];

    zip.file("journal.json", JSON.stringify(sampleJournalJson, null, 2));

    // Add dummy image inside images/ folder
    const imagesFolder = zip.folder("images");
    imagesFolder?.file("test_photo.jpg", new Uint8Array([0xff, 0xd8, 0xff, 0xe0]));

    const zipBlob = await zip.generateAsync({ type: "blob" });
    expect(zipBlob.size).toBeGreaterThan(0);

    // Read back zip
    const loadedZip = await JSZip.loadAsync(zipBlob);
    const jsonFile = loadedZip.file("journal.json");
    expect(jsonFile).not.toBeNull();

    const jsonText = await jsonFile!.async("string");
    const parsed = JSON.parse(jsonText);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBe(1);
    expect(parsed[0].title).toBe("Test Import Entry");
    expect(parsed[0].images).toContain("test_photo.jpg");

    // Check images folder extraction
    const extractedImage = loadedZip.file("images/test_photo.jpg");
    expect(extractedImage).not.toBeNull();
  });
});
