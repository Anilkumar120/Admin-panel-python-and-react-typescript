import { useState } from "react";
import MediaPicker, { type PickedMedia } from "./MediaPicker";
import IconPickerPopup from "./IconPickerPopup";

export interface RepeaterChildItem {
  id: string;
  type: "heading" | "text" | "image" | "video" | "iframe" | "icon" | "button";
  content?: string;
  url?: string;
  icon?: string;
  link?: { url?: string; target?: string };
}

interface RepeaterItemsEditorProps {
  items: any[];
  onChange: (items: any[]) => void;
  itemLabel?: string;
  addLabel?: string;
  allowNestedChildren?: boolean;
  showItemIcon?: boolean;
  showItemImage?: boolean;
  showItemLink?: boolean;
  showTitle?: boolean;
  showContent?: boolean;
}

const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const RepeaterItemsEditor = ({
  items,
  onChange,
  itemLabel = "Item",
  addLabel = "Add Item",
  allowNestedChildren = false,
  showItemIcon = false,
  showItemImage = false,
  showItemLink = false,
  showTitle = true,
  showContent = true,
}: RepeaterItemsEditorProps) => {
  const [activeIndex, setActiveIndex] = useState<number | null>(
    items.length > 0 ? 0 : null,
  );
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<{
    index: number;
    field: "image" | "childImage";
    childIndex?: number;
  } | null>(null);
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconTarget, setIconTarget] = useState<{
    index: number;
    childIndex?: number;
  } | null>(null);

  const updateItem = (index: number, changes: Record<string, any>) => {
    const next = [...items];
    next[index] = { ...next[index], ...changes };
    onChange(next);
  };

  const addItem = () => {
    const newItem: any = {
      id: createId(),
      title: `${itemLabel} ${items.length + 1}`,
      content: "",
      children: allowNestedChildren ? [] : undefined,
    };
    onChange([...items, newItem]);
    setActiveIndex(items.length);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
    if (activeIndex === index) setActiveIndex(null);
    else if (activeIndex !== null && activeIndex > index)
      setActiveIndex(activeIndex - 1);
  };

  const duplicateItem = (index: number) => {
    const clone = JSON.parse(JSON.stringify(items[index]));
    clone.id = createId();
    if (clone.children) {
      clone.children = clone.children.map((c: any) => ({
        ...c,
        id: createId(),
      }));
    }
    onChange([...items.slice(0, index + 1), clone, ...items.slice(index + 1)]);
  };

  const moveItem = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
    setActiveIndex(target);
  };

  // Nested children helpers
  const addChild = (itemIndex: number, type: RepeaterChildItem["type"]) => {
    const item = items[itemIndex];
    const children = [...(item.children || [])];
    const newChild: RepeaterChildItem = {
      id: createId(),
      type,
      content:
        type === "heading"
          ? "Heading"
          : type === "text"
            ? "Text content"
            : type === "button"
              ? "Click Here"
              : type === "icon"
                ? "★"
                : "",
      url: type === "video" || type === "iframe" ? "" : undefined,
      icon: type === "icon" ? "★" : undefined,
    };
    children.push(newChild);
    updateItem(itemIndex, { children });
  };

  const updateChild = (
    itemIndex: number,
    childIndex: number,
    changes: Record<string, any>,
  ) => {
    const item = items[itemIndex];
    const children = [...(item.children || [])];
    children[childIndex] = { ...children[childIndex], ...changes };
    updateItem(itemIndex, { children });
  };

  const removeChild = (itemIndex: number, childIndex: number) => {
    const item = items[itemIndex];
    const children = (item.children || []).filter(
      (_: any, i: number) => i !== childIndex,
    );
    updateItem(itemIndex, { children });
  };

  const moveChild = (
    itemIndex: number,
    childIndex: number,
    dir: -1 | 1,
  ) => {
    const item = items[itemIndex];
    const children = [...(item.children || [])];
    const target = childIndex + dir;
    if (target < 0 || target >= children.length) return;
    [children[childIndex], children[target]] = [
      children[target],
      children[childIndex],
    ];
    updateItem(itemIndex, { children });
  };

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    const picked = Array.isArray(media) ? media[0] : media;
    if (!picked || !mediaTarget) return;
    if (mediaTarget.field === "image") {
      updateItem(mediaTarget.index, { image: picked.url, imageAlt: picked.alt });
    } else if (
      mediaTarget.field === "childImage" &&
      mediaTarget.childIndex !== undefined
    ) {
      updateChild(mediaTarget.index, mediaTarget.childIndex, {
        url: picked.url,
        content: "",
      });
    }
    setMediaPickerOpen(false);
    setMediaTarget(null);
  };

  const currentActive = activeIndex !== null ? items[activeIndex] : null;

  return (
    <div className="items-editor">
      <div className="items-header">
        <span>{itemLabel}s ({items.length})</span>
        <button type="button" onClick={addItem}>
          + {addLabel}
        </button>
      </div>

      {items.length === 0 && (
        <p style={{ fontSize: 12, color: "#888", padding: "12px 0" }}>
          No {itemLabel.toLowerCase()}s yet. Click "{addLabel}" to start.
        </p>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          marginBottom: 12,
        }}
      >
        {items.map((item, index) => (
          <div
            key={item.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: 8,
              background: activeIndex === index ? "#eef5fb" : "#f8f9fc",
              border:
                activeIndex === index
                  ? "1px solid #0c2f55"
                  : "1px solid #e3e6eb",
              borderRadius: 6,
            }}
          >
            <button
              type="button"
              onClick={() => setActiveIndex(index)}
              style={{
                flex: 1,
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px 8px",
                fontSize: 13,
                fontWeight: activeIndex === index ? 700 : 500,
                color: activeIndex === index ? "#0c2f55" : "#333",
              }}
            >
              {index + 1}. {item.title || `${itemLabel} ${index + 1}`}
            </button>
            <button
              type="button"
              onClick={() => moveItem(index, -1)}
              disabled={index === 0}
              title="Move up"
              style={{ padding: "2px 6px", fontSize: 11 }}
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => moveItem(index, 1)}
              disabled={index === items.length - 1}
              title="Move down"
              style={{ padding: "2px 6px", fontSize: 11 }}
            >
              ↓
            </button>
            <button
              type="button"
              onClick={() => duplicateItem(index)}
              title="Duplicate"
              style={{ padding: "2px 6px", fontSize: 11 }}
            >
              ⧉
            </button>
            <button
              type="button"
              onClick={() => removeItem(index)}
              title="Delete"
              style={{
                padding: "2px 6px",
                fontSize: 11,
                color: "#b42318",
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {/* Active item editor */}
      {currentActive && activeIndex !== null && (
        <div
          style={{
            border: "1px solid #e3e6eb",
            borderRadius: 6,
            padding: 14,
            background: "#fff",
          }}
        >
          <h4
            style={{
              margin: "0 0 12px",
              fontSize: 12,
              color: "#0c2f55",
              textTransform: "uppercase",
            }}
          >
            {itemLabel} {activeIndex + 1} — Settings
          </h4>

          {showTitle && (
            <label className="setting-field">
              <span>Title</span>
              <input
                type="text"
                value={currentActive.title || ""}
                onChange={(e) =>
                  updateItem(activeIndex, { title: e.target.value })
                }
                placeholder="Enter title"
              />
            </label>
          )}

          {showContent && (
            <label className="setting-field">
              <span>Content / Description</span>
              <textarea
                rows={3}
                value={currentActive.content || ""}
                onChange={(e) =>
                  updateItem(activeIndex, { content: e.target.value })
                }
                placeholder="Enter content"
              />
            </label>
          )}

          {showItemImage && (
            <div className="setting-field">
              <span>Image</span>
              {currentActive.image && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <img
                    src={currentActive.image}
                    alt=""
                    style={{
                      width: 60,
                      height: 60,
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                    }}
                  />
                  <button
                    type="button"
                    className="remove-media-btn"
                    onClick={() => updateItem(activeIndex, { image: "" })}
                  >
                    Remove
                  </button>
                </div>
              )}
              <button
                type="button"
                className="change-media-btn"
                onClick={() => {
                  setMediaTarget({ index: activeIndex, field: "image" });
                  setMediaPickerOpen(true);
                }}
              >
                📁 Choose or Upload Image
              </button>
            </div>
          )}

          {showItemIcon && (
            <div className="setting-field">
              <span>Icon</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: 10,
                  background: "#f8f9fc",
                  border: "1px solid #e3e6eb",
                  borderRadius: 6,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#fff",
                    border: "1px solid #e3e6eb",
                    borderRadius: 6,
                    fontSize: 18,
                  }}
                >
                  {currentActive.image ? (
                    <img
                      src={currentActive.image}
                      alt=""
                      style={{
                        width: 24,
                        height: 24,
                        objectFit: "contain",
                      }}
                    />
                  ) : (
                    currentActive.icon || "★"
                  )}
                </div>
                <button
                  type="button"
                  className="change-media-btn"
                  onClick={() => {
                    setIconTarget({ index: activeIndex });
                    setIconPickerOpen(true);
                  }}
                >
                  Choose Icon
                </button>
                {(currentActive.icon || currentActive.image) && (
                  <button
                    type="button"
                    className="remove-media-btn"
                    onClick={() =>
                      updateItem(activeIndex, { icon: "", image: "" })
                    }
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          )}

          {showItemLink && (
            <label className="setting-field">
              <span>Link URL</span>
              <input
                type="text"
                value={currentActive.link?.url || ""}
                onChange={(e) =>
                  updateItem(activeIndex, {
                    link: { ...currentActive.link, url: e.target.value },
                  })
                }
                placeholder="https://..."
              />
            </label>
          )}

          {/* ============================================ */}
          {/* NESTED CHILDREN — inner content builder       */}
          {/* ============================================ */}
          {allowNestedChildren && (
            <div
              style={{
                marginTop: 16,
                paddingTop: 16,
                borderTop: "1px dashed #e3e6eb",
              }}
            >
              <h5
                style={{
                  fontSize: 12,
                  margin: "0 0 8px",
                  color: "#0c2f55",
                }}
              >
                Inner Content ({(currentActive.children || []).length})
              </h5>

              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginBottom: 10,
                }}
              >
                {(
                  [
                    { t: "heading", l: "H", title: "Heading" },
                    { t: "text", l: "T", title: "Text" },
                    { t: "image", l: "🖼", title: "Image" },
                    { t: "video", l: "▶", title: "Video" },
                    { t: "iframe", l: "▣", title: "iFrame" },
                    { t: "icon", l: "★", title: "Icon" },
                    { t: "button", l: "▣", title: "Button" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.t}
                    type="button"
                    onClick={() => addChild(activeIndex, opt.t)}
                    title={`Add ${opt.title}`}
                    style={{
                      padding: "6px 10px",
                      fontSize: 11,
                      border: "1px dashed #0c2f55",
                      borderRadius: 4,
                      background: "#fff",
                      color: "#0c2f55",
                      cursor: "pointer",
                    }}
                  >
                    + {opt.title}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                {(currentActive.children || []).map(
                  (child: RepeaterChildItem, childIndex: number) => (
                    <div
                      key={child.id}
                      style={{
                        padding: 10,
                        background: "#f8f9fc",
                        border: "1px solid #e3e6eb",
                        borderRadius: 6,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 6,
                        }}
                      >
                        <strong
                          style={{
                            fontSize: 11,
                            textTransform: "uppercase",
                            color: "#0c2f55",
                          }}
                        >
                          {child.type}
                        </strong>
                        <div style={{ display: "flex", gap: 2 }}>
                          <button
                            type="button"
                            onClick={() => moveChild(activeIndex, childIndex, -1)}
                            disabled={childIndex === 0}
                            style={{ padding: "1px 5px", fontSize: 10 }}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => moveChild(activeIndex, childIndex, 1)}
                            disabled={
                              childIndex ===
                              (currentActive.children || []).length - 1
                            }
                            style={{ padding: "1px 5px", fontSize: 10 }}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => removeChild(activeIndex, childIndex)}
                            style={{
                              padding: "1px 5px",
                              fontSize: 10,
                              color: "#b42318",
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>

                      {(child.type === "heading" || child.type === "text") && (
                        <textarea
                          rows={2}
                          value={child.content || ""}
                          onChange={(e) =>
                            updateChild(activeIndex, childIndex, {
                              content: e.target.value,
                            })
                          }
                          placeholder={
                            child.type === "heading"
                              ? "Heading text"
                              : "Text content"
                          }
                          style={{
                            width: "100%",
                            fontSize: 12,
                            padding: 6,
                            border: "1px solid #d9dee7",
                            borderRadius: 4,
                            boxSizing: "border-box",
                          }}
                        />
                      )}

                      {child.type === "image" && (
                        <div>
                          {child.url && (
                            <img
                              src={child.url}
                              alt=""
                              style={{
                                width: "100%",
                                maxHeight: 100,
                                objectFit: "cover",
                                borderRadius: 4,
                                marginBottom: 6,
                              }}
                            />
                          )}
                          <button
                            type="button"
                            className="change-media-btn"
                            style={{ width: "100%" }}
                            onClick={() => {
                              setMediaTarget({
                                index: activeIndex,
                                field: "childImage",
                                childIndex,
                              });
                              setMediaPickerOpen(true);
                            }}
                          >
                            {child.url ? "Change Image" : "Choose Image"}
                          </button>
                        </div>
                      )}

                      {(child.type === "video" || child.type === "iframe") && (
                        <input
                          type="text"
                          value={child.url || ""}
                          onChange={(e) =>
                            updateChild(activeIndex, childIndex, {
                              url: e.target.value,
                            })
                          }
                          placeholder={
                            child.type === "video"
                              ? "YouTube/Vimeo/MP4 URL"
                              : "https://example.com/embed"
                          }
                          style={{
                            width: "100%",
                            fontSize: 12,
                            padding: 6,
                            border: "1px solid #d9dee7",
                            borderRadius: 4,
                            boxSizing: "border-box",
                          }}
                        />
                      )}

                      {child.type === "icon" && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              width: 30,
                              height: 30,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "#fff",
                              border: "1px solid #e3e6eb",
                              borderRadius: 4,
                              fontSize: 16,
                            }}
                          >
                            {child.url ? (
                              <img
                                src={child.url}
                                alt=""
                                style={{
                                  width: 22,
                                  height: 22,
                                  objectFit: "contain",
                                }}
                              />
                            ) : (
                              child.icon || child.content || "★"
                            )}
                          </div>
                          <button
                            type="button"
                            className="change-media-btn"
                            style={{ flex: 1, fontSize: 11 }}
                            onClick={() => {
                              setIconTarget({
                                index: activeIndex,
                                childIndex,
                              });
                              setIconPickerOpen(true);
                            }}
                          >
                            Choose Icon
                          </button>
                        </div>
                      )}

                      {child.type === "button" && (
                        <>
                          <input
                            type="text"
                            value={child.content || ""}
                            onChange={(e) =>
                              updateChild(activeIndex, childIndex, {
                                content: e.target.value,
                              })
                            }
                            placeholder="Button text"
                            style={{
                              width: "100%",
                              fontSize: 12,
                              padding: 6,
                              border: "1px solid #d9dee7",
                              borderRadius: 4,
                              boxSizing: "border-box",
                              marginBottom: 4,
                            }}
                          />
                          <input
                            type="text"
                            value={child.link?.url || ""}
                            onChange={(e) =>
                              updateChild(activeIndex, childIndex, {
                                link: {
                                  ...child.link,
                                  url: e.target.value,
                                },
                              })
                            }
                            placeholder="https://..."
                            style={{
                              width: "100%",
                              fontSize: 12,
                              padding: 6,
                              border: "1px solid #d9dee7",
                              borderRadius: 4,
                              boxSizing: "border-box",
                            }}
                          />
                        </>
                      )}
                    </div>
                  ),
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <MediaPicker
        isOpen={mediaPickerOpen}
        onClose={() => {
          setMediaPickerOpen(false);
          setMediaTarget(null);
        }}
        onSelect={handleMediaSelect}
        fileType="image"
      />

      <IconPickerPopup
        isOpen={iconPickerOpen}
        currentIcon={currentActive?.icon}
        currentImage={currentActive?.image}
        onClose={() => {
          setIconPickerOpen(false);
          setIconTarget(null);
        }}
        onSelectIcon={(iconName) => {
          if (iconTarget?.childIndex !== undefined && iconTarget) {
            updateChild(iconTarget.index, iconTarget.childIndex, {
              icon: iconName,
              url: "",
              content: iconName,
            });
          } else if (iconTarget) {
            updateItem(iconTarget.index, {
              icon: iconName,
              image: "",
            });
          }
        }}
        onSelectImage={(imageUrl) => {
          if (iconTarget?.childIndex !== undefined && iconTarget) {
            updateChild(iconTarget.index, iconTarget.childIndex, {
              url: imageUrl,
              icon: "",
            });
          } else if (iconTarget) {
            updateItem(iconTarget.index, {
              image: imageUrl,
              icon: "",
            });
          }
        }}
        onClear={() => {
          if (iconTarget?.childIndex !== undefined && iconTarget) {
            updateChild(iconTarget.index, iconTarget.childIndex, {
              icon: "",
              url: "",
            });
          } else if (iconTarget) {
            updateItem(iconTarget.index, { icon: "", image: "" });
          }
        }}
      />
    </div>
  );
};

export default RepeaterItemsEditor;