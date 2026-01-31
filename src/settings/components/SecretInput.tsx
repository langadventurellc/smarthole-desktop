import { useState, useEffect, useCallback } from "react";
import type { CredentialKey } from "../../types/credentials";

interface SecretInputProps {
  id: string;
  label: string;
  description?: string;
  credentialKey: CredentialKey;
  onSave: (value: string) => Promise<void>;
  onClear: () => Promise<void>;
  disabled?: boolean;
}

export function SecretInput({
  id,
  label,
  description,
  credentialKey,
  onSave,
  onClear,
  disabled = false,
}: SecretInputProps): React.ReactNode {
  const [hasCredential, setHasCredential] = useState<boolean | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Check if credential exists on mount
  useEffect(() => {
    let mounted = true;
    window.electronAPI
      .hasCredential(credentialKey)
      .then((has: boolean) => {
        if (mounted) {
          setHasCredential(has);
        }
      })
      .catch(() => {
        if (mounted) {
          setHasCredential(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [credentialKey]);

  const handleEdit = useCallback(() => {
    setIsEditing(true);
    setInputValue("");
    setShowValue(false);
  }, []);

  const handleCancel = useCallback(() => {
    setIsEditing(false);
    setInputValue("");
    setShowValue(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!inputValue.trim()) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(inputValue);
      setHasCredential(true);
      setIsEditing(false);
      setInputValue("");
      setShowValue(false);
    } finally {
      setIsSaving(false);
    }
  }, [inputValue, onSave]);

  const handleClear = useCallback(async () => {
    setIsSaving(true);
    try {
      await onClear();
      setHasCredential(false);
      setIsEditing(false);
      setInputValue("");
    } finally {
      setIsSaving(false);
    }
  }, [onClear]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    },
    [handleSave, handleCancel]
  );

  // Loading state
  if (hasCredential === null) {
    return (
      <div className="setting-field">
        <label htmlFor={id} className="setting-field-label">
          {label}
        </label>
        {description && <span className="setting-field-description">{description}</span>}
        <div className="setting-field-loading">Loading...</div>
      </div>
    );
  }

  // Editing mode
  if (isEditing) {
    return (
      <div className="setting-field">
        <label htmlFor={id} className="setting-field-label">
          {label}
        </label>
        {description && <span className="setting-field-description">{description}</span>}
        <div className="setting-field-secret-edit">
          <div className="setting-field-secret-input-group">
            <input
              id={id}
              type={showValue ? "text" : "password"}
              className="setting-field-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter API key"
              disabled={isSaving || disabled}
              autoFocus
            />
            <button
              type="button"
              className="setting-field-secret-toggle"
              onClick={() => setShowValue(!showValue)}
              disabled={isSaving || disabled}
              aria-label={showValue ? "Hide value" : "Show value"}
            >
              {showValue ? "Hide" : "Show"}
            </button>
          </div>
          <div className="setting-field-secret-actions">
            <button
              type="button"
              className="setting-button setting-button--primary"
              onClick={handleSave}
              disabled={isSaving || disabled || !inputValue.trim()}
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="setting-button"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Display mode
  return (
    <div className="setting-field">
      <label htmlFor={id} className="setting-field-label">
        {label}
      </label>
      {description && <span className="setting-field-description">{description}</span>}
      <div className="setting-field-secret-display">
        <span className="setting-field-secret-value">
          {hasCredential ? "\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF\u25CF" : "Not configured"}
        </span>
        <div className="setting-field-secret-actions">
          <button type="button" className="setting-button" onClick={handleEdit} disabled={disabled}>
            {hasCredential ? "Change" : "Add"}
          </button>
          {hasCredential && (
            <button
              type="button"
              className="setting-button setting-button--danger"
              onClick={handleClear}
              disabled={isSaving || disabled}
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
