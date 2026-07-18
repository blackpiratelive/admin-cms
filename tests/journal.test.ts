import { describe, it, expect } from "vitest";
import {
  calculateWordCount,
  calculateReadingTime,
  extractPlaintextFromLexicalState,
  ENTRY_TYPES,
  MOODS,
} from "@/features/journal/lib/journal-helpers";
import { calculateJournalStats } from "@/features/journal/lib/journal-stats";
import { searchDecryptedEntries, DecryptedEntryItem } from "@/features/journal/lib/journal-search";

describe("Journal Helpers & Utilities", () => {
  it("calculates word count and reading time accurately", () => {
    const text = "The quick brown fox jumps over the lazy dog";
    const words = calculateWordCount(text);
    expect(words).toBe(9);

    const readingTime = calculateReadingTime(450);
    expect(readingTime).toBe(3); // 450 / 200 = 2.25 -> ceil = 3 min
  });

  it("extracts plaintext from Lexical editor JSON state", () => {
    const lexicalJson = JSON.stringify({
      root: {
        children: [
          {
            type: "paragraph",
            children: [
              { text: "Hello " },
              { text: "World!" },
            ],
          },
        ],
      },
    });

    const text = extractPlaintextFromLexicalState(lexicalJson);
    expect(text).toBe("Hello World!");
  });

  it("contains entry types and mood definitions", () => {
    expect(ENTRY_TYPES.some((t) => t.id === "daily")).toBe(true);
    expect(ENTRY_TYPES.some((t) => t.id === "travel")).toBe(true);
    expect(MOODS.some((m) => m.id === "amazing")).toBe(true);
  });
});

describe("Journal Statistics Engine", () => {
  it("computes stats and writing streak correctly", () => {
    const mockItems: DecryptedEntryItem[] = [
      {
        record: {
          id: "1",
          slug: "j1",
          entryDate: "2026-07-18",
          entryType: "daily",
          mood: "happy",
          favorite: 1,
          visibility: "private",
          locationId: null,
          tripId: null,
          weatherId: null,
          encryptedContent: "cipher1",
          encryptionVersion: 1,
          iv: "iv1",
          salt: "salt1",
          wordCount: 150,
          readingTime: 1,
          tags: '["mindfulness"]',
          createdAt: "2026-07-18T10:00:00Z",
          updatedAt: "2026-07-18T10:00:00Z",
        },
        content: { title: "Entry 1", lexicalState: "{}" },
        plaintextBody: "Today was a good day",
      },
      {
        record: {
          id: "2",
          slug: "j2",
          entryDate: "2026-07-17",
          entryType: "reflection",
          mood: "good",
          favorite: 0,
          visibility: "private",
          locationId: null,
          tripId: null,
          weatherId: null,
          encryptedContent: "cipher2",
          encryptionVersion: 1,
          iv: "iv2",
          salt: "salt2",
          wordCount: 250,
          readingTime: 2,
          tags: '[]',
          createdAt: "2026-07-17T10:00:00Z",
          updatedAt: "2026-07-17T10:00:00Z",
        },
        content: { title: "Entry 2", lexicalState: "{}" },
        plaintextBody: "Deep thoughts on project architecture",
      },
    ];

    const stats = calculateJournalStats(mockItems);
    expect(stats.totalEntries).toBe(2);
    expect(stats.totalWords).toBe(400);
    expect(stats.avgWordsPerEntry).toBe(200);
    expect(stats.longestEntryWords).toBe(250);
    expect(stats.favoriteCount).toBe(1);
    expect(stats.typeCounts["daily"]).toBe(1);
    expect(stats.typeCounts["reflection"]).toBe(1);
  });
});

