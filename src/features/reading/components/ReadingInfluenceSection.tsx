"use client";

import { useEffect, useState } from "react";
import { getReadingAroundTimeAction, ReadingArticleDTO } from "../actions";
import { BookOpen, ExternalLink, Sparkles, Star } from "lucide-react";

export function ReadingInfluenceSection({
  date,
  endDate,
  title = "Reading Around This Time",
}: {
  date: string;
  endDate?: string;
  title?: string;
}) {
  const [articles, setArticles] = useState<ReadingArticleDTO[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!date) return;
      setLoading(true);
      try {
        const res = await getReadingAroundTimeAction(date, endDate);
        if (active) setArticles(res);
      } catch (err) {
        console.error("Reading influence load error:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [date, endDate]);

  if (!loading && articles.length === 0) return null;

  return (
    <div className="card my-6 border border-[var(--border-color)] p-5 rounded-xl bg-[var(--bg-secondary)] shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles size={18} className="text-[var(--accent-color)]" />
        <h3 className="text-base font-semibold text-[var(--fg-primary)]">{title}</h3>
      </div>
      <p className="text-xs text-[var(--fg-muted)] mb-4">
        Articles read and starred around this timeframe that may have influenced thoughts or activities.
      </p>

      {loading ? (
        <div className="animate-pulse flex flex-col gap-2">
          <div className="h-4 bg-[var(--bg-tertiary)] rounded w-3/4"></div>
          <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/2"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {articles.map((art) => (
            <div
              key={art.id}
              className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--bg-hover)] transition-colors text-sm"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-3">
                <BookOpen size={15} className="text-[var(--fg-muted)] shrink-0" />
                <a
                  href={art.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[var(--fg-primary)] hover:text-[var(--accent-color)] hover:underline truncate"
                >
                  {art.title}
                </a>
                {art.isStarred && (
                  <Star size={13} className="fill-amber-400 text-amber-400 shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--fg-muted)] shrink-0">
                <span className="hidden sm:inline bg-[var(--bg-tertiary)] px-2 py-0.5 rounded">
                  {art.feedName || art.category || "RSS"}
                </span>
                <a
                  href={art.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open article in new tab"
                  className="hover:text-[var(--accent-color)]"
                >
                  <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
