---
id: F-anthropic-api-client-tool
title: Anthropic API Client & Tool Generation
status: open
priority: high
parent: E-intelligent-routing-agent
prerequisites: []
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-02-01T01:55:46.991Z
updated: 2026-02-01T01:55:46.991Z
---

# Anthropic API Client & Tool Generation

## Purpose

Implement the Anthropic API client integration and dynamic tool generation from registered clients. This is the foundational infrastructure for the intelligent routing system.

## Scope

### 1. Anthropic API Client Service

Create a service that wraps the Anthropic SDK for routing requests:

- **SDK Integration**: Use `@anthropic-ai/sdk` package
- **API Key Retrieval**: Get API key from `CredentialManager` using the `anthropic-api-key` key
- **Client Configuration**: Configure for Claude Haiku model (`claude-3-haiku-20240307`)
- **Error Handling**: Wrap API errors with meaningful context (rate limits, auth failures, network issues)
- **Retry Logic**: Implement exponential backoff for rate limit errors (429 status)

**Service Interface:**

```typescript
interface RoutingApiService {
  // Invoke Claude Haiku with a message and available tools
  routeMessage(params: {
    userMessage: string;
    tools: Tool[];
    systemPrompt: string;
    excludeClients?: string[]; // For re-routing after rejection
    rejectionContext?: string; // Context from previous rejection
  }): Promise<RoutingResult>;
}

interface RoutingResult {
  success: true;
  decisions: RoutingDecision[];
} | {
  success: false;
  error: RoutingError;
}

interface RoutingDecision {
  clientName: string;
  message: string;
  reason?: string;
}
```

### 2. Dynamic Tool Generation

Generate Claude tool definitions from the client registry:

- **Tool Naming**: `route_to_{sanitized_client_name}`
- **Sanitization Rules**:
  - Replace spaces and special characters with underscores
  - Ensure starts with a letter
  - Handle collision by appending number suffix (unlikely given name validation)
- **Tool Schema**: Each tool has:
  - `message` parameter (required): The message to route to this client
  - `reason` parameter (optional): Explanation for why this client was chosen
- **Tool Description**: Use client's `description` field as routing hint
- **Dynamic Rebuild**: Subscribe to registry `registered`/`unregistered` events to rebuild tools

**Tool Generation Interface:**

```typescript
interface ToolGenerator {
  // Generate tools for all registered clients
  generateTools(): Tool[];

  // Generate tools excluding specific clients (for re-routing)
  generateToolsExcluding(clientNames: string[]): Tool[];

  // Get the client name from a tool name
  resolveClientName(toolName: string): string | undefined;
}
```

### 3. Caching Strategy

- Cache tool definitions to avoid regeneration on every request
- Invalidate cache when clients connect/disconnect
- Tools should be regenerated lazily on next request after invalidation

## Implementation Location

- `src/services/routing-api.ts` - API client service
- `src/services/tool-generator.ts` - Tool generation logic
- `src/types/routing.ts` - Type definitions

## Dependencies

- Existing `CredentialManager` for API key retrieval
- Existing `ClientRegistry` for client information and events
- `@anthropic-ai/sdk` package (to be installed)

## Acceptance Criteria

1. [ ] `@anthropic-ai/sdk` package installed
2. [ ] Routing API service retrieves API key from credential manager
3. [ ] Routing API service invokes Claude Haiku with tools
4. [ ] Tool generator creates properly formatted tool definitions from registry
5. [ ] Tool names are sanitized to valid function names
6. [ ] Tool descriptions use client descriptions
7. [ ] Tool cache invalidates on client registry changes
8. [ ] API errors wrapped with meaningful context
9. [ ] Rate limit errors trigger exponential backoff retry
10. [ ] Service follows singleton pattern with initialize/get functions
