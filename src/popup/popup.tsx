/**
 * React component for the text input popup.
 * Provides a simple input field with keyboard handling.
 */

import { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./popup.css";

function PopupInput(): React.ReactNode {
  const [text, setText] = useState("");
  const [placeholder, setPlaceholder] = useState("Type your command...");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auto-focus on mount
    inputRef.current?.focus();
    window.popupAPI.notifyFocused();

    // Subscribe to placeholder changes
    const unsubPlaceholder = window.popupAPI.onPlaceholderChange((newPlaceholder: string) => {
      setPlaceholder(newPlaceholder);
    });

    // Subscribe to clear commands
    const unsubClear = window.popupAPI.onClear(() => {
      setText("");
    });

    return () => {
      unsubPlaceholder();
      unsubClear();
    };
  }, []);

  const handleSubmit = (): void => {
    const trimmedText = text.trim();
    if (trimmedText) {
      window.popupAPI.submit(trimmedText);
      setText(""); // Clear immediately for responsiveness
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      window.popupAPI.dismiss();
    }
  };

  return (
    <div className="popup-container">
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="popup-input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
    </div>
  );
}

// Mount the React app
const container = document.getElementById("root");
if (container) {
  const root = createRoot(container);
  root.render(<PopupInput />);
}
