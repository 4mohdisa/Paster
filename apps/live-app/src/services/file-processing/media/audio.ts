import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { spawn, exec } from "child_process";

import { decode } from "../../../utils/utils";

const execPromise = util.promisify(exec);

class ProcessPool {
  private activeProcesses = 0;
  private readonly maxConcurrency: number;
  private readonly queue: Array<() => void> = [];

  constructor(maxConcurrency = 5) {
    this.maxConcurrency = maxConcurrency;
  }

  async execute<T>(task: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const executeTask = async () => {
        this.activeProcesses++;
        try {
          const result = await task();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          this.activeProcesses--;
          this.processQueue();
        }
      };

      if (this.activeProcesses < this.maxConcurrency) {
        executeTask();
      } else {
        this.queue.push(executeTask);
      }
    });
  }

  private processQueue() {
    if (this.queue.length > 0 && this.activeProcesses < this.maxConcurrency) {
      const nextTask = this.queue.shift();
      if (nextTask) nextTask();
    }
  }
}

const processPool = new ProcessPool(5);

export function saveUserAudioChunkLocally(rootDir: string, data: string, timestamp?: number): void {
  const dir = path.join(rootDir, "media/audio");
  fs.mkdirSync(dir, { recursive: true });

  const buffer = Buffer.from(decode(data));
  if (buffer.length === 0) return;

  const chunkPath = path.join(dir, `chunk-${timestamp || Date.now()}.wav`);
  const ffmpegProcess = spawn("ffmpeg", [
    "-f",
    "s16le",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-i",
    "pipe:0",
    chunkPath,
  ]);
  ffmpegProcess.stdin.write(buffer);
  ffmpegProcess.stdin.end();
  ffmpegProcess.on("error", (err) => console.error("FFmpeg error (user audio):", err));
}

export function saveLlmAudioChunkLocally(rootDir: string, data: string): void {
  const dir = path.join(rootDir, "media/llm_audio");
  fs.mkdirSync(dir, { recursive: true });

  const buffer = Buffer.from(decode(data));
  if (buffer.length === 0) return;

  const chunkPath = path.join(dir, `chunk-${Date.now()}.wav`);
  const ffmpegProcess = spawn("ffmpeg", [
    "-f",
    "s16le",
    "-ar",
    "24000",
    "-ac",
    "1",
    "-i",
    "pipe:0",
    chunkPath,
  ]);
  ffmpegProcess.stdin.write(buffer);
  ffmpegProcess.stdin.end();
  ffmpegProcess.on("error", (err) => console.error("FFmpeg error (LLM audio):", err));
}

