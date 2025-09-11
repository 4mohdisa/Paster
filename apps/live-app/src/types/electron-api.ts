// Single source of truth for Electron API types

export interface FileFinderOptions {
  fileId?: string;
  originalPath?: string;
  originalFileName?: string;
}

export interface FileStatus {
  status: "pending" | "processing" | "completed" | "error" | "skipped";
  lastUpdated: string;
  filePath?: string;
  error?: string;
}

export interface FileProcessingStatus {
  fileId: string;
  originalPath: string;
  fileName: string;
  fileExtension: string;
  fileType: string;
  summaryFile: FileStatus;
  textFile: FileStatus;
  descriptionFile: FileStatus;
  transcriptFile: FileStatus;
  transcriptWithTimestampsFile: FileStatus;
  detailedDescriptionFile?: FileStatus;
  formattedTextFile?: FileStatus;
  overallStatus: "pending" | "processing" | "completed" | "error" | "partial";
  createdAt: string;
  lastUpdated: string;
  youtubeVideoTitle?: string;
  youtubeVideoUrl?: string;
  activeTab?: boolean;
  inContext?: boolean;
}

export interface PageData {
  url: string;
  title: string;
  description: string;
  domain: string;
  body: string;
}

export interface ParentFileStatus {
  files: { [fileId: string]: FileProcessingStatus };
  totalFiles: number;
  completedFiles: number;
  processingFiles: number;
  errorFiles: number;
  lastUpdated: string;
}

export interface ElectronAPI {
  getApiKey: () => Promise<string | null>;
  getScreenSources: () => Promise<Electron.DesktopCapturerSource[]>;
  getParentStatus: () => Promise<ParentFileStatus>;
  getDirectoryContents: (options: FileFinderOptions) => Promise<string[] | { error: string }>;
  getFileStatus: (options: FileFinderOptions) => Promise<FileProcessingStatus | { error: string }>;
  getFileContent: (
    options: FileFinderOptions,
    contentType: string,
  ) => Promise<string | { error: string }>;
  getActiveTab: () => Promise<FileProcessingStatus | { error: string }>;
  getFilesInContext: () => Promise<FileProcessingStatus[] | { error: string }>;
  processTabData: (pageData: PageData) => Promise<void>;

  // Main -> client message
  sendMessageToClient: (callback: (message: string) => void) => void;
  // saving chunk locally
  saveAudioChunkLocally: (data: string, timestamp?: number) => void;
  stitchAudioChunks: () => Promise<void>;

  saveVideoFrameLocally: (data: string, timestamp?: number) => void;
  stitchVideoFrames: () => Promise<void>;
  mergeAudioAndVideo: () => Promise<void>;
  createDataVariants: () => void;

  saveLlmAudioChunkLocally: (data: string) => void;
  stitchLlmAudioChunks: () => Promise<void>;

  // Hotkeys (simple toggle). Returns an unsubscribe function
  onAudioHotkey: (callback: (payload: { action: "toggle" }) => void) => () => void;
  onVideoHotkey: (callback: (payload: { action: "toggle" }) => void) => () => void;
  
  // Interface mode toggle
  onToggleInterfaceMode: (callback: () => void) => () => void;
  
  // Custom hotkey (Cmd+Shift+N)
  onCustomHotkey: (callback: () => void) => () => void;
  
  // Secondary custom hotkey (Cmd+Shift+M)
  onSecondaryCustomHotkey: (callback: () => void) => () => void;
  
  // Window utilities
  // resizeWindow: (height: number) => void;
  resizeWindowFromBottom: (height: number, width: number) => void;
  resizeWindowFromBottomCentered: (height: number, width: number) => void;
  getWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number }>;
  moveWindow: (deltaX: number, deltaY: number) => void;
  resetDragPosition: () => void;
  
  // Pause state communication
  setPauseState: (paused: boolean) => void;
  
  // LLM connection state communication
  setLlmConnectionState: (connected: boolean) => void;
  
  // File status notifications
  onStatusFileUpdated: (callback: () => void) => () => void;
  onFileAddedToContext: (callback: (data: { fileId: string; fileName: string; auto: boolean }) => void) => () => void;
}
