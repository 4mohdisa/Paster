import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { SelectedFile, FileFinderOptions, FileProcessingStatus, ParentFileStatus, FileType } from "../types";

export class FileUtils {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  // File extension mappings
  private readonly textExtensions = [".txt", ".md", ".json", ".csv", ".xml", ".html"];
  private readonly pdfExtensions = [".pdf"];
  private readonly audioExtensions = [".mp3", ".wav", ".m4a", ".aac", ".ogg"];
  private readonly videoExtensions = [".mp4", ".avi", ".mov", ".mkv", ".webm"];
  private readonly imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"];

  generateFileId(filePath: string): string {
    const fileContent = fs.readFileSync(filePath);
    return crypto.createHash("md5").update(fileContent).digest("hex");
  }

  generateYoutubeFileId(videoId: string): string {
    return crypto.createHash("md5").update(videoId).digest("hex");
  }

  generateWebpageFileId(url: string): string {
    return crypto.createHash("md5").update(url).digest("hex");
  }

  determineFileType(extension: string): FileType {
    if (this.imageExtensions.includes(extension)) return "image";
    if (this.textExtensions.includes(extension)) return "text";
    if (this.pdfExtensions.includes(extension)) return "pdf";
    if (this.audioExtensions.includes(extension)) return "audio";
    if (this.videoExtensions.includes(extension)) return "video";
    return "document";
  }

  getAvailableContentTypes(fileType: FileType): string[] {
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

  expandDirectoriesOneLevel(files: SelectedFile[]): SelectedFile[] {
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
              if (!entry.isFile()) continue;
              if (this.isHiddenFile(entry.name)) continue;

              const fullPath = path.join(dirPath, entry.name);
              const parsed = path.parse(fullPath);
              const extLower = parsed.ext.toLowerCase();
              if (!this.isKnownFileType(extLower)) continue;

              let size: number | undefined = undefined;
              try {
                const stats = fs.statSync(fullPath);
                size = stats.size;
              } catch {
                // ignore
              }

              pushIfNotSeen({
                path: fullPath,
                name: parsed.name,
                extension: extLower,
                size,
                type: "file",
              });
            } catch {
              // ignore
            }
          }
        } else if (item.type === "file") {
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
      this.imageExtensions.includes(extension) ||
      this.textExtensions.includes(extension) ||
      this.pdfExtensions.includes(extension) ||
      this.audioExtensions.includes(extension) ||
      this.videoExtensions.includes(extension)
    );
  }

  private isHiddenFile(name: string): boolean {
    return name.startsWith(".");
  }

  findFileId(options: FileFinderOptions, loadParentStatus: () => ParentFileStatus): string | null {
    if (options.fileId) {
      return options.fileId;
    }

    const parentStatus = loadParentStatus();
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

  getDirectoryContents(
    options: FileFinderOptions,
    loadParentStatus: () => ParentFileStatus
  ): string[] | { error: string } {
    const fileId = this.findFileId(options, loadParentStatus);
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

  getFileContent(
    options: FileFinderOptions,
    contentType: string,
    loadParentStatus: () => ParentFileStatus,
    loadFileStatus: (fileId: string) => FileProcessingStatus | null
  ): string | { error: string } {
    const fileId = this.findFileId(options, loadParentStatus);
    if (!fileId) {
      return { error: "File not found with the provided options." };
    }

    const status = loadFileStatus(fileId);
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
}