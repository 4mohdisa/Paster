import * as fs from "fs";
import * as path from "path";
import { FileProcessor, FileProcessorContext } from "./base-processor";
import { SelectedFile } from "../types";

export class AudioVideoProcessor implements FileProcessor {
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

      const summaryPromise = context.geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Extract the summary of the ${status.fileType}` },
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

      // Generate transcript
      context.updateFileStatus(status, "transcriptFile", "processing");
      context.saveFileStatus(status);

      const transcriptPromise = context.geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              { text: `Extract the transcript of the ${status.fileType}` },
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

      // Generate transcript with timestamps
      context.updateFileStatus(status, "transcriptWithTimestampsFile", "processing");
      context.saveFileStatus(status);

      const transcriptWithTimestampsPromise = context.geminiAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          {
            role: "user",
            parts: [
              {
                text: `Extract the transcript of the ${status.fileType} with timestamps`,
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

      const [summaryResponse, transcriptResponse, transcriptWithTimestampsResponse] = await Promise.all([
        summaryPromise,
        transcriptPromise,
        transcriptWithTimestampsPromise,
      ]);

      const summaryText = summaryResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      const transcriptText = transcriptResponse.candidates?.[0]?.content?.parts?.[0]?.text;
      const transcriptWithTimestampsText = transcriptWithTimestampsResponse.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!summaryText) {
        throw new Error("Failed to get summary from Gemini response");
      }
      if (!transcriptText) {
        throw new Error("Failed to get transcript from Gemini response");
      }
      if (!transcriptWithTimestampsText) {
        throw new Error("Failed to get transcript with timestamps from Gemini response");
      }

      // Save files
      const summaryPath = path.join(context.baseDir, status.fileId, "summary.txt");
      const transcriptPath = path.join(context.baseDir, status.fileId, "transcript.txt");
      const transcriptWithTimestampsPath = path.join(context.baseDir, status.fileId, "transcript_with_timestamps.txt");

      fs.writeFileSync(summaryPath, summaryText);
      fs.writeFileSync(transcriptPath, transcriptText);
      fs.writeFileSync(transcriptWithTimestampsPath, transcriptWithTimestampsText);

      context.updateFileStatus(status, "summaryFile", "completed", summaryPath);
      context.updateFileStatus(status, "transcriptFile", "completed", transcriptPath);
      context.updateFileStatus(status, "transcriptWithTimestampsFile", "completed", transcriptWithTimestampsPath);
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
      context.updateFileStatus(status, "transcriptFile", "error", undefined, errorMessage);
      context.updateFileStatus(status, "transcriptWithTimestampsFile", "error", undefined, errorMessage);
      context.saveFileStatus(status);
      throw error;
    }
  }
}