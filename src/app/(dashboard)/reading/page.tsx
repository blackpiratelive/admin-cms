import { ReadingDashboard } from "@/features/reading/components/ReadingDashboard";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reading History & Analytics | Admin CMS",
  description: "Personal reading history, analytics, sessions, and FreshRSS integration.",
};

export default function ReadingPage() {
  return <ReadingDashboard />;
}
