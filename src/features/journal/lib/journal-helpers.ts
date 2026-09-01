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

export function getAssetFileExtension(mimeType?: string): string {
  if (!mimeType) return "webp";
  const lower = mimeType.toLowerCase();
  if (lower.includes("png")) return "png";
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg";
  if (lower.includes("gif")) return "gif";
  if (lower.includes("svg")) return "svg";
  if (lower.includes("webp")) return "webp";
  return "webp";
}

export function extractAssetIdsFromLexicalState(lexicalJsonStr: string): string[] {
  if (!lexicalJsonStr) return [];
  try {
    const state = typeof lexicalJsonStr === "string" ? JSON.parse(lexicalJsonStr) : lexicalJsonStr;
    const assetIds: string[] = [];
    function traverse(node: any) {
      if (node && typeof node === "object") {
        if ((node.type === "journal-image" || node.type === "image") && node.assetId) {
          assetIds.push(node.assetId);
        }
        if (Array.isArray(node.children)) {
          for (const child of node.children) {
            traverse(child);
          }
        }
      }
    }
    if (state && state.root) traverse(state.root);
    return Array.from(new Set(assetIds));
  } catch {
    return [];
  }
}

function formatInlineNode(node: any, assetFilenameMap?: Map<string, string>): string {
  if (!node || typeof node !== "object") return "";

  if (node.type === "linebreak") {
    return "\n";
  }

  if (node.type === "tab") {
    return "\t";
  }

  if (node.type === "link" || node.type === "autolink") {
    const text = (node.children || []).map((c: any) => formatInlineNode(c, assetFilenameMap)).join("");
    return `[${text || node.url || ""}](${node.url || ""})`;
  }

  if (node.type === "journal-image" || node.type === "image") {
    const assetId = node.assetId || "";
    const imagePath = (assetFilenameMap && assetId && assetFilenameMap.get(assetId))
      ? assetFilenameMap.get(assetId)
      : assetId
      ? `images/${assetId}.webp`
      : node.src || "";
    const caption = node.caption || "Image";
    return `![${caption}](${imagePath})`;
  }

  if (typeof node.text === "string") {
    let text = node.text;
    const format = typeof node.format === "number" ? node.format : 0;
    if (format === 0 || !text) return text;

    if (format & 16) {
      text = `\`${text}\``;
    }
    if (format & 1) {
      text = `**${text}**`;
    }
    if (format & 2) {
      text = `*${text}*`;
    }
    if (format & 4) {
      text = `~~${text}~~`;
    }
    if (format & 8) {
      text = `<u>${text}</u>`;
    }
    if (format & 128) {
      text = `==${text}==`;
    }
    return text;
  }

  if (Array.isArray(node.children)) {
    return node.children.map((c: any) => formatInlineNode(c, assetFilenameMap)).join("");
  }

  return "";
}

function formatBlockNode(node: any, indentLevel = 0, assetFilenameMap?: Map<string, string>): string {
  if (!node || typeof node !== "object") return "";

  const nodeType = String(node.type || "").toLowerCase().trim();

  if (nodeType === "heading") {
    const tag = String(node.tag || "h1").toLowerCase();
    const level = tag === "h1" ? "#" : tag === "h2" ? "##" : tag === "h3" ? "###" : tag === "h4" ? "####" : tag === "h5" ? "#####" : "######";
    const text = (node.children || []).map((c: any) => formatInlineNode(c, assetFilenameMap)).join("");
    return `${level} ${text}`;
  }

  if (nodeType === "quote") {
    const text = (node.children || []).map((c: any) => formatInlineNode(c, assetFilenameMap)).join("");
    const lines = text.split("\n");
    return lines.map((l: string) => `> ${l}`).join("\n");
  }

  if (nodeType === "code") {
    const language = node.language || "";
    const codeText = (node.children || []).map((c: any) => c.text || formatInlineNode(c, assetFilenameMap)).join("");
    return `\`\`\`${language}\n${codeText}\n\`\`\``;
  }

  if (nodeType === "list") {
    const listType = node.listType || "bullet";
    const items: string[] = [];
    const children = Array.isArray(node.children) ? node.children : [];

    children.forEach((child: any, idx: number) => {
      if (child.type === "listitem") {
        let prefix = "- ";
        if (listType === "number") {
          prefix = `${child.value !== undefined ? child.value : idx + 1}. `;
        } else if (listType === "check") {
          prefix = child.checked ? "- [x] " : "- [ ] ";
        }

        let itemText = "";
        if (Array.isArray(child.children)) {
          const inlineParts: string[] = [];
          const subListParts: string[] = [];
          for (const subChild of child.children) {
            if (subChild.type === "list") {
              subListParts.push(formatBlockNode(subChild, indentLevel + 1, assetFilenameMap));
            } else {
              inlineParts.push(formatInlineNode(subChild, assetFilenameMap));
            }
          }
          itemText = inlineParts.join("");
          if (subListParts.length > 0) {
            itemText += "\n" + subListParts.join("\n");
          }
        } else {
          itemText = formatInlineNode(child, assetFilenameMap);
        }

        const indent = "  ".repeat(indentLevel);
        items.push(`${indent}${prefix}${itemText}`);
      } else {
        items.push(formatBlockNode(child, indentLevel, assetFilenameMap));
      }
    });

    return items.join("\n");
  }

  if (
    nodeType === "horizontal-rule" ||
    nodeType === "horizontalrule" ||
    nodeType === "hr" ||
    nodeType === "session-divider" ||
    nodeType === "session_divider"
  ) {
    return "***";
  }

  if (nodeType === "paragraph") {
    return (node.children || []).map((c: any) => formatInlineNode(c, assetFilenameMap)).join("");
  }

  if (nodeType === "journal-image" || nodeType === "image") {
    return formatInlineNode(node, assetFilenameMap);
  }

  if (Array.isArray(node.children)) {
    return node.children.map((c: any) => formatInlineNode(c, assetFilenameMap)).join("");
  }

  return formatInlineNode(node, assetFilenameMap);
}

