---
id: T-update-routing-agent-to-use
title: Update routing agent to use Claude 4.5 model aliases
status: done
priority: medium
parent: none
prerequisites: []
affectedFiles:
  src/services/routing-api.ts: Updated CLAUDE_HAIKU_MODEL constant from
    claude-3-haiku-20240307 to claude-haiku-4-5
  src/types/config.ts: Updated DEFAULT_CONFIG.llm.model from
    claude-3-haiku-20240307 to claude-haiku-4-5
  src/settings/App.tsx: Updated model dropdown options to Claude 4.5
    Haiku/Sonnet/Opus with alias values
  src/services/routing-api.test.ts: Updated mock response model field from
    claude-3-haiku-20240307 to claude-haiku-4-5
  src/types/config.test.ts: Updated test assertions for DEFAULT_CONFIG and
    LlmConfig examples to use claude-haiku-4-5 and claude-opus-4-5
  src/settings/App.test.tsx: Updated mockConfig and test assertions to use claude-haiku-4-5
  docs/routing-api.md: Updated documentation to reflect Claude 4.5 Haiku usage with model aliases
log:
  - |-
    Research Phase Complete:
    - Verified all file paths exist and contain expected code
    - routing-api.ts line 28: CLAUDE_HAIKU_MODEL = "claude-3-haiku-20240307"
    - config.ts line 178: model: "claude-3-haiku-20240307"
    - settings/App.tsx lines 387-391: Claude 3 model options
    - routing-api.test.ts line 119: Mock response uses claude-3-haiku-20240307
    - config.test.ts lines 175, 232-235, 292: Tests reference Claude 3 models

    Plan:
    1. Update CLAUDE_HAIKU_MODEL constant to "claude-haiku-4-5"
    2. Update DEFAULT_CONFIG.llm.model to "claude-haiku-4-5"
    3. Update Settings UI model dropdown to Claude 4.5 aliases
    4. Update test files with new model identifiers
    5. Update routing-api.md documentation
    6. Run quality checks
  - Updated all Claude model references from legacy Claude 3 models to Claude
    4.5 model aliases. The routing agent now uses `claude-haiku-4-5` as the
    default model, with Settings UI options for Claude 4.5 Haiku/Sonnet/Opus.
    All 1275 tests pass and quality checks are clean.
schema: v1.0
childrenIds: []
created: 2026-02-01T03:40:49.169Z
updated: 2026-02-01T03:40:49.169Z
---

## Context

The routing agent currently uses outdated Claude 3 model identifiers (`claude-3-haiku-20240307`, `claude-3-sonnet-20240229`, `claude-3-opus-20240229`). Claude 3 models are now listed as legacy by Anthropic. The codebase needs to be updated to use Claude 4.5 model **aliases** which automatically point to the latest model snapshots.

**Current Claude 4.5 Model Aliases:**

- `claude-haiku-4-5` (points to `claude-haiku-4-5-20251001`)
- `claude-sonnet-4-5` (points to `claude-sonnet-4-5-20250929`)
- `claude-opus-4-5` (points to `claude-opus-4-5-20251101`)

Reference: https://platform.claude.com/docs/en/about-claude/models/overview

## Implementation Requirements

### 1. Update routing-api.ts constant

**File:** `src/services/routing-api.ts:28`

Change:

```typescript
const CLAUDE_HAIKU_MODEL = "claude-3-haiku-20240307";
```

To:

```typescript
const CLAUDE_HAIKU_MODEL = "claude-haiku-4-5";
```

### 2. Update default configuration

**File:** `src/types/config.ts:177-179`

Change `DEFAULT_CONFIG.llm.model` from `"claude-3-haiku-20240307"` to `"claude-haiku-4-5"`.

### 3. Update Settings UI model dropdown

**File:** `src/settings/App.tsx:387-391`

Update the model options array:

```typescript
options={[
  { value: "claude-haiku-4-5", label: "Claude 4.5 Haiku (fastest)" },
  { value: "claude-sonnet-4-5", label: "Claude 4.5 Sonnet" },
  { value: "claude-opus-4-5", label: "Claude 4.5 Opus (most capable)" },
]}
```

### 4. Update test files

Update model references in:

- `src/services/routing-api.test.ts:119,123` - Update mock response model field
- `src/types/config.test.ts:175,232-235,292` - Update test assertions for DEFAULT_CONFIG and LlmConfig examples

### 5. Update documentation

**File:** `docs/routing-api.md`

Update references from "Claude Haiku" to "Claude 4.5 Haiku" and note that aliases are used.

## Acceptance Criteria

- [ ] `CLAUDE_HAIKU_MODEL` constant uses `claude-haiku-4-5` alias
- [ ] `DEFAULT_CONFIG.llm.model` defaults to `claude-haiku-4-5`
- [ ] Settings UI shows Claude 4.5 Haiku/Sonnet/Opus options with alias values
- [ ] All tests pass with updated model identifiers
- [ ] Documentation reflects Claude 4.5 usage
- [ ] `mise run quality` passes

## Testing Requirements

- Run `mise run test` to ensure all existing tests pass with updated model identifiers
- Manually verify Settings UI shows correct model options in the "AI Routing" tab

## Out of Scope

- Migration of existing user configurations from Claude 3 to Claude 4.5 (users on Claude 3 can manually update)
- Adding model validation or type-safe model enums
- Changes to pricing display or cost calculations
- Extended thinking or other new Claude 4.5 features
