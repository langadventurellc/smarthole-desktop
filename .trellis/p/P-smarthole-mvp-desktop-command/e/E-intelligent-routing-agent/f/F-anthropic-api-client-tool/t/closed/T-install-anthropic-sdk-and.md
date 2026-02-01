---
id: T-install-anthropic-sdk-and
title: Install Anthropic SDK and define routing types
status: done
priority: high
parent: F-anthropic-api-client-tool
prerequisites: []
affectedFiles:
  package.json: Added @anthropic-ai/sdk dependency (^0.72.1)
  package-lock.json: Updated with @anthropic-ai/sdk and its dependencies
  src/types/errors.ts: Added ROUTING_API_KEY_MISSING, ROUTING_REQUEST_FAILED,
    ROUTING_RATE_LIMITED, and ROUTING_NO_CLIENTS error codes
  src/types/routing.ts: Created new file with RoutingTool, RoutingDecision,
    RoutingError, RoutingResult, RoutingRequestParams, RoutingApiService,
    ToolGeneratorService interfaces and type guards
  src/types/index.ts: Added export for routing module
  src/utils/error-messages.ts: Added user-facing messages for routing error codes
log:
  - Installed @anthropic-ai/sdk package and created routing type definitions for
    the intelligent message routing system. Added routing error codes
    (ROUTING_API_KEY_MISSING, ROUTING_REQUEST_FAILED, ROUTING_RATE_LIMITED,
    ROUTING_NO_CLIENTS) to the ErrorCode enum and created comprehensive type
    definitions in routing.ts including RoutingTool, RoutingDecision,
    RoutingError, RoutingResult, and service interfaces (RoutingApiService,
    ToolGeneratorService) with type guards. All quality checks and tests pass.
schema: v1.0
childrenIds: []
created: 2026-02-01T02:03:24.921Z
updated: 2026-02-01T02:03:24.921Z
---

# Install Anthropic SDK and Define Routing Types

## Purpose

Set up the foundational dependencies and type definitions needed for the routing API client and tool generation services.

## Scope

### 1. Install Anthropic SDK

Install the official Anthropic TypeScript SDK:

```bash
npm install @anthropic-ai/sdk
```

### 2. Add Routing Error Codes

Add new error codes to `src/types/errors.ts` for routing-specific errors:

- `ROUTING_API_KEY_MISSING` - API key not found in credential manager
- `ROUTING_REQUEST_FAILED` - API request to Claude failed
- `ROUTING_RATE_LIMITED` - Hit rate limit (429), should trigger retry
- `ROUTING_NO_CLIENTS` - No clients available for routing

### 3. Create Routing Type Definitions

Create `src/types/routing.ts` with:

```typescript
// Tool definitions compatible with Anthropic SDK
interface RoutingTool {
  name: string; // e.g., "route_to_notebook"
  description: string; // Client description for LLM
  input_schema: {
    type: "object";
    properties: {
      message: { type: "string"; description: string };
      reason: { type: "string"; description: string };
    };
    required: ["message"];
  };
}

// Result of a routing request
type RoutingResult =
  | { success: true; decisions: RoutingDecision[] }
  | { success: false; error: RoutingError };

interface RoutingDecision {
  clientName: string;
  message: string;
  reason?: string;
}

interface RoutingError {
  code: ErrorCode;
  message: string;
  retryable: boolean;
}

// Service interfaces (for dependency injection in tests)
interface RoutingApiService {
  routeMessage(params: {
    userMessage: string;
    tools: RoutingTool[];
    systemPrompt: string;
    excludeClients?: string[];
    rejectionContext?: string;
  }): Promise<RoutingResult>;
}

interface ToolGeneratorService {
  generateTools(): RoutingTool[];
  generateToolsExcluding(clientNames: string[]): RoutingTool[];
  resolveClientName(toolName: string): string | undefined;
}
```

### 4. Export from Types Index

Add export to `src/types/index.ts`:

```typescript
export * from "./routing";
```

## Implementation Notes

- The tool schema uses Anthropic SDK's expected format for tool use
- `input_schema` follows JSON Schema format as required by Claude
- The `reason` parameter is optional to give Claude flexibility

## Files to Create/Modify

- `package.json` - Add @anthropic-ai/sdk dependency
- `src/types/errors.ts` - Add routing error codes
- `src/types/routing.ts` - New file with type definitions
- `src/types/index.ts` - Add routing export

## Acceptance Criteria

- [ ] `@anthropic-ai/sdk` installed and in package.json dependencies
- [ ] Routing error codes added to ErrorCode enum
- [ ] `src/types/routing.ts` created with all interfaces
- [ ] Types exported from `src/types/index.ts`
- [ ] `mise run type-check` passes
