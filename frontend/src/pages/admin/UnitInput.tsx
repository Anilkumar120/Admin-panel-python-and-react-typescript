interface UnitInputProps {
  value?: string;
  onChange: (value: string) => void;
  units?: string[];
  placeholder?: string;
  label?: string;
}

const DEFAULT_UNITS = ["px", "%", "em", "rem", "vw", "vh", "auto"];

const UnitInput = ({
  value = "",
  onChange,
  units = DEFAULT_UNITS,
  placeholder = "0",
  label,
}: UnitInputProps) => {
  // Parse value like "120px" → { number: "120", unit: "px" }
  const parse = (val: string) => {
    if (!val || val === "auto") {
      return { number: "", unit: "auto" };
    }
    const match = val.match(/^(-?\d*\.?\d*)\s*(px|%|em|rem|vw|vh)?$/);
    if (match) {
      return { number: match[1] || "", unit: match[2] || "px" };
    }
    return { number: val, unit: "px" };
  };

  const { number, unit } = parse(value);

  const handleNumberChange = (newNumber: string) => {
    if (unit === "auto") {
      onChange(newNumber ? `${newNumber}px` : "auto");
    } else {
      onChange(`${newNumber}${unit}`);
    }
  };

  const handleUnitChange = (newUnit: string) => {
    if (newUnit === "auto") {
      onChange("auto");
    } else {
      onChange(`${number || "0"}${newUnit}`);
    }
  };

  return (
    <div className="unit-input-wrapper">
      {label && <label className="unit-input-label">{label}</label>}
      <div className="unit-input-group">
        <input
          type="text"
          inputMode="decimal"
          value={unit === "auto" ? "" : number}
          placeholder={placeholder}
          onChange={(e) => handleNumberChange(e.target.value)}
          className="unit-input-number"
          disabled={unit === "auto"}
        />
        <select
          value={unit}
          onChange={(e) => handleUnitChange(e.target.value)}
          className="unit-input-unit"
        >
          {units.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default UnitInput;