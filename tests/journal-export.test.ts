import { describe, it, expect } from "vitest";
import JSZip from "jszip";
import {
  lexicalStateToMarkdown,
  normalizeEntryDate,
  sanitizeFilename,
  formatJournalEntryToMarkdownFile,
  extractAssetIdsFromLexicalState,
} from "@/features/journal/lib/journal-helpers";

describe("Journal Markdown Export & AST Serializer", () => {
  it("normalizes various date formats strictly into YYYY-MM-DD", () => {
    expect(normalizeEntryDate("2026-12-31")).toBe("2026-12-31");
    expect(normalizeEntryDate("2026-12-31T14:20:00.000Z")).toBe("2026-12-31");
    expect(normalizeEntryDate("2026-07-04T00:00:00Z")).toBe("2026-07-04");
  });

  it("sanitizes filenames safely", () => {
    expect(sanitizeFilename("My Awesome Entry #1! / ?")).toBe("my-awesome-entry-1");
    expect(sanitizeFilename("Trip to Tokyo: Day 1")).toBe("trip-to-tokyo-day-1");
  });

  it("converts Lexical JSON AST containing headings, bold, italic, lists, checklists, and code to Markdown", () => {
    const sampleAst = {
      root: {
        children: [
          {
            type: "heading",
            tag: "h1",
            children: [{ type: "text", text: "Morning Reflection", format: 0 }],
          },
          {
            type: "paragraph",
            children: [
              { type: "text", text: "Today started with a " },
              { type: "text", text: "strong coffee", format: 1 }, // bold
              { type: "text", text: " and " },
              { type: "text", text: "deep meditation", format: 2 }, // italic
              { type: "text", text: "." },
            ],
          },
          {
            type: "quote",
            children: [{ type: "text", text: "The unexamined life is not worth living." }],
          },
          {
            type: "list",
            listType: "bullet",
            children: [
              {
                type: "listitem",
                children: [{ type: "text", text: "First bullet item" }],
              },
              {
                type: "listitem",
                children: [{ type: "text", text: "Second bullet item" }],
              },
            ],
          },
          {
            type: "list",
            listType: "check",
            children: [
              {
                type: "listitem",
                checked: true,
                children: [{ type: "text", text: "Completed todo" }],
              },
              {
                type: "listitem",
                checked: false,
                children: [{ type: "text", text: "Pending todo" }],
              },
            ],
          },
          {
            type: "code",
            language: "typescript",
            children: [{ type: "text", text: "const hello = 'world';" }],
          },
        ],
        direction: "ltr",
        format: "",
        indent: 0,
        type: "root",
        version: 1,
      },
    };

    const markdown = lexicalStateToMarkdown(JSON.stringify(sampleAst));

    expect(markdown).toContain("# Morning Reflection");
    expect(markdown).toContain("**strong coffee** and *deep meditation*.");
    expect(markdown).toContain("> The unexamined life is not worth living.");
    expect(markdown).toContain("- First bullet item");
    expect(markdown).toContain("- Second bullet item");
    expect(markdown).toContain("- [x] Completed todo");
    expect(markdown).toContain("- [ ] Pending todo");
    expect(markdown).toContain("```typescript\nconst hello = 'world';\n```");
  });

  it("formats a journal entry into markdown with required YAML frontmatter (journal: true & date: 2026-12-31)", () => {
    const entryItem = {
      record: {
        id: "jnl_12345",
        slug: "nye-reflection",
        entryDate: "2026-12-31",
        entryType: "reflection",
        mood: "amazing",
        favorite: 1,
        tags: JSON.stringify(["goals", "nye"]),
        createdAt: "2026-12-31T23:59:00.000Z",
      },
      content: {
        title: "New Year's Eve Reflection",
        lexicalState: JSON.stringify({
          root: {
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Looking back at an incredible year of achievements." }],
              },
            ],
          },
        }),
        tags: ["milestone"],
      },
    };

    const result = formatJournalEntryToMarkdownFile(entryItem);

    expect(result.filename).toBe("2026-12-31-new-year-s-eve-reflection.md");

    // Verify YAML Frontmatter
    expect(result.content).toMatch(/^---\n/);
    expect(result.content).toContain("journal: true\n");
    expect(result.content).toContain("date: 2026-12-31\n");
    expect(result.content).toContain('title: "New Year\'s Eve Reflection"\n');
    expect(result.content).toContain("entryType: reflection\n");
    expect(result.content).toContain("mood: amazing\n");
    expect(result.content).toContain("favorite: true\n");
    expect(result.content).toContain("tags:\n  - milestone\n  - goals\n  - nye\n");
    expect(result.content).toContain("---\n\nLooking back at an incredible year of achievements.");
  });

  it("creates a .zip archive containing separate .md files with YAML frontmatter for multiple entries", async () => {
    const entries = [
      {
        record: {
          id: "jnl_1",
          slug: "tokyo-day-1",
          entryDate: "2026-10-15",
          entryType: "travel",
          mood: "amazing",
          favorite: 1,
          tags: '["japan"]',
        },
        content: {
          title: "Arrived in Tokyo",
          lexicalState: JSON.stringify({
            root: {
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "Landed at Haneda and took the monorail." }],
                },
              ],
            },
          }),
        },
      },
      {
        record: {
          id: "jnl_2",
          slug: "tokyo-day-2",
          entryDate: "2026-10-16",
          entryType: "travel",
          mood: "happy",
          favorite: 0,
          tags: '["japan", "shibuya"]',
        },
        content: {
          title: "Exploring Shibuya",
          lexicalState: JSON.stringify({
            root: {
              children: [
                {
                  type: "paragraph",
                  children: [{ type: "text", text: "Visited Shibuya Crossing and Hachiko statue." }],
                },
              ],
            },
          }),
        },
      },
    ];

    const zip = new JSZip();
    const usedFilenames = new Set<string>();

    for (const item of entries) {
      const { filename: baseFilename, content } = formatJournalEntryToMarkdownFile(item);
      let finalFilename = baseFilename;
      let counter = 1;
      while (usedFilenames.has(finalFilename)) {
        const dotIdx = baseFilename.lastIndexOf(".md");
        const nameWithoutExt = dotIdx !== -1 ? baseFilename.substring(0, dotIdx) : baseFilename;
        finalFilename = `${nameWithoutExt}-${counter}.md`;
        counter++;
      }
      usedFilenames.add(finalFilename);
      zip.file(finalFilename, content);
    }

    const zipBlob = await zip.generateAsync({ type: "blob" });
    expect(zipBlob.size).toBeGreaterThan(0);

    // Read back zip to verify individual .md files
    const loadedZip = await JSZip.loadAsync(zipBlob);
    const filenamesInZip = Object.keys(loadedZip.files).filter((fn) => !loadedZip.files[fn].dir);

    expect(filenamesInZip.length).toBe(2);
    expect(filenamesInZip).toContain("2026-10-15-arrived-in-tokyo.md");
    expect(filenamesInZip).toContain("2026-10-16-exploring-shibuya.md");

    const file1Content = await loadedZip.file("2026-10-15-arrived-in-tokyo.md")!.async("string");
    expect(file1Content).toContain("journal: true");
    expect(file1Content).toContain("date: 2026-10-15");
    expect(file1Content).toContain("Landed at Haneda and took the monorail.");

    const file2Content = await loadedZip.file("2026-10-16-exploring-shibuya.md")!.async("string");
    expect(file2Content).toContain("journal: true");
    expect(file2Content).toContain("date: 2026-10-16");
    expect(file2Content).toContain("Visited Shibuya Crossing and Hachiko statue.");
  });

  it("handles filename collisions for multiple entries with the same date and title", () => {
    const entries = [
      {
        record: { id: "jnl_a", entryDate: "2026-12-31", entryType: "daily" },
        content: { title: "Daily Reflection", lexicalState: "{}" },
      },
      {
        record: { id: "jnl_b", entryDate: "2026-12-31", entryType: "daily" },
        content: { title: "Daily Reflection", lexicalState: "{}" },
      },
      {
        record: { id: "jnl_c", entryDate: "2026-12-31", entryType: "daily" },
        content: { title: "Daily Reflection", lexicalState: "{}" },
      },
    ];

    const zip = new JSZip();
    const usedFilenames = new Set<string>();

    for (const item of entries) {
      const { filename: baseFilename, content } = formatJournalEntryToMarkdownFile(item);
      let finalFilename = baseFilename;
      let counter = 1;
      while (usedFilenames.has(finalFilename)) {
        const dotIdx = baseFilename.lastIndexOf(".md");
        const nameWithoutExt = dotIdx !== -1 ? baseFilename.substring(0, dotIdx) : baseFilename;
        finalFilename = `${nameWithoutExt}-${counter}.md`;
        counter++;
      }
      usedFilenames.add(finalFilename);
      zip.file(finalFilename, content);
    }

    expect(Array.from(usedFilenames)).toEqual([
      "2026-12-31-daily-reflection.md",
      "2026-12-31-daily-reflection-1.md",
      "2026-12-31-daily-reflection-2.md",
    ]);
  });

  it("extracts asset IDs from Lexical JSON AST containing journal-image and image nodes", () => {
    const astWithImages = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [{ type: "text", text: "Here is a photo:" }],
          },
          {
            type: "journal-image",
            assetId: "jasset_abc123",
            caption: "Kyoto Temple",
          },
          {
            type: "image",
            assetId: "jasset_def456",
          },
        ],
      },
    });

    const assetIds = extractAssetIdsFromLexicalState(astWithImages);
    expect(assetIds).toEqual(["jasset_abc123", "jasset_def456"]);
  });

  it("formats markdown with local image paths and frontmatter images list for attachments", () => {
    const entryItem = {
      record: {
        id: "jnl_photo_day",
        slug: "photo-day",
        entryDate: "2026-08-15",
        entryType: "travel",
      },
      content: {
        title: "Photography Walk",
        lexicalState: JSON.stringify({
          root: {
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Great photography walk today." }],
              },
              {
                type: "journal-image",
                assetId: "jasset_inline_1",
                caption: "Sunset over river",
              },
            ],
          },
        }),
      },
    };

    const assetFilenameMap = new Map([
      ["jasset_inline_1", "images/jasset_inline_1.webp"],
      ["jasset_attach_2", "images/jasset_attach_2.png"],
    ]);

    const result = formatJournalEntryToMarkdownFile(entryItem, {
      attachments: [
        {
          id: "jasset_attach_2",
          imagePath: "images/jasset_attach_2.png",
          assetRole: "attachment",
          caption: "Camera Gear",
        },
      ],
      assetFilenameMap,
    });

    // Check frontmatter contains images
    expect(result.content).toContain("images:\n  - images/jasset_attach_2.png\n  - images/jasset_inline_1.webp\n");

    // Check body contains inline image and standalone attachment section
    expect(result.content).toContain("![Sunset over river](images/jasset_inline_1.webp)");
    expect(result.content).toContain("### Attachments");
    expect(result.content).toContain("![Camera Gear](images/jasset_attach_2.png)");
  });

  it("bundles images into images/ folder inside .zip archive alongside markdown files", async () => {
    const zip = new JSZip();

    // 1. Add mock images to images/
    const dummyImageBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header
    zip.file("images/jasset_photo_1.png", dummyImageBytes);
    zip.file("images/jasset_photo_2.webp", new Uint8Array([0x52, 0x49, 0x46, 0x46])); // WEBP header

    // 2. Add entry markdown referencing the images
    const entry = {
      record: { id: "jnl_memories", entryDate: "2026-09-01", entryType: "daily" },
      content: {
        title: "Memories with Photos",
        lexicalState: JSON.stringify({
          root: {
            children: [
              {
                type: "paragraph",
                children: [{ type: "text", text: "Captured two great moments." }],
              },
              {
                type: "journal-image",
                assetId: "jasset_photo_1",
                caption: "Moment 1",
              },
            ],
          },
        }),
      },
    };

    const assetFilenameMap = new Map([
      ["jasset_photo_1", "images/jasset_photo_1.png"],
      ["jasset_photo_2", "images/jasset_photo_2.webp"],
    ]);

    const { filename, content } = formatJournalEntryToMarkdownFile(entry, {
      attachments: [
        { id: "jasset_photo_2", imagePath: "images/jasset_photo_2.webp", assetRole: "attachment" },
      ],
      assetFilenameMap,
    });

    zip.file(filename, content);

    const zipBlob = await zip.generateAsync({ type: "blob" });
    const loadedZip = await JSZip.loadAsync(zipBlob);

    // Verify all expected files exist in zip
    expect(loadedZip.file("images/jasset_photo_1.png")).not.toBeNull();
    expect(loadedZip.file("images/jasset_photo_2.webp")).not.toBeNull();
    expect(loadedZip.file("2026-09-01-memories-with-photos.md")).not.toBeNull();

    const mdText = await loadedZip.file("2026-09-01-memories-with-photos.md")!.async("string");
    expect(mdText).toContain("journal: true");
    expect(mdText).toContain("date: 2026-09-01");
    expect(mdText).toContain("images/jasset_photo_1.png");
    expect(mdText).toContain("images/jasset_photo_2.webp");
  });
});
