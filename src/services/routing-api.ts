/**
 * Routing API Service
 *
 * Wraps the Anthropic SDK to invoke Claude Haiku for message routing decisions.
 * Retrieves the API key from CredentialManager and handles rate limiting with retry logic.
 */

import Anthropic from "@anthropic-ai/sdk";
import { getLogger, Logger } from "./logger";
import { getCredentialManager, CredentialManagerService } from "./credential-manager";
import { getToolGenerator } from "./tool-generator";
import {
  RoutingApiService,
  RoutingRequestParams,
  RoutingResult,
  RoutingDecision,
  RoutingError,
  RoutingTool,
  ToolGeneratorService,
  ErrorCode,
} from "../types";

// ============================================================================
// Constants
// ============================================================================

/** Claude Haiku model identifier */
const CLAUDE_HAIKU_MODEL = "claude-3-haiku-20240307";

/** Credential key for the Anthropic API key */
const API_KEY_CREDENTIAL = "anthropic-api-key";

/** Maximum number of retries for rate limit errors */
const MAX_RETRIES = 3;

/** Initial retry delay in milliseconds */
const INITIAL_RETRY_DELAY_MS = 1000;

/** Maximum tokens for the response */
const MAX_TOKENS = 1024;

// ============================================================================
// Helper Functions
// ============================================================================

function createError(code: ErrorCode, message: string, retryable: boolean): RoutingError {
  return { code, message, retryable };
}

/**
 * Sleeps for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Checks if an error is a rate limit error (HTTP 429).
 */
function isRateLimitError(error: unknown): boolean {
  if (error instanceof Anthropic.RateLimitError) {
    return true;
  }

  // Also check for rate_limit_error in the response
  if (error instanceof Anthropic.APIError && error.status === 429) {
    return true;
  }

  return false;
}

/**
 * Checks if an error is an authentication error (HTTP 401).
 */
function isAuthError(error: unknown): boolean {
  if (error instanceof Anthropic.AuthenticationError) {
    return true;
  }

  if (error instanceof Anthropic.APIError && error.status === 401) {
    return true;
  }

  return false;
}

function toAnthropicTools(tools: RoutingTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
  }));
}

// ============================================================================
// Implementation
// ============================================================================

class RoutingApiServiceImpl implements RoutingApiService {
  private readonly logger: Logger;
  private readonly credentialManager: CredentialManagerService;
  private readonly toolGenerator: ToolGeneratorService;
  private client: Anthropic | null = null;

  constructor(credentialManager: CredentialManagerService, toolGenerator: ToolGeneratorService) {
    this.logger = getLogger().child({ component: "RoutingApi" });
    this.credentialManager = credentialManager;
    this.toolGenerator = toolGenerator;

    this.logger.debug("RoutingApi initialized");
  }

  async routeMessage(params: RoutingRequestParams): Promise<RoutingResult> {
    const { userMessage, tools, systemPrompt, excludeClients, rejectionContext } = params;

    this.logger.debug("Routing message", {
      messageLength: userMessage.length,
      toolCount: tools.length,
      excludeClients,
      hasRejectionContext: !!rejectionContext,
    });

    // Filter tools if excludeClients is specified.
    // Callers can pre-filter using toolGenerator.generateToolsExcluding(), but we also
    // filter here as a safety net for callers who pass excludeClients directly.
    let effectiveTools = tools;
    if (excludeClients && excludeClients.length > 0) {
      effectiveTools = tools.filter((tool) => {
        const clientName = this.toolGenerator.resolveClientName(tool.name);
        return clientName === undefined || !excludeClients.includes(clientName);
      });
    }

    // Check if there are any tools available
    if (effectiveTools.length === 0) {
      this.logger.warn("No tools available for routing");
      return {
        success: false,
        error: createError(ErrorCode.ROUTING_NO_CLIENTS, "No clients available for routing", false),
      };
    }

    // Ensure client is initialized
    const clientResult = await this.ensureClient();
    if (!clientResult.success) {
      return clientResult;
    }

    // Build the user message, including rejection context if provided
    let fullUserMessage = userMessage;
    if (rejectionContext) {
      fullUserMessage = `${userMessage}\n\n[Context: ${rejectionContext}]`;
    }

    // Call Claude Haiku with retry logic
    return this.callWithRetry(fullUserMessage, effectiveTools, systemPrompt);
  }

  // ==========================================================================
  // Private Methods
  // ==========================================================================

  private async ensureClient(): Promise<
    { success: true } | { success: false; error: RoutingError }
  > {
    if (this.client) {
      return { success: true };
    }

    const apiKey = await this.credentialManager.getCredential(API_KEY_CREDENTIAL);

    if (!apiKey) {
      this.logger.error("Anthropic API key not found in credential manager");
      return {
        success: false,
        error: createError(
          ErrorCode.ROUTING_API_KEY_MISSING,
          "Anthropic API key not configured. Please add your API key in Settings.",
          false
        ),
      };
    }

    this.client = new Anthropic({ apiKey });
    this.logger.debug("Anthropic client initialized");
    return { success: true };
  }

