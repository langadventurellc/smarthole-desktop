interface SelectOption {
  value: string;
  label: string;
}

interface SelectInputProps {
  id: string;
  label: string;
  description?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SelectInput({
  id,
  label,
  description,
  value,
  options,
  onChange,
  disabled = false,
}: SelectInputProps): React.ReactNode {
  return (
    <div className="setting-field">
      <label htmlFor={id} className="setting-field-label">
        {label}
      </label>
      {description && <span className="setting-field-description">{description}</span>}
      <select
        id={id}
        className="setting-field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
