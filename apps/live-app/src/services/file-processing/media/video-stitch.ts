import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { exec } from "child_process";

const execPromise = util.promisify(exec);

export interface VideoStitchDeps {
  getVideoFrameSize: (filePath: string) => Promise<{ width: number; height: number } | null>;
  generateBlackFrame: (filePath: string, width: number, height: number) => Promise<void>;
}

export async function stitchVideoFrames(
  rootDir: string,
  deps: VideoStitchDeps,
  frameRate: number,
): Promise<void> {
  const baseVideoDir = path.join(rootDir, "media/video");
  const framesDir = path.join(baseVideoDir, "frames");
  const tempDir = path.join(baseVideoDir, "temp_video_stitch");
  const outputFileName = "stitched_video.mp4";
  const outputFilePath = path.join(rootDir, "media", outputFileName);

  try {
    console.log("Starting intelligent video stitching process...");
    if (!fs.existsSync(framesDir)) {
      console.log("Video frames directory does not exist. Creating empty black video.");
      await createEmptyBlackVideo(outputFilePath);
      return;
    }

    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    const frameFiles = fs.readdirSync(framesDir).filter((f) => f.startsWith("frame-") && f.endsWith(".jpg"));
    if (frameFiles.length === 0) {
      console.log("No video frames found to stitch. Creating empty black video.");
      await createEmptyBlackVideo(outputFilePath);
      return;
    }

    console.log(`Found ${frameFiles.length} video frames. Preparing for stitching at ${frameRate}fps.`);

    const firstFramePath = path.join(framesDir, frameFiles[0]);
    const frameSize = await deps.getVideoFrameSize(firstFramePath);
    if (!frameSize) {
      console.error("Could not determine video frame size. Aborting stitch.");
      return;
    }
    console.log(`Determined frame size: ${frameSize.width}x${frameSize.height}`);

    const blackFramePath = path.join(tempDir, "black.jpg").replace(/\\/g, "/");
    await deps.generateBlackFrame(blackFramePath, frameSize.width, frameSize.height);

    const frames = frameFiles
      .map((file) => {
        const filePath = path.join(framesDir, file);
        const timestampMs = parseInt(file.replace("frame-", "").replace(".jpg", ""));
        return { filePath: filePath.replace(/\\/g, "/"), timestamp: timestampMs };
      })
      .sort((a, b) => a.timestamp - b.timestamp);

    const concatFilePath = path.join(tempDir, "concat_list.txt");
    let fileListContent = "";
    let lastTimestamp: number | null = null;
    const singleFrameDuration = 1.0 / frameRate;

    for (const frame of frames) {
      if (lastTimestamp) {
        const timeDiffSec = (frame.timestamp - lastTimestamp) / 1000.0;
        if (timeDiffSec > singleFrameDuration * 1.5) {
          // Fill gap with black frames to maintain timeline accuracy
          const gapDuration = timeDiffSec - singleFrameDuration; // Account for previous frame duration
          if (gapDuration > 0) {
            console.log(`Gap detected between frames. Adding ${gapDuration.toFixed(3)}s of black screen.`);
            fileListContent += `file '${blackFramePath}'\n`;
            fileListContent += `duration ${gapDuration}\n`;
          }
        }
      }

      fileListContent += `file '${frame.filePath}'\n`;
      fileListContent += `duration ${singleFrameDuration}\n`;

      lastTimestamp = frame.timestamp;
    }

    // Add final frame with proper duration to prevent abrupt ending
    if (frames.length > 0) {
      fileListContent += `file '${frames[frames.length - 1].filePath}'\n`;
      fileListContent += `duration 0\n`; // Final frame holds until end
    }

    fs.writeFileSync(concatFilePath, fileListContent);

    // Use video filter to ensure proper dimensions and encoding for H.264
    const command = `ffmpeg -y -f concat -safe 0 -i "${concatFilePath}" -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=${frameRate}" -c:v libx264 -pix_fmt yuv420p "${outputFilePath}"`;
    console.log(`Executing ffmpeg command...`);
    const { stderr } = await execPromise(command);
    if (stderr) {
      console.log(`ffmpeg output: ${stderr}`);
    }
    
    // Verify the output file was created and is valid
    if (!fs.existsSync(outputFilePath)) {
      throw new Error(`Video stitching failed: output file not created`);
    }
    
    const stats = fs.statSync(outputFilePath);
    if (stats.size === 0) {
      throw new Error(`Video stitching failed: output file is empty`);
    }
    
    console.log(`Successfully stitched video with gaps filled to ${outputFilePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error("An error occurred during the video stitching process:", error);
    // Create fallback empty video if frames exist but stitching failed
    try {
      await createEmptyBlackVideo(outputFilePath);
      console.log("Created fallback empty video due to stitching error");
    } catch (fallbackError) {
      console.error("Failed to create fallback video:", fallbackError);
      throw error; // Re-throw original error if fallback also fails
    }
  } finally {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
      console.log("Cleaned up temporary video stitch directory.");
    }
  }
}

async function createEmptyBlackVideo(outputFilePath: string): Promise<void> {
  try {
    // Create a 1-second black video as placeholder
    const command = `ffmpeg -y -f lavfi -i color=c=black:s=1280x720:d=1:r=15 -c:v libx264 -pix_fmt yuv420p "${outputFilePath}"`;
    await execPromise(command);
    console.log(`Created empty black video at ${outputFilePath}`);
  } catch (error) {
    console.error("Failed to create empty black video:", error);
    throw error;
  }
}


