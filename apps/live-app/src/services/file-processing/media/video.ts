import * as util from "util";
import { exec } from "child_process";

const execPromise = util.promisify(exec);

export async function getVideoFrameSize(
  filePath: string,
): Promise<{ width: number; height: number } | null> {
  const command = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "${filePath}"`;
  try {
    const { stdout } = await execPromise(command);
    const [width, height] = stdout.trim().split("x").map(Number);
    if (width && height) {
      return { width, height };
    }
    return null;
  } catch (error) {
    console.error(`Error getting video frame size for ${filePath}:`, error);
    return null;
  }
}

export async function generateBlackFrame(filePath: string, width: number, height: number): Promise<void> {
  const command = `ffmpeg -y -f lavfi -i color=c=black:s=${width}x${height}:r=1 -vframes 1 "${filePath}"`;
  try {
    await execPromise(command);
  } catch (error) {
    console.error(`Error generating black frame ${filePath}:`, error);
    throw error;
  }
}


