---
id: T-implement-routing-api-and
title: Implement routing API and tool generator services
status: done
priority: high
parent: F-anthropic-api-client-tool
prerequisites:
  - T-install-anthropic-sdk-and
affectedFiles:
  src/services/tool-generator.ts: Created new file implementing
    ToolGeneratorService - generates tools from ClientRegistry, caches with
    event-driven invalidation, maintains tool name to client name mapping
  src/services/routing-api.ts: Created new file implementing RoutingApiService -
    wraps Anthropic SDK for Claude Haiku routing, handles errors and rate limit
    retries
  src/services/tool-generator.test.ts: Created comprehensive test suite for tool
    generator - sanitization, generation, caching, event invalidation, client
    name resolution
  src/services/routing-api.test.ts: Created comprehensive test suite for routing
    API - initialization, message routing, error handling, retry logic
  src/services/index.ts: Added exports for tool-generator and routing-api modules
log:
  - >-
    Research completed. Key findings:

    - RoutingTool, RoutingDecision, RoutingError, RoutingResult,
    RoutingRequestParams interfaces already defined in src/types/routing.ts

    - Error codes ROUTING_API_KEY_MISSING, ROUTING_REQUEST_FAILED,
    ROUTING_RATE_LIMITED, ROUTING_NO_CLIENTS defined in src/types/errors.ts

    - Anthropic SDK @anthropic-ai/sdk ^0.72.1 already installed

    - CredentialManager uses "anthropic-api-key" as the credential key

    - ClientRegistry provides getAllClients() returning RegistryClientInfo[]
    with name, description properties

    - Registry has on/off methods for "registered" and "unregistered" events

    - Singleton pattern: initializeX(), getX(), resetX() - follow existing
    conventions in credential-manager.ts

    - Test patterns: Use vitest, mock dependencies, beforeEach/afterEach for
    setup/cleanup
  - >-
    Implemented the Tool Generator Service and Routing API Service for
    intelligent message routing:


    Tool Generator Service (src/services/tool-generator.ts):

    - Generates Claude tool definitions from registered clients in
    ClientRegistry

    - Tool naming: route_to_{sanitized_name} with proper sanitization (replaces
    hyphens/special chars with underscores)

    - Uses client description as tool description

    - Each tool has message (required) and reason (optional) parameters

    - Caches generated tools, invalidates on registry registered/unregistered
    events

    - Maintains reverse mapping of tool name to client name

    - Follows singleton pattern: initializeToolGenerator(), getToolGenerator(),
    resetToolGenerator()


    Routing API Service (src/services/routing-api.ts):

    - Retrieves API key from CredentialManager using "anthropic-api-key"

    - Creates Anthropic client configured for Claude Haiku
    (claude-3-haiku-20240307)

    - Parses tool use responses into RoutingDecision[] with clientName, message,
    reason

    - Error handling: wraps API errors with meaningful context
    (ROUTING_API_KEY_MISSING, ROUTING_REQUEST_FAILED, ROUTING_RATE_LIMITED,
    ROUTING_NO_CLIENTS)

    - Retry logic: exponential backoff for rate limit (429) errors, max 3
    retries, starting 1 second delay

    - Follows singleton pattern: initializeRoutingApi(), getRoutingApi(),
    resetRoutingApi()


    Both services exported from src/services/index.ts with comprehensive test
    coverage.
schema: v1.0
childrenIds: []
created: 2026-02-01T02:03:49.902Z
updated: 2026-02-01T02:03:49.902Z
---

# Implement Routing API and Tool Generator Services

## Purpose

Create the core services that wrap the Anthropic SDK and generate dynamic tools from the client registry. These services enable the intelligent routing system to use Claude Haiku for message routing decisions.

## Scope

### 1. Tool Generator Service (`src/services/tool-generator.ts`)

Create a service that generates Claude tool definitions from registered clients:

**Core Functionality:**

