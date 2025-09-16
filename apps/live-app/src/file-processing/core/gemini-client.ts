import { File as GeminiFile } from "@google/genai";

export class GeminiClient {
  private geminiAI: any;

  constructor(geminiAI: any) {
    this.geminiAI = geminiAI;
  }

  async uploadFileToGemini(
    filePath: string,
  ): Promise<{ processedFile: GeminiFile; uploadedName: string }> {
    console.log(`Uploading file to Gemini: ${filePath}...`);
    const uploadedFile = await this.geminiAI.files.upload({
      file: filePath,
    });

    if (!uploadedFile.name) {
      throw new Error("Failed to get uploaded file name from Gemini");
    }

    console.log(
      `Uploaded file '${uploadedFile.name}'. Waiting for processing...`,
    );

    let processedFile = await this.geminiAI.files.get({ name: uploadedFile.name });
    while (processedFile.state === "PROCESSING") {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      processedFile = await this.geminiAI.files.get({ name: uploadedFile.name });
      console.log(`File state: ${processedFile.state}`);
    }

    if (processedFile.state === "FAILED") {
      throw new Error(
        `File processing failed: ${processedFile.name || "unknown"}`,
      );
    }
    return { processedFile, uploadedName: uploadedFile.name };
  }

  async deleteGeminiFile(name: string): Promise<void> {
    try {
      await this.geminiAI.files.delete({ name });
    } catch (error) {
      console.error(`Error deleting Gemini file '${name}':`, error);
    }
  }

  async generateContent(params: {
    model: string;
    contents: any[];
  }): Promise<any> {
    return await this.geminiAI.models.generateContent(params);
  }

  async generateImageDescription(processedFile: GeminiFile): Promise<string> {
    const description = await this.generateContent({
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
    return descriptionText;
  }

  async generateTextSummary(processedFile: GeminiFile): Promise<string> {
    const summaryResponse = await this.generateContent({
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
    return summaryText;
  }

  async extractPdfContent(processedFile: GeminiFile): Promise<{ text: string; summary: string }> {
    const textPromise = this.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Extract the text of the pdf` },
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

    const summaryPromise = this.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Extract the summary of the pdf` },
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

    const [textResult, summaryResult] = await Promise.all([textPromise, summaryPromise]);

    const textContent = textResult.candidates?.[0]?.content?.parts?.[0]?.text;
    const summaryText = summaryResult.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!textContent) {
      throw new Error("Failed to get text content from Gemini response");
    }
    if (!summaryText) {
      throw new Error("Failed to get summary from Gemini response");
    }

    return { text: textContent, summary: summaryText };
  }

  async processAudioVideo(processedFile: GeminiFile, fileType: string): Promise<{
    summary: string;
    transcript: string;
    transcriptWithTimestamps: string;
  }> {
    const summaryPromise = this.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Extract the summary of the ${fileType}` },
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

    const transcriptPromise = this.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            { text: `Extract the transcript of the ${fileType}` },
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

    const transcriptWithTimestampsPromise = this.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `Extract the transcript of the ${fileType} with timestamps`,
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

    return {
      summary: summaryText,
      transcript: transcriptText,
      transcriptWithTimestamps: transcriptWithTimestampsText,
    };
  }

  async generateYouTubeContent(url: string, contentType: string): Promise<string> {
    const response = await this.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { fileData: { fileUri: url } },
        { text: this.getYouTubePrompt(contentType) }
      ],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`Failed to get ${contentType} from Gemini response`);
    }
    return text;
  }

  async generateWebpageContent(content: string, contentType: string): Promise<string> {
    const response = await this.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ text: this.getWebpagePrompt(contentType, content) }],
    });

    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error(`Failed to get ${contentType} from Gemini response`);
    }
    return text;
  }

  private getYouTubePrompt(contentType: string): string {
    switch (contentType) {
    case "summary":
      return "Summarize the video in 3 sentences.";
    case "detailed_description":
      return "Generate a detailed description of the video...";
    case "transcript":
      return "Generate a transcript of the video...";
    case "transcript_with_timestamps":
      return "Generate a transcript of the video with timestamps...";
    default:
      return "Analyze the video content.";
    }
  }

  private getWebpagePrompt(contentType: string, content: string): string {
    switch (contentType) {
    case "summary":
      return `Generate a summary of the following page: ${content}`;
    case "formatted_text":
      return `Format the following page data, extracting the main content and structuring it cleanly: ${content}`;
    default:
      return `Analyze the following page content: ${content}`;
    }
  }
}