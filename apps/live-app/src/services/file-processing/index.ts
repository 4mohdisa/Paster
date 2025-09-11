import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { File as GeminiFile } from "@google/genai";

import { fps } from "../../constants/screen-recorder";
import { geminiAI } from "../../index";

// Media helpers (moderate breakdown, no API changes)
import { processWebpage as externalProcessWebpage } from "./external/webpage";
import { processYouTubeVideo as externalProcessYouTubeVideo } from "./external/youtube";
import {
  saveUserAudioChunkLocally as mediaSaveUserAudioChunkLocally,
  saveLlmAudioChunkLocally as mediaSaveLlmAudioChunkLocally,
  stitchAudioChunks as mediaStitchUserAudio,
  stitchLlmAudioChunks as mediaStitchLlmAudio,
} from "./media/audio";
import { getMediaDuration as mediaGetDuration } from "./media/common";
import { runTimelineMerge } from "./media/merge";
import {
  getVideoFrameSize as mediaGetVideoFrameSize,
  generateBlackFrame as mediaGenerateBlackFrame,
} from "./media/video";
import { stitchVideoFrames as mediaStitchVideoFrames } from "./media/video-stitch";
import {
  ParentFileStatus,
  FileProcessingStatus,
  FileFinderOptions,
  PageData,
  FileType,
  SelectedFile,
  YouTubeVideoData,
  statusType,
} from "./types";

// Export MP3 flag for testing purposes
const exportMp3 = true; // Set to true to export final audio files as MP3 for testing

// Cleanup flag for debugging purposes
const deleteStitchedFiles = true; // Set to false to keep intermediate stitched files for debugging

// File extension mappings
const textExtensions = [".txt", ".md", ".json", ".csv", ".xml", ".html"];
const pdfExtensions = [".pdf"];
const audioExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

export class FileProcessingService {
  private baseDir: string;
  private mainWindow: any; // Will be injected
  private parentStatusUpdateQueue: Promise<void> = Promise.resolve();
  private paused: boolean = false;
  private llmConnectionState: boolean = false;

  // =====================================================================
  // Section: Construction & Setup
  // ---------------------------------------------------------------------
  // - constructor
  // - setMainWindow
  // - ensureBaseDir
  // =====================================================================
  constructor() {
    this.baseDir = path.join(os.homedir(), ".neutralbase");
    this.ensureBaseDir();
  }

  // baseDir is fixed to the user's home directory under .neutralbase

  setMainWindow(mainWindow: any): void {
    this.mainWindow = mainWindow;
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
  // Section: Status Orchestration
  // ---------------------------------------------------------------------
  // - updateParentStatus
  // =====================================================================
  private updateParentStatus(
    updateFn: (status: ParentFileStatus) => void,
  ): Promise<void> {
    this.parentStatusUpdateQueue = this.parentStatusUpdateQueue.then(() => {
      const status = this.loadParentStatus();
      updateFn(status);
      this.saveParentStatus(status);
    });
    return this.parentStatusUpdateQueue;
  }

  // =====================================================================
  // Section: Identifiers & File Types
  // ---------------------------------------------------------------------
  // - generateFileId / generateYoutubeFileId / generateWebpageFileId
  // - determineFileType / getAvailableContentTypes / getRelevantFilesForType
  // =====================================================================
  private generateFileId(filePath: string): string {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(fileContent).digest("hex");
  }

  private generateYoutubeFileId(videoId: string): string {
    return crypto.createHash("md5").update(videoId).digest("hex");
  }

  private generateWebpageFileId(url: string): string {
    return crypto.createHash("md5").update(url).digest("hex");
  }

  private determineFileType(extension: string): FileType {
    if (imageExtensions.includes(extension)) return "image";
    if (textExtensions.includes(extension)) return "text";
    if (pdfExtensions.includes(extension)) return "pdf";
    if (audioExtensions.includes(extension)) return "audio";
    if (videoExtensions.includes(extension)) return "video";
    return "document";
  }

  // =====================================================================
  // Section: Persistence (Parent/File Status)
  // ---------------------------------------------------------------------
  // - getParentStatusPath / getFileStatusPath
  // - loadParentStatus / saveParentStatus
  // - loadFileStatus / saveFileStatus
  // - updateFileStatus / updateOverallStatus
  // =====================================================================
  private getParentStatusPath(): string {
    return path.join(this.baseDir, "status.json");
  }

  private getFileStatusPath(fileId: string): string {
    return path.join(this.baseDir, fileId, "status.json");
  }

  private loadParentStatus(): ParentFileStatus {
    const statusPath = this.getParentStatusPath();
    if (fs.existsSync(statusPath)) {
      try {
        const data = fs.readFileSync(statusPath, "utf8");
        return JSON.parse(data);
      } catch (error) {
        console.error("Error loading parent status:", error);
      }
    }
    return {
      files: {},
      totalFiles: 0,
      completedFiles: 0,
      processingFiles: 0,
      errorFiles: 0,
      lastUpdated: new Date().toISOString(),
    };
  }

  private saveParentStatus(status: ParentFileStatus): void {
    try {
      status.lastUpdated = new Date().toISOString();
      fs.writeFileSync(
        this.getParentStatusPath(),
        JSON.stringify(status, null, 2),
      );
      
      // Notify renderer about status file update
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send("status-file-updated");
      }
    } catch (error) {
      console.error("Error saving parent status:", error);
    }
  }

  private loadFileStatus(fileId: string): FileProcessingStatus | null {
    const statusPath = this.getFileStatusPath(fileId);
    if (fs.existsSync(statusPath)) {
      try {
        const data = fs.readFileSync(statusPath, "utf8");
        return JSON.parse(data);
      } catch (error) {
        console.error(`Error loading file status for ${fileId}:`, error);
      }
    }
    return null;
  }

  private saveFileStatus(status: FileProcessingStatus): void {
    const fileDir = path.join(this.baseDir, status.fileId);
    if (!fs.existsSync(fileDir)) {
      fs.mkdirSync(fileDir, { recursive: true });
    }

    try {
      status.lastUpdated = new Date().toISOString();
      fs.writeFileSync(
        this.getFileStatusPath(status.fileId),
        JSON.stringify(status, null, 2),
      );
    } catch (error) {
      console.error(`Error saving file status for ${status.fileId}:`, error);
    }
  }

