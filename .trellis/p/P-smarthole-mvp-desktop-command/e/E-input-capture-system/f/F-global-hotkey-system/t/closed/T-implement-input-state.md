---
id: T-implement-input-state
title: Implement Input State Management Service
status: done
priority: high
parent: F-global-hotkey-system
prerequisites: []
affectedFiles:
  src/types/input.ts: "Created input state types: InputState enum, InputStateInfo
    interface, InputStateChangedEvent, InputModeChangedEvent, and
    InputStateEvents interface"
  src/types/index.ts: Added export for input types module
  src/services/input-state.ts: Created InputStateService with singleton pattern,
    validated state machine, EventEmitter for events, mode tracking
  src/services/index.ts: Added export for input-state service module
  src/services/input-state.test.ts: Added unit tests for state machine
    transitions, event emission, mode changes, and getStateInfo
log:
  - |-
    Starting implementation. Researched existing patterns:
    - Singleton pattern from hotkey-manager.ts and client-registry.ts
    - EventEmitter pattern for events
    - VoiceInputMode type from config.ts
    - Test patterns from hotkey-manager.test.ts

    Files to create:
    1. src/types/input.ts - Input state types
    2. src/services/input-state.ts - Input state service

    Files to modify:
    1. src/types/index.ts - Export input types
    2. src/services/index.ts - Export input-state service
  - >-
    Implemented Input State Management Service with:

    - InputState enum (IDLE, RECORDING, PROCESSING) and InputStateInfo interface
    in src/types/input.ts

    - InputStateService with singleton pattern
    (initializeInputState/getInputState) following existing conventions

    - Validated state machine with transitions: IDLE→RECORDING,
    RECORDING→PROCESSING, RECORDING→IDLE, PROCESSING→IDLE

    - EventEmitter pattern for stateChanged and modeChanged events

    - Mode tracking for push-to-talk vs toggle (using VoiceInputMode from
    config.ts)

    - Comprehensive unit tests covering all state transitions, event emission,
    and mode changes (21 tests)
schema: v1.0
childrenIds: []
created: 2026-01-30T22:18:08.805Z
updated: 2026-01-30T22:18:08.805Z
---

# Implement Input State Management Service

## Purpose

Create a centralized input state service that tracks the application's input state (idle, recording, processing) and input mode (push-to-talk vs toggle). Provides a validated state machine that other services can subscribe to.

## Scope

### Core Implementation

- **Service file**: `src/services/input-state.ts`
- **Singleton pattern**: `initializeInputState()` / `getInputState()`
- **EventEmitter pattern**: emit events for state changes

### Types Required (new file)

- **Types file**: `src/types/input.ts`
- `InputState`: enum with `IDLE`, `RECORDING`, `PROCESSING`
- `InputStateInfo`: interface with current state, mode, timestamps

### State Machine

States:

- `IDLE` - waiting for input trigger
- `RECORDING` - actively capturing voice input
- `PROCESSING` - transcribing/routing message

Valid transitions:

- `IDLE` → `RECORDING` (hotkey pressed)
- `RECORDING` → `PROCESSING` (hotkey released / toggle stopped)
- `RECORDING` → `IDLE` (cancelled)
- `PROCESSING` → `IDLE` (complete or failed)

### Key Features

1. **Mode tracking**: Push-to-talk vs toggle (from `VoiceInputMode` in config.ts)
2. **State transitions with validation**: reject invalid transitions
3. **Event emission**: notify subscribers on state change
4. **State queries**: get current state, check if can transition

### Events Emitted

- `stateChanged` - when state transitions (includes previous and new state)
- `modeChanged` - when input mode changes

## Files to Create/Modify

- `src/types/input.ts` - New input state types
- `src/types/index.ts` - Export new types
- `src/services/input-state.ts` - New service
- `src/services/index.ts` - Export new service

## Acceptance Criteria

1. [ ] State machine validates transitions (rejects invalid)
2. [ ] State changes emit events with previous and new state
3. [ ] Mode tracking works for push-to-talk and toggle
4. [ ] Current state can be queried
5. [ ] Follows existing singleton/EventEmitter patterns

## Testing

- Unit tests for all state transitions (valid and invalid)
- Unit tests for event emission
