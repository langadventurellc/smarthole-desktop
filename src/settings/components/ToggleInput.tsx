interface ToggleInputProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleInput({
  id,
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: ToggleInputProps): React.ReactNode {
  return (
    <div className="setting-field">
      <div className="setting-field-toggle">
        <div className="setting-field-label-group">
          <label htmlFor={id} className="setting-field-label">
            {label}
          </label>
          {description && <span className="setting-field-description">{description}</span>}
        </div>
        <button
          id={id}
          type="button"
          role="switch"
          aria-checked={checked}
          className={`toggle-switch ${checked ? "toggle-switch--on" : ""}`}
          onClick={() => onChange(!checked)}
          disabled={disabled}
        >
          <span className="toggle-switch-thumb" />
        </button>
      </div>
    </div>
  );
}
