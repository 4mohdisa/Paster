import { FileProcessingStatus, FileType, statusType, SelectedFile, YouTubeVideoData, PageData } from "../types";

export interface BaseProcessorContext {
  baseDir: string;
  geminiAI: any;
  mainWindow: any;
  isPaused: () => boolean;
  isLlmConnected: () => boolean;

  // Status management methods
  loadFileStatus: (fileId: string) => FileProcessingStatus | null;
  saveFileStatus: (status: FileProcessingStatus) => void;
  updateFileStatus: (
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
  ) => void;
  updateParentStatus: (updateFn: (status: any) => void) => Promise<void>;

  // File type utilities
  getRelevantFilesForType: (fileType: FileType) => Array<
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
  >;
  getAvailableContentTypes: (fileType: FileType) => string[];
}

export interface FileProcessorContext extends BaseProcessorContext {
  generateFileId: (filePath: string) => string;
  uploadFileToGemini: (filePath: string) => Promise<{ processedFile: any; uploadedName: string }>;
  deleteGeminiFile: (name: string) => Promise<void>;
  createInitialFileStatus: (file: SelectedFile) => FileProcessingStatus;
}

export interface ExternalProcessorContext extends BaseProcessorContext {
  generateYoutubeFileId?: (videoId: string) => string;
  generateWebpageFileId?: (url: string) => string;
}

export interface BaseProcessor<TInput = any> {
  process(context: BaseProcessorContext, input: TInput): Promise<void>;
}

export interface FileProcessor extends BaseProcessor<SelectedFile> {
  process(context: FileProcessorContext, file: SelectedFile): Promise<void>;
}

export interface YouTubeProcessor extends BaseProcessor<YouTubeVideoData> {
  process(context: ExternalProcessorContext, data: YouTubeVideoData): Promise<void>;
}

export interface WebpageProcessor extends BaseProcessor<PageData> {
  process(context: ExternalProcessorContext, data: PageData): Promise<void>;
}