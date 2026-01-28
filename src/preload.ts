// Preload script for renderer process
// This file runs in the renderer process but has access to Node.js APIs
// Use contextBridge to safely expose APIs to the renderer

import { contextBridge } from "electron";

// Expose any APIs you want to make available to the renderer here
contextBridge.exposeInMainWorld("electronAPI", {
  // Add methods here as needed
});