export async function stitchAudioChunks(rootDir: string, exportMp3: boolean): Promise<void> {
  const audioDir = path.join(rootDir, "media/audio");
  const tempDir = path.join(audioDir, "temp");

  try {
    console.log("Starting audio stitching process...");
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    const chunkFiles = fs.readdirSync(audioDir).filter((f) => f.startsWith("chunk-") && f.endsWith(".wav"));
    if (chunkFiles.length === 0) {
      console.log("No audio chunks found to stitch.");
      return;
    }

    console.log(`Found ${chunkFiles.length} audio chunks.`);

    const chunks: Array<{ filePath: string; startTime: number; duration: number; endTime: number }> = [];
    
    // Process chunks in parallel for better performance
    const chunkPromises = chunkFiles.map(async (file) => {
      const filePath = path.join(audioDir, file);
      const timestampMs = parseInt(file.replace("chunk-", "").replace(".wav", ""));
      if (isNaN(timestampMs)) return null;
      const startTime = timestampMs / 1000.0;
      const duration = await getMediaDuration(filePath);
      if (duration > 0) {
        console.log(`Audio chunk: ${file} -> start: ${startTime.toFixed(3)}s, duration: ${duration.toFixed(3)}s, end: ${(startTime + duration).toFixed(3)}s`);
        return { filePath, startTime, duration, endTime: startTime + duration };
      }
      return null;
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    chunks.push(...chunkResults.filter(chunk => chunk !== null));

    chunks.sort((a, b) => a.startTime - b.startTime);

    const concatFilePath = path.join(tempDir, "concat_list.txt");
    let fileListContent = "";
    let lastEndTime = chunks.length > 0 ? chunks[0].startTime : 0;

    for (const chunk of chunks) {
      const gap = chunk.startTime - lastEndTime;
      if (gap > 0.01) {
        const silenceFilePath = path.join(tempDir, `silence-${Date.now()}.wav`);
        await generateSilence(gap, silenceFilePath);
        fileListContent += `file '${silenceFilePath.replace(/\\/g, "/")}'\n`;
      }
      fileListContent += `file '${chunk.filePath.replace(/\\/g, "/")}'\n`;
      lastEndTime = chunk.endTime;
    }
    fs.writeFileSync(concatFilePath, fileListContent);

    const outputFilePath = path.join(rootDir, "media", exportMp3 ? "audio_stitched.mp3" : "audio_stitched.wav");
    await stitchAudioFiles(concatFilePath, outputFilePath, exportMp3);
  } catch (error) {
    console.error("An error occurred during the stitching process:", error);
    throw error;
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up temporary directory.");
    }
  }
}

export async function stitchLlmAudioChunks(rootDir: string, exportMp3: boolean): Promise<void> {
  const audioDir = path.join(rootDir, "media/llm_audio");
  const tempDir = path.join(audioDir, "temp");
  const outputFilePath = path.join(rootDir, "media", exportMp3 ? "llm_audio_stitched.mp3" : "llm_audio_stitched.wav");
  await stitchAndPadChunks(audioDir, tempDir, outputFilePath, "LLM", exportMp3);
}

async function stitchAndPadChunks(
  audioDir: string,
  tempDir: string,
  outputFilePath: string,
  logPrefix: string,
  exportMp3: boolean,
): Promise<void> {
  try {
    console.log(`Starting intelligent ${logPrefix} audio stitching...`);
    if (!fs.existsSync(audioDir)) {
      console.log(`${logPrefix} audio directory does not exist.`);
      return;
    }

    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    fs.mkdirSync(tempDir, { recursive: true });

    const chunkFiles = fs.readdirSync(audioDir).filter((f) => f.startsWith("chunk-") && f.endsWith(".wav"));
    if (chunkFiles.length === 0) {
      console.log(`No ${logPrefix} audio chunks found.`);
      return;
    }

    const chunks: Array<{ filePath: string; startTime: number; duration: number; endTime: number }> = [];
    
    // Process chunks in parallel for better performance
    const chunkPromises = chunkFiles.map(async (file) => {
      const filePath = path.join(audioDir, file);
      const timestampMs = parseInt(file.replace("chunk-", "").replace(".wav", ""));
      if (isNaN(timestampMs)) return null;
      const startTime = timestampMs / 1000.0;
      const duration = await getMediaDuration(filePath);
      if (duration > 0) {
        return { filePath, startTime, duration, endTime: startTime + duration };
      }
      return null;
    });
    
    const chunkResults = await Promise.all(chunkPromises);
    chunks.push(...chunkResults.filter(chunk => chunk !== null));
    chunks.sort((a, b) => a.startTime - b.startTime);

    const concatFilePath = path.join(tempDir, "concat_list.txt");
    let fileListContent = "";
    let lastEndTime = chunks.length > 0 ? chunks[0].startTime : 0;

    for (const chunk of chunks) {
      const gap = chunk.startTime - lastEndTime;
      if (gap > 0.01) {
        const silenceFilePath = path.join(tempDir, `silence-${Date.now()}.wav`);
        await generateSilence(gap, silenceFilePath);
        fileListContent += `file '${silenceFilePath.replace(/\\/g, "/")}'\n`;
      }
      fileListContent += `file '${chunk.filePath.replace(/\\/g, "/")}'\n`;
      lastEndTime = chunk.endTime;
    }
    fs.writeFileSync(concatFilePath, fileListContent);
    await stitchAudioFiles(concatFilePath, outputFilePath, exportMp3);
  } catch (error) {
    console.error(`Error during ${logPrefix} audio stitching:`, error);
    throw error;
  } finally {
    if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

async function getMediaDurationWithRetry(filePath: string, maxRetries = 3): Promise<number> {
  if (!fs.existsSync(filePath)) return 0;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { stdout } = await execPromise(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { timeout: 10000 },
      );
      const duration = parseFloat(stdout.trim());
      return isNaN(duration) ? 0 : duration;
    } catch (error: any) {
      console.error(`Error getting duration for ${filePath} (attempt ${attempt}/${maxRetries}):`, error.message);
      
      if (attempt < maxRetries) {
        const delay = Math.min(1000 * attempt, 3000);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error(`Failed to get duration after ${maxRetries} attempts, using fallback`);
        return getFileSizeBasedDuration(filePath);
      }
    }
  }
  return 0;
}

function getFileSizeBasedDuration(filePath: string): number {
  try {
    const stats = fs.statSync(filePath);
    const fileSizeBytes = stats.size;
    const estimatedDuration = fileSizeBytes / (16000 * 2 * 1);
    console.log(
      `Using file-size based duration estimate: ${estimatedDuration.toFixed(3)}s for ${path.basename(filePath)}`,
    );
    return estimatedDuration;
  } catch (error) {
    console.error(`Failed to get file size for duration estimate:`, error);
    return 0.2;
  }
}

export async function getMediaDuration(filePath: string): Promise<number> {
  return processPool.execute(() => getMediaDurationWithRetry(filePath));
}

export async function getAudioDuration(filePath: string): Promise<number> {
  return getMediaDuration(filePath);
}

async function generateSilence(duration: number, filePath: string): Promise<void> {
  const command = `ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t ${duration} -c:a pcm_s16le "${filePath}"`;
  await execPromise(command);
}

async function stitchAudioFiles(concatFile: string, outputFile: string, exportMp3: boolean): Promise<void> {
  if (exportMp3) {
    const wavOutputFile = outputFile.replace(".mp3", ".wav");
    const wavCommand = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${wavOutputFile}"`;
    await execPromise(wavCommand);

    const mp3Command = `ffmpeg -y -i "${wavOutputFile}" -codec:a libmp3lame -b:a 192k "${outputFile}"`;
    await execPromise(mp3Command);

    if (fs.existsSync(wavOutputFile)) {
      fs.unlinkSync(wavOutputFile);
    }

    console.log(`Successfully created final audio file at ${outputFile} (MP3)`);
  } else {
    const command = `ffmpeg -y -f concat -safe 0 -i "${concatFile}" -c copy "${outputFile}"`;
    await execPromise(command);
    console.log(`Successfully created final audio file at ${outputFile}`);
  }
}


