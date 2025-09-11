import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { exec } from "child_process";

const execPromise = util.promisify(exec);

/**
 * Utilities shared across media operations (audio/video)
 */

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

export async function generateSilence(duration: number, filePath: string): Promise<void> {
  const command = `ffmpeg -f lavfi -i anullsrc=r=24000:cl=mono -t ${duration} -c:a pcm_s16le "${filePath}"`;
  await execPromise(command);
}

export async function stitchAudioFiles(
  concatFile: string,
  outputFile: string,
  exportMp3: boolean,
): Promise<void> {
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


