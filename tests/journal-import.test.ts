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

  it("handles complex user journal JSON structure with numeric moods and Lexical content", async () => {
    const sampleUserJson = [
      {
        date: "2026-07-18T16:30:46.296Z",
        mood: 8,
        tags: ["welcome", "guide"],
        location: "My Mind Palace",
        weather: "Clear",
        content: "# Welcome to your new Journal! 📔\n\nThis is a safe space.",
        preview: "Welcome to your new Journal! 📔 This is a safe space.",
        images: ["1_0.webp"]
      },
      {
        id: "1763916420647",
        content: "{\"root\":{\"children\":[{\"children\":[{\"detail\":0,\"format\":0,\"mode\":\"normal\",\"style\":\"\",\"text\":\" 29 Mar 2022, Tuesday\",\"type\":\"text\",\"version\":1}],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"heading\",\"version\":1,\"tag\":\"h1\"}],\"direction\":null,\"format\":\"\",\"indent\":0,\"type\":\"root\",\"version\":1}}",
        preview: " 29 Mar 2022, Tuesday",
        mood: 5,
        location: "Bankura",
        date: "2025-03-29T06:30:00.000Z"
      }
    ];

    const zip = new JSZip();
    zip.file("journal.json", JSON.stringify(sampleUserJson));

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const loadedZip = await JSZip.loadAsync(zipBlob);
    const jsonString = await loadedZip.file("journal.json")!.async("string");
    const rawData = JSON.parse(jsonString);

    expect(rawData.length).toBe(2);
    expect(rawData[0].mood).toBe(8);
    expect(rawData[1].location).toBe("Bankura");
    expect(rawData[1].content).toContain('"root"');
  });
});

