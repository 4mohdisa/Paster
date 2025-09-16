import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { File as GeminiFile } from "@google/genai";

import { geminiAI } from "../index";

// Media helpers (moderate breakdown, no API changes)
import { processWebpage as externalProcessWebpage } from "./external/webpage";
import { processYouTubeVideo as externalProcessYouTubeVideo } from "./external/youtube";
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

    if (!uploadedFile.name) {
      throw new Error("Failed to get uploaded file name from Gemini");
    }

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
      throw new Error(
        `File processing failed: ${processedFile.name || "unknown"}`,
      );
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

      const descriptionText =
        description.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!descriptionText) {
        throw new Error("Failed to get description from Gemini response");
      }

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

      const summaryText =
        summaryResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!summaryText) {
        throw new Error("Failed to get summary from Gemini response");
      }

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

      const textContent = textResult.candidates?.[0]?.content?.parts?.[0]?.text;
      const summaryText =
        summaryResult.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!textContent) {
        throw new Error("Failed to get text content from Gemini response");
      }
      if (!summaryText) {
        throw new Error("Failed to get summary from Gemini response");
      }

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

      const summaryText =
        summaryResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      const transcriptText =
        transcriptResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      const transcriptWithTimestampsText =
        transcriptWithTimestampsResponse.candidates?.[0]?.content?.parts?.[0]
          ?.text;

      if (!summaryText) {
        throw new Error("Failed to get summary from Gemini response");
      }
      if (!transcriptText) {
        throw new Error("Failed to get transcript from Gemini response");
      }
      if (!transcriptWithTimestampsText) {
        throw new Error(
          "Failed to get transcript with timestamps from Gemini response",
        );
      }

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

    return { error: "Unexpected state in getActiveTab" };
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
      const { processedFile, uploadedName } =
        await this.uploadFileToGemini(finalVideoPath);

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
          console.log(
            `🗑️  Marking for cleanup: ${fileStatus.fileName} (${fileStatus.overallStatus})`,
          );
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

        console.log(
          `🧽 Cleaned up: ${fileStatus.fileName} (${fileStatus.overallStatus})`,
        );
      }

      // Update counts in parent status
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

      // Save updated parent status
      this.saveParentStatus(parentStatus);

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
