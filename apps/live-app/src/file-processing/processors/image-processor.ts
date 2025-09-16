import * as fs from "fs";
import * as path from "path";

import { SelectedFile } from "../types";
import { FileProcessor, FileProcessorContext } from "./base-processor";

export class ImageProcessor implements FileProcessor {
  async process(context: FileProcessorContext, file: SelectedFile): Promise<void> {
    const fileId = context.generateFileId(file.path);
    const status = context.loadFileStatus(fileId);

    if (!status) {
      throw new Error(`Status not found for file ID: ${fileId}`);
    }

    context.updateFileStatus(status, "descriptionFile", "processing");
    context.saveFileStatus(status);

    try {
      const { processedFile, uploadedName } = await context.uploadFileToGemini(file.path);

      const description = await context.geminiAI.models.generateContent({
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

      const descriptionText = description.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!descriptionText) {
        throw new Error("Failed to get description from Gemini response");
      }

      // Save description to file
      const descriptionPath = path.join(context.baseDir, status.fileId, "description.txt");
      fs.writeFileSync(descriptionPath, descriptionText);

      context.updateFileStatus(status, "descriptionFile", "completed", descriptionPath);
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
      context.updateFileStatus(status, "descriptionFile", "error", undefined, errorMessage);
      context.saveFileStatus(status);
      throw error;
    }
  }
}