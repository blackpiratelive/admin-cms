export interface ProcessedDerivatives {
  thumbnailBlob: Blob;
  mediumBlob: Blob;
  largeBlob: Blob;
  originalBlob: Blob;
  width: number;
  height: number;
}

export type WorkerStage =
  | "DECODING"
  | "GENERATING_THUMBNAIL"
  | "GENERATING_MEDIUM"
  | "GENERATING_LARGE"
  | "DONE"
  | "ERROR";

export interface WorkerProgressMessage {
  id: string;
  stage: WorkerStage;
  progress: number;
  result?: ProcessedDerivatives;
  error?: string;
}

const workerScriptCode = `
self.onmessage = async (e) => {
  const { id, file } = e.data;

  function postStatus(stage, progress, result, error) {
    self.postMessage({ id, stage, progress, result, error });
  }

  try {
    postStatus("DECODING", 10, null, null);
    const bitmap = await createImageBitmap(file);
    const origWidth = bitmap.width;
    const origHeight = bitmap.height;

    async function generateDerivative(maxWidth, quality) {
      let width = origWidth;
      let height = origHeight;

      if (origWidth > maxWidth) {
        width = maxWidth;
        height = Math.round(origHeight * (maxWidth / origWidth));
      }

      if (typeof OffscreenCanvas !== "undefined") {
        const canvas = new OffscreenCanvas(width, height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Could not get 2d context on OffscreenCanvas");
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(bitmap, 0, 0, width, height);

        const blob = await canvas.convertToBlob({ type: "image/webp", quality });
        return blob;
      } else {
        throw new Error("OffscreenCanvas is not supported in this environment");
      }
    }

    // 1. Generate Thumbnail (max width 500px, WebP, quality 0.8)
    postStatus("GENERATING_THUMBNAIL", 30, null, null);
    const thumbnailBlob = await generateDerivative(500, 0.80);

    // 2. Generate Medium (max width 1600px, WebP, quality 0.85)
    postStatus("GENERATING_MEDIUM", 60, null, null);
    const mediumBlob = await generateDerivative(1600, 0.85);

    // 3. Generate Large (max width 2560px, WebP, quality 0.90)
    postStatus("GENERATING_LARGE", 85, null, null);
    const largeBlob = await generateDerivative(2560, 0.90);

    bitmap.close();

    postStatus("DONE", 100, {
      thumbnailBlob,
      mediumBlob,
      largeBlob,
      originalBlob: file,
      width: origWidth,
      height: origHeight,
    }, null);

  } catch (err) {
    postStatus("ERROR", 0, null, err ? (err.message || String(err)) : "Image processing failed");
  }
};
`;

export function processImageWithWorker(
  id: string,
  file: File,
  onProgress: (msg: WorkerProgressMessage) => void
): Promise<ProcessedDerivatives> {
  return new Promise((resolve, reject) => {
    try {
      const blob = new Blob([workerScriptCode], { type: "application/javascript" });
      const workerUrl = URL.createObjectURL(blob);
      const worker = new Worker(workerUrl);

      worker.onmessage = (e: MessageEvent<WorkerProgressMessage>) => {
        const msg = e.data;
        onProgress(msg);

        if (msg.stage === "DONE" && msg.result) {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          resolve(msg.result);
        } else if (msg.stage === "ERROR") {
          worker.terminate();
          URL.revokeObjectURL(workerUrl);
          reject(new Error(msg.error || "Web Worker processing error"));
        }
      };

      worker.onerror = (err) => {
        worker.terminate();
        URL.revokeObjectURL(workerUrl);
        reject(err);
      };

      worker.postMessage({ id, file });
    } catch (err) {
      reject(err);
    }
  });
}
