// Shared, framework-agnostic types for the Location/Trip entity pickers.
// Kept in a plain (non-"use server", non-"use client") module so both the
// server actions and the client EntityCombobox can import them.

export interface LocationPickerOption {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  favorite: boolean;
}

export interface TripPickerOption {
  id: string;
  title: string;
  startDate: string | null;
  favorite: boolean;
}

export interface LocationPickerData {
  options: LocationPickerOption[];
  /** Location ids ordered most-recently-used first (derived server-side). */
  recentIds: string[];
}

export interface TripPickerData {
  options: TripPickerOption[];
  /** Trip ids ordered most-recently-used first (derived server-side). */
  recentIds: string[];
}