  // =====================================================================
  // Section: Public API (Tool Access)
  // ---------------------------------------------------------------------
  // - getParentStatus / getDirectoryContents / getFileStatus / getFileContent
  // - listProcessedFiles / getActiveTab / getFilesInContext
  // =====================================================================
  private createInitialFileStatus(file: SelectedFile): FileProcessingStatus {
    const fileId = this.generateFileId(file.path);
    const fileType = this.determineFileType(file.extension);
    const now = new Date().toISOString();
    const relevantFiles = this.getRelevantFilesForType(fileType);

    const initialStatus: FileProcessingStatus = {
      fileId,
      originalPath: file.path,
      fileName: file.name,
      fileExtension: file.extension,
      fileType,
      summaryFile: { status: "skipped", lastUpdated: now },
      textFile: { status: "skipped", lastUpdated: now },
      descriptionFile: { status: "skipped", lastUpdated: now },
      detailedDescriptionFile: { status: "skipped", lastUpdated: now },
      formattedTextFile: { status: "skipped", lastUpdated: now },
      transcriptFile: { status: "skipped", lastUpdated: now },
      transcriptWithTimestampsFile: { status: "skipped", lastUpdated: now },
      overallStatus: "pending",
      createdAt: now,
      lastUpdated: now,
    };

    for (const key of relevantFiles) {
      initialStatus[key] = { status: "pending", lastUpdated: now };
    }

    return initialStatus;
  }

  private updateFileStatus(
    status: FileProcessingStatus,
    fileType: keyof Pick<
      FileProcessingStatus,
      | "summaryFile"
      | "textFile"
      | "descriptionFile"
      | "transcriptFile"
      | "transcriptWithTimestampsFile"
      | "detailedDescriptionFile"
      | "formattedTextFile"
    >,
    newStatus: statusType,
    filePath?: string,
    error?: string,
  ): void {
    status[fileType] = {
      status: newStatus,
      lastUpdated: new Date().toISOString(),
      filePath,
      error,
    };
    this.updateOverallStatus(status);
  }

  private updateOverallStatus(status: FileProcessingStatus): void {
    const relevantFiles = this.getRelevantFilesForType(status.fileType);
    const fileStatuses = relevantFiles.map((key) => status[key].status);

    if (fileStatuses.every((s) => s === "completed" || s === "skipped")) {
      status.overallStatus = "completed";
    } else if (fileStatuses.some((s) => s === "error")) {
      status.overallStatus = "error";
    } else if (fileStatuses.some((s) => s === "processing")) {
      status.overallStatus = "processing";
    } else if (fileStatuses.some((s) => s === "completed")) {
      status.overallStatus = "partial";
    }
  }

  private getRelevantFilesForType(
    fileType: FileType,
  ): Array<
    keyof Pick<
      FileProcessingStatus,
      | "summaryFile"
      | "textFile"
      | "descriptionFile"
      | "transcriptFile"
      | "transcriptWithTimestampsFile"
      | "detailedDescriptionFile"
      | "formattedTextFile"
    >
  > {
    switch (fileType) {
    case "image":
      return ["descriptionFile"];
    case "text":
      return ["summaryFile", "textFile"];
    case "pdf":
      return ["summaryFile", "textFile"];
    case "audio":
    case "video":
      return [
        "summaryFile",
        "transcriptFile",
        "transcriptWithTimestampsFile",
      ];
    case "youtube":
      return [
        "summaryFile",
        "detailedDescriptionFile",
        "transcriptFile",
        "transcriptWithTimestampsFile",
      ];
    case "webpage":
      return ["summaryFile", "textFile", "formattedTextFile"];
    default:
      return ["summaryFile"];
    }
  }

  private getAvailableContentTypes(fileType: FileType): string[] {
    switch (fileType) {
    case "image":
      return ["description"];
    case "text":
      return ["summary", "text"];
    case "pdf":
      return ["summary", "text"];
    case "audio":
    case "video":
      return ["summary", "transcript", "transcript_with_timestamps"];
    case "youtube":
      return [
        "summary",
        "detailed_description",
        "transcript",
        "transcript_with_timestamps",
      ];
    case "webpage":
      return ["summary", "text", "formatted_text"];
    default:
      return ["summary"];
    }
  }

  // =====================================================================
  // Section: Processing Orchestrators
  // ---------------------------------------------------------------------
  // - uploadFileToGemini
  // - processFiles / processFile
  // =====================================================================
  private async uploadFileToGemini(
    filePath: string,
  ): Promise<{ processedFile: GeminiFile; uploadedName: string }> {
    console.log(`Uploading file to Gemini: ${filePath}...`);
    const uploadedFile = await geminiAI.files.upload({
      file: filePath,
    });

    console.log(
      `Uploaded file '${uploadedFile.name}'. Waiting for processing...`,
    );

    let processedFile = await geminiAI.files.get({ name: uploadedFile.name });
    while (processedFile.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      processedFile = await geminiAI.files.get({ name: uploadedFile.name });
      console.log(`File state: ${processedFile.state}`);
    }

    if (processedFile.state === "FAILED") {
      throw new Error(`File processing failed: ${processedFile.name}`);
    }
    return { processedFile, uploadedName: uploadedFile.name };
  }

  private async deleteGeminiFile(name: string): Promise<void> {
    try {
      await geminiAI.files.delete({ name });
    } catch (error) {
      console.error(`Error deleting Gemini file '${name}':`, error);
    }
  }

