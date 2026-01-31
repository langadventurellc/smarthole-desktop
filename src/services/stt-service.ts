import { getConfigManager } from "./config-manager";
import { getCredentialManager } from "./credential-manager";
import { getLogger, Logger } from "./logger";
import { GroqSttBackend } from "./stt-backends";
import { ISttBackend, SttResult, SttService } from "../types/stt";
import { SttBackend as SttBackendType } from "../types/config";
import { AudioBuffer } from "../types/audio";
import { ErrorCode } from "../types/errors";

// ============================================================================
// Constants
// ============================================================================

/** Credential key for the STT API key */
const STT_API_KEY_CREDENTIAL = "stt-api-key" as const;

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when the STT service fails to initialize or transcribe.
 */
export class SttServiceError extends Error {
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = "SttServiceError";
  }
}

// ============================================================================
// Implementation
// ============================================================================

class SttServiceImpl implements SttService {
  private readonly logger: Logger;
  private readonly backend: ISttBackend;
  private readonly backendType: SttBackendType;

  constructor(backend: ISttBackend, backendType: SttBackendType) {
    this.logger = getLogger().child({ component: "SttService" });
    this.backend = backend;
    this.backendType = backendType;

    this.logger.info("SttService initialized", {
      backend: backendType,
    });
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
      const result = await this.backend.transcribe(audio);
      const processingDurationMs = Date.now() - startTime;

      this.logger.info("Transcription completed", {
        processingDurationMs,
        audioDurationMs: audio.durationMs,
        backend: this.backendType,
      });

      return result;
    } catch (error) {
      const processingDurationMs = Date.now() - startTime;

      this.logger.error("Transcription failed", {
        processingDurationMs,
        audioDurationMs: audio.durationMs,
        backend: this.backendType,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  getActiveBackend(): SttBackendType {
    return this.backendType;
  }

  async isReady(): Promise<boolean> {
    return this.backend.isAvailable();
  }
}

// ============================================================================
// Backend Factory
// ============================================================================

async function createBackend(backendType: SttBackendType): Promise<ISttBackend> {
  const logger = getLogger().child({ component: "SttService" });

  if (backendType === "cloud") {
    logger.debug("Creating cloud STT backend (Groq)");

    // Verify API key exists before creating backend
    const credentialManager = getCredentialManager();
    const hasApiKey = await credentialManager.hasCredential(STT_API_KEY_CREDENTIAL);

    if (!hasApiKey) {
      throw new SttServiceError(
        "STT API key not found. Please configure the STT API key in settings.",
        ErrorCode.STT_INITIALIZATION_FAILED
      );
    }

    return new GroqSttBackend();
  }

  if (backendType === "local") {
    throw new SttServiceError(
      "Local STT backend is not yet implemented. Please use cloud backend.",
      ErrorCode.STT_INITIALIZATION_FAILED
    );
  }

  // This should never happen if the config validation is working correctly
  throw new SttServiceError(
    `Unknown STT backend type: ${String(backendType)}`,
    ErrorCode.STT_INITIALIZATION_FAILED
  );
}

// ============================================================================
// Singleton Management
// ============================================================================

let sttServiceInstance: SttServiceImpl | null = null;

/** Must be called inside `app.whenReady()` after logger, config manager, and credential manager. */
export async function initializeSttService(): Promise<SttService> {
  if (sttServiceInstance) {
    return sttServiceInstance;
  }

  const logger = getLogger().child({ component: "SttService" });
  logger.debug("Initializing STT service");

  // Read backend configuration
  const configManager = getConfigManager();
  const config = configManager.getConfig();
  const backendType = config.stt.backend;

  logger.debug("STT backend configuration", { backend: backendType });

  // Create the appropriate backend
  const backend = await createBackend(backendType);

  sttServiceInstance = new SttServiceImpl(backend, backendType);
  return sttServiceInstance;
}

export function getSttService(): SttService {
  if (!sttServiceInstance) {
    throw new Error(
      "SttService not initialized. Call initializeSttService() before using getSttService()."
    );
  }
  return sttServiceInstance;
}

export function resetSttService(): void {
  sttServiceInstance = null;
}
