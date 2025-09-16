import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { geminiAI } from "../index";

// Core modules
import { StatusManager } from "./core/status-manager";
import { FileUtils } from "./core/file-utils";
import { GeminiClient } from "./core/gemini-client";

// Processors
import { ImageProcessor } from "./processors/image-processor";
import { TextProcessor } from "./processors/text-processor";
import { PdfProcessor } from "./processors/pdf-processor";
import { AudioVideoProcessor } from "./processors/audio-video-processor";
import { processYouTubeVideo } from "./processors/youtube-processor";
import { processWebpage } from "./processors/webpage-processor";

// Types
import {
  ParentFileStatus,
  FileProcessingStatus,
  FileFinderOptions,
  SelectedFile,
  YouTubeVideoData,
  PageData,
  statusType,
} from "./types";

export class FileProcessingService {
  private baseDir: string;
  private mainWindow: any;
  private paused: boolean = false;
  private llmConnectionState: boolean = false;

  // Core modules
  private statusManager: StatusManager;
  private fileUtils: FileUtils;
  private geminiClient: GeminiClient;

  // Processors
  private imageProcessor: ImageProcessor;
  private textProcessor: TextProcessor;
  private pdfProcessor: PdfProcessor;
  private audioVideoProcessor: AudioVideoProcessor;

  constructor() {
    this.baseDir = path.join(os.homedir(), ".neutralbase");
    this.ensureBaseDir();

    // Initialize core modules
    this.statusManager = new StatusManager(this.baseDir, this.mainWindow);
    this.fileUtils = new FileUtils(this.baseDir);
    this.geminiClient = new GeminiClient(geminiAI);

    // Initialize processors
    this.imageProcessor = new ImageProcessor();
    this.textProcessor = new TextProcessor();
    this.pdfProcessor = new PdfProcessor();
    this.audioVideoProcessor = new AudioVideoProcessor();
  }

  // =====================================================================
  // Section: Construction & Setup
  // =====================================================================
  setMainWindow(mainWindow: any): void {
    this.mainWindow = mainWindow;
    this.statusManager.setMainWindow(mainWindow);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
  }

  isPaused(): boolean {
    return this.paused;
  }

  setLlmConnectionState(connected: boolean): void {
    this.llmConnectionState = connected;
  }

  isLlmConnected(): boolean {
    return this.llmConnectionState;
  }

