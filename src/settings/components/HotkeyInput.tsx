import { useState, useCallback } from "react";

interface HotkeyInputProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  disabled?: boolean;
}

/**
 * Converts a keyboard event to Electron accelerator format.
 * e.g., Ctrl+Shift+Space, CommandOrControl+A
 */
function keyEventToAccelerator(e: React.KeyboardEvent<HTMLInputElement>): string | null {
  // Skip if only modifier keys are pressed
  const modifierKeys = ["Control", "Shift", "Alt", "Meta"];
  if (modifierKeys.includes(e.key)) {
    return null;
  }

  const parts: string[] = [];

  // Use CommandOrControl for cross-platform compatibility
  if (e.ctrlKey || e.metaKey) {
    parts.push("CommandOrControl");
  }
  if (e.shiftKey) {
    parts.push("Shift");
  }
  if (e.altKey) {
    parts.push("Alt");
  }

  // Map key to Electron accelerator format
  let key = e.key;

  // Handle special keys
  const keyMap: Record<string, string> = {
    " ": "Space",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
    Escape: "Escape",
    Enter: "Enter",
    Tab: "Tab",
    Backspace: "Backspace",
    Delete: "Delete",
    Home: "Home",
    End: "End",
    PageUp: "PageUp",
    PageDown: "PageDown",
    Insert: "Insert",
  };

  if (keyMap[key]) {
    key = keyMap[key];
  } else if (key.length === 1) {
    // Single character keys should be uppercase
    key = key.toUpperCase();
  } else if (key.startsWith("F") && !isNaN(parseInt(key.slice(1)))) {
    // Function keys (F1-F12) are already in correct format
  } else {
    // Unknown key, skip
    return null;
  }

  parts.push(key);

  // Require at least one modifier for most keys (except function keys)
  if (parts.length === 1 && !key.startsWith("F")) {
    return null;
  }

  return parts.join("+");
}

export function HotkeyInput({
  id,
  label,
  description,
  value,
  onChange,
  error,
  disabled = false,
}: HotkeyInputProps): React.ReactNode {
  const [isRecording, setIsRecording] = useState(false);

  const handleFocus = useCallback(() => {
    setIsRecording(true);
  }, []);

  const handleBlur = useCallback(() => {
    setIsRecording(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      // Prevent default browser shortcuts while recording
      e.preventDefault();
      e.stopPropagation();

      // Allow Escape to cancel recording
      if (e.key === "Escape") {
        e.currentTarget.blur();
        return;
      }

      const accelerator = keyEventToAccelerator(e);
      if (accelerator) {
        onChange(accelerator);
        e.currentTarget.blur();
      }
    },
    [onChange]
  );

  const displayValue = isRecording ? "Press keys..." : value || "Not set";

  return (
    <div className="setting-field">
      <label htmlFor={id} className="setting-field-label">
        {label}
      </label>
      {description && <span className="setting-field-description">{description}</span>}
      <input
        id={id}
        type="text"
        className={`setting-field-input setting-field-input--hotkey ${error ? "setting-field-input--error" : ""} ${isRecording ? "setting-field-input--recording" : ""}`}
        value={displayValue}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        readOnly
        disabled={disabled}
        placeholder="Click to record hotkey"
      />
      {error && <span className="setting-field-error">{error}</span>}
    </div>
  );
}
