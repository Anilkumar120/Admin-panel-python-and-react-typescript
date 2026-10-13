import type { ResponsiveDevice } from "../../types/pageBuilder";

interface ResponsiveBarProps {
  device: ResponsiveDevice;
  onChange: (device: ResponsiveDevice) => void;
}

const DEVICES: { key: ResponsiveDevice; label: string; icon: string }[] = [
  { key: "desktop", label: "Desktop", icon: "🖥" },
  { key: "tablet", label: "Tablet", icon: "▭" },
  { key: "mobile", label: "Mobile", icon: "▯" },
];

const ResponsiveBar = ({ device, onChange }: ResponsiveBarProps) => {
  const hintText =
    device === "desktop"
      ? "Editing Desktop View"
      : device === "tablet"
      ? "Editing Tablet View — changes apply only to tablet"
      : device === "mobile"
      ? "Editing Mobile View — changes apply only to mobile"
      : "";

  return (
    <div className="responsive-bar">
      <div className="responsive-devices">
        {DEVICES.map((d) => {
          const isActive = device === d.key;
          return (
            <button
              key={d.key}
              type="button"
              className={`device-btn ${isActive ? "active" : ""}`}
              onClick={() => onChange(d.key)}
              title={d.label}
            >
              <span className="device-icon">{d.icon}</span>
              <span className="device-label">{d.label}</span>
            </button>
          );
        })}
      </div>
      <div className="responsive-hint">{hintText}</div>
    </div>
  );
};

export default ResponsiveBar;