import { describe, it, expect, vi } from "vitest";
import { formatFileSize, compressImageLocally } from "@/lib/image-compressor";

describe("formatFileSize", () => {
  it("formats bytes accurately", () => {
    expect(formatFileSize(0)).toBe("0 B");
    expect(formatFileSize(500)).toBe("500 B");
    expect(formatFileSize(1023)).toBe("1023 B");
  });

  it("formats kilobytes accurately", () => {
    expect(formatFileSize(1024)).toBe("1 KB");
    expect(formatFileSize(1024 * 50)).toBe("50 KB");
    expect(formatFileSize(1024 * 1023)).toBe("1023 KB");
  });

  it("formats megabytes accurately", () => {
    expect(formatFileSize(1024 * 1024)).toBe("1.00 MB");
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe("2.50 MB");
    expect(formatFileSize(1024 * 1024 * 10)).toBe("10.00 MB");
  });
});

describe("compressImageLocally", () => {
  it("bypasses non-image files and returns original file", async () => {
    const textFile = new File(["sample text content"], "note.txt", { type: "text/plain" });
    const result = await compressImageLocally(textFile);
    expect(result).toBe(textFile);
  });

  it("bypasses SVG files and returns original file", async () => {
    const svgFile = new File(["<svg></svg>"], "icon.svg", { type: "image/svg+xml" });
    const result = await compressImageLocally(svgFile);
    expect(result).toBe(svgFile);
  });

  it("bypasses GIF files to preserve animation and returns original file", async () => {
    const gifFile = new File(["gif content"], "animation.gif", { type: "image/gif" });
    const result = await compressImageLocally(gifFile);
    expect(result).toBe(gifFile);
  });
});
