interface NumberInputProps {
  id: string;
  label: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  error?: string;
  disabled?: boolean;
}

export function NumberInput({
  id,
  label,
  description,
  value,
  onChange,
  min,
  max,
  error,
  disabled = false,
}: NumberInputProps): React.ReactNode {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const numValue = parseInt(e.target.value, 10);
    if (!isNaN(numValue)) {
      onChange(numValue);
    }
  };

  return (
    <div className="setting-field">
      <label htmlFor={id} className="setting-field-label">
        {label}
      </label>
      {description && <span className="setting-field-description">{description}</span>}
      <input
        id={id}
        type="number"
        className={`setting-field-input ${error ? "setting-field-input--error" : ""}`}
        value={value}
        onChange={handleChange}
        min={min}
        max={max}
        disabled={disabled}
      />
      {error && <span className="setting-field-error">{error}</span>}
    </div>
  );
}
