import * as fs from "fs";
import * as path from "path";

import { YouTubeVideoData, FileProcessingStatus, FileType } from "../types";

export interface YouTubeContext {
  baseDir: string;
  geminiAI: any;
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
  generateYoutubeFileId: (videoId: string) => string;
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
    newStatus: "pending" | "processing" | "completed" | "error" | "skipped",
    filePath?: string,
    error?: string,
  ) => void;
  updateParentStatus: (updateFn: (status: any) => void) => Promise<void>;
  mainWindow: any;
  isPaused: () => boolean;
  isLlmConnected: () => boolean;
}

export async function processYouTubeVideo(ctx: YouTubeContext, youtubeData: YouTubeVideoData): Promise<void> {
  const { geminiAI } = ctx;
  const fileId = ctx.generateYoutubeFileId(youtubeData.videoId);
  let status = ctx.loadFileStatus(fileId);

  if (status && status.overallStatus === "completed") {
    console.log(`YouTube video ${fileId} already processed. Skipping.`);
    await ctx.updateParentStatus((parentStatus) => {
      for (const key in parentStatus.files) {
        if (parentStatus.files[key].activeTab) {
          parentStatus.files[key].activeTab = false;
        }
      }
      if (parentStatus.files[fileId]) {
        parentStatus.files[fileId].activeTab = true;
      }
    });
    return;
  }

  await ctx.updateParentStatus((parentStatus) => {
    for (const key in parentStatus.files) {
      if (parentStatus.files[key].activeTab) {
        parentStatus.files[key].activeTab = false;
      }
    }

    if (!status) {
      const now = new Date().toISOString();
      const relevantFiles = ctx.getRelevantFilesForType("youtube");
      const newStatus: FileProcessingStatus = {
        fileId,
        originalPath: youtubeData.url,
        fileName: youtubeData.title,
        fileExtension: ".youtube",
        fileType: "youtube",
        youtubeVideoTitle: youtubeData.title,
        youtubeVideoUrl: youtubeData.url,
        activeTab: true,
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
        newStatus[key] = { status: "pending", lastUpdated: now };
      }
      status = newStatus;
      parentStatus.files[fileId] = status;
      parentStatus.totalFiles++;
    } else {
      status.activeTab = true;
      if (parentStatus.files[fileId]) {
        parentStatus.files[fileId].activeTab = true;
      }
    }
    parentStatus.processingFiles++;
  });

  if (!status) return; // type guard
  ctx.saveFileStatus(status);

  try {
    const processingPromises: Promise<any>[] = [];

    if (status.summaryFile.status !== "completed") {
      ctx.updateFileStatus(status, "summaryFile", "processing");
      ctx.saveFileStatus(status);
      const summaryPromise = geminiAI.models
        .generateContent({
          model: "gemini-2.5-flash",
          contents: [{ fileData: { fileUri: youtubeData.url } }, { text: "Summarize the video in 3 sentences." }],
        })
        .then((response: any) => {
          const summaryText = response.candidates[0].content.parts[0].text;
          const summaryPath = path.join(ctx.baseDir, fileId, "summary.txt");
          fs.writeFileSync(summaryPath, summaryText);
          ctx.updateFileStatus(status!, "summaryFile", "completed", summaryPath);
          ctx.saveFileStatus(status!);
        })
        .catch((e: any) => ctx.updateFileStatus(status!, "summaryFile", "error", undefined, e.message));
      processingPromises.push(summaryPromise);
    }

    if (status.detailedDescriptionFile.status !== "completed") {
      ctx.updateFileStatus(status, "detailedDescriptionFile", "processing");
      ctx.saveFileStatus(status);
      const detailedDescriptionPromise = geminiAI.models
        .generateContent({
          model: "gemini-2.5-flash",
          contents: [{ fileData: { fileUri: youtubeData.url } }, { text: "Generate a detailed description of the video..." }],
        })
        .then((response: any) => {
          const text = response.candidates[0].content.parts[0].text;
          const filePath = path.join(ctx.baseDir, fileId, "detailed_description.txt");
          fs.writeFileSync(filePath, text);
          ctx.updateFileStatus(status!, "detailedDescriptionFile", "completed", filePath);
          ctx.saveFileStatus(status!);
        })
        .catch((e: any) => ctx.updateFileStatus(status!, "detailedDescriptionFile", "error", undefined, e.message));
      processingPromises.push(detailedDescriptionPromise);
    }

    if (status.transcriptFile.status !== "completed") {
      ctx.updateFileStatus(status, "transcriptFile", "processing");
      ctx.saveFileStatus(status);
      const transcriptPromise = geminiAI.models
        .generateContent({
          model: "gemini-2.5-flash",
          contents: [{ fileData: { fileUri: youtubeData.url } }, { text: "Generate a transcript of the video..." }],
        })
        .then((response: any) => {
          const text = response.candidates[0].content.parts[0].text;
          const filePath = path.join(ctx.baseDir, fileId, "transcript.txt");
          fs.writeFileSync(filePath, text);
          ctx.updateFileStatus(status!, "transcriptFile", "completed", filePath);
          ctx.saveFileStatus(status!);
        })
        .catch((e: any) => ctx.updateFileStatus(status!, "transcriptFile", "error", undefined, e.message));
      processingPromises.push(transcriptPromise);
    }

    if (status.transcriptWithTimestampsFile.status !== "completed") {
      ctx.updateFileStatus(status, "transcriptWithTimestampsFile", "processing");
      ctx.saveFileStatus(status);
      const transcriptWithTimestampsPromise = geminiAI.models
        .generateContent({
          model: "gemini-2.5-flash",
          contents: [
            { fileData: { fileUri: youtubeData.url } },
            { text: "Generate a transcript of the video with timestamps..." },
          ],
        })
        .then((response: any) => {
          const text = response.candidates[0].content.parts[0].text;
          const filePath = path.join(ctx.baseDir, fileId, "transcript_with_timestamps.txt");
          fs.writeFileSync(filePath, text);
          ctx.updateFileStatus(status!, "transcriptWithTimestampsFile", "completed", filePath);
          ctx.saveFileStatus(status!);
        })
        .catch((e: any) =>
          ctx.updateFileStatus(status!, "transcriptWithTimestampsFile", "error", undefined, e.message),
        );
      processingPromises.push(transcriptWithTimestampsPromise);
    }

    await Promise.all(processingPromises);

    ctx.saveFileStatus(status);

    await ctx.updateParentStatus((parentStatus) => {
      parentStatus.processingFiles--;
      if (status!.overallStatus === "completed") {
        parentStatus.completedFiles++;
      } else if (status!.overallStatus === "error" || status!.overallStatus === "partial") {
        parentStatus.errorFiles++;
      }
    });

    // Only send messages and notifications if session is not paused and connected
    if (!ctx.isPaused() && ctx.isLlmConnected()) {
      ctx.mainWindow.webContents.send(
        "sendMessageToClient",
        `SYSTEM NOTIFICATION:
The following item has been processed and added to the context. Do not acknowledge this notification.
Item: ${status.fileName} (ID: ${status.fileId})
Content types: ${ctx.getAvailableContentTypes(status.fileType).join(", ")}
To use the content, call get_file_content('${status.fileId}', 'content_type').`,
      );
      
      // Notify renderer about file being auto-added to context
      ctx.mainWindow.webContents.send("file-added-to-context", {
        fileId: status.fileId,
        fileName: status.fileName,
        auto: true,
      });
    } else {
      console.log(`Skipping YouTube Video notifications - session ${ctx.isPaused() ? "paused" : "disconnected"}`);
    }
  } catch (error) {
    console.error(`Error processing YouTube video ${fileId}:`, error);
    status.overallStatus = "error";
    ctx.saveFileStatus(status);
    await ctx.updateParentStatus((parentStatus) => {
      parentStatus.processingFiles--;
      parentStatus.errorFiles++;
      parentStatus.files[fileId] = status!;
    });
  }
}


