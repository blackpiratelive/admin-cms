"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Camera,
  ChevronLeft,
  ChevronRight,
  Film,
  Heart,
  MapPin,
  Music,
  Star,
  Tv,
  Users,
  X,
} from "lucide-react";
import type {
  CollectionAlbumItem,
  CollectionArtistItem,
  CollectionDetail,
  CollectionMovieItem,
  CollectionPersonItem,
  CollectionPhotoItem,
  CollectionShowItem,
  CollectionTrackItem,
} from "@/features/libraries/collection-types";
import { collectionKindLabel } from "@/features/libraries/collection-helpers";

interface PublicCollectionContentProps {
  detail: CollectionDetail;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function photoSummary(count: number): string {
  return `${count} photo${count === 1 ? "" : "s"}`;
}

function sectionSummary(counts: CollectionDetail["counts"]): string[] {
  const parts: string[] = [];
  if (counts.photos) parts.push(photoSummary(counts.photos));
  const films = counts.movies + counts.shows;
  if (films) parts.push(`${films} film${films === 1 ? "" : "s"}`);
  const music = counts.artists + counts.albums + counts.tracks;
  if (music) parts.push(`${music} music item${music === 1 ? "" : "s"}`);
  if (counts.people) parts.push(`${counts.people} ${counts.people === 1 ? "person" : "people"}`);
  return parts;
}

function Rating({ value }: { value: number | null }) {
  if (value == null || Number.isNaN(value)) return null;
  return (
    <span className="public-media-rating" title={`Personal rating: ${value}/10`}>
      <Star size={12} fill="currentColor" /> {value.toFixed(1)}
    </span>
  );
}

function Review({ text }: { text: string | null }) {
  if (!text?.trim()) return null;
  return (
    <details className="public-media-review">
      <summary>Read review</summary>
      <p>{text.trim()}</p>
    </details>
  );
}

function PhotoLightbox({
  photos,
  index,
  onClose,
  onNavigate,
}: {
  photos: CollectionPhotoItem[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
}) {
  const photo = photos[index];
  const hasPrevious = index > 0;
  const hasNext = index < photos.length - 1;

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasPrevious) onNavigate(index - 1);
      if (event.key === "ArrowRight" && hasNext) onNavigate(index + 1);
    };
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [hasNext, hasPrevious, index, onClose, onNavigate]);

  const touchStart = React.useRef<number | null>(null);

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStart.current = event.touches[0]?.clientX ?? null;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStart.current == null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchStart.current;
    const delta = endX - touchStart.current;
    touchStart.current = null;
    if (Math.abs(delta) < 50) return;
    if (delta > 0 && hasPrevious) onNavigate(index - 1);
    if (delta < 0 && hasNext) onNavigate(index + 1);
  };

  if (!photo) return null;

  return (
    <div
      className="public-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={photo.title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <button className="public-lightbox-close" onClick={onClose} aria-label="Close photo">
        <X size={22} />
      </button>

      {hasPrevious && (
        <button
          className="public-lightbox-nav is-previous"
          onClick={() => onNavigate(index - 1)}
          aria-label="Previous photo"
        >
          <ChevronLeft size={26} />
        </button>
      )}
      {hasNext && (
        <button
          className="public-lightbox-nav is-next"
          onClick={() => onNavigate(index + 1)}
          aria-label="Next photo"
        >
          <ChevronRight size={26} />
        </button>
      )}

      <div className="public-lightbox-stage" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.largeUrl} alt={photo.title} />
      </div>

      <aside className="public-lightbox-details">
        <div className="public-lightbox-count">
          {index + 1} / {photos.length}
        </div>
        <h2>{photo.title}</h2>
        {photo.description && <p className="public-lightbox-description">{photo.description}</p>}

        <div className="public-lightbox-specs">
          {photo.camera && (
            <div>
              <Camera size={14} />
              <span>
                {photo.camera}
                {photo.lens ? ` · ${photo.lens}` : ""}
              </span>
            </div>
          )}
          {(photo.focalLength || photo.aperture || photo.shutterSpeed || photo.iso) && (
            <div>
              <Camera size={14} />
              <span>
                {[photo.focalLength, photo.aperture, photo.shutterSpeed, photo.iso ? `ISO ${photo.iso}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </div>
          )}
          {photo.takenAt && (
            <div>
              <Calendar size={14} />
              <span>{formatDate(photo.takenAt)}</span>
            </div>
          )}
          {photo.locationName && (
            <div>
              <MapPin size={14} />
              <span>{photo.locationName}</span>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function MovieCard({ movie }: { movie: CollectionMovieItem }) {
  return (
    <article className="public-media-card">
      <div className="public-media-poster">
        {movie.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={movie.posterUrl} alt={movie.title} loading="lazy" />
        ) : (
          <Film size={28} />
        )}
      </div>
      <div className="public-media-body">
        <h3>{movie.title}</h3>
        <div className="public-media-subline">
          {movie.year && <span>{movie.year}</span>}
          {movie.favorite && (
            <span className="public-media-favorite">
              <Heart size={12} fill="currentColor" /> Favorite
            </span>
          )}
          <Rating value={movie.rating} />
        </div>
        <Review text={movie.review} />
      </div>
    </article>
  );
}

function ShowCard({ show }: { show: CollectionShowItem }) {
  return (
    <article className="public-media-card">
      <div className="public-media-poster">
        {show.posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={show.posterUrl} alt={show.title} loading="lazy" />
        ) : (
          <Tv size={28} />
        )}
      </div>
      <div className="public-media-body">
        <h3>{show.title}</h3>
        <div className="public-media-subline">
          {show.year && <span>{show.year}</span>}
          {show.status && <span>{show.status}</span>}
          {show.favorite && (
            <span className="public-media-favorite">
              <Heart size={12} fill="currentColor" /> Favorite
            </span>
          )}
          <Rating value={show.rating} />
        </div>
        <Review text={show.review} />
      </div>
    </article>
  );
}

function MusicCard({
  icon,
  title,
  subtitle,
  playCount,
  favorite,
  rating,
  review,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string | null;
  playCount: number;
  favorite: boolean;
  rating: number | null;
  review: string | null;
}) {
  return (
    <article className="public-music-card">
      <div className="public-music-icon">{icon}</div>
      <div className="public-music-body">
        <h3>{title}</h3>
        {subtitle && <div className="public-music-subtitle">{subtitle}</div>}
        <div className="public-media-subline">
          <span>{playCount.toLocaleString("en-US")} plays</span>
          {favorite && (
            <span className="public-media-favorite">
              <Heart size={12} fill="currentColor" /> Favorite
            </span>
          )}
          <Rating value={rating} />
        </div>
        <Review text={review} />
      </div>
    </article>
  );
}

function ArtistCard({ artist }: { artist: CollectionArtistItem }) {
  return (
    <MusicCard
      icon={<Users size={18} />}
      title={artist.name}
      playCount={artist.playCount}
      favorite={artist.favorite}
      rating={artist.rating}
      review={artist.review}
    />
  );
}

function AlbumCard({ album }: { album: CollectionAlbumItem }) {
  return (
    <MusicCard
      icon={<Music size={18} />}
      title={album.name}
      subtitle={album.artist}
      playCount={album.playCount}
      favorite={album.favorite}
      rating={album.rating}
      review={album.review}
    />
  );
}

function TrackCard({ track }: { track: CollectionTrackItem }) {
  return (
    <MusicCard
      icon={<Music size={18} />}
      title={track.name}
      subtitle={track.artist}
      playCount={track.playCount}
      favorite={track.favorite}
      rating={track.rating}
      review={track.review}
    />
  );
}

function PersonCard({ person }: { person: CollectionPersonItem }) {
  return (
    <article className="public-person-card">
      <div className="public-person-avatar">
        {person.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.avatarUrl} alt={person.name} loading="lazy" />
        ) : (
          <Users size={24} />
        )}
      </div>
      <h3>{person.name}</h3>
    </article>
  );
}

export function PublicCollectionContent({ detail }: PublicCollectionContentProps) {
  const { collection, photos, movies, shows, artists, albums, tracks, people, counts } = detail;
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const showPhotos = collection.kind === "photo" || collection.kind === "mixed";
  const showMedia = collection.kind === "media" || collection.kind === "mixed";
  const summary = useMemo(() => sectionSummary(counts), [counts]);
  const hasAnything =
    (showPhotos && photos.length > 0) ||
    (showMedia &&
      (movies.length > 0 ||
        shows.length > 0 ||
        artists.length > 0 ||
        albums.length > 0 ||
        tracks.length > 0 ||
        people.length > 0));

  const closeLightbox = useCallback(() => setLightboxIndex(null), []);
  const navigateLightbox = useCallback((nextIndex: number) => setLightboxIndex(nextIndex), []);

  return (
    <main className="public-collection-detail">
      <div
        className="public-collection-accent"
        style={{ background: collection.color || "#ff6600" }}
      />

      <header className="public-collection-detail-header">
        {collection.visibility === "public" && (
          <Link href="/collections" className="public-collection-back">
            <ChevronLeft size={14} /> All collections
          </Link>
        )}
        {collection.visibility === "unlisted" && (
          <span className="public-collection-unlisted-badge">Shared collection</span>
        )}

        <span className="public-collection-kind-badge">{collectionKindLabel(collection.kind)}</span>
        <h1>{collection.name}</h1>
        {collection.description && <p>{collection.description}</p>}
        {summary.length > 0 && <div className="public-collection-summary">{summary.join(" · ")}</div>}
      </header>

      {!hasAnything && (
        <div className="public-collections-empty">
          <h2>Nothing on display yet</h2>
          <p>This collection does not have any visible items right now.</p>
        </div>
      )}

      {showPhotos && photos.length > 0 && (
        <section className="public-collection-section">
          <div className="public-collection-section-heading">
            <h2>Photographs</h2>
            <span>{photoSummary(photos.length)}</span>
          </div>
          <div className="public-photo-grid">
            {photos.map((photo, index) => (
              <button
                key={photo.id}
                type="button"
                className="public-photo-tile"
                onClick={() => setLightboxIndex(index)}
                aria-label={`Open ${photo.title}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.mediumUrl || photo.thumbnailUrl}
                  alt={photo.title}
                  loading="lazy"
                  width={photo.width || undefined}
                  height={photo.height || undefined}
                />
                <span className="public-photo-tile-overlay">
                  <span className="public-photo-tile-title">{photo.title}</span>
                  {photo.takenAt && (
                    <span className="public-photo-tile-date">{formatDate(photo.takenAt)}</span>
                  )}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {showMedia && (movies.length > 0 || shows.length > 0) && (
        <section className="public-collection-section">
          <div className="public-collection-section-heading">
            <h2>Film &amp; Television</h2>
            <span>
              {movies.length + shows.length} title{movies.length + shows.length === 1 ? "" : "s"}
            </span>
          </div>
          {(movies.length > 0 || shows.length > 0) && (
            <div className="public-media-grid">
              {movies.map((movie) => (
                <MovieCard key={`movie-${movie.id}`} movie={movie} />
              ))}
              {shows.map((show) => (
                <ShowCard key={`show-${show.id}`} show={show} />
              ))}
            </div>
          )}
        </section>
      )}

      {showMedia && (artists.length > 0 || albums.length > 0 || tracks.length > 0) && (
        <section className="public-collection-section">
          <div className="public-collection-section-heading">
            <h2>Music</h2>
            <span>
              {artists.length + albums.length + tracks.length} item
              {artists.length + albums.length + tracks.length === 1 ? "" : "s"}
            </span>
          </div>
          <div className="public-music-groups">
            {artists.length > 0 && (
              <div className="public-music-group">
                <h3>Artists</h3>
                <div className="public-music-grid">
                  {artists.map((artist) => (
                    <ArtistCard key={`artist-${artist.id}`} artist={artist} />
                  ))}
                </div>
              </div>
            )}
            {albums.length > 0 && (
              <div className="public-music-group">
                <h3>Albums</h3>
                <div className="public-music-grid">
                  {albums.map((album) => (
                    <AlbumCard key={`album-${album.id}`} album={album} />
                  ))}
                </div>
              </div>
            )}
            {tracks.length > 0 && (
              <div className="public-music-group">
                <h3>Tracks</h3>
                <div className="public-music-grid">
                  {tracks.map((track) => (
                    <TrackCard key={`track-${track.id}`} track={track} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {showMedia && people.length > 0 && (
        <section className="public-collection-section">
          <div className="public-collection-section-heading">
            <h2>People</h2>
            <span>
              {people.length} {people.length === 1 ? "person" : "people"}
            </span>
          </div>
          <div className="public-people-grid">
            {people.map((person) => (
              <PersonCard key={`person-${person.id}`} person={person} />
            ))}
          </div>
        </section>
      )}

      {collection.visibility === "public" && (
        <footer className="public-collections-footer">
          <Link href="/collections">Browse all collections</Link>
        </footer>
      )}

      {lightboxIndex != null && photos[lightboxIndex] && (
        <PhotoLightbox
          photos={photos}
          index={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}
    </main>
  );
}
