import Groq from "groq-sdk";
import { getCredentialManager } from "../credential-manager";
import { getLogger, Logger } from "../logger";
import { ISttBackend, SttResult } from "../../types/stt";
import { AudioBuffer } from "../../types/audio";
import { SttBackend as SttBackendType } from "../../types/config";
import { ErrorCode } from "../../types/errors";

// ============================================================================
// Constants
// ============================================================================

/** Credential key for the STT API key */
const STT_API_KEY_CREDENTIAL = "stt-api-key" as const;

/** Whisper model to use for transcription */
const WHISPER_MODEL = "whisper-large-v3";

/** Timeout for API calls in milliseconds */
const API_TIMEOUT_MS = 30000;

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when the Groq STT backend fails.
 */
export class GroqSttError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "GroqSttError";
  }
}

// ============================================================================
// Implementation
// ============================================================================

export class GroqSttBackend implements ISttBackend {
  readonly name: SttBackendType = "cloud";
  private readonly logger: Logger;
  private groqClient: Groq | null = null;

  constructor() {
    this.logger = getLogger().child({ component: "SttBackend:Groq" });
  }

  async transcribe(audio: AudioBuffer): Promise<SttResult> {
    const startTime = Date.now();
    this.logger.debug("Starting transcription", {
      format: audio.format,
      sampleRate: audio.sampleRate,
      channels: audio.channels,
      durationMs: audio.durationMs,
    });

    try {
      // Initialize client if not already done
      if (!this.groqClient) {
        await this.initializeClient();
      }

      // Convert AudioBuffer to File for Groq SDK
      const audioFile = this.createAudioFile(audio);

      // Call Groq API with timeout
      const transcription = await this.callWithTimeout(
        this.groqClient!.audio.transcriptions.create({
          file: audioFile,
          model: WHISPER_MODEL,
        }),
        API_TIMEOUT_MS
      );

      const processingDurationMs = Date.now() - startTime;
      this.logger.info("Transcription completed", {
        processingDurationMs,
        audioDurationMs: audio.durationMs,
        backend: this.name,
      });

      return {
        text: transcription.text,
        durationMs: audio.durationMs,
        backendUsed: this.name,
      };
    } catch (error) {
      const processingDurationMs = Date.now() - startTime;
      this.logger.error("Transcription failed", {
        processingDurationMs,
        audioDurationMs: audio.durationMs,
        error: error instanceof Error ? error.message : String(error),
      });

      throw this.mapError(error);
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const credentialManager = getCredentialManager();
      const hasApiKey = await credentialManager.hasCredential(STT_API_KEY_CREDENTIAL);

      this.logger.debug("Availability check completed", { available: hasApiKey });
      return hasApiKey;
    } catch (error) {
      this.logger.warn("Availability check failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Initialize the Groq client with the API key from credential manager.
   */
  private async initializeClient(): Promise<void> {
    this.logger.debug("Initializing Groq client");

    try {
      const credentialManager = getCredentialManager();
      const apiKey = await credentialManager.getCredential(STT_API_KEY_CREDENTIAL);

      if (!apiKey) {
        throw new GroqSttError(
          "STT API key not found in credential manager",
          ErrorCode.STT_INITIALIZATION_FAILED
        );
      }

      this.groqClient = new Groq({
        apiKey,
        timeout: API_TIMEOUT_MS,
      });

      this.logger.info("Groq client initialized successfully");
    } catch (error) {
      if (error instanceof GroqSttError) {
        throw error;
      }

      const err = error instanceof Error ? error : new Error(String(error));
      throw new GroqSttError(
        `Failed to initialize Groq client: ${err.message}`,
        ErrorCode.STT_INITIALIZATION_FAILED,
        err
      );
    }
  }

  private createAudioFile(audio: AudioBuffer): File {
    const mimeType = audio.format === "wav" ? "audio/wav" : "audio/pcm";
    const extension = audio.format === "wav" ? "wav" : "raw";

    // Create a Blob from the ArrayBuffer
    const blob = new Blob([audio.data], { type: mimeType });

    // Create a File from the Blob
    return new File([blob], `audio.${extension}`, { type: mimeType });
  }

  private async callWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout>;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`API call timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      clearTimeout(timeoutId!);
      return result;
    } catch (error) {
      clearTimeout(timeoutId!);
      throw error;
    }
  }

  private mapError(error: unknown): GroqSttError {
    if (error instanceof GroqSttError) {
      return error;
    }

    const err = error instanceof Error ? error : new Error(String(error));
    const message = err.message.toLowerCase();

    // Check for authentication errors (401)
    if (
      message.includes("401") ||
      message.includes("unauthorized") ||
      message.includes("invalid api key") ||
      message.includes("authentication")
    ) {
      return new GroqSttError(
        `Authentication failed: ${err.message}`,
        ErrorCode.STT_INITIALIZATION_FAILED,
        err
      );
    }

    // Check for rate limit errors (429)
    if (message.includes("429") || message.includes("rate limit")) {
      return new GroqSttError(
        `Rate limit exceeded: ${err.message}`,
        ErrorCode.STT_TRANSCRIPTION_FAILED,
        err
      );
    }

    // Check for timeout errors
    if (message.includes("timeout") || message.includes("timed out")) {
      return new GroqSttError(
        `Request timed out: ${err.message}`,
        ErrorCode.STT_TRANSCRIPTION_FAILED,
        err
      );
    }

    // Check for network errors
    if (
      message.includes("network") ||
      message.includes("econnrefused") ||
      message.includes("econnreset") ||
      message.includes("fetch failed")
    ) {
      return new GroqSttError(
        `Network error: ${err.message}`,
        ErrorCode.STT_TRANSCRIPTION_FAILED,
        err
      );
    }

    // Default to transcription failed
    return new GroqSttError(
      `Transcription failed: ${err.message}`,
      ErrorCode.STT_TRANSCRIPTION_FAILED,
      err
    );
  }
}
