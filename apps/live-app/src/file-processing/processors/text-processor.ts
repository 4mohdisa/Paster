import * as fs from "fs";
import * as path from "path";
import { FileProcessor, FileProcessorContext } from "./base-processor";
import { SelectedFile } from "../types";

export class TextProcessor implements FileProcessor {
  async process(context: FileProcessorContext, file: SelectedFile): Promise<void> {
    const fileId = context.generateFileId(file.path);
    const status = context.loadFileStatus(fileId);

    if (!status) {
      throw new Error(`Status not found for file ID: ${fileId}`);
    }

    try {
      const { processedFile, uploadedName } = await context.uploadFileToGemini(file.path);

      // Generate summary
      context.updateFileStatus(status, "summaryFile", "processing");
      context.saveFileStatus(status);

      const summaryResponse = await context.geminiAI.models.generateContent({
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

      const summaryText = summaryResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!summaryText) {
        throw new Error("Failed to get summary from Gemini response");
      }

      const summaryPath = path.join(context.baseDir, status.fileId, "summary.txt");
      fs.writeFileSync(summaryPath, summaryText);

      context.updateFileStatus(status, "summaryFile", "completed", summaryPath);
      context.saveFileStatus(status);

      // Extract text content
      context.updateFileStatus(status, "textFile", "processing");
      context.saveFileStatus(status);

      const textContent = fs.readFileSync(file.path, "utf8");
      const textPath = path.join(context.baseDir, status.fileId, "text.txt");
      fs.writeFileSync(textPath, textContent);

      context.updateFileStatus(status, "textFile", "completed", textPath);
      context.saveFileStatus(status);

      if (!context.isPaused()) {
        context.mainWindow.webContents.send(
          "sendMessageToClient",
          `SYSTEM NOTIFICATION:
The following file has been processed and added to the context. Do not acknowledge this notification.
File: ${file.name}${file.extension} (ID: ${status.fileId})
Content types: ${context.getAvailableContentTypes(status.fileType).join(", ")}
To use the file, call get_file_content('${status.fileId}', 'content_type').`,
        );

        // Notify renderer about file being auto-added to context
        context.mainWindow.webContents.send("file-added-to-context", {
          fileId: status.fileId,
          fileName: `${file.name}${file.extension}`,
          auto: true,
        });
      }

      await context.deleteGeminiFile(uploadedName);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      context.updateFileStatus(status, "summaryFile", "error", undefined, errorMessage);
      context.updateFileStatus(status, "textFile", "error", undefined, errorMessage);
      context.saveFileStatus(status);
      throw error;
    }
  }
}