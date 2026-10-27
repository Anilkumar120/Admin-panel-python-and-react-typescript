import { useState } from "react";
import { createPortal } from "react-dom";
import { ICON_LIBRARY } from "../../components/iconLibrary";
import MediaPicker, { type PickedMedia } from "./MediaPicker";

interface IconPickerPopupProps {
  isOpen: boolean;
  currentIcon?: string;
  currentImage?: string;
  onClose: () => void;
  onSelectIcon: (iconName: string) => void;
  onSelectImage: (imageUrl: string) => void;
  onClear: () => void;
}

const IconPickerPopup = ({
  isOpen,
  currentIcon,
  currentImage,
  onClose,
  onSelectIcon,
  onSelectImage,
  onClear,
}: IconPickerPopupProps) => {
  const [tab, setTab] = useState<"library" | "upload" | "char">("library");
  const [search, setSearch] = useState("");
  const [family, setFamily] = useState("all");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);

  if (!isOpen) return null;

  const filtered = ICON_LIBRARY.filter(
    (item) =>
      item.label.toLowerCase().includes(search.toLowerCase()) ||
      item.name.toLowerCase().includes(search.toLowerCase()),
  ).filter((item) =>
    family === "all" ||
    (family === "font-awesome" && item.family === "font-awesome") ||
    item.style === family,
  );

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    const picked = Array.isArray(media) ? media[0] : media;
    if (picked) onSelectImage(picked.url);
    setMediaPickerOpen(false);
    onClose();
  };

  return createPortal(
    <>
      <div
        className="media-picker-overlay"
        onClick={onClose}
        style={{ zIndex: 99998 }}
      >
        <div
          className="media-picker"
          style={{ maxWidth: 720, maxHeight: "85vh" }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="media-picker-header">
            <h3>Icon Library</h3>
            <button
              type="button"
              className="media-picker-close"
              onClick={onClose}
            >
              ×
            </button>
          </div>

          <div className="media-picker-tabs">
            <button
              type="button"
              className={tab === "library" ? "active" : ""}
              onClick={() => setTab("library")}
            >
              📚 Library
            </button>
            <button
              type="button"
              className={tab === "upload" ? "active" : ""}
              onClick={() => setTab("upload")}
            >
              📤 Upload SVG / PNG
            </button>
            <button
              type="button"
              className={tab === "char" ? "active" : ""}
              onClick={() => setTab("char")}
            >
              ✏️ Character
            </button>
          </div>

          <div className="media-picker-body">
            {tab === "library" && (
              <>
                <select
                  aria-label="Icon family"
                  value={family}
                  onChange={(event) => setFamily(event.target.value)}
                  style={{ width: "100%", marginBottom: 12 }}
                >
                  <option value="all">All Icons</option>
                  <option value="font-awesome">Font Awesome - All</option>
                  <option value="regular">Font Awesome - Regular</option>
                  <option value="solid">Font Awesome - Solid</option>
                  <option value="brands">Font Awesome - Brands</option>
                  <option value="filled">Material Design Icons - Filled</option>
                </select>
                <input
                  type="text"
                  className="media-search"
                  placeholder="Search icons..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
                    gap: 10,
                  }}
                >
                  {filtered.map(({ name, label, Icon }) => (
                    <button
                      key={name}
                      type="button"
                      title={label}
                      onClick={() => {
                        onSelectIcon(name);
                        onClose();
                      }}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 4,
                        padding: 10,
                        border:
                          currentIcon === name
                            ? "2px solid #2563eb"
                            : "1px solid #e3e6eb",
                        borderRadius: 8,
                        background: currentIcon === name ? "#eff6ff" : "#fff",
                        cursor: "pointer",
                      }}
                    >
                      <Icon size={22} />
                      <span style={{ fontSize: 10, color: "#666" }}>
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
                {filtered.length === 0 && (
                  <p style={{ textAlign: "center", color: "#888", padding: 40 }}>
                    No icons found.
                  </p>
                )}
              </>
            )}

            {tab === "upload" && (
              <div style={{ padding: 20 }}>
                {currentImage && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 16,
                      padding: 12,
                      background: "#f8f9fc",
                      borderRadius: 8,
                      marginBottom: 20,
                    }}
                  >
                    <img
                      src={currentImage}
                      alt="Current icon"
                      style={{
                        width: 60,
                        height: 60,
                        objectFit: "contain",
                        border: "1px solid #ddd",
                        borderRadius: 6,
                        background: "#fff",
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600 }}>Current image</div>
                      <div style={{ fontSize: 11, color: "#888" }}>
                        {currentImage}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  className="select-media-btn"
                  onClick={() => setMediaPickerOpen(true)}
                  style={{ width: "100%" }}
                >
                  📁 Choose SVG or PNG from Media Library
                </button>
                <p
                  style={{
                    fontSize: 12,
                    color: "#888",
                    marginTop: 12,
                    textAlign: "center",
                  }}
                >
                  Or drag and drop an image file. Supported: SVG, PNG, JPG, GIF, WebP.
                </p>
              </div>
            )}

            {tab === "char" && (
              <div style={{ padding: 20 }}>
                <label className="setting-field">
                  <span>Paste emoji or character</span>
                  <input
                    type="text"
                    placeholder="★, ♥, ✓, 🔥, ⚡, ➜"
                    onChange={(e) => {
                      if (e.target.value) {
                        onSelectIcon(e.target.value);
                        onClose();
                      }
                    }}
                    autoFocus
                  />
                </label>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(8, 1fr)",
                    gap: 8,
                    marginTop: 16,
                  }}
                >
                  {[
                    "★", "♥", "✓", "→", "☎", "✉", "⚙", "⚡",
                    "⌂", "+", "◎", "♫", "☀", "☁", "☂", "✂",
                    "🚀", "🔥", "💡", "📧", "📱", "🏆", "🎯", "🎨",
                    "💎", "🔒", "🔑", "📦", "🛒", "💰", "📊", "🌍",
                  ].map((sym) => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => {
                        onSelectIcon(sym);
                        onClose();
                      }}
                      style={{
                        padding: 10,
                        fontSize: 22,
                        border:
                          currentIcon === sym
                            ? "2px solid #2563eb"
                            : "1px solid #e3e6eb",
                        borderRadius: 6,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="media-picker-footer">
            <div></div>
            <div className="media-picker-actions">
              {(currentIcon || currentImage) && (
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    onClose();
                  }}
                  style={{ color: "#b42318" }}
                >
                  Remove Icon
                </button>
              )}
              <button type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>

      <MediaPicker
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        multiple={false}
        fileType="image"
      />
    </>,
    document.body,
  );
};

export default IconPickerPopup;