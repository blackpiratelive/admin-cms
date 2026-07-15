"use client";

import { useState, Suspense } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { NavigationProgressBar } from "@/components/NavigationProgressBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Suspense fallback={null}>
        <NavigationProgressBar />
      </Suspense>
      <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} sidebarOpen={sidebarOpen} />
      <div className="body-layout">
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
