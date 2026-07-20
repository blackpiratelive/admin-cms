"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { CheckListPlugin } from "@lexical/react/LexicalCheckListPlugin";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { TRANSFORMERS } from "@lexical/markdown";
import {
  HeadingNode,
  QuoteNode,
  $createHeadingNode,
  $createQuoteNode,
} from "@lexical/rich-text";
import {
  ListNode,
  ListItemNode,
  $createListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from "@lexical/list";
import { TableNode, TableCellNode, TableRowNode } from "@lexical/table";
import { CodeNode, CodeHighlightNode, $createCodeNode } from "@lexical/code";
import { AutoLinkNode, LinkNode } from "@lexical/link";
import {
  FORMAT_TEXT_COMMAND,
  FORMAT_ELEMENT_COMMAND,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  TextNode,
  EditorState,
} from "lexical";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  List,
  ListOrdered,
  ListChecks,
  Quote,
  Table,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Sparkles,
  Save,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { calculateWordCount, calculateReadingTime, extractPlaintextFromLexicalState, sanitizeLexicalStateJson } from "../../lib/journal-helpers";
import { JournalImageNode, $createJournalImageNode } from "./JournalImageNode";
import { useJournalAuth } from "../../context/JournalAuthContext";
import { processAndUploadEncryptedJournalAsset } from "../../lib/crypto-assets";
import { notify } from "@/lib/notifications";

// Theme configuration for Lexical
const editorTheme = {
  paragraph: "editor-p",
  heading: {
    h1: "editor-h1",
    h2: "editor-h2",
    h3: "editor-h3",
  },
  list: {
    ul: "editor-ul",
    ol: "editor-ol",
    checklist: "editor-checklist",
    listitem: "editor-listitem",
  },
  quote: "editor-quote",
  code: "editor-code",
  text: {
    bold: "editor-text-bold",
    italic: "editor-text-italic",
    underline: "editor-text-underline",
    strikethrough: "editor-text-strikethrough",
    code: "editor-text-code",
  },
};

const editorNodes = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  TableNode,
  TableCellNode,
  TableRowNode,
  CodeNode,
  CodeHighlightNode,
  AutoLinkNode,
  LinkNode,
  JournalImageNode,
];

interface ToolbarProps {
  wordCount: number;
  characterCount: number;
  readingTime: number;
  autosaveStatus: "idle" | "saving" | "saved" | "error";
  onSave?: () => void;
  entryId?: string;
}

