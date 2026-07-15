"use client";

import React, { useEffect, useState, useTransition } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export function NavigationProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [navigating, setNavigating] = useState(false);
  const [progress, setProgress] = useState(0);

  // Complete progress bar when route finishes loading
  useEffect(() => {
    if (navigating) {
      setProgress(100);
      const timer = setTimeout(() => {
        setNavigating(false);
        setProgress(0);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [pathname, searchParams]);

  // Intercept all internal anchor clicks for instant 0ms visual feedback
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    const handleAnchorClick = (e: MouseEvent) => {
      // Find closest anchor tag
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const targetUrl = anchor.getAttribute("href");
      if (!targetUrl) return;

      // Ignore external links, mailto, tel, anchor hashes, new tab clicks
      if (
        targetUrl.startsWith("http://") ||
        targetUrl.startsWith("https://") ||
        targetUrl.startsWith("#") ||
        targetUrl.startsWith("mailto:") ||
        targetUrl.startsWith("tel:") ||
        anchor.target === "_blank" ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }

      const currentPath = window.location.pathname + window.location.search;
      // If clicking same path with same search params, skip
      if (targetUrl === currentPath) return;

      // Start global top loading bar immediately
      setNavigating(true);
      setProgress(25);

      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 85) {
            if (interval) clearInterval(interval);
            return 85;
          }
          return prev + Math.random() * 15;
        });
      }, 150);
    };

    document.addEventListener("click", handleAnchorClick, { capture: true });

    return () => {
      document.removeEventListener("click", handleAnchorClick, { capture: true });
      if (interval) clearInterval(interval);
    };
  }, []);

  if (!navigating) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: "3px",
        zIndex: 99999,
        pointerEvents: "none",
        backgroundColor: "rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, var(--accent-color, #3b82f6) 0%, #60a5fa 50%, var(--accent-color, #3b82f6) 100%)",
          boxShadow: "0 0 10px var(--accent-color, #3b82f6), 0 0 5px var(--accent-color, #3b82f6)",
          transition: progress === 100 ? "width 0.2s ease-out, opacity 0.3s ease" : "width 0.2s ease-in-out",
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
