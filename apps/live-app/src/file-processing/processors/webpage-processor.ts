import * as fs from "fs";
import * as path from "path";
import { WebpageProcessor, ExternalProcessorContext } from "./base-processor";
import { PageData, FileProcessingStatus } from "../types";

export class WebpageProcessorImpl implements WebpageProcessor {
  async process(context: ExternalProcessorContext, tabData: PageData): Promise<void> {
    if (!context.generateWebpageFileId) {
      throw new Error("generateWebpageFileId method required for webpage processing");
    }

    const { geminiAI } = context;
    const fileId = context.generateWebpageFileId(tabData.url);
    let status = context.loadFileStatus(fileId);

    if (status && status.overallStatus === "completed") {
      console.log(`Webpage ${fileId} already processed. Skipping.`);
      await context.updateParentStatus((parentStatus) => {
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

    await context.updateParentStatus((parentStatus) => {
      for (const key in parentStatus.files) {
        if (parentStatus.files[key].activeTab) {
          parentStatus.files[key].activeTab = false;
        }
      }

      if (!status) {
        const now = new Date().toISOString();
        const relevantFiles = context.getRelevantFilesForType("webpage");
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
    context.saveFileStatus(status);

    try {
      const processingPromises: Promise<any>[] = [];

      // Raw Text saving
      if (status.textFile.status !== "completed") {
        context.updateFileStatus(status, "textFile", "processing");
        context.saveFileStatus(status);
        const textPath = path.join(context.baseDir, fileId, "text.txt");
        fs.writeFileSync(textPath, tabData.body);

        // Send immediate LLM notification with webpage content
        if (!context.isPaused() && context.isLlmConnected()) {
          context.mainWindow.webContents.send(
            "sendMessageToClient",
            `New webpage content available:
Title: ${tabData.title}
URL: ${tabData.url}
Content: ${tabData.body}

This webpage data has been saved and is being processed. You can reference this content in our conversation.`,
          );
        }

        context.updateFileStatus(status, "textFile", "completed", textPath);
        context.saveFileStatus(status);
      }

      // Summary Processing
      if (status.summaryFile.status !== "completed") {
        context.updateFileStatus(status, "summaryFile", "processing");
        context.saveFileStatus(status);
        const summaryPromise = geminiAI.models
          .generateContent({
            model: "gemini-2.5-flash",
            contents: [{ text: `Generate a summary of the following page: ${tabData.body}` }],
          })
          .then((response: any) => {
            const summaryText = response.candidates[0].content.parts[0].text;
            const summaryPath = path.join(context.baseDir, fileId, "summary.txt");
            fs.writeFileSync(summaryPath, summaryText);
            context.updateFileStatus(status!, "summaryFile", "completed", summaryPath);
            context.saveFileStatus(status!);
          })
          .catch((e: any) => context.updateFileStatus(status!, "summaryFile", "error", undefined, e.message));
        processingPromises.push(summaryPromise);
      }

      // Formatted Text Processing
      if (status.formattedTextFile.status !== "completed") {
        context.updateFileStatus(status, "formattedTextFile", "processing");
        context.saveFileStatus(status);
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
            const formattedTextPath = path.join(context.baseDir, fileId, "formatted_text.txt");
            fs.writeFileSync(formattedTextPath, formattedText);
            context.updateFileStatus(status!, "formattedTextFile", "completed", formattedTextPath);
            context.saveFileStatus(status!);
          })
          .catch((e: any) => context.updateFileStatus(status!, "formattedTextFile", "error", undefined, e.message));
        processingPromises.push(formattedTextPromise);
      }

      await Promise.all(processingPromises);

      context.saveFileStatus(status);

      await context.updateParentStatus((parentStatus) => {
        parentStatus.processingFiles--;
        if (status!.overallStatus === "completed") {
          parentStatus.completedFiles++;
        } else if (status!.overallStatus === "error" || status!.overallStatus === "partial") {
          parentStatus.errorFiles++;
        }
        parentStatus.files[fileId] = status!;
      });

      // Only send messages and notifications if session is not paused and connected
      if (!context.isPaused() && context.isLlmConnected()) {
        context.mainWindow.webContents.send(
          "sendMessageToClient",
          `SYSTEM NOTIFICATION:
The following item has been processed and added to the context. Do not acknowledge this notification.
Item: ${status.fileName} (ID: ${status.fileId})
Content types: ${context.getAvailableContentTypes(status.fileType).join(", ")}
To use the content, call get_file_content('${status.fileId}', 'content_type').`,
        );

        // Notify renderer about file being auto-added to context
        context.mainWindow.webContents.send("file-added-to-context", {
          fileId: status.fileId,
          fileName: status.fileName,
          auto: true,
        });
      } else {
        console.log(`Skipping webpage notifications - session ${context.isPaused() ? "paused" : "disconnected"}`);
      }
    } catch (error) {
      console.error(`Error processing webpage ${fileId}:`, error);
      status.overallStatus = "error";
      context.saveFileStatus(status);
      await context.updateParentStatus((parentStatus) => {
        parentStatus.processingFiles--;
        parentStatus.errorFiles++;
        parentStatus.files[fileId] = status!;
      });
    }
  }
}

// Export the function for backward compatibility
export async function processWebpage(context: ExternalProcessorContext, tabData: PageData): Promise<void> {
  const processor = new WebpageProcessorImpl();
  await processor.process(context, tabData);
}