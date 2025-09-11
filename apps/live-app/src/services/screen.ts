/**
 * Manages screen sharing capture and image processing
 */
export interface ScreenManagerConfig {
  width: number;
  quality: number; // 0-1
  onStop?: () => void;
}

export class ScreenManager {
  private config: ScreenManagerConfig;

  private stream: MediaStream | null;
  private videoElement: HTMLVideoElement | null;
  private canvas: HTMLCanvasElement | null;
  private ctx: CanvasRenderingContext2D | null;
  private isInitialized: boolean;
  private aspectRatio: number | null;
  private previewContainer: HTMLElement | null;

  /**
   * @param config
   * - width: Target width for resizing captured images
   * - quality: JPEG quality (0-1)
   * - onStop: Callback when screen sharing stops
   */
  constructor(config: Partial<ScreenManagerConfig>) {
    this.config = {
      width: config.width ?? 1280,
      quality: config.quality ?? 0.8,
      onStop: config.onStop,
    } as ScreenManagerConfig;

    this.stream = null;
    this.videoElement = null;
    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    this.aspectRatio = null;
    this.previewContainer = null;
  }

  /**
   * Show the screen preview
   */
  showPreview(): void {
    if (this.previewContainer) {
      this.previewContainer.style.display = "block";
    }
  }

  /**
   * Hide the screen preview
   */
  hidePreview(): void {
    if (this.previewContainer) {
      this.previewContainer.style.display = "none";
    }
  }

  /**
   * Initialize screen capture stream and canvas
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Get available screen sources using native desktopCapturer
      const sources = await window.electronAPI.getScreenSources();

      // Find the primary screen source (prioritized by our GET_SOURCES handler)
      // Filter to only screen sources to avoid capturing individual windows
      const screenSources = sources.filter(source => source.id.startsWith('screen:'));
      
      if (screenSources.length === 0) {
        throw new Error("No screen sources available - only window sources found");
      }

      // Use the first screen source (which should be the primary display due to our ordering)
      const source = screenSources[0];
      
      console.log(`Screen capture initialized with source: ${source.name} (${source.id})`);
      
      if (!source) {
        throw new Error("No screen sources available");
      }

      // Request screen sharing using the source ID
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: (source as any).id,
            minWidth: 1280,
            maxWidth: 4096,
            minHeight: 720,
            maxHeight: 2160,
          },
        } as any,
      });

      // Create and setup video element
      this.videoElement = document.createElement("video");
      this.videoElement.srcObject = this.stream;
      this.videoElement.playsInline = true;

      // Add video to preview container
      const previewContainer = document.getElementById("screenPreview");
      if (previewContainer) {
        previewContainer.appendChild(this.videoElement);
        this.previewContainer = previewContainer;
        this.showPreview(); // Show preview when initialized
      }

      await this.videoElement.play();

      // Get the actual video dimensions
      const videoWidth = this.videoElement.videoWidth;
      const videoHeight = this.videoElement.videoHeight;
      this.aspectRatio = videoHeight / videoWidth;

      // Calculate canvas size maintaining aspect ratio (no upscaling)
      const canvasWidth = Math.min(this.config.width, videoWidth);
      const canvasHeight = Math.round(canvasWidth * this.aspectRatio);

      // Create canvas for image processing
      this.canvas = document.createElement("canvas");
      this.canvas.width = canvasWidth;
      this.canvas.height = canvasHeight;
      this.ctx = this.canvas.getContext("2d");
      if (this.ctx) {
        this.ctx.imageSmoothingEnabled = true;
        // @ts-ignore: imageSmoothingQuality is supported in modern browsers
        this.ctx.imageSmoothingQuality = "high";
      }

      // Listen for the end of screen sharing
      this.stream.getVideoTracks()[0].addEventListener("ended", () => {
        this.dispose();
        // Notify parent component that sharing has stopped
        if (this.config.onStop) {
          this.config.onStop();
        }
      });

      this.isInitialized = true;
    } catch (error: any) {
      throw new Error(`Failed to initialize screen capture: ${error.message}`);
    }
  }

  /**
   * Update capture quality at runtime
   */
  setQuality(width: number, quality: number): void {
    this.config.width = width;
    this.config.quality = Math.max(0, Math.min(1, quality));
    if (this.isInitialized && this.videoElement) {
      // Recompute canvas dimensions without upscaling
      const videoWidth = this.videoElement.videoWidth;
      const videoHeight = this.videoElement.videoHeight;
      this.aspectRatio = videoHeight / videoWidth;
      const canvasWidth = Math.min(this.config.width, videoWidth);
      const canvasHeight = Math.round(canvasWidth * this.aspectRatio);
      if (this.canvas) {
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
      }
    }
  }

  /**
   * Get current canvas dimensions
   */
  getDimensions(): { width: number; height: number } {
    if (!this.isInitialized) {
      throw new Error("Screen capture not initialized. Call initialize() first.");
    }
    return {
      width: this.canvas!.width,
      height: this.canvas!.height,
    };
  }

  /**
   * Capture and process a screenshot
   * @returns Base64 encoded JPEG image
   */
  async capture(): Promise<string> {
    if (!this.isInitialized) {
      throw new Error("Screen capture not initialized. Call initialize() first.");
    }

    // Draw current video frame to canvas, maintaining aspect ratio
    this.ctx!.drawImage(this.videoElement as HTMLVideoElement, 0, 0, this.canvas!.width, this.canvas!.height);

    // Convert to base64 JPEG with specified quality
    return this.canvas!.toDataURL("image/jpeg", this.config.quality).split(",")[1];
  }

  /**
   * Stop screen capture and cleanup resources
   */
  dispose(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.videoElement) {
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    if (this.previewContainer) {
      this.hidePreview();
      this.previewContainer.innerHTML = ""; // Clear the preview container
      this.previewContainer = null;
    }

    this.canvas = null;
    this.ctx = null;
    this.isInitialized = false;
    this.aspectRatio = null;
  }
}