function Toolbar({ wordCount, characterCount, readingTime, autosaveStatus, onSave, entryId }: ToolbarProps) {
  const [editor] = useLexicalComposerContext();
  const { cryptoKey } = useJournalAuth();
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleToolbarImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !cryptoKey) return;

    setUploadingImage(true);
    try {
      notify.show({ type: "info", message: `Encrypting & uploading ${file.name}...` });
      const record = await processAndUploadEncryptedJournalAsset({
        file,
        dekKey: cryptoKey,
        entryId,
        assetRole: "inline",
      });

      editor.update(() => {
        const selection = $getSelection();
        const node = $createJournalImageNode(record.id, record.width, record.height);
        if ($isRangeSelection(selection)) {
          selection.insertNodes([node]);
        } else {
          $getRoot().append(node);
        }
      });
      notify.show({ type: "success", message: "Encrypted inline image inserted" });
    } catch (err: any) {
      console.error("Toolbar image upload failed:", err);
      notify.show({ type: "error", message: err?.message || "Failed to upload image" });
    } finally {
      setUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const formatText = (format: "bold" | "italic" | "underline" | "strikethrough" | "code") => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };

  const formatElement = (format: "left" | "center" | "right") => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
  };

  const formatHeading = (level: "h1" | "h2") => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = $createHeadingNode(level);
        selection.insertNodes([node]);
      }
    });
  };

  const formatQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = $createQuoteNode();
        selection.insertNodes([node]);
      }
    });
  };

  const formatCodeBlock = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = $createCodeNode();
        selection.insertNodes([node]);
      }
    });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 12px",
        backgroundColor: "var(--bg-main)",
        borderBottom: "1px solid var(--border-color)",
        flexWrap: "wrap",
        gap: "8px",
        fontSize: "13px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
        <button
          type="button"
          onClick={() => formatText("bold")}
          title="Bold (Ctrl+B)"
          className="editor-btn"
        >
          <Bold size={15} />
        </button>
        <button
          type="button"
          onClick={() => formatText("italic")}
          title="Italic (Ctrl+I)"
          className="editor-btn"
        >
          <Italic size={15} />
        </button>
        <button
          type="button"
          onClick={() => formatText("underline")}
          title="Underline (Ctrl+U)"
          className="editor-btn"
        >
          <Underline size={15} />
        </button>
        <button
          type="button"
          onClick={() => formatText("strikethrough")}
          title="Strikethrough"
          className="editor-btn"
        >
          <Strikethrough size={15} />
        </button>
        <button
          type="button"
          onClick={() => formatText("code")}
          title="Inline Code"
          className="editor-btn"
        >
          <Code size={15} />
        </button>

        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 4px" }} />

        <button
          type="button"
          onClick={() => formatHeading("h1")}
          title="Heading 1"
          className="editor-btn"
        >
          <Heading1 size={15} />
        </button>
        <button
          type="button"
          onClick={() => formatHeading("h2")}
          title="Heading 2"
          className="editor-btn"
        >
          <Heading2 size={15} />
        </button>

        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 4px" }} />

        <button
          type="button"
          onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)}
          title="Bullet List"
          className="editor-btn"
        >
          <List size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)}
          title="Numbered List"
          className="editor-btn"
        >
          <ListOrdered size={15} />
        </button>
        <button
          type="button"
          onClick={() => editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined)}
          title="Checklist"
          className="editor-btn"
        >
          <ListChecks size={15} />
        </button>
        <button
          type="button"
          onClick={formatQuote}
          title="Quote"
          className="editor-btn"
        >
          <Quote size={15} />
        </button>
        <button
          type="button"
          onClick={formatCodeBlock}
          title="Code Block"
          className="editor-btn"
        >
          <Code size={15} />
        </button>

        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          onChange={handleToolbarImageSelect}
          style={{ display: "none" }}
          data-journal-image-input
        />
        <button
          type="button"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploadingImage}
          title="Insert E2EE Image"
          className="editor-btn"
        >
          {uploadingImage ? <Loader2 size={15} className="spin" style={{ color: "var(--accent)" }} /> : <ImageIcon size={15} />}
        </button>

        <div style={{ width: "1px", height: "18px", backgroundColor: "var(--border-color)", margin: "0 4px" }} />

        <button
          type="button"
          onClick={() => formatElement("left")}
          title="Align Left"
          className="editor-btn"
        >
          <AlignLeft size={15} />
        </button>
        <button
          type="button"
          onClick={() => formatElement("center")}
          title="Align Center"
          className="editor-btn"
        >
          <AlignCenter size={15} />
        </button>
        <button
          type="button"
          onClick={() => formatElement("right")}
          title="Align Right"
          className="editor-btn"
        >
          <AlignRight size={15} />
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "14px", color: "var(--text-muted)", fontSize: "12px" }}>
        <span>{wordCount} words</span>
        <span>{characterCount} chars</span>
        <span>{readingTime} min read</span>

        {onSave && (
          <button
            type="button"
            onClick={onSave}
            style={{
              padding: "4px 10px",
              backgroundColor: "var(--accent, #f97316)",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "12px",
            }}
          >
            <Save size={13} />
            <span>Save</span>
          </button>
        )}

        <span
          style={{
            fontSize: "11px",
            padding: "2px 8px",
            borderRadius: "4px",
            backgroundColor:
              autosaveStatus === "saving"
                ? "rgba(234, 179, 8, 0.15)"
                : autosaveStatus === "saved"
                ? "rgba(34, 197, 94, 0.15)"
                : "transparent",
            color:
              autosaveStatus === "saving"
                ? "#eab308"
                : autosaveStatus === "saved"
                ? "#22c55e"
                : "var(--text-muted)",
          }}
        >
          {autosaveStatus === "saving" ? "Saving..." : autosaveStatus === "saved" ? "Autosaved" : ""}
        </span>
      </div>
    </div>
  );
}

// Custom Slash Commands Plugin
function SlashCommandsPlugin() {
  const [editor] = useLexicalComposerContext();
  const [showPopup, setShowPopup] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const commands = [
    { label: "Heading 1", icon: "H1", action: () => insertHeading("h1") },
    { label: "Heading 2", icon: "H2", action: () => insertHeading("h2") },
    { label: "Checklist", icon: "☑", action: () => insertChecklist() },
    { label: "Bullet List", icon: "•", action: () => insertBulletList() },
    { label: "Quote", icon: "“", action: () => insertQuote() },
    { label: "Code Block", icon: "</>", action: () => insertCode() },
    { label: "Encrypted Image", icon: "🖼", action: () => insertImage() },
  ];

  const insertHeading = (level: "h1" | "h2") => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = $createHeadingNode(level);
        selection.insertNodes([node]);
      }
    });
    setShowPopup(false);
  };

  const insertChecklist = () => {
    editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
    setShowPopup(false);
  };

  const insertBulletList = () => {
    editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    setShowPopup(false);
  };

  const insertQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = $createQuoteNode();
        selection.insertNodes([node]);
      }
    });
    setShowPopup(false);
  };

  const insertCode = () => {
    editor.update(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) {
        const node = $createCodeNode();
        selection.insertNodes([node]);
      }
    });
    setShowPopup(false);
  };

  const insertImage = () => {
    setShowPopup(false);
    const input = document.querySelector<HTMLInputElement>('input[data-journal-image-input]');
    input?.click();
  };

  return null;
}

