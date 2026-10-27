interface UnitInputProps {
  value?: string;
  onChange: (value: string) => void;
  units?: string[];
  placeholder?: string;
  label?: string;
}

const DEFAULT_UNITS = ["px", "%", "em", "rem", "vw", "vh", "auto"];

/**
 * Converts a dimension value into a string accepted by UnitInput.
 * Supports strings, numbers, and common dimension object shapes.
 */
export const toUnitInputValue = (value: unknown): string => {
  if (value == null || value === "") {
    return "";
  }

  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (typeof value === "object") {
    const dimension = value as {
      value?: string | number;
      size?: string | number;
      unit?: string;
    };

    const amount = dimension.value ?? dimension.size;

    if (amount != null && amount !== "") {
      const unit = dimension.unit ?? "px";
      return unit === "auto" ? "auto" : `${amount}${unit}`;
    }
  }

  return "";
};

const UnitInput = ({
  value = "",
  onChange,
  units = DEFAULT_UNITS,
  placeholder = "0",
  label,
}: UnitInputProps) => {
  // Parse values such as "120px", "50%", "1.5rem", and "auto".
  const parse = (val: string): { number: string; unit: string } => {
    const normalized = val.trim();

    if (!normalized || normalized === "auto") {
      return { number: "", unit: "auto" };
    }

    const match = normalized.match(
      /^(-?(?:\d+\.?\d*|\.\d+))\s*(px|%|em|rem|vw|vh)?$/i
    );

    if (match) {
      return {
        number: match[1],
        unit: match[2] ?? "px",
      };
    }

    // Preserve unrecognized values instead of silently discarding them.
    return { number: normalized, unit: "px" };
  };

  const { number, unit } = parse(value);

  const handleNumberChange = (newNumber: string) => {
    if (unit === "auto") {
      onChange(newNumber ? `${newNumber}px` : "auto");
      return;
    }

    onChange(newNumber ? `${newNumber}${unit}` : "");
  };

  const handleUnitChange = (newUnit: string) => {
    if (newUnit === "auto") {
      onChange("auto");
      return;
    }

    onChange(`${number || "0"}${newUnit}`);
  };

  const availableUnits = units.includes(unit)
    ? units
    : [...units, unit];

  return (
    <div className="unit-input-wrapper">
      {label && <label className="unit-input-label">{label}</label>}

      <div className="unit-input-group">
        <input
          type="text"
          inputMode="decimal"
          value={unit === "auto" ? "" : number}
          placeholder={unit === "auto" ? "Auto" : placeholder}
          onChange={(event) => handleNumberChange(event.target.value)}
          className="unit-input-number"
          aria-label={label}
        />

        <select
          value={unit}
          onChange={(event) => handleUnitChange(event.target.value)}
          className="unit-input-unit"
          aria-label={label ? `${label} unit` : "Unit"}
        >
          {availableUnits.map((currentUnit) => (
            <option key={currentUnit} value={currentUnit}>
              {currentUnit}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default UnitInput;