  private async callWithRetry(
    userMessage: string,
    tools: RoutingTool[],
    systemPrompt: string
  ): Promise<RoutingResult> {
    let lastError: RoutingError | null = null;
    let delay = INITIAL_RETRY_DELAY_MS;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        this.logger.debug("Retrying after rate limit", { attempt, delayMs: delay });
        await sleep(delay);
        delay *= 2; // Exponential backoff
      }

      try {
        return await this.callClaude(userMessage, tools, systemPrompt);
      } catch (error) {
        if (isRateLimitError(error)) {
          this.logger.warn("Rate limit hit", { attempt, maxRetries: MAX_RETRIES });
          lastError = createError(
            ErrorCode.ROUTING_RATE_LIMITED,
            "Rate limit exceeded. Please wait and try again.",
            true
          );

          // Only retry if we haven't exhausted retries
          if (attempt < MAX_RETRIES) {
            continue;
          }
        } else if (isAuthError(error)) {
          this.logger.error("Authentication failed", { error: String(error) });
          // Invalidate client so it will be recreated with fresh credentials
          this.client = null;
          return {
            success: false,
            error: createError(
              ErrorCode.ROUTING_API_KEY_MISSING,
              "Invalid API key. Please check your API key in Settings.",
              false
            ),
          };
        } else {
          // Other errors are not retryable
          const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
          this.logger.error("Claude API request failed", { error: errorMessage });
          return {
            success: false,
            error: createError(
              ErrorCode.ROUTING_REQUEST_FAILED,
              `API request failed: ${errorMessage}`,
              false
            ),
          };
        }
      }
    }

    // If we get here, we exhausted retries on rate limit
    return {
      success: false,
      error:
        lastError ||
        createError(
          ErrorCode.ROUTING_REQUEST_FAILED,
          "Request failed after multiple retries",
          false
        ),
    };
  }

  private async callClaude(
    userMessage: string,
    tools: RoutingTool[],
    systemPrompt: string
  ): Promise<RoutingResult> {
    if (!this.client) {
      throw new Error("Client not initialized");
    }

    const response = await this.client.messages.create({
      model: CLAUDE_HAIKU_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      tools: toAnthropicTools(tools),
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    // Parse tool use blocks from the response
    const decisions = this.parseToolUseBlocks(response);

    this.logger.info("Routing completed", {
      decisionCount: decisions.length,
      stopReason: response.stop_reason,
    });

    return {
      success: true,
      decisions,
    };
  }

  private parseToolUseBlocks(response: Anthropic.Message): RoutingDecision[] {
    const decisions: RoutingDecision[] = [];

    for (const block of response.content) {
      if (block.type === "tool_use") {
        const clientName = this.toolGenerator.resolveClientName(block.name);

        if (!clientName) {
          this.logger.warn("Could not resolve client name for tool", { toolName: block.name });
          continue;
        }

        const input = block.input as { message?: string; reason?: string };

        if (typeof input.message !== "string") {
          this.logger.warn("Tool use missing message parameter", { toolName: block.name });
          continue;
        }

        decisions.push({
          clientName,
          message: input.message,
          reason: typeof input.reason === "string" ? input.reason : undefined,
        });
      }
    }

    return decisions;
  }
}

// ============================================================================
// Singleton Management
// ============================================================================

let routingApiInstance: RoutingApiServiceImpl | null = null;

/**
 * Initializes the global routing API instance.
 * Must be called inside `app.whenReady()` after logger, credential manager,
 * and tool generator have been initialized.
 *
 * @returns The initialized RoutingApiService instance
 * @throws Error if dependencies have not been initialized
 */
export function initializeRoutingApi(): RoutingApiService {
  if (routingApiInstance) {
    return routingApiInstance;
  }

  const credentialManager = getCredentialManager();
  const toolGenerator = getToolGenerator();
  routingApiInstance = new RoutingApiServiceImpl(credentialManager, toolGenerator);
  return routingApiInstance;
}

/**
 * Gets the current routing API service instance.
 * Throws if initializeRoutingApi() has not been called.
 *
 * @returns The RoutingApiService instance
 * @throws Error if routing API has not been initialized
 */
export function getRoutingApi(): RoutingApiService {
  if (!routingApiInstance) {
    throw new Error(
      "RoutingApi not initialized. Call initializeRoutingApi() before using getRoutingApi()."
    );
  }
  return routingApiInstance;
}

/**
 * Resets the routing API instance (primarily for testing).
 * This should not be used in production code.
 */
export function resetRoutingApi(): void {
  routingApiInstance = null;
}
