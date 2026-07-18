import React, { Suspense } from "react";
import { JournalEditorClient } from "@/features/journal/components/JournalEditorClient";

export default function JournalEditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: "40px", textAlign: "center", color: "var(--text-muted)" }}>Loading Editor...</div>}>
      <JournalEditorClient />
    </Suspense>
  );
}
