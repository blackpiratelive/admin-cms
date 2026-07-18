import { encryptText, decryptText } from "./crypto";

export interface DecryptedJournalContent {
  title: string;
  lexicalState: string;
  markdown?: string;
  privateNotes?: string;
  tags?: string[];
  privateReferences?: string[];
  internalComments?: string[];
}

export const ENTRY_TYPES = [
  { id: "daily", label: "Daily Journal", icon: "📖" },
  { id: "reflection", label: "Reflection", icon: "🧠" },
  { id: "travel", label: "Travel Journal", icon: "✈️" },
  { id: "dream", label: "Dream", icon: "🌙" },
  { id: "meeting", label: "Meeting Notes", icon: "🤝" },
  { id: "ideas", label: "Ideas", icon: "💡" },
  { id: "gratitude", label: "Gratitude", icon: "🙏" },
  { id: "life_event", label: "Life Event", icon: "🎉" },
  { id: "health", label: "Health & Fitness", icon: "🏋️" },
  { id: "thoughts", label: "Random Thoughts", icon: "💬" },
  { id: "project", label: "Project Journal", icon: "📁" },
  { id: "learning", label: "Learning Journal", icon: "📚" },
  { id: "custom", label: "Custom", icon: "✍️" },
];

export const MOODS = [
  { id: "amazing", label: "Amazing", emoji: "😁" },
  { id: "happy", label: "Happy", emoji: "😊" },
  { id: "good", label: "Good", emoji: "🙂" },
  { id: "neutral", label: "Neutral", emoji: "😐" },
  { id: "sad", label: "Sad", emoji: "😔" },
  { id: "bad", label: "Bad", emoji: "😞" },
  { id: "terrible", label: "Terrible", emoji: "😭" },
];

export async function encryptJournalPayload(
  content: DecryptedJournalContent,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const jsonStr = JSON.stringify(content);
  return encryptText(jsonStr, key);
}

export async function decryptJournalPayload(
  ciphertext: string,
  iv: string,
  key: CryptoKey
): Promise<DecryptedJournalContent> {
  const decryptedJson = await decryptText(ciphertext, iv, key);
  return JSON.parse(decryptedJson);
}

export function calculateWordCount(text: string): number {
  if (!text) return 0;
  const clean = text.replace(/<[^>]*>/g, " ").replace(/[^\w\s]/gi, " ");
  const words = clean.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

export function calculateReadingTime(wordCount: number): number {
  const WPM = 200; // average words per minute
  return Math.ceil(wordCount / WPM);
}

export function extractPlaintextFromLexicalState(lexicalJsonStr: string): string {
  try {
    const state = JSON.parse(lexicalJsonStr);
    let text = "";

    function traverse(node: any) {
      if (node.text) {
        text += node.text + " ";
      }
      if (node.children && Array.isArray(node.children)) {
        for (const child of node.children) {
          traverse(child);
        }
      }
    }

    if (state.root) {
      traverse(state.root);
    }
    return text.replace(/\s+/g, " ").trim();
  } catch (e) {
    return "";
  }
}