export function lexicalStateToMarkdown(lexicalJsonStr: string, assetFilenameMap?: Map<string, string>): string {
  if (!lexicalJsonStr) return "";
  try {
    const state = typeof lexicalJsonStr === "string" ? JSON.parse(lexicalJsonStr) : lexicalJsonStr;
    if (!state || typeof state !== "object" || !state.root) {
      return extractPlaintextFromLexicalState(lexicalJsonStr);
    }

    const root = state.root;
    if (!Array.isArray(root.children)) {
      return "";
    }

    const blocks = root.children
      .map((child: any) => formatBlockNode(child, 0, assetFilenameMap))
      .filter((blockText: string) => blockText !== undefined && blockText !== null);

    return blocks.join("\n\n").trim();
  } catch (err) {
    return extractPlaintextFromLexicalState(lexicalJsonStr);
  }
}

export function normalizeEntryDate(rawDate?: string | null): string {
  if (!rawDate) return new Date().toISOString().split("T")[0];
  try {
    const trimmed = String(rawDate).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split("T")[0];
    }
  } catch (e) {}
  return String(rawDate).split("T")[0] || new Date().toISOString().split("T")[0];
}

export function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 60);
}

export interface JournalExportAttachment {
  id: string;
  imagePath: string; // e.g. "images/jasset_123.webp"
  assetRole?: "inline" | "attachment";
  caption?: string;
}

export function formatJournalEntryToMarkdownFile(
  item: {
    record: {
      id: string;
      slug?: string;
      entryDate: string;
      entryType?: string;
      mood?: string | null;
      favorite?: number;
      tags?: string;
      createdAt?: string;
    };
    content: DecryptedJournalContent | null;
    plaintextBody?: string;
  },
  options?: {
    attachments?: JournalExportAttachment[];
    assetFilenameMap?: Map<string, string>;
  }
): { filename: string; content: string } {
  const dateStr = normalizeEntryDate(item.record.entryDate || item.record.createdAt);
  const title = item.content?.title || "Untitled";
  const entryType = item.record.entryType || "daily";
  const mood = item.record.mood || null;
  const favorite = item.record.favorite === 1;

  let tagList: string[] = [];
  if (Array.isArray(item.content?.tags)) {
    tagList.push(...item.content.tags);
  }
  if (item.record.tags) {
    try {
      const parsed = JSON.parse(item.record.tags);
      if (Array.isArray(parsed)) {
        tagList.push(...parsed);
      }
    } catch {}
  }
  tagList = tagList.map(String).filter((t, idx, arr) => t.trim().length > 0 && arr.indexOf(t) === idx);

  // Extract list of all image paths for this entry
  const entryImages: string[] = [];
  if (options?.attachments && options.attachments.length > 0) {
    for (const att of options.attachments) {
      if (!entryImages.includes(att.imagePath)) {
        entryImages.push(att.imagePath);
      }
    }
  }

  // Also include any inline image paths from AST
  if (item.content?.lexicalState) {
    const inlineAssetIds = extractAssetIdsFromLexicalState(item.content.lexicalState);
    for (const aId of inlineAssetIds) {
      const mapped = options?.assetFilenameMap?.get(aId) || `images/${aId}.webp`;
      if (!entryImages.includes(mapped)) {
        entryImages.push(mapped);
      }
    }
  }

  let frontmatter = `---\n`;
  frontmatter += `journal: true\n`;
  frontmatter += `date: ${dateStr}\n`;
  frontmatter += `title: ${JSON.stringify(title)}\n`;
  frontmatter += `entryType: ${entryType}\n`;
  if (mood) {
    frontmatter += `mood: ${mood}\n`;
  }
  frontmatter += `favorite: ${favorite}\n`;
  if (tagList.length > 0) {
    frontmatter += `tags:\n`;
    for (const tag of tagList) {
      frontmatter += `  - ${tag}\n`;
    }
  }
  if (entryImages.length > 0) {
    frontmatter += `images:\n`;
    for (const img of entryImages) {
      frontmatter += `  - ${img}\n`;
    }
  }
  frontmatter += `---\n\n`;

  let body = "";
  if (item.content?.lexicalState) {
    body = lexicalStateToMarkdown(item.content.lexicalState, options?.assetFilenameMap);
  } else if (item.content?.markdown) {
    body = item.content.markdown;
  } else if (item.plaintextBody) {
    body = item.plaintextBody;
  }

  // If there are standalone attached images not present in the body text, append an attachments gallery section
  const standaloneAttachments = (options?.attachments || []).filter(
    (att) => att.assetRole === "attachment" && !body.includes(att.imagePath)
  );

  if (standaloneAttachments.length > 0) {
    let attachSection = "\n\n### Attachments\n\n";
    for (const att of standaloneAttachments) {
      attachSection += `![${att.caption || "Attachment"}](${att.imagePath})\n\n`;
    }
    body = body.trim() + attachSection;
  }

  const fullMarkdown = `${frontmatter}${body.trim()}\n`;

  const cleanTitle = sanitizeFilename(title !== "Untitled" ? title : item.record.slug || item.record.id);
  const filename = `${dateStr}-${cleanTitle || item.record.id}.md`;

  return {
    filename,
    content: fullMarkdown,
  };
}