  private ensureBaseDir(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  // =====================================================================
  // Section: Processing Orchestrators
  // =====================================================================
  async processFiles(files: SelectedFile[]): Promise<void> {
    const expandedFiles = this.fileUtils.expandDirectoriesOneLevel(files);

    console.log(
      `📁 [FILE PROCESSING] Starting processing of ${expandedFiles.length} files`,
    );

    const processingPromises = expandedFiles.map((file) =>
      this.processFile(file).catch((error) =>
        console.error(
          `📁 [FILE PROCESSING] Error processing ${file.name}${file.extension}:`,
          error,
        ),
      ),
    );
    await Promise.all(processingPromises);
  }

  private async processFile(file: SelectedFile): Promise<void> {
    const fileId = this.fileUtils.generateFileId(file.path);
    const fileType = this.fileUtils.determineFileType(file.extension);

    console.log(
      `📁 [FILE PROCESSING] Processing ${file.name}${file.extension} (ID: ${fileId}, Type: ${fileType})`,
    );

    await this.statusManager.updateParentStatus((parentStatus) => {
      if (!parentStatus.files[fileId]) {
        const newStatus = this.statusManager.createInitialFileStatus(file, (path) => this.fileUtils.generateFileId(path));
        this.statusManager.saveFileStatus(newStatus);
        parentStatus.files[fileId] = newStatus;
        parentStatus.totalFiles++;
      }
      parentStatus.processingFiles++;
    });

    const status = this.statusManager.loadFileStatus(fileId);
    if (!status) {
      console.error(
        `Failed to load status for file that should exist: ${fileId}`,
      );
      return;
    }

    try {
      // Create context for processors
      const context = this.createFileProcessorContext();

      // Process based on file type
      switch (fileType) {
      case "image":
        await this.imageProcessor.process(context, file);
        break;
      case "text":
        await this.textProcessor.process(context, file);
        break;
      case "pdf":
        await this.pdfProcessor.process(context, file);
        break;
      case "audio":
      case "video":
        await this.audioVideoProcessor.process(context, file);
        break;
      default:
        console.warn(
          `📁 [FILE PROCESSING] Unsupported file type: ${fileType}`,
        );
        this.statusManager.updateFileStatus(status, "summaryFile", "skipped");
        break;
      }

      const updatedStatus = this.statusManager.loadFileStatus(fileId);
      if (updatedStatus) {
        await this.statusManager.updateParentStatus((parentStatus) => {
          parentStatus.processingFiles--;
          if (updatedStatus.overallStatus === "completed") {
            parentStatus.completedFiles++;
          } else if (
            updatedStatus.overallStatus === "error" ||
            updatedStatus.overallStatus === "partial"
          ) {
            parentStatus.errorFiles++;
          }
          parentStatus.files[fileId] = updatedStatus;
        });
      }
    } catch (error) {
      console.error(
        `📁 [FILE PROCESSING] Error processing ${file.name}${file.extension}:`,
        error,
      );
      status.overallStatus = "error";
      this.statusManager.saveFileStatus(status);

      await this.statusManager.updateParentStatus((parentStatus) => {
        parentStatus.processingFiles--;
        parentStatus.errorFiles++;
        parentStatus.files[fileId] = status;
      });
    }
  }

  // =====================================================================
  // Section: Context Creation
  // =====================================================================
  private createFileProcessorContext() {
    return {
      baseDir: this.baseDir,
      geminiAI,
      mainWindow: this.mainWindow,
      isPaused: () => this.isPaused(),
      isLlmConnected: () => this.isLlmConnected(),
      loadFileStatus: (fileId: string) => this.statusManager.loadFileStatus(fileId),
      saveFileStatus: (status: FileProcessingStatus) => this.statusManager.saveFileStatus(status),
      updateFileStatus: (status: FileProcessingStatus, fileType: any, newStatus: statusType, filePath?: string, error?: string) =>
        this.statusManager.updateFileStatus(status, fileType, newStatus, filePath, error),
      updateParentStatus: (updateFn: (status: ParentFileStatus) => void) => this.statusManager.updateParentStatus(updateFn),
      getRelevantFilesForType: (fileType: any) => this.statusManager.getRelevantFilesForType(fileType),
      getAvailableContentTypes: (fileType: any) => this.fileUtils.getAvailableContentTypes(fileType),
      generateFileId: (filePath: string) => this.fileUtils.generateFileId(filePath),
      uploadFileToGemini: (filePath: string) => this.geminiClient.uploadFileToGemini(filePath),
      deleteGeminiFile: (name: string) => this.geminiClient.deleteGeminiFile(name),
      createInitialFileStatus: (file: SelectedFile) => this.statusManager.createInitialFileStatus(file, (path) => this.fileUtils.generateFileId(path)),
    };
  }

  private createExternalProcessorContext() {
    return {
      baseDir: this.baseDir,
      geminiAI,
      mainWindow: this.mainWindow,
      isPaused: () => this.isPaused(),
      isLlmConnected: () => this.isLlmConnected(),
      loadFileStatus: (fileId: string) => this.statusManager.loadFileStatus(fileId),
      saveFileStatus: (status: FileProcessingStatus) => this.statusManager.saveFileStatus(status),
      updateFileStatus: (status: FileProcessingStatus, fileType: any, newStatus: statusType, filePath?: string, error?: string) =>
        this.statusManager.updateFileStatus(status, fileType, newStatus, filePath, error),
      updateParentStatus: (updateFn: (status: ParentFileStatus) => void) => this.statusManager.updateParentStatus(updateFn),
      getRelevantFilesForType: (fileType: any) => this.statusManager.getRelevantFilesForType(fileType),
      getAvailableContentTypes: (fileType: any) => this.fileUtils.getAvailableContentTypes(fileType),
      generateYoutubeFileId: (videoId: string) => this.fileUtils.generateYoutubeFileId(videoId),
      generateWebpageFileId: (url: string) => this.fileUtils.generateWebpageFileId(url),
    };
  }

  // =====================================================================
  // Section: External Sources Processing
  // =====================================================================
  async processYouTubeVideo(youtubeData: YouTubeVideoData): Promise<void> {
    await processYouTubeVideo(this.createExternalProcessorContext(), youtubeData);
  }

  async processTabData(tabData: PageData): Promise<void> {
    await processWebpage(this.createExternalProcessorContext(), tabData);
  }

  // =====================================================================
  // Section: Public API (Tool Access)
  // =====================================================================
  getParentStatus(): ParentFileStatus {
    return this.statusManager.loadParentStatus();
  }

  getDirectoryContents(options: FileFinderOptions): string[] | { error: string } {
    return this.fileUtils.getDirectoryContents(options, () => this.statusManager.loadParentStatus());
  }

  getFileStatus(options: FileFinderOptions): FileProcessingStatus | { error: string } {
    const fileId = this.fileUtils.findFileId(options, () => this.statusManager.loadParentStatus());
    if (!fileId) {
      return {
        error: "File with fileId, not found with the provided options.",
      };
    }
    const status = this.statusManager.loadFileStatus(fileId);
    if (!status) {
      return { error: `Status file not found for fileId ${fileId}.` };
    }
    return status;
  }

  getFileContent(options: FileFinderOptions, contentType: string): string | { error: string } {
    return this.fileUtils.getFileContent(
      options,
      contentType,
      () => this.statusManager.loadParentStatus(),
      (fileId: string) => this.statusManager.loadFileStatus(fileId)
    );
  }

  listProcessedFiles(): Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    status: string;
    availableContent: string[];
  }> {
    const parentStatus = this.statusManager.loadParentStatus();
    return Object.values(parentStatus.files).map((file) => ({
      fileId: file.fileId,
      fileName: `${file.fileName}${file.fileExtension}`,
      fileType: file.fileType,
      status: file.overallStatus,
      availableContent: this.fileUtils.getAvailableContentTypes(file.fileType),
    }));
  }

