# SmartHole Desktop - Claude Instructions

This is the SmartHole desktop application built with Electron, React, and TypeScript.

## Project Overview

- **Type**: Cross-platform desktop application (Windows, macOS)
- **UI**: System tray application with minimal window UI
- **Build Tool**: Electron Forge with Vite
- **Task Runner**: mise

## Key Technologies

- Electron 40+
- React 19
- TypeScript 5.9+
- Vite 7
- Vitest for testing
- ESLint 9 (flat config) + Prettier

## Development Commands

Use mise for all development tasks:

```bash
mise run dev        # Start in development mode
mise run build      # Build for distribution
mise run lint       # Run ESLint
mise run format     # Format with Prettier
mise run type-check # TypeScript checking
mise run quality    # All quality checks
mise run test       # Run tests
```

## Architecture Notes

- `src/main.ts` - Electron main process, handles tray icon and system-level functionality
- `src/preload.ts` - Preload script for secure IPC between main and renderer
- `src/renderer.tsx` - React entry point for any window UIs
- `src/App.tsx` - Main React component

## Guidelines

- When adding libraries, use `npm install <package>` to get the latest version
- The app primarily runs as a tray application - dock/taskbar visibility is hidden on macOS
- For IPC between main and renderer, use contextBridge in preload.ts
