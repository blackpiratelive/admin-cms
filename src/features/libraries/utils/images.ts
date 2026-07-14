export function getTmdbImageUrl(path: string | null | undefined, size: "poster" | "backdrop" | "original" = "poster"): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;

  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const width = size === "poster" ? "w500" : size === "backdrop" ? "w1280" : "original";
  return `https://image.tmdb.org/t/p/${width}${cleanPath}`;
}