- Generate tools from `ClientRegistry.getAllClients()`
- Tool naming: `route_to_{sanitized_name}` where name is sanitized:
  - Replace non-alphanumeric with underscores
  - Ensure starts with letter (prepend `client_` if needed)
  - Handle collisions with numeric suffix (unlikely given name validation)
- Use client `description` as tool description
- Each tool has `message` (required) and `reason` (optional) parameters

**Caching Strategy:**

- Cache generated tools to avoid regeneration on every request
- Subscribe to registry `registered`/`unregistered` events
- Invalidate cache on client changes (lazy regeneration on next request)
- Maintain reverse mapping of tool name → client name

**Interface:**

```typescript
interface ToolGeneratorService {
  generateTools(): RoutingTool[];
  generateToolsExcluding(clientNames: string[]): RoutingTool[];
  resolveClientName(toolName: string): string | undefined;
}
```

**Singleton Pattern:**

- `initializeToolGenerator()` - Creates instance, subscribes to registry events
- `getToolGenerator()` - Returns instance, throws if not initialized
- `resetToolGenerator()` - Cleanup for tests

### 2. Routing API Service (`src/services/routing-api.ts`)

Create a service that invokes Claude Haiku for routing decisions:

**Core Functionality:**

- Retrieve API key from `CredentialManager` using `anthropic-api-key`
- Create Anthropic client with the API key
- Configure for Claude Haiku model (`claude-3-haiku-20240307`)
- Parse tool use responses into `RoutingDecision[]`

**Error Handling:**

- Wrap API errors with meaningful context
- Detect rate limit errors (429) and mark as retryable
- Detect auth errors (401) with clear message about API key
- Handle network failures gracefully

**Retry Logic:**

- Implement exponential backoff for rate limit errors
- Start with 1 second delay, double each retry
- Maximum 3 retries before failing
- Only retry on rate limit (429), not on other errors

**Interface:**

```typescript
interface RoutingApiService {
  routeMessage(params: {
    userMessage: string;
    tools: RoutingTool[];
    systemPrompt: string;
    excludeClients?: string[];
    rejectionContext?: string;
  }): Promise<RoutingResult>;
}
```

**Singleton Pattern:**

- `initializeRoutingApi()` - Creates instance, verifies API key exists
- `getRoutingApi()` - Returns instance, throws if not initialized
- `resetRoutingApi()` - Cleanup for tests

### 3. Service Exports

Update `src/services/index.ts` to export both services.

## Implementation Notes

**Tool Generator Considerations:**

- Client names are already validated (alphanumeric + hyphen/underscore, starts with letter)
- But tool names cannot have hyphens, so replace with underscores
- Cache invalidation is event-driven, not polling-based

**Routing API Considerations:**

- The Anthropic SDK handles most complexity internally
- Need to parse `tool_use` content blocks from response
- A single response may include multiple tool calls (multi-routing)
- If response has no tool use, return empty decisions array

**Logging:**

- Log at debug level for routine operations
- Log at info level for successful routing decisions
- Log at error level for failures
- Use child loggers with component names

## Files to Create/Modify

- `src/services/tool-generator.ts` - New file
- `src/services/routing-api.ts` - New file
- `src/services/index.ts` - Add exports

## Testing Notes

Both services should be testable with mocked dependencies:

- Tool generator: Mock `getClientRegistry()`
- Routing API: Mock Anthropic SDK and `getCredentialManager()`

## Acceptance Criteria

- [ ] Tool generator creates properly formatted tool definitions
- [ ] Tool names are sanitized to valid function names (underscores, no hyphens)
- [ ] Tool descriptions use client descriptions
- [ ] Tool cache invalidates on client registry changes
- [ ] Routing API retrieves API key from credential manager
- [ ] Routing API invokes Claude Haiku with tools
- [ ] API errors wrapped with meaningful context
- [ ] Rate limit errors trigger exponential backoff retry (max 3 attempts)
- [ ] Both services follow singleton pattern (initialize/get/reset)
- [ ] Services exported from `src/services/index.ts`
- [ ] `mise run quality` passes
