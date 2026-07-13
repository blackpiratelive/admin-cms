import exifr from "exifr";

export interface ExtractedExif {
  camera?: string | null;
  lens?: string | null;
  iso?: number | null;
  shutterSpeed?: string | null;
  aperture?: string | null;
  focalLength?: string | null;
  takenAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  width?: number | null;
  height?: number | null;
}

function formatShutterSpeed(exposureTime?: number): string | null {
  if (!exposureTime || exposureTime <= 0) return null;
  if (exposureTime >= 1) return `${exposureTime}s`;
  const denominator = Math.round(1 / exposureTime);
  return `1/${denominator}s`;
}

function formatAperture(fNumber?: number): string | null {
  if (!fNumber) return null;
  return `f/${fNumber}`;
}

function formatFocalLength(focalLength?: number): string | null {
  if (!focalLength) return null;
  return `${focalLength}mm`;
}

export async function extractExifMetadata(file: File): Promise<ExtractedExif> {
  try {
    const rawData = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      xmp: true,
      icc: false,
    });

    if (!rawData) {
      return {};
    }

    const make = rawData.Make?.trim() || "";
    let model = rawData.Model?.trim() || "";
    if (make && !model.toLowerCase().includes(make.toLowerCase())) {
      model = `${make} ${model}`;
    }
    const camera = model || make || null;

    const lens = rawData.LensModel?.trim() || rawData.Lens?.trim() || rawData.LensInfo?.trim() || null;
    const iso = rawData.ISO ? Number(rawData.ISO) : null;
    const shutterSpeed = formatShutterSpeed(rawData.ExposureTime);
    const aperture = formatAperture(rawData.FNumber);
    const focalLength = formatFocalLength(rawData.FocalLength);

    let takenAt: string | null = null;
    const rawDate = rawData.DateTimeOriginal || rawData.CreateDate || rawData.ModifyDate;
    if (rawDate instanceof Date && !isNaN(rawDate.getTime())) {
      takenAt = rawDate.toISOString();
    } else if (typeof rawDate === "string") {
      const parsedDate = new Date(rawDate);
      if (!isNaN(parsedDate.getTime())) {
        takenAt = parsedDate.toISOString();
      }
    }

    let latitude: number | null = null;
    let longitude: number | null = null;
    if (typeof rawData.latitude === "number" && typeof rawData.longitude === "number") {
      latitude = rawData.latitude;
      longitude = rawData.longitude;
    }

    const width = rawData.ExifImageWidth || rawData.ImageWidth || null;
    const height = rawData.ExifImageHeight || rawData.ImageHeight || null;

    return {
      camera,
      lens,
      iso,
      shutterSpeed,
      aperture,
      focalLength,
      takenAt,
      latitude,
      longitude,
      width,
      height,
    };
  } catch (err) {
    console.warn("Failed to extract EXIF metadata from file:", err);
    return {};
  }
}
