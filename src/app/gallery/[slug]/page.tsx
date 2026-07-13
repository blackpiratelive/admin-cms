import React from "react";
import { getGalleryPhotoBySlug } from "@/features/gallery/actions";
import { notFound } from "next/navigation";
import { Camera, MapPin, Calendar, Tag, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";

interface PublicPhotoPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export async function generateMetadata({ params }: PublicPhotoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const photo = await getGalleryPhotoBySlug(slug);

  if (!photo || photo.visibility === "private" || !photo.shortUrl) {
    return {
      title: "Photo Not Found",
    };
  }

  return {
    title: `${photo.title} — Photography Gallery`,
    description: photo.description || `Photo capture: ${photo.title}`,
    openGraph: {
      title: photo.title,
      description: photo.description || undefined,
      images: [{ url: photo.largeUrl || photo.originalUrl }],
    },
  };
}

export default async function PublicGalleryPhotoPage({ params }: PublicPhotoPageProps) {
  const { slug } = await params;
  const photo = await getGalleryPhotoBySlug(slug);

  if (!photo || photo.visibility === "private" || !photo.shortUrl) {
    notFound();
  }

  let tagsArray: string[] = [];
  try {
    const parsed = JSON.parse(photo.tags);
    if (Array.isArray(parsed)) tagsArray = parsed;
  } catch {
    if (photo.tags) tagsArray = [photo.tags];
  }

  const displayImageUrl = photo.largeUrl || photo.originalUrl;

  return (
    <div className="public-gallery-wrapper">
      <div className="photo-container">
        {/* Main Photograph Display */}
        <div className="photo-frame">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={displayImageUrl}
            alt={photo.title}
            className="main-image"
          />
        </div>

        {/* Details & EXIF Metadata Section */}
        <div className="details-card">
          <div className="title-header">
            <h1 className="photo-title">{photo.title}</h1>
            {photo.visibility === "unlisted" && (
              <span className="unlisted-badge" title="This photo is unlisted and accessible via direct share link">
                Unlisted Photo
              </span>
            )}
          </div>

          {photo.description && (
            <p className="photo-description">{photo.description}</p>
          )}

          {/* Camera Specifications & Technical EXIF */}
          <div className="specs-grid">
            <div className="spec-item">
              <Camera className="spec-icon" />
              <div>
                <div className="spec-label">Camera & Lens</div>
                <div className="spec-value">
                  {photo.camera || "N/A"} {photo.lens ? `• ${photo.lens}` : ""}
                </div>
              </div>
            </div>

            <div className="spec-item">
              <div className="spec-value-group">
                {photo.focalLength && <span><strong>Focal:</strong> {photo.focalLength}</span>}
                {photo.aperture && <span><strong>Aperture:</strong> {photo.aperture}</span>}
                {photo.shutterSpeed && <span><strong>Shutter:</strong> {photo.shutterSpeed}</span>}
                {photo.iso && <span><strong>ISO:</strong> {photo.iso}</span>}
                {!photo.focalLength && !photo.aperture && !photo.shutterSpeed && !photo.iso && (
                  <span className="spec-muted">EXIF metadata unrecorded</span>
                )}
              </div>
            </div>

            {photo.locationName && (
              <div className="spec-item">
                <MapPin className="spec-icon" />
                <div>
                  <div className="spec-label">Location</div>
                  <div className="spec-value">{photo.locationName}</div>
                </div>
              </div>
            )}

            {photo.takenAt && (
              <div className="spec-item">
                <Calendar className="spec-icon" />
                <div>
                  <div className="spec-label">Captured On</div>
                  <div className="spec-value">{new Date(photo.takenAt).toLocaleDateString(undefined, { dateStyle: "long" })}</div>
                </div>
              </div>
            )}
          </div>

          {/* Tags */}
          {tagsArray.length > 0 && (
            <div className="tags-container">
              <Tag size={14} className="tag-icon" />
              <div className="tags-list">
                {tagsArray.map((tag) => (
                  <span key={tag} className="tag-chip">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .public-gallery-wrapper {
          min-height: 100vh;
          background: #09090b;
          color: #f4f4f5;
          display: flex;
          justify-content: center;
          padding: 24px 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .photo-container {
          max-width: 1100px;
          width: 100%;
          display: flex;
          flexDirection: column;
          gap: 24px;
        }
        .photo-frame {
          background: #000;
          border: 1px solid #27272a;
          border-radius: 8px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);
        }
        .main-image {
          max-width: 100%;
          max-height: 80vh;
          object-fit: contain;
        }
        .details-card {
          background: #18181b;
          border: 1px solid #27272a;
          border-radius: 8px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .title-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .photo-title {
          font-size: 24px;
          font-weight: 700;
          margin: 0;
          letter-spacing: -0.02em;
        }
        .unlisted-badge {
          background: #3f3f46;
          color: #a1a1aa;
          font-size: 11px;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 12px;
          text-transform: uppercase;
        }
        .photo-description {
          color: #a1a1aa;
          font-size: 15px;
          line-height: 1.6;
          margin: 0;
        }
        .specs-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          background: #09090b;
          border: 1px solid #27272a;
          padding: 16px;
          border-radius: 6px;
        }
        .spec-item {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .spec-icon {
          width: 18px;
          height: 18px;
          color: #6366f1;
          flex-shrink: 0;
        }
        .spec-label {
          font-size: 11px;
          color: #71717a;
          text-transform: uppercase;
          font-weight: 600;
        }
        .spec-value {
          font-size: 13px;
          color: #e4e4e7;
          font-weight: 500;
        }
        .spec-value-group {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 12px;
          color: #a1a1aa;
        }
        .spec-muted {
          font-style: italic;
          color: #52525b;
        }
        .tags-container {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: 4px;
        }
        .tag-icon {
          color: #71717a;
        }
        .tags-list {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }
        .tag-chip {
          background: #27272a;
          color: #818cf8;
          font-size: 12px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 4px;
        }
      `}</style>
    </div>
  );
}
