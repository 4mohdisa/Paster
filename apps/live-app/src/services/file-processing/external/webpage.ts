import * as fs from "fs";
import * as path from "path";

import { FileProcessingStatus, PageData, FileType } from "../types";

export interface WebpageContext {
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
  generateWebpageFileId: (url: string) => string;
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

export async function processWebpage(ctx: WebpageContext, tabData: PageData): Promise<void> {
  const { geminiAI } = ctx;
  const fileId = ctx.generateWebpageFileId(tabData.url);
  let status = ctx.loadFileStatus(fileId);

  if (status && status.overallStatus === "completed") {
    console.log(`Webpage ${fileId} already processed. Skipping.`);
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
      const relevantFiles = ctx.getRelevantFilesForType("webpage");
      const newStatus: FileProcessingStatus = {
        fileId,
        originalPath: tabData.url,
        fileName: tabData.title,
        fileExtension: ".webpage",
        fileType: "webpage",
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

  if (!status) return;
  ctx.saveFileStatus(status);

  try {
    const processingPromises: Promise<any>[] = [];

    // Raw Text saving
    if (status.textFile.status !== "completed") {
      ctx.updateFileStatus(status, "textFile", "processing");
      ctx.saveFileStatus(status);
      const textPath = path.join(ctx.baseDir, fileId, "text.txt");
      fs.writeFileSync(textPath, tabData.body);
      
      // Send immediate LLM notification with webpage content
      if (!ctx.isPaused() && ctx.isLlmConnected()) {
        ctx.mainWindow.webContents.send(
          "sendMessageToClient", 
          `New webpage content available:
Title: ${tabData.title}
URL: ${tabData.url}
Content: ${tabData.body}

This webpage data has been saved and is being processed. You can reference this content in our conversation.`,
        );
      }
      
      ctx.updateFileStatus(status, "textFile", "completed", textPath);
      ctx.saveFileStatus(status);
    }

    // Summary Processing
    if (status.summaryFile.status !== "completed") {
      ctx.updateFileStatus(status, "summaryFile", "processing");
      ctx.saveFileStatus(status);
      const summaryPromise = geminiAI.models
        .generateContent({
          model: "gemini-2.5-flash",
          contents: [{ text: `Generate a summary of the following page: ${tabData.body}` }],
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

    // Formatted Text Processing
    if (status.formattedTextFile.status !== "completed") {
      ctx.updateFileStatus(status, "formattedTextFile", "processing");
      ctx.saveFileStatus(status);
      const formattedTextPromise = geminiAI.models
        .generateContent({
          model: "gemini-2.5-flash",
          contents: [
            {
              text: `Format the following page data, extracting the main content and structuring it cleanly: ${tabData.body}`,
            },
          ],
        })
        .then((response: any) => {
          const formattedText = response.candidates[0].content.parts[0].text;
          const formattedTextPath = path.join(ctx.baseDir, fileId, "formatted_text.txt");
          fs.writeFileSync(formattedTextPath, formattedText);
          ctx.updateFileStatus(status!, "formattedTextFile", "completed", formattedTextPath);
          ctx.saveFileStatus(status!);
        })
        .catch((e: any) => ctx.updateFileStatus(status!, "formattedTextFile", "error", undefined, e.message));
      processingPromises.push(formattedTextPromise);
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
      parentStatus.files[fileId] = status!;
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
      console.log(`Skipping webpage notifications - session ${ctx.isPaused() ? "paused" : "disconnected"}`);
    }
  } catch (error) {
    console.error(`Error processing webpage ${fileId}:`, error);
    status.overallStatus = "error";
    ctx.saveFileStatus(status);
    await ctx.updateParentStatus((parentStatus) => {
      parentStatus.processingFiles--;
      parentStatus.errorFiles++;
      parentStatus.files[fileId] = status!;
    });
  }
}


