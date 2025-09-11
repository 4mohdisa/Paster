export interface SelectedFile {
  path: string;
  name: string;
  extension: string;
  size?: number;
  type: "file" | "directory";
}

// File type definitions
export type FileType =
  | "image"
  | "text"
  | "pdf"
  | "audio"
  | "video"
  | "document"
  | "youtube"
  | "webpage";

export type statusType = "pending" | "processing" | "completed" | "error" | "skipped";

// Status definitions
export interface FileStatus {
  status: statusType;
  lastUpdated: string;
  filePath?: string;
  error?: string;
}

export interface FileProcessingStatus {
  fileId: string;
  originalPath: string;
  fileName: string;
  fileExtension: string;
  fileType: FileType;
  summaryFile: FileStatus;
  textFile: FileStatus;
  descriptionFile: FileStatus; // for images
  detailedDescriptionFile: FileStatus; // for youtube
  formattedTextFile: FileStatus; // for webpages
  transcriptFile: FileStatus; // for audio/video
  transcriptWithTimestampsFile: FileStatus; // for audio/video
  overallStatus: "pending" | "processing" | "completed" | "error" | "partial";
  createdAt: string;
  lastUpdated: string;
  youtubeVideoTitle?: string;
  youtubeVideoUrl?: string;
  activeTab?: boolean;
  inContext?: boolean;
}

export interface ParentFileStatus {
  files: { [fileId: string]: FileProcessingStatus };
  totalFiles: number;
  completedFiles: number;
  processingFiles: number;
  errorFiles: number;
  lastUpdated: string;
}

export interface FileFinderOptions {
  fileId?: string;
  originalPath?: string;
  originalFileName?: string;
}

export interface YouTubeVideoData {
  url: string;
  videoId: string;
  title: string;
  timestamp: string;
  action: string;
}

export interface PageData {
  url: string;
  title: string;
  description: string;
  domain: string;
  body: string;
}
