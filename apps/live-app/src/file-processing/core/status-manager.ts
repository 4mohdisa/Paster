import * as fs from "fs";
import * as path from "path";
import { ParentFileStatus, FileProcessingStatus, statusType, FileType, SelectedFile } from "../types";

export class StatusManager {
  private baseDir: string;
  private mainWindow: any;
  private parentStatusUpdateQueue: Promise<void> = Promise.resolve();

  constructor(baseDir: string, mainWindow: any) {
    this.baseDir = baseDir;
    this.mainWindow = mainWindow;
  }

  setMainWindow(mainWindow: any): void {
    this.mainWindow = mainWindow;
  }

  private getParentStatusPath(): string {
    return path.join(this.baseDir, "status.json");
  }

  private getFileStatusPath(fileId: string): string {
    return path.join(this.baseDir, fileId, "status.json");
  }

  loadParentStatus(): ParentFileStatus {
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

  saveParentStatus(status: ParentFileStatus): void {
    try {
      status.lastUpdated = new Date().toISOString();
      fs.writeFileSync(
        this.getParentStatusPath(),
        JSON.stringify(status, null, 2),
      );

      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send("status-file-updated");
      }
    } catch (error) {
      console.error("Error saving parent status:", error);
    }
  }

  loadFileStatus(fileId: string): FileProcessingStatus | null {
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

  saveFileStatus(status: FileProcessingStatus): void {
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

  updateFileStatus(
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

  updateOverallStatus(status: FileProcessingStatus): void {
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

  getRelevantFilesForType(
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

  updateParentStatus(
    updateFn: (status: ParentFileStatus) => void,
  ): Promise<void> {
    this.parentStatusUpdateQueue = this.parentStatusUpdateQueue.then(() => {
      const status = this.loadParentStatus();
      updateFn(status);
      this.saveParentStatus(status);
    });
    return this.parentStatusUpdateQueue;
  }

  createInitialFileStatus(file: SelectedFile, generateFileId: (path: string) => string): FileProcessingStatus {
    const fileId = generateFileId(file.path);
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

  private determineFileType(extension: string): FileType {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];
    const textExtensions = [".txt", ".md", ".json", ".csv", ".xml", ".html"];
    const pdfExtensions = [".pdf"];
    const audioExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
    const videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];

    if (imageExtensions.includes(extension)) return "image";
    if (textExtensions.includes(extension)) return "text";
    if (pdfExtensions.includes(extension)) return "pdf";
    if (audioExtensions.includes(extension)) return "audio";
    if (videoExtensions.includes(extension)) return "video";
    return "document";
  }
}