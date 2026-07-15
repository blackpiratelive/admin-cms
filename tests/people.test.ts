import { describe, it, expect } from "vitest";
import {
  personInputSchema,
  generatePersonSlug,
  DEFAULT_RELATIONSHIP_TYPES,
} from "@/features/people/schema";

describe("People Schema & Validation", () => {
  it("generates valid slug from display name", () => {
    const slug1 = generatePersonSlug("John Doe");
    expect(slug1).toBe("john-doe");

    const slug2 = generatePersonSlug("  Sarah O'Connor-Smith! ");
    expect(slug2).toBe("sarah-oconnor-smith");
  });

  it("validates personInputSchema defaults", () => {
    const input = {
      displayName: "Alice Vance",
    };

    const parsed = personInputSchema.parse(input);
    expect(parsed.displayName).toBe("Alice Vance");
    expect(parsed.relationshipType).toBe("Friend");
    expect(parsed.visibility).toBe("private");
    expect(parsed.favorite).toBe(0);
    expect(parsed.importantDates).toEqual([]);
    expect(parsed.interests).toEqual([]);
    expect(parsed.tags).toEqual([]);
  });

  it("parses comma-separated tags and interests into string arrays", () => {
    const input = {
      displayName: "Bob Ross",
      interests: "Painting, Nature, Cycling",
      tags: "artist, mentor",
    };

    const parsed = personInputSchema.parse(input);
    expect(parsed.interests).toEqual(["Painting", "Nature", "Cycling"]);
    expect(parsed.tags).toEqual(["artist", "mentor"]);
  });

  it("parses boolean or integer favorite fields correctly", () => {
    const inputTrue = personInputSchema.parse({
      displayName: "Charlie",
      favorite: true,
    });
    expect(inputTrue.favorite).toBe(1);

    const inputFalse = personInputSchema.parse({
      displayName: "Charlie",
      favorite: 0,
    });
    expect(inputFalse.favorite).toBe(0);
  });

  it("fails validation if displayName is missing or empty", () => {
    expect(() => {
      personInputSchema.parse({ displayName: "" });
    }).toThrow();
  });

  it("contains default relationship types list", () => {
    expect(DEFAULT_RELATIONSHIP_TYPES).toContain("Family");
    expect(DEFAULT_RELATIONSHIP_TYPES).toContain("Friend");
    expect(DEFAULT_RELATIONSHIP_TYPES).toContain("Colleague");
  });
});
