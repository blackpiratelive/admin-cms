import type { Metadata } from "next";
import "./collections.css";

export const metadata: Metadata = {
  title: {
    default: "Collections",
    template: "%s — Collections",
  },
  description: "A curated collection of photographs, films, music, and people.",
  referrer: "no-referrer",
};

export default function PublicCollectionsLayout({ children }: { children: React.ReactNode }) {
  return <div className="public-collections-root">{children}</div>;
}
