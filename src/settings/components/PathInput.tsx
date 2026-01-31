import { useCallback } from "react";

interface PathInputProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  selectDirectory?: boolean;
  error?: string;
  disabled?: boolean;
}

export function PathInput({
  id,
  label,
  description,
  value,
  onChange,
  placeholder = "Select a file...",
  selectDirectory = false,
  error,
  disabled = false,
}: PathInputProps): React.ReactNode {
  const handleBrowse = useCallback(async () => {
    const result = await window.electronAPI.showOpenDialog({
      title: selectDirectory ? "Select Directory" : "Select File",
      properties: [selectDirectory ? "openDirectory" : "openFile"],
    });

    if (!result.canceled && result.filePaths.length > 0) {
      onChange(result.filePaths[0]);
    }
  }, [onChange, selectDirectory]);

  return (
    <div className="setting-field">
      <label htmlFor={id} className="setting-field-label">
        {label}
      </label>
      {description && <span className="setting-field-description">{description}</span>}
      <div className="setting-field-path-group">
        <input
          id={id}
          type="text"
          className={`setting-field-input setting-field-input--path ${error ? "setting-field-input--error" : ""}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
        <button type="button" className="setting-button" onClick={handleBrowse} disabled={disabled}>
          Browse
        </button>
      </div>
      {error && <span className="setting-field-error">{error}</span>}
    </div>
  );
}
