import React from "react";
import { JournalAuthProvider } from "@/features/journal/context/JournalAuthContext";

export const metadata = {
  title: "Personal Memory Vault | CMS",
  description: "End-to-End Encrypted Personal Life Journal & Memory Archive",
};

export default function JournalLayout({ children }: { children: React.ReactNode }) {
  return <JournalAuthProvider>{children}</JournalAuthProvider>;
}
