export const fps = 10;
export const captureInterval = 1000 / fps;
export const resizeWidth = 1280;
export const quality = 0.95;

// Video quality presets for future user selection
export type VideoQualityPreset = "low" | "medium" | "high";

export const videoQualityPresets: Record<VideoQualityPreset, { width: number; quality: number }> = {
  low: { width: 640, quality: 0.8 },
  medium: { width: 1280, quality: 0.95 },
  high: { width: 1920, quality: 0.98 },
};

export const defaultVideoQualityPreset: VideoQualityPreset = "medium";
