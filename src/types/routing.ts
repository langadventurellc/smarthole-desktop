import { ErrorCode, isErrorCode } from "./errors";

export interface RoutingTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: {
      message: {
        type: "string";
        description: string;
      };
      reason: {
        type: "string";
        description: string;
      };
    };
    required: ["message"];
  };
}

export interface RoutingDecision {
  clientName: string;
  message: string;
  reason?: string;
}

export interface RoutingError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

export type RoutingResult =
  | { success: true; decisions: RoutingDecision[] }
  | { success: false; error: RoutingError };

export interface RoutingRequestParams {
  userMessage: string;
  tools: RoutingTool[];
  systemPrompt: string;
  excludeClients?: string[];
  rejectionContext?: string;
}

export interface RoutingApiService {
  routeMessage(params: RoutingRequestParams): Promise<RoutingResult>;
}

export interface ToolGeneratorService {
  generateTools(): RoutingTool[];
  generateToolsExcluding(clientNames: string[]): RoutingTool[];
  resolveClientName(toolName: string): string | undefined;
}

export function isRoutingSuccess(
  result: RoutingResult
): result is { success: true; decisions: RoutingDecision[] } {
  return result.success === true;
}

export function isRoutingFailure(
  result: RoutingResult
): result is { success: false; error: RoutingError } {
  return result.success === false;
}

export function isRoutingDecision(value: unknown): value is RoutingDecision {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.clientName !== "string" || obj.clientName.length === 0) {
    return false;
  }

  if (typeof obj.message !== "string") {
    return false;
  }

  if (obj.reason !== undefined && typeof obj.reason !== "string") {
    return false;
  }

  return true;
}

export function isRoutingError(value: unknown): value is RoutingError {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (!isErrorCode(obj.code)) {
    return false;
  }

  if (typeof obj.message !== "string") {
    return false;
  }

  if (typeof obj.retryable !== "boolean") {
    return false;
  }

  return true;
}

export function isRoutingResult(value: unknown): value is RoutingResult {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;

  if (obj.success === true) {
    if (!Array.isArray(obj.decisions)) {
      return false;
    }
    return obj.decisions.every(isRoutingDecision);
  } else if (obj.success === false) {
    return isRoutingError(obj.error);
  }

  return false;
}
