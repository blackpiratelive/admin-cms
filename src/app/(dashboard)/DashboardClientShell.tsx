"use client";

import { useState, Suspense } from "react";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { NavigationProgressBar } from "@/components/NavigationProgressBar";
import { ToastNotification } from "@/components/ToastNotification";
import type { SessionUser } from "@/features/auth/session";

interface DashboardClientShellProps {
  children: React.ReactNode;
  user: SessionUser | null;
}

export function DashboardClientShell({
  children,
  user,
}: DashboardClientShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-container">
      <Suspense fallback={null}>
        <NavigationProgressBar />
      </Suspense>
      <ToastNotification />
      <Header
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        sidebarOpen={sidebarOpen}
        user={user}
      />
      <div className="body-layout">
        {sidebarOpen && (
          <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />
        )}
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} user={user} />
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
