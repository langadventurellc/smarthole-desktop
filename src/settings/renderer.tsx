// Renderer entry point
// This is the entry point for the renderer process (browser window)
// For now, this is minimal since the app is primarily tray-based

import "./index.css";
import { createRoot } from "react-dom/client";
import { App } from "./App";

const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