describe("Journal Decrypted Search Engine", () => {
  it("filters entries by query, entry type, and mood", () => {
    const mockItems: DecryptedEntryItem[] = [
      {
        record: {
          id: "1",
          slug: "j1",
          entryDate: "2026-07-18",
          entryType: "travel",
          mood: "amazing",
          favorite: 1,
          visibility: "private",
          locationId: null,
          tripId: null,
          weatherId: null,
          encryptedContent: "c1",
          encryptionVersion: 1,
          iv: "iv1",
          salt: "s1",
          wordCount: 100,
          readingTime: 1,
          tags: '["kyoto"]',
          createdAt: "2026-07-18T10:00:00Z",
          updatedAt: "2026-07-18T10:00:00Z",
        },
        content: { title: "Trip to Kyoto", lexicalState: "{}", tags: ["japan"] },
        plaintextBody: "Visited Fushimi Inari shrine today.",
      },
      {
        record: {
          id: "2",
          slug: "j2",
          entryDate: "2026-07-15",
          entryType: "meeting",
          mood: "neutral",
          favorite: 0,
          visibility: "private",
          locationId: null,
          tripId: null,
          weatherId: null,
          encryptedContent: "c2",
          encryptionVersion: 1,
          iv: "iv2",
          salt: "s2",
          wordCount: 50,
          readingTime: 1,
          tags: '[]',
          createdAt: "2026-07-15T10:00:00Z",
          updatedAt: "2026-07-15T10:00:00Z",
        },
        content: { title: "Architecture Sync", lexicalState: "{}" },
        plaintextBody: "Discussed database schema.",
      },
    ];

    const results = searchDecryptedEntries(mockItems, "Kyoto");
    expect(results.length).toBe(1);
    expect(results[0].record.id).toBe("1");

    const travelResults = searchDecryptedEntries(mockItems, "", { entryType: "travel" });
    expect(travelResults.length).toBe(1);

    const tagResults = searchDecryptedEntries(mockItems, "", { tag: "japan" });
    expect(tagResults.length).toBe(1);
  });
});

describe("DEK / KEK Cryptographic Architecture", () => {
  it("generates random DEK, derives Argon2id KEK, wraps and unwraps DEK", async () => {
    const {
      generateDEK,
      generateSalt,
      deriveKEK,
      wrapDEK,
      unwrapDEK,
      encryptText,
      decryptText,
    } = await import("@/features/journal/lib/crypto");

    // 1. Generate random DEK
    const dek = await generateDEK();
    expect(dek).toBeDefined();

    // 2. Derive KEK from password using Argon2id
    const password = "my-secret-journal-password";
    const salt = generateSalt();
    const kek = await deriveKEK(password, salt, { memorySize: 4096, iterations: 1, parallelism: 1 });
    expect(kek).toBeDefined();

    // 3. Wrap DEK with KEK
    const { encryptedDek, iv } = await wrapDEK(dek, kek);
    expect(encryptedDek).toBeTypeOf("string");
    expect(iv).toBeTypeOf("string");

    // 4. Unwrap DEK using KEK
    const unwrappedDek = await unwrapDEK(encryptedDek, iv, kek);
    expect(unwrappedDek).toBeDefined();

    // 5. Encrypt entry with DEK and decrypt with unwrapped DEK
    const secretText = "Encrypted journal entry contents";
    const { ciphertext, iv: entryIv } = await encryptText(secretText, dek);
    const decryptedText = await decryptText(ciphertext, entryIv, unwrappedDek);
    expect(decryptedText).toBe(secretText);
  });

  it("re-wraps DEK instantly on password change without re-encrypting entry ciphertext", async () => {
    const {
      generateDEK,
      generateSalt,
      deriveKEK,
      wrapDEK,
      unwrapDEK,
      encryptText,
      decryptText,
    } = await import("@/features/journal/lib/crypto");

    const oldPassword = "old-password-123";
    const newPassword = "new-password-456";

    // 1. Initial DEK and entry encryption
    const dek = await generateDEK();
    const entryData = "Unchanged life memory content";
    const { ciphertext: entryCiphertext, iv: entryIv } = await encryptText(entryData, dek);

    // 2. Wrap DEK with old KEK
    const oldSalt = generateSalt();
    const oldKek = await deriveKEK(oldPassword, oldSalt, { memorySize: 4096, iterations: 1, parallelism: 1 });
    const { encryptedDek: oldWrappedDek, iv: oldIv } = await wrapDEK(dek, oldKek);

    // 3. Password change: Recover DEK with old KEK, derive new KEK, re-wrap DEK
    const recoveredDek = await unwrapDEK(oldWrappedDek, oldIv, oldKek);
    const newSalt = generateSalt();
    const newKek = await deriveKEK(newPassword, newSalt, { memorySize: 4096, iterations: 1, parallelism: 1 });
    const { encryptedDek: newWrappedDek, iv: newIv } = await wrapDEK(recoveredDek, newKek);

    expect(newWrappedDek).not.toBe(oldWrappedDek);

    // 4. Verify new password can unwrap DEK and decrypt the UNTOUCHED entry ciphertext!
    const unlockedDek = await unwrapDEK(newWrappedDek, newIv, newKek);
    const decryptedEntry = await decryptText(entryCiphertext, entryIv, unlockedDek);

    expect(decryptedEntry).toBe(entryData);
  });
});

