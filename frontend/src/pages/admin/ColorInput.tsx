const ColorInput = ({
  value,
  onChange,
  fallbackColor = "#ffffff",
  label = "Choose color",
}: {
  value?: string;
  onChange: (value: string) => void;
  fallbackColor?: string;
  label?: string;
}) => {
  const isTransparent = value?.toLowerCase() === "transparent";
  const hexColor =
    value && /^#[\da-f]{3}([\da-f]{3})?$/i.test(value)
      ? value.length === 4
        ? `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`
        : value
      : fallbackColor;

  return (
    <div className="hex-color-control">
      <input
        type="color"
        value={hexColor}
        aria-label={label}
        onChange={(event) => onChange(event.target.value)}
      />
      <label className="hex-color-transparent">
        <input
          type="checkbox"
          checked={isTransparent}
          onChange={(event) =>
            onChange(event.target.checked ? "transparent" : hexColor)
          }
        />
        <span>Transparent</span>
      </label>
    </div>
  );
};

export default ColorInput;