  async processFiles(files: SelectedFile[]): Promise<void> {
    // Expand any directories one level deep into files, filter to known types, ignore hidden files
    const expandedFiles = this.expandDirectoriesOneLevel(files);

    console.log(
      `📁 [FILE PROCESSING] Starting processing of ${expandedFiles.length} files`,
    );

    // Process each file in parallel
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
    const fileId = this.generateFileId(file.path);
    const fileType = this.determineFileType(file.extension);

    console.log(
      `📁 [FILE PROCESSING] Processing ${file.name}${file.extension} (ID: ${fileId}, Type: ${fileType})`,
    );

    await this.updateParentStatus((parentStatus) => {
      if (!parentStatus.files[fileId]) {
        const newStatus = this.createInitialFileStatus(file);
        this.saveFileStatus(newStatus);
        parentStatus.files[fileId] = newStatus;
        parentStatus.totalFiles++;
      }
      parentStatus.processingFiles++;
    });

    const status = this.loadFileStatus(fileId);
    if (!status) {
      console.error(
        `Failed to load status for file that should exist: ${fileId}`,
      );
      return;
    }

    try {
      // Process based on file type
      switch (fileType) {
      case "image":
        await this.processImageFile(file, status);
        break;
      case "text":
        await this.processTextFile(file, status);
        break;
      case "pdf":
        await this.processPdfFile(file, status);
        break;
      case "audio":
      case "video":
        await this.processAudioVideoFile(file, status);
        break;
      default:
        console.warn(
          `📁 [FILE PROCESSING] Unsupported file type: ${fileType}`,
        );
        this.updateFileStatus(status, "summaryFile", "skipped");
        break;
      }

      this.saveFileStatus(status);

      await this.updateParentStatus((parentStatus) => {
        parentStatus.processingFiles--;
        if (status.overallStatus === "completed") {
          parentStatus.completedFiles++;
        } else if (
          status.overallStatus === "error" ||
          status.overallStatus === "partial"
        ) {
          parentStatus.errorFiles++;
        }
        parentStatus.files[fileId] = status;
      });
    } catch (error) {
      console.error(
        `📁 [FILE PROCESSING] Error processing ${file.name}${file.extension}:`,
        error,
      );
      status.overallStatus = "error";
      this.saveFileStatus(status);

      await this.updateParentStatus((parentStatus) => {
        parentStatus.processingFiles--;
        parentStatus.errorFiles++;
        parentStatus.files[fileId] = status;
      });
    }
  }

  // =====================================================================
  // Section: Directory Expansion (One Level)
  // ---------------------------------------------------------------------
  // - expandDirectoriesOneLevel / isKnownFileType / isHiddenFile
  // =====================================================================
  private expandDirectoriesOneLevel(files: SelectedFile[]): SelectedFile[] {
    const results: SelectedFile[] = [];
    const seenPaths = new Set<string>();

    const pushIfNotSeen = (f: SelectedFile) => {
      if (!seenPaths.has(f.path)) {
        seenPaths.add(f.path);
        results.push(f);
      }
    };

    for (const item of files) {
      try {
        if (item.type === "directory") {
          const dirPath = item.path;
          if (!fs.existsSync(dirPath)) continue;
          const entries = fs.readdirSync(dirPath, { withFileTypes: true });
          for (const entry of entries) {
            try {
              if (!entry.isFile()) continue; // no recursion
              if (this.isHiddenFile(entry.name)) continue; // ignore hidden

              const fullPath = path.join(dirPath, entry.name);
              const parsed = path.parse(fullPath);
              const extLower = parsed.ext.toLowerCase();
              if (!this.isKnownFileType(extLower)) continue; // only known types

              let size: number | undefined = undefined;
              try {
                const stats = fs.statSync(fullPath);
                size = stats.size;
              } catch {
                // 
              }

              pushIfNotSeen({
                path: fullPath,
                name: parsed.name,
                extension: extLower,
                size,
                type: "file",
              });
            } catch {
              //
            }
          }
        } else if (item.type === "file") {
          // Filter single files by known types and hidden-file rule
          const baseName = path.basename(item.path);
          if (this.isHiddenFile(baseName)) continue;
          const extLower = (
            item.extension || path.parse(item.path).ext
          ).toLowerCase();
          if (!this.isKnownFileType(extLower)) continue;
          pushIfNotSeen({ ...item, extension: extLower, type: "file" });
        }
      } catch (e) {
        console.error(
          "📁 [FILE PROCESSING] Failed to expand entry:",
          item.path,
          e,
        );
      }
    }

    return results;
  }

  private isKnownFileType(extension: string): boolean {
    return (
      imageExtensions.includes(extension) ||
      textExtensions.includes(extension) ||
      pdfExtensions.includes(extension) ||
      audioExtensions.includes(extension) ||
      videoExtensions.includes(extension)
    );
  }

  private isHiddenFile(name: string): boolean {
    return name.startsWith(".");
  }

  // =====================================================================
  // Section: Type-specific Processing
  // ---------------------------------------------------------------------
  // - processImageFile / processTextFile / processPdfFile / processAudioVideoFile
  // =====================================================================
  private async processImageFile(
    file: SelectedFile,
    status: FileProcessingStatus,
  ): Promise<void> {
    this.updateFileStatus(status, "descriptionFile", "processing");
    this.saveFileStatus(status);

    try {
      const { processedFile, uploadedName } = await this.uploadFileToGemini(
        file.path,
      );

      const description = await geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extract the detailed description of the image. Make sure you have all the information from the image in the description summaries do not miss any information.`,
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

      const descriptionText = description.candidates[0].content.parts[0].text;

      // Save description to file
      const descriptionPath = path.join(
        this.baseDir,
        status.fileId,
        "description.txt",
      );
      fs.writeFileSync(descriptionPath, descriptionText);

      this.updateFileStatus(
        status,
        "descriptionFile",
        "completed",
        descriptionPath,
      );
      this.saveFileStatus(status);

      if (!this.isPaused()) {
        this.mainWindow.webContents.send(
          "sendMessageToClient",
          `SYSTEM NOTIFICATION:
The following file has been processed and added to the context. Do not acknowledge this notification.
File: ${file.name}${file.extension} (ID: ${status.fileId})
Content types: ${this.getAvailableContentTypes(status.fileType).join(", ")}
To use the file, call get_file_content('${status.fileId}', 'content_type').`,
        );
        
        // Notify renderer about file being auto-added to context
        this.mainWindow.webContents.send("file-added-to-context", {
          fileId: status.fileId,
          fileName: `${file.name}${file.extension}`,
          auto: true,
        });
      }
      await this.deleteGeminiFile(uploadedName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.updateFileStatus(
        status,
        "descriptionFile",
        "error",
        undefined,
        errorMessage,
      );
      this.saveFileStatus(status);
      throw error;
    }
  }

  private async processTextFile(
    file: SelectedFile,
    status: FileProcessingStatus,
  ): Promise<void> {
    try {
      const { processedFile, uploadedName } = await this.uploadFileToGemini(
        file.path,
      );

      // Generate summary
      this.updateFileStatus(status, "summaryFile", "processing");
      this.saveFileStatus(status);

      const summaryResponse = await geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Extract the summary of the text file` },
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

      const summaryText = summaryResponse.candidates[0].content.parts[0].text;
      const summaryPath = path.join(this.baseDir, status.fileId, "summary.txt");
      fs.writeFileSync(summaryPath, summaryText);

      this.updateFileStatus(status, "summaryFile", "completed", summaryPath);
      this.saveFileStatus(status);

      // Extract text content
      this.updateFileStatus(status, "textFile", "processing");
      this.saveFileStatus(status);

      const textContent = fs.readFileSync(file.path, "utf8");
      const textPath = path.join(this.baseDir, status.fileId, "text.txt");
      fs.writeFileSync(textPath, textContent);

      this.updateFileStatus(status, "textFile", "completed", textPath);
      this.saveFileStatus(status);

      if (!this.isPaused()) {
        this.mainWindow.webContents.send(
          "sendMessageToClient",
          `SYSTEM NOTIFICATION:
The following file has been processed and added to the context. Do not acknowledge this notification.
File: ${file.name}${file.extension} (ID: ${status.fileId})
Content types: ${this.getAvailableContentTypes(status.fileType).join(", ")}
To use the file, call get_file_content('${status.fileId}', 'content_type').`,
        );
        
        // Notify renderer about file being auto-added to context
        this.mainWindow.webContents.send("file-added-to-context", {
          fileId: status.fileId,
          fileName: `${file.name}${file.extension}`,
          auto: true,
        });
      }
      await this.deleteGeminiFile(uploadedName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.updateFileStatus(
        status,
        "summaryFile",
        "error",
        undefined,
        errorMessage,
      );
      this.updateFileStatus(
        status,
        "textFile",
        "error",
        undefined,
        errorMessage,
      );
      this.saveFileStatus(status);
      throw error;
    }
  }

