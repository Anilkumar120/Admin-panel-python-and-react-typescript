import { useState } from "react";
import type { PageWidget, WidgetSettings, WidgetItem } from "../../types/pageBuilder";
import MediaPicker, { type PickedMedia } from "./MediaPicker";
import UnitInput from "./UnitInput";
import ColorInput from "./ColorInput";

interface SliderSettingsProps {
  widget: PageWidget;
  onChangeSettings: (settings: Partial<WidgetSettings>) => void;
  onChangeItems: (items: WidgetItem[]) => void;
}

const SliderSettings = ({
  widget,
  onChangeSettings,
  onChangeItems,
}: SliderSettingsProps) => {
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [activeSlideTab, setActiveSlideTab] = useState<"background" | "content" | "style">("background");
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaTarget, setMediaTarget] = useState<"single" | "multiple">("single");
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    slides: true,
    title: false,
    description: false,
    button: false,
    navigation: true,
  });

  const settings = widget.settings || {};
  const slides: WidgetItem[] = widget.items || [];
  const activeSlide = slides[activeSlideIndex];

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateSlide = (index: number, changes: Partial<WidgetItem>) => {
    const newSlides = [...slides];
    newSlides[index] = { ...newSlides[index], ...changes };
    onChangeItems(newSlides);
  };

  const addSlide = () => {
    const newSlide: WidgetItem = {
      id: `slide-${Date.now()}`,
      title: `Slide ${slides.length + 1} Heading`,
      content:
        "Lorem ipsum dolor sit amet consectetur adipiscing elit dolor",
      image: "",
      imageAlt: "",
      button1Text: "Click Here",
      button1Link: "#",
      button2Text: "Contact Us",
      button2Link: "#",
      customStyle: false,
    };
    const newSlides = [...slides, newSlide];
    onChangeItems(newSlides);
    setActiveSlideIndex(slides.length);
  };

  const removeSlide = (index: number) => {
    const newSlides = slides.filter((_, i) => i !== index);
    onChangeItems(newSlides);
    if (activeSlideIndex >= newSlides.length) {
      setActiveSlideIndex(Math.max(0, newSlides.length - 1));
    }
  };

  const duplicateSlide = (index: number) => {
    const clone = { ...slides[index], id: `slide-${Date.now()}` };
    const newSlides = [
      ...slides.slice(0, index + 1),
      clone,
      ...slides.slice(index + 1),
    ];
    onChangeItems(newSlides);
  };

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    const arr = Array.isArray(media) ? media : [media];

    if (mediaTarget === "single" && activeSlideIndex >= 0) {
      updateSlide(activeSlideIndex, {
        image: arr[0].url,
        imageAlt: arr[0].alt,
      });
    } else if (mediaTarget === "multiple") {
      const newSlides: WidgetItem[] = arr.map((m, i) => ({
        id: `slide-${Date.now()}-${i}`,
        title: `Slide ${slides.length + i + 1} Heading`,
        content:
          "Lorem ipsum dolor sit amet consectetur adipiscing elit dolor",
        image: m.url,
        imageAlt: m.alt,
        button1Text: "Click Here",
        button1Link: "#",
        button2Text: "Contact Us",
        button2Link: "#",
        customStyle: false,
      }));
      onChangeItems([...slides, ...newSlides]);
    }

    setMediaPickerOpen(false);
  };

  return (
    <div className="slider-settings">
      {/* ====== SLIDES SECTION ====== */}
      <div className="settings-section">
        <div
          className="collapsible-header"
          onClick={() => toggleSection("slides")}
        >
          <span>{openSections.slides ? "▾" : "▸"} Slides</span>
        </div>

        {openSections.slides && (
          <div className="collapsible-content">
            <label className="setting-field">
              <span>Slides Name</span>
              <input
                type="text"
                value={settings.sliderName || "Slides"}
                onChange={(e) =>
                  onChangeSettings({ sliderName: e.target.value })
                }
              />
            </label>

            <label className="setting-field">
              <span>Slides</span>
            </label>

            {/* Slides List */}
            <div className="slides-list">
              {slides.map((slide, i) => (
                <div
                  key={slide.id}
                  className={`slide-list-item ${activeSlideIndex === i ? "active" : ""}`}
                >
                  <button
                    type="button"
                    className="slide-list-header"
                    onClick={() => setActiveSlideIndex(i)}
                  >
                    <span className="slide-number">{i + 1}</span>
                    <span className="slide-title">
                      {slide.title || `Slide ${i + 1} Heading`}
                    </span>
                  </button>

                  <div className="slide-list-actions">
                    <button
                      type="button"
                      title="Duplicate"
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateSlide(i);
                      }}
                    >
                      ⧉
                    </button>
                    <button
                      type="button"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSlide(i);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button type="button" className="add-slide-btn" onClick={addSlide}>
              + Add Item
            </button>

            {/* Active Slide Editor */}
            {activeSlide && (
              <div className="active-slide-editor">
                <div className="slide-tabs">
                  <button
                    type="button"
                    className={activeSlideTab === "background" ? "active" : ""}
                    onClick={() => setActiveSlideTab("background")}
                  >
                    Background
                  </button>
                  <button
                    type="button"
                    className={activeSlideTab === "content" ? "active" : ""}
                    onClick={() => setActiveSlideTab("content")}
                  >
                    Content
                  </button>
                  <button
                    type="button"
                    className={activeSlideTab === "style" ? "active" : ""}
                    onClick={() => setActiveSlideTab("style")}
                  >
                    Style
                  </button>
                </div>

                {/* Background Tab */}
                {activeSlideTab === "background" && (
                  <div className="slide-tab-content">
                    {activeSlide.image ? (
                      <div className="image-preview-box">
                        <img
                          src={activeSlide.image}
                          alt={activeSlide.imageAlt || ""}
                        />
                        <div className="image-preview-actions">
                          <button
                            type="button"
                            className="change-media-btn"
                            onClick={() => {
                              setMediaTarget("single");
                              setMediaPickerOpen(true);
                            }}
                          >
                            🔄 Change
                          </button>
                          <button
                            type="button"
                            className="remove-media-btn"
                            onClick={() =>
                              updateSlide(activeSlideIndex, { image: "" })
                            }
                          >
                            ✕ Remove
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="select-media-btn"
                        onClick={() => {
                          setMediaTarget("single");
                          setMediaPickerOpen(true);
                        }}
                      >
                        🖼 Choose Image
                      </button>
                    )}

                    <label className="setting-field">
                      <span>Image Alt</span>
                      <input
                        type="text"
                        value={activeSlide.imageAlt || ""}
                        placeholder="Image description"
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            imageAlt: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                )}

                {/* Content Tab */}
                {activeSlideTab === "content" && (
                  <div className="slide-tab-content">
                    <label className="setting-field">
                      <span>Title</span>
                      <input
                        type="text"
                        value={activeSlide.title || ""}
                        placeholder="Slide Heading"
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            title: e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="setting-field">
                      <span>Description</span>
                      <textarea
                        value={activeSlide.content || ""}
                        placeholder="Slide description..."
                        rows={4}
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            content: e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="setting-field">
                      <span>Button Text</span>
                      <input
                        type="text"
                        value={activeSlide.button1Text || ""}
                        placeholder="Click Here"
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            button1Text: e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="setting-field">
                      <span>Button Link</span>
                      <input
                        type="text"
                        value={activeSlide.button1Link || ""}
                        placeholder="https://..."
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            button1Link: e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="setting-field">
                      <span>Button 2 Text</span>
                      <input
                        type="text"
                        value={activeSlide.button2Text || ""}
                        placeholder="Contact Us"
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            button2Text: e.target.value,
                          })
                        }
                      />
                    </label>

                    <label className="setting-field">
                      <span>Button 2 Link</span>
                      <input
                        type="text"
                        value={activeSlide.button2Link || ""}
                        placeholder="https://..."
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            button2Link: e.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                )}

                {/* Style Tab */}
                {activeSlideTab === "style" && (
                  <div className="slide-tab-content">
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={activeSlide.customStyle || false}
                        onChange={(e) =>
                          updateSlide(activeSlideIndex, {
                            customStyle: e.target.checked,
                          })
                        }
                      />
                      <span>Custom Style</span>
                    </label>

                    {activeSlide.customStyle && (
                      <>
                        <label className="setting-field">
                          <span>Horizontal Position</span>
                          <div className="button-group">
                            {(["left", "center", "right"] as const).map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                className={
                                  activeSlide.contentPosition === pos
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  updateSlide(activeSlideIndex, {
                                    contentPosition: pos,
                                  })
                                }
                              >
                                {pos === "left"
                                  ? "|←"
                                  : pos === "center"
                                    ? "|↔|"
                                    : "→|"}
                              </button>
                            ))}
                          </div>
                        </label>

                        <label className="setting-field">
                          <span>Vertical Position</span>
                          <div className="button-group">
                            {(["top", "middle", "bottom"] as const).map((pos) => (
                              <button
                                key={pos}
                                type="button"
                                className={
                                  activeSlide.contentPosition === pos
                                    ? "active"
                                    : ""
                                }
                                onClick={() =>
                                  updateSlide(activeSlideIndex, {
                                    contentPosition: pos,
                                  })
                                }
                              >
                                {pos === "top" ? "T" : pos === "middle" ? "↕" : "B"}
                              </button>
                            ))}
                          </div>
                        </label>

                        <label className="setting-field">
                          <span>Text Align</span>
                          <div className="button-group">
                            {(["left", "center", "right"] as const).map(
                              (align) => (
                                <button
                                  key={align}
                                  type="button"
                                  className={
                                    activeSlide.contentTextAlign === align
                                      ? "active"
                                      : ""
                                  }
                                  onClick={() =>
                                    updateSlide(activeSlideIndex, {
                                      contentTextAlign: align,
                                    })
                                  }
                                >
                                  {align === "left"
                                    ? "≡"
                                    : align === "center"
                                      ? "≡"
                                      : "≡"}
                                </button>
                              ),
                            )}
                          </div>
                        </label>

                        <label className="setting-field">
                          <span>Content Color</span>
                          <div className="color-input-group">
                            <ColorInput
                              value={activeSlide.contentColor || "#ffffff"}
                              fallbackColor="#ffffff"
                              label="Choose slide content color"
                              onChange={(color) =>
                                updateSlide(activeSlideIndex, {
                                  contentColor: color,
                                })
                              }
                            />
                            <input
                              type="text"
                              value={activeSlide.contentColor || "#ffffff"}
                              onChange={(e) =>
                                updateSlide(activeSlideIndex, {
                                  contentColor: e.target.value,
                                })
                              }
                            />
                          </div>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ====== SLIDER OPTIONS ====== */}
      <div className="settings-section">
        <div
          className="collapsible-header"
          onClick={() => toggleSection("navigation")}
        >
          <span>{openSections.navigation ? "▾" : "▸"} Slider Options</span>
        </div>
        {openSections.navigation && (
          <div className="collapsible-content">
            {/* Height */}
            <UnitInput
              label="Height"
              value={
                settings.sliderHeight
                  ? `${settings.sliderHeight}${settings.sliderHeightUnit || "px"}`
                  : "500px"
              }
              units={["px", "%", "vh"]}
              onChange={(val) => {
                const match = val.match(/^(-?\d*\.?\d*)\s*(px|%|vh)?$/);
                if (match) {
                  onChangeSettings({
                    sliderHeight: Number(match[1]) || 500,
                    sliderHeightUnit: match[2] || "px",
                  });
                }
              }}
            />

            {/* Navigation */}
            <label className="setting-field">
              <span>Navigation</span>
              <select
                value={settings.navigation || "arrows-dots"}
                onChange={(e) =>
                  onChangeSettings({
                    navigation: e.target.value as any,
                  })
                }
              >
                <option value="none">None</option>
                <option value="arrows">Arrows</option>
                <option value="dots">Dots</option>
                <option value="arrows-dots">Arrows and Dots</option>
              </select>
            </label>

            {/* Autoplay */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.autoplay !== false}
                onChange={(e) =>
                  onChangeSettings({ autoplay: e.target.checked })
                }
              />
              <span>Autoplay</span>
            </label>

            {/* Pause on Hover */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.pauseOnHover !== false}
                onChange={(e) =>
                  onChangeSettings({ pauseOnHover: e.target.checked })
                }
              />
              <span>Pause on Hover</span>
            </label>

            {/* Pause on Interaction */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.pauseOnInteraction !== false}
                onChange={(e) =>
                  onChangeSettings({
                    pauseOnInteraction: e.target.checked,
                  })
                }
              />
              <span>Pause on Interaction</span>
            </label>

            {/* Autoplay Speed */}
            <label className="setting-field">
              <span>Autoplay Speed (ms)</span>
              <input
                type="number"
                value={settings.autoplaySpeed || 5000}
                onChange={(e) =>
                  onChangeSettings({
                    autoplaySpeed: Number(e.target.value),
                  })
                }
              />
            </label>

            {/* Infinite Loop */}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.infiniteLoop !== false}
                onChange={(e) =>
                  onChangeSettings({ infiniteLoop: e.target.checked })
                }
              />
              <span>Infinite Loop</span>
            </label>

            {/* Transition */}
            <label className="setting-field">
              <span>Transition</span>
              <select
                value={settings.transition || "slide"}
                onChange={(e) =>
                  onChangeSettings({
                    transition: e.target.value as any,
                  })
                }
              >
                <option value="slide">Slide</option>
                <option value="fade">Fade</option>
                <option value="zoom">Zoom</option>
              </select>
            </label>

            {/* Transition Speed */}
            <label className="setting-field">
              <span>Transition Speed (ms)</span>
              <input
                type="number"
                value={settings.transitionSpeed || 500}
                onChange={(e) =>
                  onChangeSettings({
                    transitionSpeed: Number(e.target.value),
                  })
                }
              />
            </label>

            {/* Content Animation */}
            <label className="setting-field">
              <span>Content Animation</span>
              <select
                value={settings.contentAnimation || "up"}
                onChange={(e) =>
                  onChangeSettings({
                    contentAnimation: e.target.value as any,
                  })
                }
              >
                <option value="none">None</option>
                <option value="up">Up</option>
                <option value="down">Down</option>
                <option value="left">Left</option>
                <option value="right">Right</option>
                <option value="zoom">Zoom</option>
              </select>
            </label>
          </div>
        )}
      </div>

      <MediaPicker
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        multiple={mediaTarget === "multiple"}
        fileType="image"
      />
    </div>
  );
};

export default SliderSettings;