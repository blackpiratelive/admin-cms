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

const KNOWN_REGISTERED_NODE_TYPES = new Set([
  "root",
  "paragraph",
  "heading",
  "quote",
  "list",
  "listitem",
  "table",
  "tablecell",
  "tablerow",
  "code",
  "code-highlight",
  "autolink",
  "link",
  "journal-image",
  "image",
  "text",
  "linebreak",
  "tab",
]);

export function sanitizeLexicalStateJson(lexicalJsonStr: string): string {
  if (!lexicalJsonStr) return lexicalJsonStr;
  try {
    const state = JSON.parse(lexicalJsonStr);
    if (!state || typeof state !== "object" || !state.root) return lexicalJsonStr;

    function sanitizeNode(node: any): any {
      if (!node || typeof node !== "object") return node;

      const nodeType = String(node.type || "").toLowerCase().trim();

      // Convert custom dividers/rules into paragraph with divider text
      if (
        nodeType === "session-divider" ||
        nodeType === "session_divider" ||
        nodeType === "horizontal-rule" ||
        nodeType === "horizontalrule" ||
        nodeType === "hr"
      ) {
        return {
          type: "paragraph",
          version: 1,
          children: [
            {
              type: "text",
              text: "***",
              format: 0,
              detail: 0,
              mode: "normal",
              style: "",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
        };
      }

      // If node type is not registered on Lexical Editor
      if (!KNOWN_REGISTERED_NODE_TYPES.has(nodeType)) {
        if (Array.isArray(node.children)) {
          // Convert unknown element node to paragraph so children render
          node.type = "paragraph";
        } else if (typeof node.text === "string") {
          // Convert unknown inline node to text
          node.type = "text";
        } else {
          // Empty or unknown node -> fallback to paragraph with text
          return {
            type: "paragraph",
            version: 1,
            children: [
              {
                type: "text",
                text: node.text || "",
                format: 0,
                detail: 0,
                mode: "normal",
                style: "",
                version: 1,
              },
            ],
            direction: "ltr",
            format: "",
            indent: 0,
          };
        }
      }

      // Recursively sanitize children
      if (Array.isArray(node.children)) {
        node.children = node.children.map((child: any) => sanitizeNode(child));
      }

      return node;
    }

    state.root = sanitizeNode(state.root);
    return JSON.stringify(state);
  } catch (e) {
    return lexicalJsonStr;
  }
}

