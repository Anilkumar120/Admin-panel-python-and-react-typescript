import { useState } from "react";
import type { BuilderGlobals, GlobalColor, GlobalFont } from "../../types/pageBuilder";

interface GlobalSettingsProps {
  globals: BuilderGlobals;
  onChange: (globals: BuilderGlobals) => void;
}

const GlobalSettings = ({ globals, onChange }: GlobalSettingsProps) => {
  const [newColorName, setNewColorName] = useState("");
  const [newColorValue, setNewColorValue] = useState("#000000");
  const [newFontName, setNewFontName] = useState("");
  const [newFontFamily, setNewFontFamily] = useState("");

  const addColor = () => {
    if (!newColorName.trim()) return;
    const newColor: GlobalColor = {
      id: `color-${Date.now()}`,
      name: newColorName.trim(),
      value: newColorValue,
    };
    onChange({ ...globals, colors: [...(globals.colors || []), newColor] });
    setNewColorName("");
    setNewColorValue("#000000");
  };

  const removeColor = (id: string) => {
    onChange({
      ...globals,
      colors: (globals.colors || []).filter((c) => c.id !== id),
    });
  };

  const updateColor = (id: string, value: string) => {
    onChange({
      ...globals,
      colors: (globals.colors || []).map((c) =>
        c.id === id ? { ...c, value } : c
      ),
    });
  };

  const addFont = () => {
    if (!newFontName.trim() || !newFontFamily.trim()) return;
    const newFont: GlobalFont = {
      id: `font-${Date.now()}`,
      name: newFontName.trim(),
      family: newFontFamily.trim(),
    };
    onChange({ ...globals, fonts: [...(globals.fonts || []), newFont] });
    setNewFontName("");
    setNewFontFamily("");
  };

  const removeFont = (id: string) => {
    onChange({
      ...globals,
      fonts: (globals.fonts || []).filter((f) => f.id !== id),
    });
  };

  return (
    <div className="global-settings">
      <div className="settings-group">
        <h4>Container</h4>
        <label>
          Container Width (px)
          <input
            type="number"
            value={globals.containerWidth || 1200}
            onChange={(e) =>
              onChange({ ...globals, containerWidth: Number(e.target.value) })
            }
          />
        </label>
      </div>

      <div className="settings-group">
        <h4>Default Typography</h4>
        <label>
          Default Font Family
          <input
            type="text"
            value={globals.defaultFontFamily || ""}
            onChange={(e) =>
              onChange({ ...globals, defaultFontFamily: e.target.value })
            }
          />
        </label>
        <label>
          Default Font Size (px)
          <input
            type="number"
            value={globals.defaultFontSize || 16}
            onChange={(e) =>
              onChange({ ...globals, defaultFontSize: Number(e.target.value) })
            }
          />
        </label>
        <label>
          Default Line Height
          <input
            type="number"
            step="0.1"
            value={globals.defaultLineHeight || 1.5}
            onChange={(e) =>
              onChange({ ...globals, defaultLineHeight: Number(e.target.value) })
            }
          />
        </label>
      </div>

      <div className="settings-group">
        <h4>Global Colors</h4>
        <div className="global-colors-list">
          {(globals.colors || []).map((color) => (
            <div key={color.id} className="global-color-item">
              <input
                type="color"
                value={color.value}
                onChange={(e) => updateColor(color.id, e.target.value)}
              />
              <span className="color-name">{color.name}</span>
              <code>{color.value}</code>
              <button type="button" onClick={() => removeColor(color.id)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="add-global-color">
          <input
            type="text"
            placeholder="Color name"
            value={newColorName}
            onChange={(e) => setNewColorName(e.target.value)}
          />
          <input
            type="color"
            value={newColorValue}
            onChange={(e) => setNewColorValue(e.target.value)}
          />
          <button type="button" onClick={addColor}>
            + Add
          </button>
        </div>
      </div>

      <div className="settings-group">
        <h4>Global Fonts</h4>
        <div className="global-fonts-list">
          {(globals.fonts || []).map((font) => (
            <div key={font.id} className="global-font-item">
              <span className="font-name">{font.name}</span>
              <code>{font.family}</code>
              <button type="button" onClick={() => removeFont(font.id)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div className="add-global-font">
          <input
            type="text"
            placeholder="Font name"
            value={newFontName}
            onChange={(e) => setNewFontName(e.target.value)}
          />
          <input
            type="text"
            placeholder="e.g. 'Open Sans', sans-serif"
            value={newFontFamily}
            onChange={(e) => setNewFontFamily(e.target.value)}
          />
          <button type="button" onClick={addFont}>
            + Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default GlobalSettings;