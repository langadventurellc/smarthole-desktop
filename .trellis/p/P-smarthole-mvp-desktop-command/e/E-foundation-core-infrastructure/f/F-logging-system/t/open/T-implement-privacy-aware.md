---
id: T-implement-privacy-aware
title: Implement privacy-aware logging with sanitization
status: open
priority: high
parent: F-logging-system
prerequisites:
  - T-implement-core-pino-logger
affectedFiles: {}
log: []
schema: v1.0
childrenIds: []
created: 2026-01-30T01:27:46.286Z
updated: 2026-01-30T01:27:46.286Z
---

# Implement Privacy-Aware Logging with Sanitization

## Context

This task adds privacy protection to the logging system. It implements the `logMessageContent` flag and a sanitization utility to prevent sensitive data from being logged.

**Parent Feature**: F-logging-system
**Prerequisite Task**: T-implement-core-pino-logger

## What to Build

### 1. logMessageContent Configuration

Extend the logger to respect the `logMessageContent` configuration flag from `AppConfig`:

- When `logMessageContent: true` - Log full message content
- When `logMessageContent: false` (default) - Redact or omit message content from logs

### 2. Sanitization Utility

Create `sanitizeLogData(data: Record<string, unknown>): Record<string, unknown>`:

```typescript
// Patterns to redact
const SENSITIVE_PATTERNS = [
  /api[-_]?key/i,
  /password/i,
  /secret/i,
  /token/i,
  /auth/i,
  /credential/i,
  /bearer/i,
];

// Replace sensitive values with "[REDACTED]"
```

### 3. Content Redaction

When `logMessageContent: false`:

- Replace message content with a placeholder or hash
- Keep metadata and context structure intact
- Log that content was redacted (for debugging purposes)

### 4. Integration with Logger

- Apply sanitization automatically to all log context
- Provide option to bypass sanitization for internal logs (non-user content)
- Ensure sanitization is performant (only scan when necessary)

## File Locations

- Modify: `src/services/logger.ts` - Add sanitization and privacy logic

## Technical Approach

1. Create a sanitization function that recursively scans objects
2. Match keys against sensitive patterns
3. Replace values with "[REDACTED]"
4. Apply sanitization in the logger wrapper before passing to pino
5. For `logMessageContent: false`, implement at the log call level

## Example Usage

```typescript
// With logMessageContent: false
logger.info("User message received", { content: "Hello world", userId: "usr_123" });
// Logs: { message: 'User message received', content: '[CONTENT_REDACTED]', userId: 'usr_123' }

// Sensitive data always redacted
logger.info("API call", { apiKey: "sk-1234" });
// Logs: { message: 'API call', apiKey: '[REDACTED]' }
```

## Acceptance Criteria

- [ ] `logMessageContent` flag respected in logger configuration
- [ ] When disabled, message content is redacted in logs
- [ ] Sensitive data sanitization utility implemented
- [ ] Patterns detected: api_key, apiKey, password, secret, token, auth, credential, bearer
- [ ] Sanitization is recursive (handles nested objects)
- [ ] Arrays are handled correctly
- [ ] Performance: sanitization adds minimal overhead
- [ ] Unit tests for sanitization patterns (all patterns detected)
- [ ] Unit tests for content redaction behavior

## Testing Requirements

- Unit tests for each sensitive pattern
- Unit tests for nested object sanitization
- Unit tests for array handling
- Unit tests for `logMessageContent` flag behavior
- Performance benchmark (optional but recommended)

## Security Considerations

- Never log API keys, tokens, or credentials even if `logMessageContent: true`
- Err on the side of caution - redact if uncertain
- Log files should have appropriate permissions (handled in main process)

## Dependencies

- T-implement-core-pino-logger (must be completed first)
- Uses `AppConfig.logMessageContent` from `src/types/config.ts`