  private async processPdfFile(
    file: SelectedFile,
    status: FileProcessingStatus,
  ): Promise<void> {
    try {
      const { processedFile, uploadedName } = await this.uploadFileToGemini(
        file.path,
      );

      // Generate text extraction
      this.updateFileStatus(status, "textFile", "processing");
      this.saveFileStatus(status);

      const textResponse = geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Extract the text of the pdf` },
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

      // Generate summary
      this.updateFileStatus(status, "summaryFile", "processing");
      this.saveFileStatus(status);

      const summaryResponse = geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Extract the summary of the pdf` },
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

      const [textResult, summaryResult] = await Promise.all([
        textResponse,
        summaryResponse,
      ]);

      const textContent = textResult.candidates[0].content.parts[0].text;
      const summaryText = summaryResult.candidates[0].content.parts[0].text;

      // Save files
      const textPath = path.join(this.baseDir, status.fileId, "text.txt");
      const summaryPath = path.join(this.baseDir, status.fileId, "summary.txt");

      fs.writeFileSync(textPath, textContent);
      fs.writeFileSync(summaryPath, summaryText);

      this.updateFileStatus(status, "textFile", "completed", textPath);
      this.updateFileStatus(status, "summaryFile", "completed", summaryPath);
      this.saveFileStatus(status);

      if (!this.isPaused()) {
        this.mainWindow.webContents.send(
          "sendMessageToClient",
          `SYSTEM NOTIFICATION:
The following file has been processed and added to the context. Do not acknowledge this notification.
File: ${file.name}${file.extension} (ID: ${status.fileId})
Content types: ${this.getAvailableContentTypes(status.fileType).join(", ")}
To use the file, call get_file_content('${status.fileId}', 'content_type').`,
        );
        
        // Notify renderer about file being auto-added to context
        this.mainWindow.webContents.send("file-added-to-context", {
          fileId: status.fileId,
          fileName: `${file.name}${file.extension}`,
          auto: true,
        });
      }
      await this.deleteGeminiFile(uploadedName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.updateFileStatus(
        status,
        "textFile",
        "error",
        undefined,
        errorMessage,
      );
      this.updateFileStatus(
        status,
        "summaryFile",
        "error",
        undefined,
        errorMessage,
      );
      this.saveFileStatus(status);
      throw error;
    }
  }

