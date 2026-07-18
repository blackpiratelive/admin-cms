import { JournalEntryRecord } from "@/db/schema";
import { DecryptedJournalContent, decryptJournalPayload, extractPlaintextFromLexicalState } from "./journal-helpers";

export interface DecryptedEntryItem {
  record: JournalEntryRecord;
  content: DecryptedJournalContent | null;
  plaintextBody: string;
  decryptionError?: boolean;
}

export async function decryptAllEntries(
  records: JournalEntryRecord[],
  key: CryptoKey
): Promise<DecryptedEntryItem[]> {
  const results: DecryptedEntryItem[] = [];

  for (const rec of records) {
    try {
      const content = await decryptJournalPayload(rec.encryptedContent, rec.iv, key);
      const plaintextBody = extractPlaintextFromLexicalState(content.lexicalState) || content.markdown || "";
      results.push({
        record: rec,
        content,
        plaintextBody,
      });
    } catch (err) {
      results.push({
        record: rec,
        content: null,
        plaintextBody: "",
        decryptionError: true,
      });
    }
  }

  return results;
}

export function searchDecryptedEntries(
  items: DecryptedEntryItem[],
  query: string,
  filters?: {
    entryType?: string;
    mood?: string;
    favoriteOnly?: boolean;
    startDate?: string;
    endDate?: string;
    tag?: string;
  }
): DecryptedEntryItem[] {
  let filtered = items;

  if (filters?.entryType && filters.entryType !== "all") {
    filtered = filtered.filter((item) => item.record.entryType === filters.entryType);
  }

  if (filters?.mood && filters.mood !== "all") {
    filtered = filtered.filter((item) => item.record.mood === filters.mood);
  }

  if (filters?.favoriteOnly) {
    filtered = filtered.filter((item) => item.record.favorite === 1);
  }

  if (filters?.startDate) {
    filtered = filtered.filter((item) => item.record.entryDate >= filters.startDate!);
  }

  if (filters?.endDate) {
    filtered = filtered.filter((item) => item.record.entryDate <= filters.endDate!);
  }

  if (filters?.tag) {
    const targetTag = filters.tag.toLowerCase();
    filtered = filtered.filter((item) => {
      const publicTags: string[] = JSON.parse(item.record.tags || "[]");
      const privateTags: string[] = item.content?.tags || [];
      return publicTags.some((t) => t.toLowerCase() === targetTag) || privateTags.some((t) => t.toLowerCase() === targetTag);
    });
  }

  if (!query.trim()) {
    return filtered;
  }

  const q = query.toLowerCase();
  return filtered.filter((item) => {
    if (!item.content) return false;
    const titleMatch = item.content.title?.toLowerCase().includes(q);
    const bodyMatch = item.plaintextBody.toLowerCase().includes(q);
    const privateNotesMatch = item.content.privateNotes?.toLowerCase().includes(q);
    const dateMatch = item.record.entryDate.includes(q);
    const tagsMatch = item.content.tags?.some((t) => t.toLowerCase().includes(q));

    return titleMatch || bodyMatch || privateNotesMatch || dateMatch || tagsMatch;
  });
}
