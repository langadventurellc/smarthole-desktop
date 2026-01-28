# SmartHole Desktop

A cross-platform desktop application that runs in the system tray for Windows and macOS.

## Prerequisites

- [mise](https://mise.jdx.dev/) - Development environment manager
- Node.js 24 LTS (installed automatically via mise)

## Setup

1. Install mise if you haven't already:

   ```bash
   curl https://mise.run | sh
   ```

2. Trust and install tools:

   ```bash
   mise trust
   mise install
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

## Development

Start the application in development mode:

```bash
npm start
```

Or use mise directly:

```bash
mise run dev
```

## Available Commands

| Command              | Description                                 |
| -------------------- | ------------------------------------------- |
| `npm start`          | Start the app in development mode           |
| `npm run build`      | Build the app for distribution              |
| `npm run package`    | Package the app without creating installers |
| `npm run lint`       | Run ESLint                                  |
| `npm run format`     | Format code with Prettier                   |
| `npm run type-check` | Run TypeScript type checking                |
| `npm run quality`    | Run all quality checks                      |
| `npm run test`       | Run tests                                   |
| `npm run test:watch` | Run tests in watch mode                     |

## Project Structure

```
smarthole-desktop/
├── src/
│   ├── main.ts          # Electron main process (tray app)
│   ├── preload.ts       # Preload script for renderer
│   ├── renderer.tsx     # Renderer entry point
│   ├── App.tsx          # React app component
│   └── index.html       # HTML template
├── forge.config.ts      # Electron Forge configuration
├── vite.*.config.ts     # Vite configurations
├── mise.toml            # mise task runner configuration
└── package.json
```

## Technology Stack

- **Electron** - Cross-platform desktop framework
- **React** - UI library
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool
- **Electron Forge** - Electron tooling and packaging
- **Vitest** - Testing framework
- **ESLint + Prettier** - Code quality and formatting
