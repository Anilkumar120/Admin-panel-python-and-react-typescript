import { useState } from "react";
import type {
  PageWidget,
  ResponsiveDevice,
  WidgetStyle,
  BuilderGlobals,
} from "../../types/pageBuilder";
import MediaPicker, { type PickedMedia } from "./MediaPicker";
import UnitInput from "./UnitInput";
import SliderSettings from "./SliderSettings";
import RichTextEditor from "./RichTextEditor";
import "./SliderSettings.css";

interface SettingsPanelProps {
  widget: PageWidget;
  device: ResponsiveDevice;
  globals: BuilderGlobals;
  onChangeContent: (content: string) => void;
  onChangeUrl: (url: string) => void;
  onChangeStyle: (
    changes: Partial<WidgetStyle>,
    device?: ResponsiveDevice
  ) => void;
  onChangeSettings: (settings: any) => void;
  onChangeItems: (items: any[]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

type ContainerLayout = "flexbox" | "grid";
type ContainerDirection = "row" | "column" | "row-reverse" | "column-reverse";
type ContainerJustify =
  | "flex-start" | "center" | "flex-end"
  | "space-between" | "space-around" | "space-evenly";
type ContainerAlign = "flex-start" | "center" | "flex-end" | "stretch";

const SettingsPanel = ({
  widget,
  device,
  globals,
  onChangeContent,
  onChangeUrl,
  onChangeStyle,
  onChangeSettings,
  onChangeItems,
  onDelete,
  onDuplicate,
}: SettingsPanelProps) => {
  const [activeTab, setActiveTab] = useState<"content" | "style" | "advanced">(
    "content"
  );
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerMultiple, setMediaPickerMultiple] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<string>("");
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkInput, setLinkInput] = useState(widget.link?.url || "");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    layout: true,
    heading: true,
    typography: true,
    colors: true,
    spacing: false,
    size: false,
    border: false,
    background: false,
    link: false,
  });

  const s = widget.style;
  const rs = device !== "desktop" ? s.responsive?.[device] : undefined;
  const currentStyle = { ...s, ...(rs || {}) };

  const updateStyle = (changes: Partial<WidgetStyle>) => {
    onChangeStyle(changes, device !== "desktop" ? device : undefined);
  };

  const updateSpacing = (
    key: "padding" | "margin",
    side: "top" | "right" | "bottom" | "left",
    value: number
  ) => {
    const current =
      rs?.[key] || s[key] || { top: 0, right: 0, bottom: 0, left: 0 };
    updateStyle({ [key]: { ...current, [side]: value } } as any);
  };

  const isHeading = widget.type === "heading";
  const isButton = widget.type === "button";
  const isImageWidget = widget.type === "image";
  const isContainer = ["container", "section", "column", "grid"].includes(
    widget.type
  );
  const isSlider = ["carousel", "slider", "post_carousel"].includes(
    widget.type
  );
  const isGallery = widget.type === "gallery";
  const supportsLink = !["spacer", "divider", "html"].includes(widget.type);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const openMediaPicker = (target: string, multiple = false) => {
    setMediaPickerTarget(target);
    setMediaPickerMultiple(multiple);
    setMediaPickerOpen(true);
  };

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    const arr = Array.isArray(media) ? media : [media];

    if (
      mediaPickerTarget === "image" ||
      mediaPickerTarget === "background" ||
      mediaPickerTarget === "video"
    ) {
      const picked = arr[0];
      if (mediaPickerTarget === "background") {
        updateStyle({ backgroundImage: picked.url });
      } else {
        onChangeUrl(picked.url);
        onChangeSettings({
          accessibility: {
            ...widget.accessibility,
            altText: picked.alt,
          },
        });
      }
    } else if (
      mediaPickerTarget === "slider" ||
      mediaPickerTarget === "gallery" ||
      mediaPickerTarget === "carousel"
    ) {
      const currentImages = widget.settings?.images || [];
      const newImages = [
        ...currentImages,
        ...arr.map((p) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: p.url,
          type: "image" as const,
          alt: p.alt,
          title: p.title,
        })),
      ];
      onChangeSettings({ images: newImages });
    }

    setMediaPickerOpen(false);
  };

  // ============ CONTAINER STATE (per-device) ============
  const currentLayout: ContainerLayout = (
    (rs?.display as string) ||
    (s.display as string) ||
    "flex"
  ) === "grid"
    ? "grid"
    : "flexbox";
  const currentDirection: ContainerDirection =
    ((rs?.flexDirection as ContainerDirection) ||
      (currentStyle.flexDirection as ContainerDirection) ||
      "row");
  const currentJustify: ContainerJustify =
    ((currentStyle.justifyContent as ContainerJustify) || "flex-start");
  const currentAlign: ContainerAlign =
    ((currentStyle.alignItems as ContainerAlign) || "stretch");
  const currentGap: number = currentStyle.gap ?? 0;

  // ============ LINK HANDLERS ============
  const applyLink = () => {
    onChangeSettings({
      link: {
        ...widget.link,
        url: linkInput,
      },
    });
    setShowLinkPopup(false);
  };

  const removeLink = () => {
    onChangeSettings({
      link: { ...widget.link, url: "" },
    });
    setLinkInput("");
    setShowLinkPopup(false);
  };

  return (
    <div className="settings-panel">
      <div className="settings-header">
        <div className="widget-badge">
          {isContainer ? "▦" : isImageWidget ? "🖼" : isHeading ? "H" : "◆"}{" "}
          {widget.label}
          {device !== "desktop" && (
            <span className="device-badge">
              {device === "tablet" ? "▭" : "▯"} {device}
            </span>
          )}
        </div>
        <div className="settings-actions">
          <button type="button" onClick={onDuplicate} title="Duplicate">
            ⧉
          </button>
          <button type="button" onClick={onDelete} title="Delete">
            ×
          </button>
        </div>
      </div>

      <div className="settings-tabs">
        <button
          type="button"
          className={activeTab === "content" ? "active" : ""}
          onClick={() => setActiveTab("content")}
        >
          {isContainer ? "▭ Layout" : "✏ Content"}
        </button>
        <button
          type="button"
          className={activeTab === "style" ? "active" : ""}
          onClick={() => setActiveTab("style")}
        >
          🎨 Style
        </button>
        <button
          type="button"
          className={activeTab === "advanced" ? "active" : ""}
          onClick={() => setActiveTab("advanced")}
        >
          ⚙ Advanced
        </button>
      </div>

      <div className="settings-body">
        {/* ============================================ */}
        {/* ====== CONTENT / LAYOUT TAB =============== */}
        {/* ============================================ */}
        {activeTab === "content" && (
          <div className="settings-section">
            {/* ====== CONTAINER / SECTION / COLUMN / GRID ====== */}
            {isContainer && (
              <>
                {device !== "desktop" && (
                  <div className="device-notice">
                    ⚠ Editing <strong>{device}</strong> layout — desktop stays
                    unchanged.
                  </div>
                )}

                <div className="container-layout-group">
                  <label className="setting-field">
                    <span>Container Layout</span>
                    <select
                      value={currentLayout}
                      onChange={(e) => {
                        const layout = e.target.value as ContainerLayout;
                        if (layout === "grid") {
                          updateStyle({
                            display: "grid",
                            gridColumns: s.gridColumns || 2,
                            gridColumnGap: s.gridColumnGap || 16,
                            gridRowGap: s.gridRowGap || 16,
                          });
                        } else {
                          updateStyle({
                            display: "flex",
                            flexDirection: currentDirection || "row",
                          });
                        }
                      }}
                    >
                      <option value="flexbox">Flexbox</option>
                      <option value="grid">Grid</option>
                    </select>
                  </label>
                </div>

                {currentLayout === "flexbox" && (
                  <>
                    <label className="setting-field">
                      <span>Direction</span>
                      <div className="button-group">
                        <button
                          type="button"
                          className={currentDirection === "row" ? "active" : ""}
                          onClick={() => updateStyle({ flexDirection: "row" })}
                          title="Row →"
                        >
                          →
                        </button>
                        <button
                          type="button"
                          className={
                            currentDirection === "column" ? "active" : ""
                          }
                          onClick={() =>
                            updateStyle({ flexDirection: "column" })
                          }
                          title="Column ↓"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          className={
                            currentDirection === "row-reverse" ? "active" : ""
                          }
                          onClick={() =>
                            updateStyle({ flexDirection: "row-reverse" })
                          }
                          title="Row Reverse ←"
                        >
                          ←
                        </button>
                        <button
                          type="button"
                          className={
                            currentDirection === "column-reverse"
                              ? "active"
                              : ""
                          }
                          onClick={() =>
                            updateStyle({ flexDirection: "column-reverse" })
                          }
                          title="Column Reverse ↑"
                        >
                          ↑
                        </button>
                      </div>
                    </label>

                    <label className="setting-field">
                      <span>Justify Content</span>
                      <div className="button-group button-group-6">
                        {(
                          [
                            "flex-start", "center", "flex-end",
                            "space-between", "space-around", "space-evenly",
                          ] as ContainerJustify[]
                        ).map((j) => (
                          <button
                            key={j}
                            type="button"
                            className={currentJustify === j ? "active" : ""}
                            onClick={() => updateStyle({ justifyContent: j })}
                            title={j}
                          >
                            {j === "flex-start" ? "|←"
                              : j === "center" ? "|↔|"
                              : j === "flex-end" ? "→|"
                              : j === "space-between" ? "|=|"
                              : j === "space-around" ? "|·|"
                              : "|···|"}
                          </button>
                        ))}
                      </div>
                    </label>

                    <label className="setting-field">
                      <span>Align Items</span>
                      <div className="button-group">
                        {(
                          ["flex-start", "center", "flex-end", "stretch"] as ContainerAlign[]
                        ).map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={currentAlign === a ? "active" : ""}
                            onClick={() => updateStyle({ alignItems: a })}
                            title={a}
                          >
                            {a === "flex-start" ? "T"
                              : a === "center" ? "↕"
                              : a === "flex-end" ? "B"
                              : "⇕"}
                          </button>
                        ))}
                      </div>
                    </label>

                    <label className="setting-field">
                      <span>Gap (px)</span>
                      <input
                        type="number"
                        min={0}
                        value={currentGap}
                        onChange={(e) =>
                          updateStyle({ gap: Number(e.target.value) || 0 })
                        }
                      />
                    </label>
                  </>
                )}

                {currentLayout === "grid" && (
                  <>
                    <label className="setting-field">
                      <span>Columns</span>
                      <input
                        type="number"
                        min={1}
                        max={12}
                        value={
                          (rs as any)?.gridColumns ?? s.gridColumns ?? 2
                        }
                        onChange={(e) =>
                          updateStyle({
                            gridColumns: Number(e.target.value) || 1,
                          })
                        }
                      />
                    </label>

                    <div className="field-row">
                      <label className="setting-field">
                        <span>Column Gap (px)</span>
                        <input
                          type="number"
                          min={0}
                          value={s.gridColumnGap || 16}
                          onChange={(e) =>
                            updateStyle({
                              gridColumnGap: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                      <label className="setting-field">
                        <span>Row Gap (px)</span>
                        <input
                          type="number"
                          min={0}
                          value={s.gridRowGap || 16}
                          onChange={(e) =>
                            updateStyle({
                              gridRowGap: Number(e.target.value) || 0,
                            })
                          }
                        />
                      </label>
                    </div>
                  </>
                )}

                <label className="setting-field">
                  <span>Content Width</span>
                  <select
                    value={
                      s.maxWidth === "1140px"
                        ? "boxed"
                        : s.maxWidth === "100%"
                        ? "full"
                        : "default"
                    }
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "boxed") updateStyle({ maxWidth: "1140px" });
                      else if (val === "full") updateStyle({ maxWidth: "100%" });
                      else updateStyle({ maxWidth: undefined as any });
                    }}
                  >
                    <option value="default">Default</option>
                    <option value="boxed">Boxed (1140px)</option>
                    <option value="full">Full Width</option>
                  </select>
                </label>

                <div className="field-row">
                  <UnitInput
                    label="Width"
                    value={s.width || ""}
                    onChange={(val) => updateStyle({ width: val })}
                  />
                  <UnitInput
                    label="Min Height"
                    value={s.minHeight || ""}
                    onChange={(val) => updateStyle({ minHeight: val })}
                  />
                </div>

                <div className="settings-group" style={{ marginTop: 20 }}>
                  <h4>Add Element Inside</h4>
                  <div className="quick-add-widgets">
                    {(["heading", "text", "image", "button"] as const).map(
                      (t) => (
                        <button
                          key={t}
                          type="button"
                          className="quick-add-btn"
                          onClick={() => {
                            window.dispatchEvent(
                              new CustomEvent("pb-add-inside", {
                                detail: { parentId: widget.id, type: t },
                              })
                            );
                          }}
                        >
                          + {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </>
            )}

            {/* ====== HEADING — Elementor-style ====== */}
            {isHeading && (
              <div className="content-section-elementor">
                <div className="elementor-section-header">
                  <span
                    className="elementor-section-toggle"
                    onClick={() => toggleSection("heading")}
                  >
                    {openSections.heading ? "▾" : "▸"}
                  </span>
                  <span className="elementor-section-title">Heading</span>
                </div>

                {openSections.heading && (
                  <div className="elementor-section-body">
                    <label className="elementor-field">
                      <div className="elementor-label-row">
                        <span>Title</span>
                        <button type="button" className="ai-edit-btn">
                          ✨ Edit with AI
                        </button>
                      </div>
                      <div className="elementor-textarea-wrapper">
                        <textarea
                          value={widget.content || ""}
                          placeholder="Enter your title"
                          rows={3}
                          onChange={(e) => onChangeContent(e.target.value)}
                        />
                        <button
                          type="button"
                          className="textarea-expand-btn"
                          onClick={() => {
                            const val = window.prompt(
                              "Edit title:",
                              widget.content || ""
                            );
                            if (val !== null) onChangeContent(val);
                          }}
                          title="Expand editor"
                        >
                          ⛶
                        </button>
                      </div>
                    </label>

                    <label className="elementor-field">
                      <span className="elementor-label">Link</span>
                      <div className="elementor-link-input">
                        <input
                          type="text"
                          value={widget.link?.url || ""}
                          placeholder="Type or paste your URL"
                          onChange={(e) =>
                            onChangeSettings({
                              link: { ...widget.link, url: e.target.value },
                            })
                          }
                        />
                        <button
                          type="button"
                          className="link-icon-btn"
                          onClick={() => {
                            setLinkInput(widget.link?.url || "");
                            setShowLinkPopup(true);
                          }}
                          title="Link Options"
                        >
                          ⚙
                        </button>
                        <button
                          type="button"
                          className="link-icon-btn"
                          onClick={() => {
                            const url = window.prompt(
                              "Enter URL:",
                              widget.link?.url || "https://"
                            );
                            if (url !== null) {
                              onChangeSettings({
                                link: { ...widget.link, url },
                              });
                            }
                          }}
                          title="Insert Link"
                        >
                          🔗
                        </button>
                      </div>
                    </label>

                    <label className="elementor-field elementor-field-inline">
                      <span className="elementor-label">HTML Tag</span>
                      <select
                        value={s.htmlTag || "h2"}
                        onChange={(e) =>
                          updateStyle({ htmlTag: e.target.value })
                        }
                      >
                        <option value="h1">H1</option>
                        <option value="h2">H2</option>
                        <option value="h3">H3</option>
                        <option value="h4">H4</option>
                        <option value="h5">H5</option>
                        <option value="h6">H6</option>
                        <option value="p">p</option>
                        <option value="div">div</option>
                        <option value="span">span</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}

            {/* ====== TEXT — Full WYSIWYG Editor ====== */}
            {widget.type === "text" && (
              <RichTextEditor
                value={widget.content || ""}
                onChange={onChangeContent}
                placeholder="Enter your text..."
                minHeight={200}
              />
            )}

            {/* ====== BUTTON ====== */}
            {isButton && (
              <>
                <label className="setting-field">
                  <span>Button Text</span>
                  <input
                    type="text"
                    value={widget.content || ""}
                    placeholder="Click Here"
                    onChange={(e) => onChangeContent(e.target.value)}
                  />
                </label>

                <label className="setting-field">
                  <span>Button Link</span>
                  <div className="elementor-link-input">
                    <input
                      type="text"
                      value={widget.url || widget.link?.url || ""}
                      placeholder="https://..."
                      onChange={(e) => {
                        onChangeUrl(e.target.value);
                        onChangeSettings({
                          link: { ...widget.link, url: e.target.value },
                        });
                      }}
                    />
                    <button
                      type="button"
                      className="link-icon-btn"
                      onClick={() => {
                        const url = window.prompt(
                          "Enter URL:",
                          widget.url || "https://"
                        );
                        if (url !== null) {
                          onChangeUrl(url);
                          onChangeSettings({
                            link: { ...widget.link, url },
                          });
                        }
                      }}
                    >
                      🔗
                    </button>
                  </div>
                </label>

                <label className="setting-field">
                  <span>Open in</span>
                  <select
                    value={widget.link?.target || "_self"}
                    onChange={(e) =>
                      onChangeSettings({
                        link: {
                          ...widget.link,
                          target: e.target.value as "_self" | "_blank",
                        },
                      })
                    }
                  >
                    <option value="_self">Same Window</option>
                    <option value="_blank">New Window</option>
                  </select>
                </label>
              </>
            )}

            {/* ====== IMAGE ====== */}
            {isImageWidget && (
              <>
                <label className="setting-field">
                  <span>Image</span>
                </label>

                {widget.url ? (
                  <div className="image-preview-box">
                    <img src={widget.url} alt={widget.label} />
                    <div className="image-preview-actions">
                      <button
                        type="button"
                        className="change-media-btn"
                        onClick={() => openMediaPicker("image", false)}
                      >
                        🔄 Change
                      </button>
                      <button
                        type="button"
                        className="remove-media-btn"
                        onClick={() => onChangeUrl("")}
                      >
                        ✕ Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="select-media-btn"
                    onClick={() => openMediaPicker("image", false)}
                  >
                    🖼 Select Image
                  </button>
                )}

                <label className="setting-field">
                  <span>Link</span>
                  <div className="elementor-link-input">
                    <input
                      type="text"
                      value={widget.link?.url || ""}
                      placeholder="Type or paste your URL"
                      onChange={(e) =>
                        onChangeSettings({
                          link: { ...widget.link, url: e.target.value },
                        })
                      }
                    />
                    <button
                      type="button"
                      className="link-icon-btn"
                      onClick={() => {
                        const url = window.prompt(
                          "Enter URL:",
                          widget.link?.url || "https://"
                        );
                        if (url !== null)
                          onChangeSettings({
                            link: { ...widget.link, url },
                          });
                      }}
                    >
                      🔗
                    </button>
                  </div>
                </label>

                <label className="setting-field">
                  <span>Alt Text</span>
                  <input
                    type="text"
                    value={widget.accessibility?.altText || ""}
                    placeholder="Describe image"
                    onChange={(e) =>
                      onChangeSettings({
                        accessibility: {
                          ...widget.accessibility,
                          altText: e.target.value,
                        },
                      })
                    }
                  />
                </label>
              </>
            )}

            {/* ====== SLIDER ====== */}
            {isSlider && (
              <SliderSettings
                widget={widget}
                onChangeSettings={onChangeSettings}
                onChangeItems={onChangeItems}
              />
            )}

            {/* ====== GALLERY ====== */}
            {isGallery && (
              <div className="items-editor">
                <div className="items-header">
                  <span>Images ({(widget.settings?.images || []).length})</span>
                  <button
                    type="button"
                    onClick={() => openMediaPicker("gallery", true)}
                  >
                    + Add Images
                  </button>
                </div>

                <label className="setting-field">
                  <span>Columns</span>
                  <select
                    value={widget.settings?.columns || 3}
                    onChange={(e) =>
                      onChangeSettings({ columns: Number(e.target.value) })
                    }
                  >
                    <option value={1}>1 Column</option>
                    <option value={2}>2 Columns</option>
                    <option value={3}>3 Columns</option>
                    <option value={4}>4 Columns</option>
                    <option value={6}>6 Columns</option>
                  </select>
                </label>

                {(widget.settings?.images || []).map((img, i) => (
                  <div key={img.id || i} className="image-item-editor">
                    <img
                      src={img.url}
                      alt=""
                      style={{
                        width: 50,
                        height: 40,
                        objectFit: "cover",
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ flex: 1, fontSize: 11, color: "#666" }}>
                      {img.title || `Image ${i + 1}`}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSettings({
                          images: (widget.settings?.images || []).filter(
                            (_, idx) => idx !== i
                          ),
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ====== HTML ====== */}
            {widget.type === "html" && (
              <label className="setting-field">
                <span>HTML Code</span>
                <textarea
                  value={widget.content || ""}
                  onChange={(e) => onChangeContent(e.target.value)}
                  rows={8}
                  className="code-textarea"
                  placeholder="<div>...</div>"
                />
              </label>
            )}

            {/* ====== VIDEO ====== */}
            {widget.type === "video" && (
              <label className="setting-field">
                <span>Video URL</span>
                <input
                  type="text"
                  value={widget.url || ""}
                  placeholder="YouTube / Vimeo / MP4"
                  onChange={(e) => onChangeUrl(e.target.value)}
                />
              </label>
            )}

            {/* ====== ACCORDION / TABS / TOGGLE ====== */}
            {["accordion", "tabs", "toggle"].includes(widget.type) && (
              <div className="items-editor">
                <div className="items-header">
                  <span>Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: `item-${Date.now()}`,
                          title: "New Item",
                          content: "Content",
                        },
                      ])
                    }
                  >
                    + Add
                  </button>
                </div>
                {(widget.items || []).map((item, i) => (
                  <div key={item.id} className="item-editor">
                    <input
                      type="text"
                      value={item.title}
                      onChange={(e) => {
                        const newItems = [...(widget.items || [])];
                        newItems[i] = { ...item, title: e.target.value };
                        onChangeItems(newItems);
                      }}
                      placeholder="Title"
                    />
                    <textarea
                      value={item.content || ""}
                      onChange={(e) => {
                        const newItems = [...(widget.items || [])];
                        newItems[i] = { ...item, content: e.target.value };
                        onChangeItems(newItems);
                      }}
                      placeholder="Content"
                      rows={2}
                    />
                    <button
                      type="button"
                      className="remove-item"
                      onClick={() =>
                        onChangeItems(
                          (widget.items || []).filter((_, idx) => idx !== i)
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* ====== STYLE TAB ========================== */}
        {/* ============================================ */}
        {activeTab === "style" && (
          <>
            {!isContainer && !isImageWidget && (
              <div className="settings-section">
                <div
                  className="collapsible-header"
                  onClick={() => toggleSection("typography")}
                >
                  <span>
                    {openSections.typography ? "▾" : "▸"} Typography
                  </span>
                </div>
                {openSections.typography && (
                  <div className="collapsible-content">
                    <label className="setting-field">
                      <span>Font Family</span>
                      <select
                        value={currentStyle.fontFamily || ""}
                        onChange={(e) =>
                          updateStyle({ fontFamily: e.target.value })
                        }
                      >
                        <option value="">Default</option>
                        <option value="Arial, sans-serif">Arial</option>
                        <option value="Georgia, serif">Georgia</option>
                        <option value="'Times New Roman', serif">
                          Times New Roman
                        </option>
                        <option value="Verdana, sans-serif">Verdana</option>
                        <option value="'Courier New', monospace">
                          Courier New
                        </option>
                        {(globals.fonts || []).map((f) => (
                          <option key={f.id} value={f.family}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="field-row">
                      <label className="setting-field">
                        <span>Font Size (px)</span>
                        <input
                          type="number"
                          min="8"
                          max="200"
                          value={currentStyle.fontSize || 16}
                          onChange={(e) =>
                            updateStyle({ fontSize: Number(e.target.value) })
                          }
                        />
                      </label>

                      <label className="setting-field">
                        <span>Font Weight</span>
                        <select
                          value={currentStyle.fontWeight || 400}
                          onChange={(e) =>
                            updateStyle({ fontWeight: Number(e.target.value) })
                          }
                        >
                          <option value={300}>Light</option>
                          <option value={400}>Normal</option>
                          <option value={500}>Medium</option>
                          <option value={600}>Semi Bold</option>
                          <option value={700}>Bold</option>
                          <option value={800}>Extra Bold</option>
                          <option value={900}>Black</option>
                        </select>
                      </label>
                    </div>

                    <label className="setting-field">
                      <span>Text Align</span>
                      <div className="button-group">
                        {(
                          ["left", "center", "right", "justify"] as const
                        ).map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={
                              currentStyle.textAlign === a ? "active" : ""
                            }
                            onClick={() => updateStyle({ textAlign: a })}
                          >
                            {a === "left" ? "⬅"
                              : a === "center" ? "↔"
                              : a === "right" ? "➡"
                              : "☰"}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("colors")}
              >
                <span>{openSections.colors ? "▾" : "▸"} Colors</span>
              </div>
              {openSections.colors && (
                <div className="collapsible-content">
                  {!isImageWidget && (
                    <label className="setting-field">
                      <span>Text Color</span>
                      <div className="color-input-group">
                        <input
                          type="color"
                          value={currentStyle.color || "#1a1a2e"}
                          onChange={(e) =>
                            updateStyle({ color: e.target.value })
                          }
                        />
                        <input
                          type="text"
                          value={currentStyle.color || "#1a1a2e"}
                          onChange={(e) =>
                            updateStyle({ color: e.target.value })
                          }
                        />
                      </div>
                    </label>
                  )}

                  <label className="setting-field">
                    <span>Background Color</span>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={s.backgroundColor || "#ffffff"}
                        onChange={(e) =>
                          updateStyle({ backgroundColor: e.target.value })
                        }
                      />
                      <input
                        type="text"
                        value={s.backgroundColor || "#ffffff"}
                        onChange={(e) =>
                          updateStyle({ backgroundColor: e.target.value })
                        }
                      />
                    </div>
                  </label>

                  {globals.colors && globals.colors.length > 0 && (
                    <div className="global-colors-row">
                      <span className="global-label">Global:</span>
                      <div className="color-swatches">
                        {globals.colors.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            className="color-swatch"
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                            onClick={() =>
                              updateStyle({ backgroundColor: c.value })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {(isContainer || isSlider || isGallery) && (
              <div className="settings-section">
                <div
                  className="collapsible-header"
                  onClick={() => toggleSection("background")}
                >
                  <span>
                    {openSections.background ? "▾" : "▸"} Background Image
                  </span>
                </div>
                {openSections.background && (
                  <div className="collapsible-content">
                    {s.backgroundImage ? (
                      <div className="image-preview-box">
                        <img src={s.backgroundImage} alt="Background" />
                        <div className="image-preview-actions">
                          <button
                            type="button"
                            className="change-media-btn"
                            onClick={() =>
                              openMediaPicker("background", false)
                            }
                          >
                            🔄 Change
                          </button>
                          <button
                            type="button"
                            className="remove-media-btn"
                            onClick={() => updateStyle({ backgroundImage: "" })}
                          >
                            ✕ Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="select-media-btn"
                        onClick={() => openMediaPicker("background", false)}
                      >
                        🖼 Select Background
                      </button>
                    )}

                    <label className="setting-field">
                      <span>Background Size</span>
                      <select
                        value={s.backgroundSize || "cover"}
                        onChange={(e) =>
                          updateStyle({ backgroundSize: e.target.value })
                        }
                      >
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="auto">Auto</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("spacing")}
              >
                <span>{openSections.spacing ? "▾" : "▸"} Spacing</span>
              </div>
              {openSections.spacing && (
                <div className="collapsible-content">
                  <label className="setting-field">
                    <span>Padding (px)</span>
                  </label>
                  <div className="spacing-grid">
                    <input
                      type="number"
                      placeholder="Top"
                      value={(rs?.padding || s.padding)?.top || 0}
                      onChange={(e) =>
                        updateSpacing("padding", "top", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Right"
                      value={(rs?.padding || s.padding)?.right || 0}
                      onChange={(e) =>
                        updateSpacing("padding", "right", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Bottom"
                      value={(rs?.padding || s.padding)?.bottom || 0}
                      onChange={(e) =>
                        updateSpacing("padding", "bottom", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Left"
                      value={(rs?.padding || s.padding)?.left || 0}
                      onChange={(e) =>
                        updateSpacing("padding", "left", Number(e.target.value))
                      }
                    />
                  </div>

                  <label className="setting-field" style={{ marginTop: 12 }}>
                    <span>Margin (px)</span>
                  </label>
                  <div className="spacing-grid">
                    <input
                      type="number"
                      placeholder="Top"
                      value={(rs?.margin || s.margin)?.top || 0}
                      onChange={(e) =>
                        updateSpacing("margin", "top", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Right"
                      value={(rs?.margin || s.margin)?.right || 0}
                      onChange={(e) =>
                        updateSpacing("margin", "right", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Bottom"
                      value={(rs?.margin || s.margin)?.bottom || 0}
                      onChange={(e) =>
                        updateSpacing("margin", "bottom", Number(e.target.value))
                      }
                    />
                    <input
                      type="number"
                      placeholder="Left"
                      value={(rs?.margin || s.margin)?.left || 0}
                      onChange={(e) =>
                        updateSpacing("margin", "left", Number(e.target.value))
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("border")}
              >
                <span>{openSections.border ? "▾" : "▸"} Border</span>
              </div>
              {openSections.border && (
                <div className="collapsible-content">
                  <label className="setting-field">
                    <span>Border Style</span>
                    <select
                      value={s.borderStyle || "none"}
                      onChange={(e) =>
                        updateStyle({ borderStyle: e.target.value as any })
                      }
                    >
                      <option value="none">None</option>
                      <option value="solid">Solid</option>
                      <option value="dashed">Dashed</option>
                      <option value="dotted">Dotted</option>
                    </select>
                  </label>

                  {s.borderStyle && s.borderStyle !== "none" && (
                    <div className="field-row">
                      <label className="setting-field">
                        <span>Width (px)</span>
                        <input
                          type="number"
                          value={s.borderWidth || 1}
                          onChange={(e) =>
                            updateStyle({
                              borderWidth: Number(e.target.value),
                            })
                          }
                        />
                      </label>

                      <label className="setting-field">
                        <span>Color</span>
                        <input
                          type="color"
                          value={s.borderColor || "#e0e0e0"}
                          onChange={(e) =>
                            updateStyle({ borderColor: e.target.value })
                          }
                        />
                      </label>
                    </div>
                  )}

                  <label className="setting-field">
                    <span>Border Radius (px)</span>
                    <input
                      type="number"
                      min="0"
                      value={currentStyle.borderRadius || 0}
                      onChange={(e) =>
                        updateStyle({ borderRadius: Number(e.target.value) })
                      }
                    />
                  </label>
                </div>
              )}
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* ====== ADVANCED TAB ======================== */}
        {/* ============================================ */}
        {activeTab === "advanced" && (
          <>
            {supportsLink && !isHeading && !isButton && !isImageWidget && (
              <div className="settings-section">
                <div
                  className="collapsible-header"
                  onClick={() => toggleSection("link")}
                >
                  <span>{openSections.link ? "▾" : "▸"} 🔗 Link</span>
                </div>
                {openSections.link && (
                  <div className="collapsible-content">
                    <label className="setting-field">
                      <span>Link URL</span>
                      <input
                        type="text"
                        value={widget.link?.url || widget.url || ""}
                        placeholder="https://example.com"
                        onChange={(e) =>
                          onChangeSettings({
                            link: { ...widget.link, url: e.target.value },
                          })
                        }
                      />
                    </label>

                    <label className="setting-field">
                      <span>Open in</span>
                      <select
                        value={widget.link?.target || "_self"}
                        onChange={(e) =>
                          onChangeSettings({
                            link: {
                              ...widget.link,
                              target: e.target.value as "_self" | "_blank",
                            },
                          })
                        }
                      >
                        <option value="_self">Same Window</option>
                        <option value="_blank">New Window</option>
                      </select>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="settings-section">
              <h4 className="section-title">Layout</h4>

              <label className="setting-field">
                <span>Position</span>
                <select
                  value={s.position || "static"}
                  onChange={(e) =>
                    updateStyle({ position: e.target.value as any })
                  }
                >
                  <option value="static">Static</option>
                  <option value="relative">Relative</option>
                  <option value="absolute">Absolute</option>
                  <option value="fixed">Fixed</option>
                  <option value="sticky">Sticky</option>
                </select>
              </label>

              <div className="field-row">
                <label className="setting-field">
                  <span>Z-Index</span>
                  <input
                    type="number"
                    value={s.zIndex || 0}
                    onChange={(e) =>
                      updateStyle({ zIndex: Number(e.target.value) })
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Overflow</span>
                  <select
                    value={s.overflow || "visible"}
                    onChange={(e) =>
                      updateStyle({ overflow: e.target.value as any })
                    }
                  >
                    <option value="visible">Visible</option>
                    <option value="hidden">Hidden</option>
                    <option value="auto">Auto</option>
                    <option value="scroll">Scroll</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="settings-section">
              <h4 className="section-title">Responsive Visibility</h4>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={s.responsive?.desktop?.hide || false}
                  onChange={(e) =>
                    onChangeStyle(
                      {
                        responsive: {
                          ...s.responsive,
                          desktop: {
                            ...s.responsive?.desktop,
                            hide: e.target.checked,
                          },
                        },
                      },
                      "desktop"
                    )
                  }
                />
                Hide on Desktop
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={s.responsive?.tablet?.hide || false}
                  onChange={(e) =>
                    onChangeStyle(
                      {
                        responsive: {
                          ...s.responsive,
                          tablet: {
                            ...s.responsive?.tablet,
                            hide: e.target.checked,
                          },
                        },
                      },
                      "tablet"
                    )
                  }
                />
                Hide on Tablet
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={s.responsive?.mobile?.hide || false}
                  onChange={(e) =>
                    onChangeStyle(
                      {
                        responsive: {
                          ...s.responsive,
                          mobile: {
                            ...s.responsive?.mobile,
                            hide: e.target.checked,
                          },
                        },
                      },
                      "mobile"
                    )
                  }
                />
                Hide on Mobile
              </label>
            </div>

            <div className="settings-section">
              <h4 className="section-title">Custom CSS</h4>
              <label className="setting-field">
                <span>CSS Classes</span>
                <input
                  type="text"
                  value={(s as any).customClasses || ""}
                  placeholder="class1 class2"
                  onChange={(e) =>
                    updateStyle({ customClasses: e.target.value } as any)
                  }
                />
              </label>
              <label className="setting-field">
                <span>CSS ID</span>
                <input
                  type="text"
                  value={widget.advanced?.cssId || ""}
                  onChange={(e) =>
                    onChangeSettings({ cssId: e.target.value })
                  }
                />
              </label>
            </div>
          </>
        )}
      </div>

      {/* Link popup */}
      {showLinkPopup && (
        <div
          className="link-popup-overlay"
          onClick={() => setShowLinkPopup(false)}
        >
          <div className="link-popup" onClick={(e) => e.stopPropagation()}>
            <h4>Link Options</h4>
            <label className="setting-field">
              <span>URL</span>
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="https://..."
                autoFocus
              />
            </label>
            <div className="link-popup-actions">
              <button type="button" onClick={removeLink}>
                Remove Link
              </button>
              <button type="button" className="primary" onClick={applyLink}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      <MediaPicker
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        multiple={mediaPickerMultiple}
        fileType={mediaPickerTarget === "video" ? "video" : "image"}
      />
    </div>
  );
};

export default SettingsPanel;