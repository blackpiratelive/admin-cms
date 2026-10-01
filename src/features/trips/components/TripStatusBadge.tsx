import React from "react";

interface TripStatusBadgeProps {
  status: "planned" | "ongoing" | "completed" | "cancelled" | string;
  className?: string;
}

export function TripStatusBadge({ status, className }: TripStatusBadgeProps) {
  const norm = (status || "planned").toLowerCase();

  const labelMap: Record<string, string> = {
    completed: "COMPLETED",
    upcoming: "UPCOMING",
    planned: "UPCOMING",
    ongoing: "ONGOING",
    cancelled: "CANCELLED",
  };

  const label = labelMap[norm] || norm.toUpperCase();
  const statusClass = norm === "planned" ? "upcoming" : norm;

  return (
    <span
      className={`trip-status-badge ${statusClass} ${className || ""}`.trim()}
      role="status"
    >
      {label}
    </span>
  );
}
