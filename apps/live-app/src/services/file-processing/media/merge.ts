import * as fs from "fs";
import * as path from "path";
import * as util from "util";
import { exec } from "child_process";

const execPromise = util.promisify(exec);

export async function runTimelineMerge(
  rootDir: string,
  opts: {
    videoFilePath: string;
    userAudioFilePath: string;
    llmAudioFilePath: string;
    duration: number;
    videoStartOffset: number;
    userAudioStartOffset: number;
    llmAudioStartOffset: number;
  },
): Promise<void> {
  const outputFilePath = path.join(rootDir, "media", "final-movie-complete.mp4");

  // Validate inputs exist and are accessible
  const mediaFiles = [
    { path: opts.videoFilePath, name: "video", offset: opts.videoStartOffset },
    { path: opts.userAudioFilePath, name: "user audio", offset: opts.userAudioStartOffset },
    { path: opts.llmAudioFilePath, name: "LLM audio", offset: opts.llmAudioStartOffset },
  ];

  const availableMedia = mediaFiles.filter(media => {
    if (media.offset < 0) return false;
    if (!fs.existsSync(media.path)) {
      console.warn(`${media.name} file not found: ${media.path}`);
      return false;
    }
    const stats = fs.statSync(media.path);
    if (stats.size === 0) {
      console.warn(`${media.name} file is empty: ${media.path}`);
      return false;
    }
    return true;
  });

  if (availableMedia.length === 0) {
    throw new Error("No valid media files found for merging");
  }

  console.log(`Merging ${availableMedia.length} media streams:`, 
    availableMedia.map(m => `${m.name} (offset: ${m.offset.toFixed(3)}s)`).join(', '),
  );
  console.log(`Total duration: ${opts.duration.toFixed(3)}s`);

  const inputs: string[] = [];
  const filterComplexParts: string[] = [];
  const audioInputs: string[] = [];
  let inputIndex = 0;

  // Base black video
  inputs.push(`-f lavfi -i color=c=black:s=1280x720:d=${opts.duration}:r=15`);
  const videoStreamLabel = `[${inputIndex}:v]`;
  inputIndex++;

  // Video
  if (opts.videoStartOffset >= 0 && fs.existsSync(opts.videoFilePath)) {
    inputs.push(`-i "${opts.videoFilePath}"`);
    if (opts.videoStartOffset > 0.01) {
      filterComplexParts.push(`[${inputIndex}:v]tpad=start_duration=${opts.videoStartOffset}[v_delayed]`);
      filterComplexParts.push(`${videoStreamLabel}[v_delayed]overlay=0:0[v_out]`);
    } else {
      filterComplexParts.push(`${videoStreamLabel}[${inputIndex}:v]overlay=0:0[v_out]`);
    }
    inputIndex++;
  } else {
    filterComplexParts.push(`${videoStreamLabel}copy[v_out]`);
  }

  // User audio
  if (opts.userAudioStartOffset >= 0 && fs.existsSync(opts.userAudioFilePath)) {
    inputs.push(`-i "${opts.userAudioFilePath}"`);
    if (opts.userAudioStartOffset > 0.01) {
      const delayMs = Math.round(opts.userAudioStartOffset * 1000);
      filterComplexParts.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs}[user_audio]`);
      audioInputs.push("[user_audio]");
    } else {
      audioInputs.push(`[${inputIndex}:a]`);
    }
    inputIndex++;
  }

  // LLM audio
  if (opts.llmAudioStartOffset >= 0 && fs.existsSync(opts.llmAudioFilePath)) {
    inputs.push(`-i "${opts.llmAudioFilePath}"`);
    if (opts.llmAudioStartOffset > 0.01) {
      const delayMs = Math.round(opts.llmAudioStartOffset * 1000);
      filterComplexParts.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs}[llm_audio]`);
      audioInputs.push("[llm_audio]");
    } else {
      audioInputs.push(`[${inputIndex}:a]`);
    }
    inputIndex++;
  }

  // Mix audio with proper duration handling
  if (audioInputs.length === 0) {
    inputs.push(`-f lavfi -i anullsrc=channel_layout=stereo:sample_rate=44100:duration=${opts.duration}`);
    filterComplexParts.push(`[${inputIndex}:a]copy[audio_out]`);
  } else if (audioInputs.length === 1) {
    // Ensure single audio stream matches video duration
    filterComplexParts.push(`${audioInputs[0]}apad=pad_dur=${opts.duration}[audio_out]`);
  } else {
    // Mix multiple audio streams and pad to match video duration
    const audioMixFilter = `${audioInputs.join("")}amix=inputs=${audioInputs.length}:duration=longest,apad=pad_dur=${opts.duration}[audio_out]`;
    filterComplexParts.push(audioMixFilter);
  }

  const commandParts = [
    "ffmpeg",
    "-y",
    ...inputs,
    "-filter_complex",
    `"${filterComplexParts.join(";")}"`,
    '-map "[v_out]"',
    '-map "[audio_out]"',
    "-c:v libx264",
    "-c:a aac",
    "-t",
    opts.duration.toString(),
    `"${outputFilePath}"`,
  ];

  try {
    const command = commandParts.join(" ");
    console.log("Executing timeline-based ffmpeg merge:", command.substring(0, 200) + "...");
    
    const { stderr } = await execPromise(command);
    if (stderr) {
      console.log(`ffmpeg merge output: ${stderr}`);
    }
    
    // Verify output was created successfully
    if (!fs.existsSync(outputFilePath)) {
      throw new Error(`Output file was not created: ${outputFilePath}`);
    }
    
    const outputStats = fs.statSync(outputFilePath);
    if (outputStats.size === 0) {
      throw new Error(`Output file is empty: ${outputFilePath}`);
    }
    
    console.log(`Successfully created timeline-accurate movie at ${outputFilePath} (${(outputStats.size / 1024 / 1024).toFixed(2)} MB)`);
  } catch (error) {
    console.error("FFmpeg merge failed:", error);
    throw new Error(`Media merge failed: ${error.message}`);
  }
}