// Drag-and-Drop + Paste Image Plugin
function DragDropPasteImagePlugin({ entryId }: { entryId?: string }) {
  const [editor] = useLexicalComposerContext();
  const { cryptoKey } = useJournalAuth();

  const handleImageFile = useCallback(async (file: File) => {
    if (!cryptoKey) {
      notify.show({ type: "error", message: "Journal not unlocked \u2013 cannot encrypt image" });
      return;
    }
    try {
      notify.show({ type: "info", message: `Encrypting & uploading ${file.name}...` });
      const record = await processAndUploadEncryptedJournalAsset({
        file,
        dekKey: cryptoKey,
        entryId,
        assetRole: "inline",
      });
      editor.update(() => {
        const selection = $getSelection();
        const node = $createJournalImageNode(record.id, record.width, record.height);
        if ($isRangeSelection(selection)) {
          selection.insertNodes([node]);
        } else {
          $getRoot().append(node);
        }
      });
      notify.show({ type: "success", message: "Encrypted image inserted" });
    } catch (err: any) {
      console.error("Image upload failed:", err);
      notify.show({ type: "error", message: err?.message || "Failed to upload image" });
    }
  }, [editor, cryptoKey, entryId]);

  useEffect(() => {
    const root = editor.getRootElement();
    if (!root) return;

    const handleDrop = (e: DragEvent) => {
      const files = e.dataTransfer?.files;
      if (!files?.length) return;
      for (let i = 0; i < files.length; i++) {
        if (files[i].type.startsWith("image/")) {
          e.preventDefault();
          e.stopPropagation();
          handleImageFile(files[i]);
          return;
        }
      }
    };

    const handleDragOver = (e: DragEvent) => {
      const items = e.dataTransfer?.items;
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith("image/")) {
            e.preventDefault();
            return;
          }
        }
      }
    };

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            handleImageFile(file);
            return;
          }
        }
      }
    };

    root.addEventListener("drop", handleDrop);
    root.addEventListener("dragover", handleDragOver);
    root.addEventListener("paste", handlePaste);
    return () => {
      root.removeEventListener("drop", handleDrop);
      root.removeEventListener("dragover", handleDragOver);
      root.removeEventListener("paste", handlePaste);
    };
  }, [editor, handleImageFile]);

  return null;
}

interface LexicalJournalEditorProps {
  initialStateJson?: string;
  onChange: (lexicalStateJson: string, plaintext: string, wordCount: number, readingTime: number) => void;
  autosaveStatus?: "idle" | "saving" | "saved" | "error";
  onManualSave?: () => void;
  entryId?: string;
}

export function LexicalJournalEditor({
  initialStateJson,
  onChange,
  autosaveStatus = "idle",
  onManualSave,
  entryId,
}: LexicalJournalEditorProps) {
  const [wordCount, setWordCount] = useState(0);
  const [characterCount, setCharacterCount] = useState(0);
  const [readingTime, setReadingTime] = useState(0);

  const sanitizedState = initialStateJson ? sanitizeLexicalStateJson(initialStateJson) : undefined;

  const initialConfig = {
    namespace: "JournalEditor",
    theme: editorTheme,
    nodes: editorNodes,
    editorState: sanitizedState,
    onError: (error: Error) => {
      console.error("Lexical Editor Error:", error);
    },
  };

  const handleStateChange = (editorState: EditorState) => {
    editorState.read(() => {
      const jsonStr = JSON.stringify(editorState.toJSON());
      const plaintext = extractPlaintextFromLexicalState(jsonStr);
      const wCount = calculateWordCount(plaintext);
      const rTime = calculateReadingTime(wCount);

      setWordCount(wCount);
      setCharacterCount(plaintext.length);
      setReadingTime(rTime);

      onChange(jsonStr, plaintext, wCount, rTime);
    });
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          borderRadius: "8px",
          border: "1px solid var(--border-color)",
          overflow: "hidden",
          backgroundColor: "var(--bg-card)",
          minHeight: "420px",
        }}
      >
        <Toolbar
          wordCount={wordCount}
          characterCount={characterCount}
          readingTime={readingTime}
          autosaveStatus={autosaveStatus}
          onSave={onManualSave}
          entryId={entryId}
        />

        <div style={{ position: "relative", flex: 1, padding: "16px 20px" }}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                style={{
                  minHeight: "360px",
                  outline: "none",
                  fontSize: "15px",
                  lineHeight: "1.7",
                  color: "var(--text-primary)",
                }}
              />
            }
            placeholder={
              <div
                style={{
                  position: "absolute",
                  top: "16px",
                  left: "20px",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                  fontSize: "15px",
                }}
              >
                Write your journal entry... Type '/' for commands or '@' to mention entities.
              </div>
            }
            ErrorBoundary={({ children }) => <>{children}</>}
          />
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <TablePlugin />
          <LinkPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <OnChangePlugin onChange={handleStateChange} />
          <SlashCommandsPlugin />
          <DragDropPasteImagePlugin entryId={entryId} />
        </div>
      </div>
    </LexicalComposer>
  );
}