  getActiveTab(): FileProcessingStatus | { error: string } {
    const parentStatus = this.statusManager.loadParentStatus();
    const activeFile = Object.values(parentStatus.files).filter(
      (f) => f.activeTab,
    );

    if (activeFile.length === 0) {
      return { error: "No active tab found." };
    }

    if (activeFile.length === 1) {
      return activeFile[0];
    }

    if (activeFile.length > 1) {
      activeFile.sort(
        (a, b) =>
          new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime(),
      );
      return activeFile[0];
    }

    return { error: "Unexpected state in getActiveTab" };
  }

  getFilesInContext(): FileProcessingStatus[] {
    // Context is now managed locally in the renderer process
    return [];
  }

  // =====================================================================
  // Section: Other Operations
  // =====================================================================
  async createDataVariants(): Promise<void> {
    console.log(
      "Creating Data Variants for final merged video (media directory)...",
    );
    const mediaDir = path.join(this.baseDir, "media");
    const finalVideoPath = path.join(mediaDir, "final-movie-complete.mp4");
    const nowIso = new Date().toISOString();

    const statusFilePath = path.join(
      mediaDir,
      "final-movie-complete.variants.status.json",
    );

    type VariantStatus = {
      status: statusType;
      lastUpdated: string;
      filePath?: string;
      error?: string;
    };
    type MediaVariantsStatus = {
      target: string;
      fileType: "video";
      createdAt: string;
      lastUpdated: string;
      overallStatus:
        | "pending"
        | "processing"
        | "completed"
        | "partial"
        | "error";
      summary: VariantStatus;
      transcript: VariantStatus;
      transcript_with_timestamps: VariantStatus;
    };

    const writeStatus = (s: MediaVariantsStatus) => {
      s.lastUpdated = new Date().toISOString();
      fs.writeFileSync(statusFilePath, JSON.stringify(s, null, 2));
    };

    const statusObj: MediaVariantsStatus = {
      target: finalVideoPath,
      fileType: "video",
      createdAt: nowIso,
      lastUpdated: nowIso,
      overallStatus: "pending",
      summary: { status: "pending", lastUpdated: nowIso },
      transcript: { status: "pending", lastUpdated: nowIso },
      transcript_with_timestamps: { status: "pending", lastUpdated: nowIso },
    };

    try {
      if (!fs.existsSync(finalVideoPath)) {
        const message = `final-movie-complete.mp4 not found at ${finalVideoPath}. Please run Merge Audio & Video first.`;
        console.error(message);
        statusObj.overallStatus = "error";
        statusObj.summary = {
          status: "skipped",
          lastUpdated: nowIso,
          error: message,
        };
        statusObj.transcript = {
          status: "skipped",
          lastUpdated: nowIso,
          error: message,
        };
        statusObj.transcript_with_timestamps = {
          status: "skipped",
          lastUpdated: nowIso,
          error: message,
        };
        writeStatus(statusObj);
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          if (!this.isPaused()) {
            this.mainWindow.webContents.send(
              "sendMessageToClient",
              `SYSTEM NOTIFICATION:\\n${message}`,
            );
          }
        }
        return;
      }

      statusObj.overallStatus = "processing";
      statusObj.summary.status = "processing";
      statusObj.transcript.status = "processing";
      statusObj.transcript_with_timestamps.status = "processing";
      writeStatus(statusObj);

      const { processedFile, uploadedName } = await this.geminiClient.uploadFileToGemini(finalVideoPath);

      const summaryPromise = (async () => {
        try {
          const res = await this.geminiClient.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Extract the summary of the video. Focus on key actions, decisions, and outcomes.`,
                  },
                  {
                    fileData: {
                      mimeType: processedFile.mimeType,
                      fileUri: processedFile.uri,
                    },
                  },
                ],
              },
            ],
          });
          const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error("Failed to get summary from Gemini response");
          }
          const outPath = path.join(
            mediaDir,
            "final-movie-complete.summary.txt",
          );
          fs.writeFileSync(outPath, text);
          statusObj.summary = {
            status: "completed",
            lastUpdated: new Date().toISOString(),
            filePath: outPath,
          };
        } catch (e) {
          statusObj.summary = {
            status: "error",
            lastUpdated: new Date().toISOString(),
            error: e instanceof Error ? e.message : "Unknown error",
          };
        } finally {
          writeStatus(statusObj);
        }
      })();

      const transcriptPromise = (async () => {
        try {
          const res = await this.geminiClient.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Extract the transcript of the video (verbatim where possible).`,
                  },
                  {
                    fileData: {
                      mimeType: processedFile.mimeType,
                      fileUri: processedFile.uri,
                    },
                  },
                ],
              },
            ],
          });
          const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error("Failed to get transcript from Gemini response");
          }
          const outPath = path.join(
            mediaDir,
            "final-movie-complete.transcript.txt",
          );
          fs.writeFileSync(outPath, text);
          statusObj.transcript = {
            status: "completed",
            lastUpdated: new Date().toISOString(),
            filePath: outPath,
          };
        } catch (e) {
          statusObj.transcript = {
            status: "error",
            lastUpdated: new Date().toISOString(),
            error: e instanceof Error ? e.message : "Unknown error",
          };
        } finally {
          writeStatus(statusObj);
        }
      })();

      const transcriptTsPromise = (async () => {
        try {
          const res = await this.geminiClient.generateContent({
            model: "gemini-2.5-flash",
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `Extract the transcript of the video with timestamps per utterance.`,
                  },
                  {
                    fileData: {
                      mimeType: processedFile.mimeType,
                      fileUri: processedFile.uri,
                    },
                  },
                ],
              },
            ],
          });
          const text = res.candidates?.[0]?.content?.parts?.[0]?.text;
          if (!text) {
            throw new Error(
              "Failed to get transcript with timestamps from Gemini response",
            );
          }
          const outPath = path.join(
            mediaDir,
            "final-movie-complete.transcript_with_timestamps.txt",
          );
          fs.writeFileSync(outPath, text);
          statusObj.transcript_with_timestamps = {
            status: "completed",
            lastUpdated: new Date().toISOString(),
            filePath: outPath,
          };
        } catch (e) {
          statusObj.transcript_with_timestamps = {
            status: "error",
            lastUpdated: new Date().toISOString(),
            error: e instanceof Error ? e.message : "Unknown error",
          };
        } finally {
          writeStatus(statusObj);
        }
      })();

      await Promise.all([
        summaryPromise,
        transcriptPromise,
        transcriptTsPromise,
      ]);

      const statuses: statusType[] = [
        statusObj.summary.status as statusType,
        statusObj.transcript.status as statusType,
        statusObj.transcript_with_timestamps.status as statusType,
      ];
      const allCompleted = statuses.every((s) => s === "completed");
      const anyError = statuses.includes("error");
      const anyCompleted = statuses.includes("completed");
      if (allCompleted) {
        statusObj.overallStatus = "completed";
      } else if (anyError) {
        statusObj.overallStatus = anyCompleted ? "partial" : "error";
      } else {
        statusObj.overallStatus = "processing";
      }
      writeStatus(statusObj);

      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        if (!this.isPaused()) {
          this.mainWindow.webContents.send(
            "sendMessageToClient",
            `SYSTEM NOTIFICATION:\\nFinal movie variants generated in media directory. Status file: ${statusFilePath}`,
          );
        }
      }
      await this.geminiClient.deleteGeminiFile(uploadedName);
    } catch (error) {
      console.error(
        "Error creating data variants for final movie (media):",
        error,
      );
      try {
        const finalStatus = fs.existsSync(statusFilePath)
          ? (JSON.parse(fs.readFileSync(statusFilePath, "utf8")) as any)
          : undefined;
        if (finalStatus) {
          finalStatus.overallStatus = "error";
          finalStatus.lastUpdated = new Date().toISOString();
          fs.writeFileSync(
            statusFilePath,
            JSON.stringify(finalStatus, null, 2),
          );
        }
      } catch {
        // ignore
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        if (!this.isPaused()) {
          this.mainWindow.webContents.send(
            "sendMessageToClient",
            `SYSTEM NOTIFICATION:\\nFailed to create data variants for final movie: ${errMsg}`,
          );
        }
      }
    }
  }

  // =====================================================================
  // Section: Cleanup on App Shutdown
  // =====================================================================
  async cleanupIncompleteProcessing(): Promise<void> {
    console.log("🧹 Starting cleanup of incomplete file processing...");

    try {
      const parentStatus = this.statusManager.loadParentStatus();
      const filesToCleanup: string[] = [];

      for (const [fileId, fileStatus] of Object.entries(parentStatus.files)) {
        if (fileStatus.overallStatus !== "completed") {
          filesToCleanup.push(fileId);
          console.log(
            `🗑️  Marking for cleanup: ${fileStatus.fileName} (${fileStatus.overallStatus})`,
          );
        }
      }

      if (filesToCleanup.length === 0) {
        console.log("✨ No incomplete files found. Cleanup complete.");
        return;
      }

      let cleanedCount = 0;
      for (const fileId of filesToCleanup) {
        const fileStatus = parentStatus.files[fileId];

        delete parentStatus.files[fileId];

        const fileDir = path.join(this.baseDir, fileId);
        if (fs.existsSync(fileDir)) {
          try {
            fs.rmSync(fileDir, { recursive: true, force: true });
            console.log(`🗂️  Deleted directory: ${fileDir}`);
            cleanedCount++;
          } catch (error) {
            console.error(`❌ Failed to delete directory ${fileDir}:`, error);
          }
        }

        console.log(
          `🧽 Cleaned up: ${fileStatus.fileName} (${fileStatus.overallStatus})`,
        );
      }

      const remainingFiles = Object.values(parentStatus.files);
      parentStatus.totalFiles = remainingFiles.length;
      parentStatus.completedFiles = remainingFiles.filter(
        (f) => f.overallStatus === "completed",
      ).length;
      parentStatus.processingFiles = remainingFiles.filter(
        (f) => f.overallStatus === "processing",
      ).length;
      parentStatus.errorFiles = remainingFiles.filter(
        (f) => f.overallStatus === "error",
      ).length;

      this.statusManager.saveParentStatus(parentStatus);

      console.log(
        `✅ Cleanup complete: Removed ${cleanedCount} incomplete files and their directories`,
      );
      console.log(
        `📊 Remaining files: ${parentStatus.totalFiles} (${parentStatus.completedFiles} completed)`,
      );
    } catch (error) {
      console.error("❌ Error during cleanup of incomplete processing:", error);
    }
  }
}

// Singleton instance
let fileProcessingService: FileProcessingService | null = null;

export function getFileProcessingService(): FileProcessingService {
  if (!fileProcessingService) {
    fileProcessingService = new FileProcessingService();
  }
  return fileProcessingService;
}