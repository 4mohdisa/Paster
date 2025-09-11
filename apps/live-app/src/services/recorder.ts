import { arrayBufferToBase64 } from "../utils/utils";

/**
 * AudioRecorder manages the capture and processing of audio input from the user's microphone.
 * It uses the Web Audio API and AudioWorklet to process audio in real-time with minimal latency.
 * The processed audio is converted to base64-encoded Int16 format suitable for transmission.
 */
export class AudioRecorder extends EventTarget {
  private sampleRate: number;
  private stream: MediaStream | null;
  private audioContext: AudioContext | null;
  private source: MediaStreamAudioSourceNode | null;
  private processor: AudioWorkletNode | null;
  private onAudioData: ((base64Data: string, timestamp: number) => void) | null;
  public isRecording: boolean;
  private isSuspended: boolean;

  /**
   * Creates an AudioRecorder instance
   */
  constructor() {
    super();
    // Core audio configuration
    this.sampleRate = 16000; // Sample rate in Hz
    this.stream = null; // MediaStream from getUserMedia
    this.audioContext = null; // AudioContext for Web Audio API
    this.source = null; // MediaStreamAudioSourceNode
    this.processor = null; // AudioWorkletNode for processing
    this.onAudioData = null; // Callback for processed audio chunks
    this.isRecording = false; // Recording state flag
    this.isSuspended = false; // Mic suspension state
  }

  /**
   * Initializes and starts audio capture pipeline
   * Sets up audio context, worklet processor, and media stream
   * @param onAudioData - Callback receiving base64-encoded audio chunks
   */
  async start(onAudioData: (base64Data: string, timestamp: number) => void): Promise<void> {
    this.onAudioData = onAudioData;
    try {
      // Request microphone access with specific echo cancelation and noise reduction
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: this.sampleRate,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } as MediaTrackConstraints,
      });

      // Initialize Web Audio API context and nodes
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      this.source = this.audioContext.createMediaStreamSource(this.stream);

      // Load and initialize audio processing worklet
      await this.audioContext.audioWorklet.addModule("/src/services/worklets/audio-processor.js");
      this.processor = new AudioWorkletNode(this.audioContext, "audio-recorder-worklet");

      // Handle processed audio chunks from worklet
      this.processor.port.onmessage = (event: MessageEvent<any>) => {
        if (!this.isRecording) return;

        if (event.data.event === "chunk" && this.onAudioData) {
          const timestamp = Date.now();
          const base64Data = arrayBufferToBase64(event.data.data.int16arrayBuffer) as string;
          this.onAudioData(base64Data, timestamp);
        }
      };

      // Connect audio processing pipeline
      this.source.connect(this.processor);
      this.processor.connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (error: any) {
      throw new Error("Failed to start audio recording:" + error);
    }
  }

  /**
   * Gracefully stops audio recording and cleans up resources
   * Stops media tracks and logs the operation completion
   */
  async stop(): Promise<void> {
    try {
      if (!this.isRecording) {
        return;
      }

      // Stop all active media tracks
      if (this.stream) {
        this.stream.getTracks().forEach((track) => track.stop());
        this.stream = null;
      }

      this.isRecording = false;
      console.info("Audio recording stopped");

      if (this.audioContext) {
        await this.audioContext.close();
      }
    } catch (error: any) {
      throw new Error("Failed to stop audio recording:" + error);
    }
  }

  /**
   * Suspends microphone input without destroying the audio context
   */
  async suspendMic(): Promise<void> {
    if (!this.isRecording || this.isSuspended) return;

    try {
      await this.audioContext!.suspend();
      this.stream!.getTracks().forEach((track) => (track.enabled = false));
      this.isSuspended = true;
      console.info("Microphone suspended");
    } catch (error: any) {
      throw new Error("Failed to suspend microphone:" + error);
    }
  }

  /**
   * Resumes microphone input if previously suspended
   */
  async resumeMic(): Promise<void> {
    if (!this.isRecording || !this.isSuspended) return;

    try {
      await this.audioContext!.resume();
      this.stream!.getTracks().forEach((track) => (track.enabled = true));
      this.isSuspended = false;
      console.info("Microphone resumed");
    } catch (error: any) {
      throw new Error("Failed to resume microphone:" + error);
    }
  }

  /**
   * Toggles microphone state between suspended and active
   */
  async toggleMic(): Promise<void> {
    if (this.isSuspended) {
      await this.resumeMic();
    } else {
      await this.suspendMic();
    }
  }
}
