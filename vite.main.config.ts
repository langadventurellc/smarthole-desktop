import { defineConfig } from "vite";

export default defineConfig({
  build: {
    rollupOptions: {
      // Externalize native modules that shouldn't be bundled
      // - electron: Electron core APIs
      // - bufferutil, utf-8-validate: Optional native dependencies of 'ws' package
      // - keytar: Native module for OS keychain access
      external: ["electron", "bufferutil", "utf-8-validate", "keytar"],
    },
  },
});