  private async processAudioVideoFile(
    file: SelectedFile,
    status: FileProcessingStatus,
  ): Promise<void> {
    try {
      const { processedFile, uploadedName } = await this.uploadFileToGemini(
        file.path,
      );

      // Generate summary
      this.updateFileStatus(status, "summaryFile", "processing");
      this.saveFileStatus(status);

      const summaryPromise = geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Extract the summary of the ${status.fileType}` },
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

      // Generate transcript
      this.updateFileStatus(status, "transcriptFile", "processing");
      this.saveFileStatus(status);

      const transcriptPromise = geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Extract the transcript of the ${status.fileType}` },
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

      // Generate transcript with timestamps
      this.updateFileStatus(
        status,
        "transcriptWithTimestampsFile",
        "processing",
      );
      this.saveFileStatus(status);

      const transcriptWithTimestampsPromise = geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extract the transcript of the ${status.fileType} with timestamps`,
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

      const [
        summaryResponse,
        transcriptResponse,
        transcriptWithTimestampsResponse,
      ] = await Promise.all([
        summaryPromise,
        transcriptPromise,
        transcriptWithTimestampsPromise,
      ]);

      const summaryText = summaryResponse.candidates[0].content.parts[0].text;
      const transcriptText =
        transcriptResponse.candidates[0].content.parts[0].text;
      const transcriptWithTimestampsText =
        transcriptWithTimestampsResponse.candidates[0].content.parts[0].text;

      // Save files
      const summaryPath = path.join(this.baseDir, status.fileId, "summary.txt");
      const transcriptPath = path.join(
        this.baseDir,
        status.fileId,
        "transcript.txt",
      );
      const transcriptWithTimestampsPath = path.join(
        this.baseDir,
        status.fileId,
        "transcript_with_timestamps.txt",
      );

      fs.writeFileSync(summaryPath, summaryText);
      fs.writeFileSync(transcriptPath, transcriptText);
      fs.writeFileSync(
        transcriptWithTimestampsPath,
        transcriptWithTimestampsText,
      );

      this.updateFileStatus(status, "summaryFile", "completed", summaryPath);
      this.updateFileStatus(
        status,
        "transcriptFile",
        "completed",
        transcriptPath,
      );
      this.updateFileStatus(
        status,
        "transcriptWithTimestampsFile",
        "completed",
        transcriptWithTimestampsPath,
      );
      this.saveFileStatus(status);

      if (!this.isPaused()) {
        this.mainWindow.webContents.send(
          "sendMessageToClient",
          `SYSTEM NOTIFICATION:
The following file has been processed and added to the context. Do not acknowledge this notification.
File: ${file.name}${file.extension} (ID: ${status.fileId})
Content types: ${this.getAvailableContentTypes(status.fileType).join(", ")}
To use the file, call get_file_content('${status.fileId}', 'content_type').`,
        );
        
        // Notify renderer about file being auto-added to context
        this.mainWindow.webContents.send("file-added-to-context", {
          fileId: status.fileId,
          fileName: `${file.name}${file.extension}`,
          auto: true,
        });
      }
      await this.deleteGeminiFile(uploadedName);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.updateFileStatus(
        status,
        "summaryFile",
        "error",
        undefined,
        errorMessage,
      );
      this.updateFileStatus(
        status,
        "transcriptFile",
        "error",
        undefined,
        errorMessage,
      );
      this.updateFileStatus(
        status,
        "transcriptWithTimestampsFile",
        "error",
        undefined,
        errorMessage,
      );
      this.saveFileStatus(status);
      throw error;
    }
  }

  // =====================================================================
  // Section: Lookup & Selection Helpers
  // ---------------------------------------------------------------------
  // - _findFileId
  // =====================================================================
  private _findFileId(options: FileFinderOptions): string | null {
    if (options.fileId) {
      return options.fileId;
    }

    const parentStatus = this.loadParentStatus();
    if (options.originalPath) {
      const foundFile = Object.values(parentStatus.files).find(
        (f) => f.originalPath === options.originalPath,
      );
      if (foundFile) return foundFile.fileId;
    }

    if (options.originalFileName) {
      const foundFile = Object.values(parentStatus.files).find(
        (f) => `${f.fileName}${f.fileExtension}` === options.originalFileName,
      );
      if (foundFile) return foundFile.fileId;
    }

    return null;
  }

  // Public methods for tool access
  getParentStatus(): ParentFileStatus {
    return this.loadParentStatus();
  }

  getDirectoryContents(
    options: FileFinderOptions,
  ): string[] | { error: string } {
    const fileId = this._findFileId(options);
    if (!fileId) {
      return { error: "File not found with the provided options. : fileId" };
    }
    const fileDir = path.join(this.baseDir, fileId);
    if (!fs.existsSync(fileDir)) {
      return { error: `Directory for fileId ${fileId} does not exist.` };
    }
    try {
      return fs.readdirSync(fileDir);
    } catch (error) {
      return { error: `Could not read directory for fileId ${fileId}.` };
    }
  }

  getFileStatus(
    options: FileFinderOptions,
  ): FileProcessingStatus | { error: string } {
    const fileId = this._findFileId(options);
    if (!fileId) {
      return {
        error: "File with fileId, not found with the provided options.",
      };
    }
    const status = this.loadFileStatus(fileId);
    if (!status) {
      return { error: `Status file not found for fileId ${fileId}.` };
    }
    return status;
  }

  getFileContent(
    options: FileFinderOptions,
    contentType: string,
  ): string | { error: string } {
    const fileId = this._findFileId(options);
    if (!fileId) {
      return { error: "File not found with the provided options." };
    }

    const status = this.loadFileStatus(fileId);
    if (!status) return { error: `Status not found for fileId: ${fileId}` };

    let filePath: string | undefined;

    switch (contentType) {
    case "summary":
      filePath = status.summaryFile.filePath;
      break;
    case "text":
      filePath = status.textFile.filePath;
      break;
    case "description":
      filePath = status.descriptionFile.filePath;
      break;
    case "detailed_description":
      filePath = status.detailedDescriptionFile.filePath;
      break;
    case "transcript":
      filePath = status.transcriptFile.filePath;
      break;
    case "transcript_with_timestamps":
      filePath = status.transcriptWithTimestampsFile.filePath;
      break;
    case "formatted_text":
      filePath = status.formattedTextFile.filePath;
      break;
    default:
      return { error: `Invalid content type: ${contentType}` };
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return {
        error: `Content not found for type '${contentType}' for fileId ${fileId}. It may not have been generated, has been moved, or the file type does not support it.`,
      };
    }

    try {
      return fs.readFileSync(filePath, "utf8");
    } catch (error) {
      console.error(`Error reading file content: ${error}`);
      return {
        error: `Failed to read content for type '${contentType}' for fileId ${fileId}.`,
      };
    }
  }

  listProcessedFiles(): Array<{
    fileId: string;
    fileName: string;
    fileType: string;
    status: string;
    availableContent: string[];
  }> {
    const parentStatus = this.loadParentStatus();
    return Object.values(parentStatus.files).map((file) => ({
      fileId: file.fileId,
      fileName: `${file.fileName}${file.fileExtension}`,
      fileType: file.fileType,
      status: file.overallStatus,
      availableContent: this.getAvailableContentTypes(file.fileType),
    }));
  }

  getActiveTab(): FileProcessingStatus | { error: string } {
    const parentStatus = this.loadParentStatus();
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
  }

  private async getAudioDuration(filePath: string): Promise<number> {
    return mediaGetDuration(filePath);
  }

  // Add this inside the FileProcessingService class

  async stitchAudioChunks(): Promise<void> {
    await mediaStitchUserAudio(this.baseDir, exportMp3);
  }

  // =====================================================================
  // Section: Video/Audio Merge (Timeline-aware)
  // ---------------------------------------------------------------------
  // - mergeAudioAndVideo (timeline-based)
  // =====================================================================
  async mergeAudioAndVideo(): Promise<void> {
    console.log("Starting timeline-based merge of all media...");

    const videoFilePath = path.join(
      this.baseDir,
      "media",
      "stitched_video.mp4",
    );
    const userAudioFilePath = path.join(
      this.baseDir,
      "media",
      exportMp3 ? "audio_stitched.mp3" : "audio_stitched.wav",
    );
    const llmAudioFilePath = path.join(
      this.baseDir,
      "media",
      exportMp3 ? "llm_audio_stitched.mp3" : "llm_audio_stitched.wav",
    );

    const timeline = this.getGlobalTimelineBounds();
    if (timeline.duration <= 0) {
      console.error("No media with valid timestamps found. Aborting.");
      return;
    }

    const videoPosition = this.getMediaTimelinePosition(
      "video/frames",
      timeline.startTime,
    );
    const userAudioPosition = this.getMediaTimelinePosition(
      "audio",
      timeline.startTime,
    );
    const llmAudioPosition = this.getMediaTimelinePosition(
      "llm_audio",
      timeline.startTime,
    );

    console.log(
      `Global timeline: ${timeline.startTime.toFixed(
        2,
      )}s - ${timeline.endTime.toFixed(2)}s (${timeline.duration.toFixed(
        2,
      )}s total)`,
    );
    console.log(`Video position: ${videoPosition.startOffset.toFixed(2)}s`);
    console.log(
      `User audio position: ${userAudioPosition.startOffset.toFixed(2)}s`,
    );
    console.log(
      `LLM audio position: ${llmAudioPosition.startOffset.toFixed(2)}s`,
    );

    try {
      await runTimelineMerge(this.baseDir, {
        videoFilePath,
        userAudioFilePath,
        llmAudioFilePath,
        duration: timeline.duration,
        videoStartOffset: videoPosition.startOffset,
        userAudioStartOffset: userAudioPosition.startOffset,
        llmAudioStartOffset: llmAudioPosition.startOffset,
      });
      console.log(`Final video duration: ${timeline.duration.toFixed(2)}s`);

      // Cleanup chunk folders after successful merge
      this.cleanupChunkFolders();
    } catch (error) {
      console.error(
        "An error occurred during the timeline-based merge process:",
        error,
      );
      throw error; // Re-throw to prevent cleanup if merge failed
    }
  }

  /**
   * Cleanup chunk folders and intermediate stitched files after successful merge
   */
  private cleanupChunkFolders(): void {
    console.log("Cleaning up media chunk folders after successful merge...");

    const foldersToClean = [
      { path: path.join(this.baseDir, "media", "audio"), name: "audio" },
      {
        path: path.join(this.baseDir, "media", "llm_audio"),
        name: "LLM audio",
      },
      { path: path.join(this.baseDir, "media", "video"), name: "video" },
    ];

    let cleanedCount = 0;
    for (const folder of foldersToClean) {
      if (fs.existsSync(folder.path)) {
        try {
          fs.rmSync(folder.path, { recursive: true, force: true });
          console.log(`Removed ${folder.name} chunk folder`);
          cleanedCount++;
        } catch (error) {
          console.error(`Failed to remove ${folder.name} folder:`, error);
        }
      }
    }

    // Conditionally delete intermediate stitched files
    if (deleteStitchedFiles) {
      console.log("Cleaning up intermediate stitched files...");

      const stitchedFilesToClean = [
        {
          path: path.join(this.baseDir, "media", "audio_stitched.mp3"),
          name: "audio_stitched.mp3",
        },
        {
          path: path.join(this.baseDir, "media", "llm_audio_stitched.mp3"),
          name: "llm_audio_stitched.mp3",
        },
        {
          path: path.join(this.baseDir, "media", "stitched_video.mp4"),
          name: "stitched_video.mp4",
        },
      ];

      let stitchedCleanedCount = 0;
      for (const file of stitchedFilesToClean) {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
            console.log(`Removed ${file.name}`);
            stitchedCleanedCount++;
          } catch (error) {
            console.error(`Failed to remove ${file.name}:`, error);
          }
        }
      }

      console.log(
        `Cleanup completed: ${cleanedCount} chunk folders and ${stitchedCleanedCount} intermediate files removed`,
      );
    } else {
      console.log(
        `Cleanup completed: ${cleanedCount} chunk folders removed (intermediate files preserved for debugging)`,
      );
    }
  }

  // -------------------------------------------

  // Add these two methods inside the FileProcessingService class

  // Add these inside the FileProcessingService class

  private async getVideoFrameSize(
    filePath: string,
  ): Promise<{ width: number; height: number } | null> {
    return mediaGetVideoFrameSize(filePath);
  }

  private async generateBlackFrame(
    filePath: string,
    width: number,
    height: number,
  ): Promise<void> {
    await mediaGenerateBlackFrame(filePath, width, height);
  }
  // =====================================================================
  // Section: Video Stitching (Frames -> Video)
  // ---------------------------------------------------------------------
  // - stitchVideoFrames / getVideoFrameSize / generateBlackFrame
  // =====================================================================
  async stitchVideoFrames(frameRate = fps): Promise<void> {
    await mediaStitchVideoFrames(
      this.baseDir,
      {
        getVideoFrameSize: (filePath) => this.getVideoFrameSize(filePath),
        generateBlackFrame: (filePath, w, h) =>
          this.generateBlackFrame(filePath, w, h),
      },
      frameRate,
    );
  }

  // =====================================================================
  // Section: Context & Selection
  // ---------------------------------------------------------------------
  // - getFilesInContext
  // =====================================================================
  getFilesInContext(): FileProcessingStatus[] {
    // Context is now managed locally in the renderer process
    return [];
  }

  // =====================================================================
  // Section: External Sources Processing
  // ---------------------------------------------------------------------
  // - processYouTubeVideo / processTabData
  // =====================================================================
  async processYouTubeVideo(youtubeData: YouTubeVideoData): Promise<void> {
    await externalProcessYouTubeVideo(
      {
        baseDir: this.baseDir,
        geminiAI,
        getRelevantFilesForType: (t) => this.getRelevantFilesForType(t),
        getAvailableContentTypes: (t) => this.getAvailableContentTypes(t),
        generateYoutubeFileId: (id) => this.generateYoutubeFileId(id),
        loadFileStatus: (id) => this.loadFileStatus(id),
        saveFileStatus: (s) => this.saveFileStatus(s),
        updateFileStatus: (s, type, ns, fp, err) =>
          this.updateFileStatus(s, type, ns, fp, err),
        updateParentStatus: (fn) => this.updateParentStatus(fn),
        mainWindow: this.mainWindow,
        isPaused: () => this.isPaused(),
        isLlmConnected: () => this.isLlmConnected(),
      },
      youtubeData,
    );
  }

  // Add this inside the FileProcessingService class

  /**
   * Gets the duration of any media file using ffprobe.
   * @param filePath The full path to the media file.
   * @returns The duration in seconds, or 0 on error.
   */

  /**
   * Generates a silent WAV audio file of a specific duration.
   */
  private async generateSilence(
    duration: number,
    filePath: string,
  ): Promise<void> {
    const { generateSilence } = await import("./media/common");
    await generateSilence(duration, filePath);
  }

  /**
   * Executes the ffmpeg command to stitch audio files listed in a concat file.
   */
  private async stitchAudioFiles(
    concatFile: string,
    outputFile: string,
  ): Promise<void> {
    const { stitchAudioFiles } = await import("./media/common");
    await stitchAudioFiles(concatFile, outputFile, exportMp3);
  }

  saveAudioChunkLocally(data: string, timestamp?: number): void {
    mediaSaveUserAudioChunkLocally(this.baseDir, data, timestamp);
  }

  /**
   * Saves a chunk of LLM's audio (24kHz) to a local WAV file.
   */
  saveLlmAudioChunkLocally(data: string): void {
    mediaSaveLlmAudioChunkLocally(this.baseDir, data);
  }

  /**
   * Saves a captured video frame to a local JPG file.
   */
  saveVideoFrameLocally(data: string, timestamp?: number): void {
    const dir = path.join(this.baseDir, "media/video/frames");
    fs.mkdirSync(dir, { recursive: true });
    const buffer = Buffer.from(data, "base64");
    const framePath = path.join(dir, `frame-${timestamp || Date.now()}.jpg`);
    fs.writeFileSync(framePath, buffer);
  }

  /**
   * Stitches LLM audio chunks, filling gaps with silence.
   */
  async stitchLlmAudioChunks(): Promise<void> {
    await mediaStitchLlmAudio(this.baseDir, exportMp3);
  }

  /**
   * Generic function to stitch audio chunks from a directory with silence padding.
   */
  private async stitchAndPadChunks(
    audioDir: string,
    tempDir: string,
    outputFilePath: string,
    logPrefix: string,
  ): Promise<void> {
    try {
      console.log(`Starting intelligent ${logPrefix} audio stitching...`);
      if (!fs.existsSync(audioDir)) {
        console.log(`${logPrefix} audio directory does not exist.`);
        return;
      }

      if (fs.existsSync(tempDir))
        fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });

      const chunkFiles = fs
        .readdirSync(audioDir)
        .filter((f) => f.startsWith("chunk-") && f.endsWith(".wav"));
      if (chunkFiles.length === 0) {
        console.log(`No ${logPrefix} audio chunks found.`);
        return;
      }

      const chunks = [];
      for (const file of chunkFiles) {
        const filePath = path.join(audioDir, file);
        const timestampMs = parseInt(
          file.replace("chunk-", "").replace(".wav", ""),
        );
        if (isNaN(timestampMs)) continue;

        const startTime = timestampMs / 1000.0;
        const duration = await this.getMediaDuration(filePath);
        if (duration > 0) {
          chunks.push({
            filePath,
            startTime,
            duration,
            endTime: startTime + duration,
          });
        }
      }
      chunks.sort((a, b) => a.startTime - b.startTime);

      const concatFilePath = path.join(tempDir, "concat_list.txt");
      let fileListContent = "";
      let lastEndTime = chunks.length > 0 ? chunks[0].startTime : 0;

      for (const chunk of chunks) {
        const gap = chunk.startTime - lastEndTime;
        if (gap > 0.01) {
          const silenceFilePath = path.join(
            tempDir,
            `silence-${Date.now()}.wav`,
          );
          await this.generateSilence(gap, silenceFilePath);
          fileListContent += `file '${silenceFilePath.replace(/\\/g, "/")}'\n`;
        }
        fileListContent += `file '${chunk.filePath.replace(/\\/g, "/")}'\n`;
        lastEndTime = chunk.endTime;
      }
      fs.writeFileSync(concatFilePath, fileListContent);
      await this.stitchAudioFiles(concatFilePath, outputFilePath);
    } catch (error) {
      console.error(`Error during ${logPrefix} audio stitching:`, error);
    } finally {
      if (fs.existsSync(tempDir))
        fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  private getFirstTimestamp(directory: string): number {
    const dirPath = path.join(this.baseDir, "media", directory);
    if (!fs.existsSync(dirPath)) return 0;

    // Supports both audio .wav and video .jpg chunks
    const chunkFiles = fs
      .readdirSync(dirPath)
      .filter(
        (f) =>
          (f.startsWith("chunk-") && f.endsWith(".wav")) ||
          (f.startsWith("frame-") && f.endsWith(".jpg")),
      );

    if (chunkFiles.length === 0) return 0;

    const timestamps = chunkFiles.map((file) => {
      const name = file.split(".")[0]; // e.g., 'chunk-1712345678' or 'frame-1712345678'
      return parseInt(name.split("-")[1]);
    });

    const validTimestamps = timestamps.filter((ts) => !isNaN(ts));
    if (validTimestamps.length === 0) return 0;

    return Math.min(...validTimestamps);
  }

  /**
   * Gets the last timestamp from a media directory
   */
  private getLastTimestamp(directory: string): number {
    const dirPath = path.join(this.baseDir, "media", directory);
    if (!fs.existsSync(dirPath)) return 0;

    const chunkFiles = fs
      .readdirSync(dirPath)
      .filter(
        (f) =>
          (f.startsWith("chunk-") && f.endsWith(".wav")) ||
          (f.startsWith("frame-") && f.endsWith(".jpg")),
      );

    if (chunkFiles.length === 0) return 0;

    const timestamps = chunkFiles.map((file) => {
      const name = file.split(".")[0];
      return parseInt(name.split("-")[1]);
    });

    const validTimestamps = timestamps.filter((ts) => !isNaN(ts));
    if (validTimestamps.length === 0) return 0;

    return Math.max(...validTimestamps);
  }

  /**
   * Gets the global timeline bounds across all media types with enhanced validation
   */
  private getGlobalTimelineBounds(): {
    startTime: number;
    endTime: number;
    duration: number;
    } {
    const mediaTypes = ["audio", "llm_audio", "video/frames"];

    let globalStartTime = Infinity;
    let globalEndTime = 0;
    let hasValidMedia = false;

    console.log("Calculating global timeline bounds...");

    for (const mediaType of mediaTypes) {
      try {
        const firstTimestamp = this.getFirstTimestamp(mediaType);
        const lastTimestamp = this.getLastTimestamp(mediaType);

        if (firstTimestamp > 0 && lastTimestamp > firstTimestamp) {
          hasValidMedia = true;
          if (firstTimestamp < globalStartTime) {
            globalStartTime = firstTimestamp;
          }
          if (lastTimestamp > globalEndTime) {
            globalEndTime = lastTimestamp;
          }
          console.log(
            `${mediaType}: ${firstTimestamp}ms - ${lastTimestamp}ms (${
              (lastTimestamp - firstTimestamp) / 1000
            }s duration)`,
          );
        } else {
          console.warn(
            `${mediaType}: No valid timestamps found (first: ${firstTimestamp}, last: ${lastTimestamp})`,
          );
        }
      } catch (error) {
        console.error(`Error processing ${mediaType} timeline:`, error);
      }
    }

    if (!hasValidMedia) {
      console.warn(
        "No valid media found for timeline calculation - using default timeline",
      );
      return { startTime: 0, endTime: 0, duration: 0 };
    }

    // Handle edge cases
    if (globalStartTime === Infinity) globalStartTime = 0;

    const startTimeSeconds = globalStartTime / 1000;
    const endTimeSeconds = globalEndTime / 1000;
    const duration = Math.max(endTimeSeconds - startTimeSeconds, 0);

    console.log(
      `Global timeline: ${startTimeSeconds.toFixed(
        3,
      )}s - ${endTimeSeconds.toFixed(3)}s (${duration.toFixed(3)}s total)`,
    );

    return {
      startTime: startTimeSeconds,
      endTime: endTimeSeconds,
      duration: duration,
    };
  }

  /**
   * Gets the timeline position for a specific media type
   */
  private getMediaTimelinePosition(
    mediaType: string,
    globalStartTime: number,
  ): { startOffset: number; endOffset: number } {
    const firstTimestamp = this.getFirstTimestamp(mediaType);
    const lastTimestamp = this.getLastTimestamp(mediaType);

    if (firstTimestamp === 0 || lastTimestamp === 0) {
      return { startOffset: -1, endOffset: -1 }; // Media doesn't exist
    }

    const startOffset = firstTimestamp / 1000 - globalStartTime;
    const endOffset = lastTimestamp / 1000 - globalStartTime;

    return { startOffset, endOffset };
  }

  /**
   * Gets the duration of any media file using ffprobe.
   * @param filePath The full path to the media file.
   * @returns The duration in seconds, or 0 on error.
   */
  private async getMediaDuration(filePath: string): Promise<number> {
    return mediaGetDuration(filePath);
  }

  async processTabData(tabData: PageData): Promise<void> {
    await externalProcessWebpage(
      {
        baseDir: this.baseDir,
        geminiAI,
        getRelevantFilesForType: (t) => this.getRelevantFilesForType(t),
        getAvailableContentTypes: (t) => this.getAvailableContentTypes(t),
        generateWebpageFileId: (url) => this.generateWebpageFileId(url),
        loadFileStatus: (id) => this.loadFileStatus(id),
        saveFileStatus: (s) => this.saveFileStatus(s),
        updateFileStatus: (s, type, ns, fp, err) =>
          this.updateFileStatus(s, type, ns, fp, err),
        updateParentStatus: (fn) => this.updateParentStatus(fn),
        mainWindow: this.mainWindow,
        isPaused: () => this.isPaused(),
        isLlmConnected: () => this.isLlmConnected(),
      },
      tabData,
    );
  }

  // =====================================================================
  // Section: Other Operations
  // ---------------------------------------------------------------------
  // - createDataVariants
  // =====================================================================
  async createDataVariants(): Promise<void> {
    console.log(
      "Creating Data Variants for final merged video (media directory)...",
    );
    const mediaDir = path.join(this.baseDir, "media");
    const finalVideoPath = path.join(mediaDir, "final-movie-complete.mp4");
    const nowIso = new Date().toISOString();

    // Status file that lives alongside media outputs
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
              `SYSTEM NOTIFICATION:\n${message}`,
            );
          }
        }
        return;
      }

      // Mark processing
      statusObj.overallStatus = "processing";
      statusObj.summary.status = "processing";
      statusObj.transcript.status = "processing";
      statusObj.transcript_with_timestamps.status = "processing";
      writeStatus(statusObj);

      // Upload once
      const { processedFile, uploadedName } = await this.uploadFileToGemini(
        finalVideoPath,
      );

      // Prepare parallel generation
      const summaryPromise = (async () => {
        try {
          const res = await geminiAI.models.generateContent({
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
          const text = res.candidates[0].content.parts[0].text;
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
          const res = await geminiAI.models.generateContent({
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
          const text = res.candidates[0].content.parts[0].text;
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
          const res = await geminiAI.models.generateContent({
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
          const text = res.candidates[0].content.parts[0].text;
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
            `SYSTEM NOTIFICATION:\nFinal movie variants generated in media directory. Status file: ${statusFilePath}`,
          );
        }
      }
      // Cleanup uploaded file on Gemini
      await this.deleteGeminiFile(uploadedName);
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
        // 
      }
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        if (!this.isPaused()) {
          this.mainWindow.webContents.send(
            "sendMessageToClient",
            `SYSTEM NOTIFICATION:\nFailed to create data variants for final movie: ${errMsg}`,
          );
        }
      }
    }
  }

  // =====================================================================
  // Section: Cleanup on App Shutdown
  // ---------------------------------------------------------------------
  // - cleanupIncompleteProcessing
  // =====================================================================

  /**
   * Cleans up incomplete file processing on app shutdown
   * Removes files with status other than "completed" from status.json
   * and deletes their corresponding directories
   */
  async cleanupIncompleteProcessing(): Promise<void> {
    console.log("🧹 Starting cleanup of incomplete file processing...");
    
    try {
      const parentStatus = this.loadParentStatus();
      const filesToCleanup: string[] = [];
      
      // Find files that are not completed
      for (const [fileId, fileStatus] of Object.entries(parentStatus.files)) {
        if (fileStatus.overallStatus !== "completed") {
          filesToCleanup.push(fileId);
          console.log(`🗑️  Marking for cleanup: ${fileStatus.fileName} (${fileStatus.overallStatus})`);
        }
      }
      
      if (filesToCleanup.length === 0) {
        console.log("✨ No incomplete files found. Cleanup complete.");
        return;
      }
      
      // Remove files from parent status and delete directories
      let cleanedCount = 0;
      for (const fileId of filesToCleanup) {
        const fileStatus = parentStatus.files[fileId];
        
        // Remove from parent status
        delete parentStatus.files[fileId];
        
        // Delete directory and all contents
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
        
        console.log(`🧽 Cleaned up: ${fileStatus.fileName} (${fileStatus.overallStatus})`);
      }
      
      // Update counts in parent status
      const remainingFiles = Object.values(parentStatus.files);
      parentStatus.totalFiles = remainingFiles.length;
      parentStatus.completedFiles = remainingFiles.filter(f => f.overallStatus === "completed").length;
      parentStatus.processingFiles = remainingFiles.filter(f => f.overallStatus === "processing").length;
      parentStatus.errorFiles = remainingFiles.filter(f => f.overallStatus === "error").length;
      
      // Save updated parent status
      this.saveParentStatus(parentStatus);
      
      console.log(`✅ Cleanup complete: Removed ${cleanedCount} incomplete files and their directories`);
      console.log(`📊 Remaining files: ${parentStatus.totalFiles} (${parentStatus.completedFiles} completed)`);
      
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
