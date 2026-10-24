import { useState, useEffect, useRef } from "react";
import axios from "axios";
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
import BuilderIcon from "../../components/BuilderIcon";
import { ICON_LIBRARY } from "../../components/iconLibrary";
import { getMenusForDropdown } from "../../api/menus";
import { API_URL } from "../../api/config";
import { getProducts, type Product } from "../../api/products";
import IconPickerPopup from "./IconPickerPopup";
import RepeaterItemsEditor from "./RepeaterItemsEditor";
import "./SliderSettings.css";
import "./SettingsPanel.css";

interface SettingsPanelProps {
  widget: PageWidget;
  device: ResponsiveDevice;
  globals: BuilderGlobals;
  onChangeContent: (content: string) => void;
  onChangeUrl: (url: string) => void;
  onChangeStyle: (
    changes: Partial<WidgetStyle>,
    device?: ResponsiveDevice,
  ) => void;
  onChangeSettings: (settings: any) => void;
  onChangeItems: (items: any[]) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

type ContainerLayout = "flexbox" | "grid";
type ContainerDirection = "row" | "column" | "row-reverse" | "column-reverse";
type ContainerJustify =
  | "flex-start"
  | "center"
  | "flex-end"
  | "space-between"
  | "space-around"
  | "space-evenly";
type ContainerAlign = "flex-start" | "center" | "flex-end" | "stretch";
type ContainerWrap = "nowrap" | "wrap" | "wrap-reverse";

// ============ NUMBER INPUT WITH KEYBOARD SUPPORT ============
const NumberInput = ({ value, onChange, min, max, step = 1, ...props }: any) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const currentVal = Number(value) || 0;
      const newValue = e.key === "ArrowUp" ? currentVal + step : currentVal - step;

      let finalValue = newValue;
      if (min !== undefined) finalValue = Math.max(min, finalValue);
      if (max !== undefined) finalValue = Math.min(max, finalValue);

      onChange(finalValue);
    }
  };

  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      onKeyDown={handleKeyDown}
      min={min}
      max={max}
      step={step}
      {...props}
    />
  );
};

// ============ DYNAMIC LINK PICKER ============
interface LinkOption {
  id: string;
  label: string;
  url: string;
  type: string;
  group: string;
}

const LinkPicker = ({
  value,
  onChange,
  onRemove,
}: {
  value: string;
  onChange: (url: string) => void;
  onRemove?: () => void;
}) => {
  const [options, setOptions] = useState<LinkOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");
  const [activeGroup, setActiveGroup] = useState<string>("pages");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("access_token");
        const headers = { Authorization: `Bearer ${token}` };

        const [pagesRes, builderPagesRes, postsRes, productsRes, postTypesRes] =
          await Promise.all([
            axios
              .get(`${API_URL}/api/content/pages`, {
                headers,
                params: { published_only: true },
              })
              .catch(() => ({ data: { pages: [] } })),
            axios
              .get(`${API_URL}/api/page-builder`, {
                headers,
                params: { status: "published" },
              })
              .catch(() => ({ data: [] })),
            axios
              .get(`${API_URL}/api/content/items/posts`, { headers })
              .catch(() => ({ data: { items: [] } })),
            axios
              .get(`${API_URL}/api/products`, { headers })
              .catch(() => ({ data: { products: [] } })),
            axios
              .get(`${API_URL}/api/content/post-types`, { headers })
              .catch(() => ({ data: { post_types: [] } })),
          ]);

        const list: LinkOption[] = [];

        (pagesRes.data.pages || []).forEach((p: any) => {
          list.push({
            id: `page-${p.id}`,
            label: p.title,
            url: `/${p.slug}`,
            type: "page",
            group: "pages",
          });
        });

        (Array.isArray(builderPagesRes.data) ? builderPagesRes.data : [])
          .filter(
            (page: any) =>
              page.status === "published" &&
              (page.template_type === "page" || !page.template_type),
          )
          .forEach((page: any) => {
            list.push({
              id: `builder-page-${page.id}`,
              label: `[Builder] ${page.title}`,
              url: `/${page.slug}`,
              type: "page",
              group: "pages",
            });
          });

        (postsRes.data.items || []).forEach((p: any) => {
          list.push({
            id: `post-${p.id}`,
            label: p.title,
            url: `/${p.slug}`,
            type: "post",
            group: "posts",
          });
        });

        (productsRes.data.products || []).forEach((p: any) => {
          list.push({
            id: `product-${p.id}`,
            label: p.name || p.title,
            url: `/${p.slug}`,
            type: "product",
            group: "products",
          });
        });

        for (const pt of postTypesRes.data.post_types || []) {
          if (pt.is_builtin || !pt.is_active) continue;
          try {
            const itemsRes = await axios.get(
              `${API_URL}/api/content/items/${pt.slug}`,
              { headers },
            );
            (itemsRes.data.items || []).forEach((item: any) => {
              list.push({
                id: `cpt-${pt.slug}-${item.id}`,
                label: `${pt.name}: ${item.title}`,
                url: `/${item.slug}`,
                type: pt.slug,
                group: "custom",
              });
            });
          } catch {
            // skip
          }
        }

        setOptions(list);
      } catch (err) {
        console.error("Link options load error:", err);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const visibleOptions = filtered.filter((o) => o.group === activeGroup);

  return (
    <div className="link-picker-wrapper">
      <div className="link-picker-input-row">
        <input
          type="text"
          value={value}
          placeholder="https://example.com or /page-slug"
          onChange={(e) => onChange(e.target.value)}
        />
        <button
          type="button"
          className="link-picker-btn"
          onClick={() => setShowPicker((v) => !v)}
          title="Pick from site content"
        >
          🔗
        </button>
        {onRemove && value && (
          <button
            type="button"
            className="link-picker-btn danger"
            onClick={onRemove}
            title="Remove link"
          >
            ✕
          </button>
        )}
      </div>

      {showPicker && (
        <div className="link-picker-popup">
          <div className="link-picker-header">
            <input
              type="text"
              placeholder="Search pages, posts, products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowPicker(false)}
              className="link-picker-close"
            >
              ✕
            </button>
          </div>

          <div className="link-picker-tabs">
            {["pages", "posts", "products", "custom"].map((g) => {
              const count = filtered.filter((o) => o.group === g).length;
              if (count === 0 && g !== "pages") return null;
              return (
                <button
                  key={g}
                  type="button"
                  className={activeGroup === g ? "active" : ""}
                  onClick={() => setActiveGroup(g)}
                >
                  {g} ({count})
                </button>
              );
            })}
          </div>

          <div className="link-picker-list">
            {loading ? (
              <div className="link-picker-loading">Loading...</div>
            ) : visibleOptions.length === 0 ? (
              <div className="link-picker-empty">No items found.</div>
            ) : (
              visibleOptions.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className="link-picker-item"
                  onClick={() => {
                    onChange(opt.url);
                    setShowPicker(false);
                    setSearch("");
                  }}
                >
                  <span className="link-picker-item-label">{opt.label}</span>
                  <span className="link-picker-item-url">{opt.url}</span>
                </button>
              ))
            )}
          </div>

          <div className="link-picker-footer">
            <span>Or paste custom URL in the field above</span>
          </div>
        </div>
      )}
    </div>
  );
};

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
    "content",
  );
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerMultiple, setMediaPickerMultiple] = useState(false);
  const [mediaPickerTarget, setMediaPickerTarget] = useState<string>("");
  const iconListItemSequence = useRef(0);
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkInput, setLinkInput] = useState(widget.link?.url || "");

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [iconPickerTarget, setIconPickerTarget] = useState<"main" | "item">(
    "main",
  );
  const [iconPickerItemIndex, setIconPickerItemIndex] = useState<number>(-1);

  const [linkedPadding, setLinkedPadding] = useState(false);
  const [linkedMargin, setLinkedMargin] = useState(false);

  const [availableMenus, setAvailableMenus] = useState<
    { id: string; name: string; items: any[] }[]
  >([]);
  const [menuLoadError, setMenuLoadError] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewProductError, setPreviewProductError] = useState("");

  const [menuItemStyleTab, setMenuItemStyleTab] = useState<
    "normal" | "hover" | "active"
  >("normal");

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
    sizeControl: true,
    hoverEffects: false,
    animation: false,
    mobileMenu: false,
    menuItemStyle: true,
    scrollEffects: false,
    entranceAnimation: false,
  });

  useEffect(() => {
    if (!["nav_menu", "footer_menu", "menu"].includes(widget.type)) return;
    const load = async () => {
      try {
        const menus = await getMenusForDropdown();
        setAvailableMenus(menus);
      } catch (err) {
        console.error("Menu load error:", err);
        setMenuLoadError(true);
      }
    };
    void load();
  }, [widget.type]);

  useEffect(() => {
    const isProductWidget =
      widget.type.startsWith("product_") ||
      widget.type === "add_to_cart" ||
      widget.type === "quantity" ||
      widget.type === "related_products" ||
      widget.type === "recent_products";
    if (!isProductWidget) return;
    let active = true;
    getProducts(1, 100)
      .then((response) => {
        if (active) setPreviewProducts(response.products);
      })
      .catch((error) => {
        console.error("Unable to load product preview options:", error);
        if (active)
          setPreviewProductError("Products could not be loaded for preview.");
      });
    return () => {
      active = false;
    };
  }, [widget.type]);

  const s = widget.style;
  const rs = device !== "desktop" ? s.responsive?.[device] : undefined;
  const currentStyle = { ...s, ...(rs || {}) };

  const updateStyle = (changes: Partial<WidgetStyle>) => {
    onChangeStyle(changes, device !== "desktop" ? device : undefined);
  };

  const updateSpacing = (
    key: "padding" | "margin",
    side: "top" | "right" | "bottom" | "left",
    value: number,
  ) => {
    const current = rs?.[key] ||
      s[key] || { top: 0, right: 0, bottom: 0, left: 0 };

    let newSpacing;
    if (key === "padding" && linkedPadding) {
      newSpacing = { top: value, right: value, bottom: value, left: value };
    } else if (key === "margin" && linkedMargin) {
      newSpacing = { top: value, right: value, bottom: value, left: value };
    } else {
      newSpacing = { ...current, [side]: value };
    }

    updateStyle({ [key]: newSpacing } as any);
  };

  const toggleHideForDevice = (targetDevice: ResponsiveDevice) => {
    const currentResponsive = s.responsive || {};
    const deviceSettings = currentResponsive[targetDevice] || {};
    const newHideValue = !deviceSettings.hide;

    const updatedResponsive = {
      ...currentResponsive,
      [targetDevice]: {
        ...deviceSettings,
        hide: newHideValue,
      },
    };

    onChangeStyle({ responsive: updatedResponsive } as any, "desktop");
  };

  const isHiddenOnDevice = (targetDevice: ResponsiveDevice) => {
    return s.responsive?.[targetDevice]?.hide === true;
  };

  const isHeading = widget.type === "heading";
  const isButton = widget.type === "button";
  const isImageWidget = ["image", "site_logo", "image_box"].includes(widget.type);
  const isLinkBio = widget.type.startsWith("link_bio_");
  const isContainer = ["container", "section", "column", "grid"].includes(
    widget.type,
  );
  const isSlider = ["carousel", "slider", "post_carousel"].includes(
    widget.type,
  );
  const isGallery = widget.type === "gallery";
  const isIconList = widget.type === "icon_list";
  const isMenuWidget = ["nav_menu", "footer_menu", "menu"].includes(
    widget.type,
  );

  const isCartWidget = widget.type === "cart";
  const isCheckoutWidget = widget.type === "checkout";
  const isMyAccountWidget = widget.type === "my_account";
  const isOrderSummaryWidget = widget.type === "order_summary";

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

    if (mediaPickerTarget === "background") {
      const picked = arr[0];
      updateStyle({ backgroundImage: picked.url });
    } else if (
      mediaPickerTarget === "image" ||
      mediaPickerTarget === "logo" ||
      mediaPickerTarget === "video" ||
      mediaPickerTarget === "bio-avatar" ||
      mediaPickerTarget === "icon-image"
    ) {
      const picked = arr[0];
      onChangeUrl(picked.url);
      onChangeContent("");
      onChangeSettings({ customIcon: null });
      onChangeSettings({
        accessibility: {
          ...widget.accessibility,
          altText: picked.alt,
        },
      });
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

  const currentLayout: ContainerLayout =
    ((rs?.display as string) || (s.display as string) || "flex") === "grid"
      ? "grid"
      : "flexbox";
  const currentDirection: ContainerDirection =
    (rs?.flexDirection as ContainerDirection) ||
    (currentStyle.flexDirection as ContainerDirection) ||
    "row";
  const currentJustify: ContainerJustify =
    (currentStyle.justifyContent as ContainerJustify) || "flex-start";
  const currentAlign: ContainerAlign =
    (currentStyle.alignItems as ContainerAlign) || "stretch";
  const currentGap: number = currentStyle.gap ?? 0;
  const currentWrap: ContainerWrap =
    (currentStyle.flexWrap as ContainerWrap) || "nowrap";

  const applyLink = () => {
    onChangeSettings({
      link: { ...widget.link, url: linkInput },
    });
    setShowLinkPopup(false);
  };

  const removeLink = () => {
    onChangeSettings({ link: { ...widget.link, url: "" } });
    setLinkInput("");
    setShowLinkPopup(false);
  };

  const isProductWidget =
    widget.type.startsWith("product_") ||
    widget.type === "add_to_cart" ||
    widget.type === "quantity" ||
    widget.type === "related_products" ||
    widget.type === "recent_products";

  const st = widget.settings || {};
  const setSetting = (key: string, value: any) =>
    onChangeSettings({ [key]: value });

  const handleIconSelect = (iconName: string) => {
    if (iconPickerTarget === "main") {
      onChangeContent(iconName);
      onChangeUrl("");
      onChangeSettings({ customIcon: null });
    } else if (iconPickerTarget === "item" && iconPickerItemIndex >= 0) {
      const items = [...(widget.items || [])];
      items[iconPickerItemIndex] = {
        ...items[iconPickerItemIndex],
        icon: iconName,
        image: "",
      };
      onChangeItems(items);
    }
    setIconPickerOpen(false);
  };

  const handleIconImageSelect = (imageUrl: string) => {
    if (iconPickerTarget === "main") {
      onChangeUrl(imageUrl);
      onChangeContent("");
      onChangeSettings({ customIcon: null });
    } else if (iconPickerTarget === "item" && iconPickerItemIndex >= 0) {
      const items = [...(widget.items || [])];
      items[iconPickerItemIndex] = {
        ...items[iconPickerItemIndex],
        image: imageUrl,
        icon: "",
      };
      onChangeItems(items);
    }
    setIconPickerOpen(false);
  };

  const handleIconClear = () => {
    if (iconPickerTarget === "main") {
      onChangeContent("");
      onChangeUrl("");
      onChangeSettings({ customIcon: null });
    } else if (iconPickerTarget === "item" && iconPickerItemIndex >= 0) {
      const items = [...(widget.items || [])];
      items[iconPickerItemIndex] = {
        ...items[iconPickerItemIndex],
        icon: "",
        image: "",
      };
      onChangeItems(items);
    }
    setIconPickerOpen(false);
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
        {/* ====== CONTENT TAB ========================= */}
        {/* ============================================ */}
        {activeTab === "content" && (
          <div className="settings-section">
            {widget.type === "search" && (
              <>
                <div className="items-editor">
                  <h4>Search Field</h4>
                  <label className="setting-field">
                    <span>Placeholder</span>
                    <input
                      type="text"
                      value={st.searchPlaceholder || "Type to start searching..."}
                      onChange={(e) => setSetting("searchPlaceholder", e.target.value)}
                    />
                  </label>
                  <label className="setting-field">
                    <span>Button Text</span>
                    <input
                      type="text"
                      value={st.searchButtonText || "Search"}
                      onChange={(e) => setSetting("searchButtonText", e.target.value)}
                    />
                  </label>
                </div>
              </>
            )}

            {["accordion", "tabs", "toggle"].includes(widget.type) && (
              <RepeaterItemsEditor
                items={widget.items || []}
                onChange={onChangeItems}
                itemLabel={widget.type === "tabs" ? "Tab" : "Item"}
                addLabel={`Add ${widget.type === "tabs" ? "Tab" : "Item"}`}
                allowNestedChildren={true}
                showTitle={true}
                showContent={widget.type !== "tabs"} 
              />
            )}

            {widget.type === "icon_list" && (
              <RepeaterItemsEditor
                items={widget.items || []}
                onChange={onChangeItems}
                itemLabel="List Item"
                addLabel="Add Item"
                showTitle={true}
                showItemIcon={true}
                showItemLink={true}
              />
            )}

            {widget.type === "icon_box" && (
              <div className="items-editor">
                <h4>Icon Box</h4>
                <div className="setting-field" style={{ marginBottom: 16 }}>
                  <span>Icon</span>
                  <div
                    onClick={() => { setIconPickerTarget("main"); setIconPickerOpen(true); }}
                    style={{ width: "100%", height: 100, border: "1px dashed #ccc", display: "flex", alignItems: "center", justifyContent: "center", background: "repeating-conic-gradient(#f3f4f6 0% 25%, #fff 0% 50%) 50% / 20px 20px", cursor: "pointer", borderRadius: 4 }}
                  >
                    {widget.url ? <img src={widget.url} alt="" style={{ height: 48 }} /> : <span style={{ fontSize: 36, color: "#555" }}>{widget.content || "★"}</span>}
                  </div>
                </div>
                <label className="setting-field">
                  <span>Title</span>
                  <input
                    type="text"
                    value={widget.items?.[0]?.title || ""}
                    onChange={(e) => {
                      const item = widget.items?.[0] || { id: `${widget.id}-feature` };
                      onChangeItems([{ ...item, title: e.target.value }]);
                    }}
                  />
                </label>
                <label className="setting-field">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={widget.items?.[0]?.content || ""}
                    onChange={(e) => {
                      const item = widget.items?.[0] || { id: `${widget.id}-feature` };
                      onChangeItems([{ ...item, content: e.target.value }]);
                    }}
                  />
                </label>
              </div>
            )}

            {widget.type === "divider" && (
              <div className="items-editor">
                <h4>Divider</h4>
                <label className="setting-field">
                  <span>Style</span>
                  <select value={s.borderStyle || "solid"} onChange={(e) => updateStyle({ borderStyle: e.target.value as any })}>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                  </select>
                </label>
                <label className="setting-field">
                  <span>Weight (px)</span>
                  <input type="number" value={s.borderWidth || 1} onChange={(e) => updateStyle({ borderWidth: Number(e.target.value) })} />
                </label>
                <label className="setting-field">
                  <span>Color</span>
                  <input type="color" value={s.borderColor || "#000000"} onChange={(e) => updateStyle({ borderColor: e.target.value })} />
                </label>
              </div>
            )}

            {widget.type === "map" && (
              <div className="items-editor">
                <h4>Google Maps</h4>
                <label className="setting-field">
                  <span>Location</span>
                  <input type="text" value={st.mapAddress || ""} onChange={(e) => setSetting("mapAddress", e.target.value)} />
                </label>
                <label className="setting-field">
                  <span>Zoom (1-20)</span>
                  <input type="number" min={1} max={20} value={st.mapZoom || 10} onChange={(e) => setSetting("mapZoom", Number(e.target.value))} />
                </label>
                <label className="setting-field">
                  <span>Height (px)</span>
                  <input type="number" value={st.mapHeight || 300} onChange={(e) => setSetting("mapHeight", Number(e.target.value))} />
                </label>
              </div>
            )}

            {["heading", "text", "button", "image", "video"].includes(widget.type) && (
              <>
                {["heading", "text"].includes(widget.type) && (
                  <label className="setting-field">
                    <span>Content</span>
                    <textarea rows={4} value={widget.content || ""} onChange={(e) => onChangeContent(e.target.value)} />
                  </label>
                )}
                {widget.type === "button" && (
                  <>
                    <label className="setting-field">
                      <span>Text</span>
                      <input type="text" value={widget.content || ""} onChange={(e) => onChangeContent(e.target.value)} />
                    </label>
                    <label className="setting-field">
                      <span>Link</span>
                      <LinkPicker value={widget.url || ""} onChange={onChangeUrl} />
                    </label>
                  </>
                )}
                {["image", "video"].includes(widget.type) && (
                  <div className="setting-field" style={{ marginBottom: 16 }}>
                    <span>Choose {widget.label}</span>
                    {widget.url && <img src={widget.url} alt="" style={{ width: "100%", borderRadius: 4, marginBottom: 8 }} />}
                    <button type="button" className="change-media-btn" style={{ width: "100%" }} onClick={() => openMediaPicker(widget.type === "video" ? "video" : "image")}>
                      Select / Upload
                    </button>
                  </div>
                )}
              </>
            )}

            {isCartWidget && (
              <>
                <div className="items-editor">
                  <h4>🛒 Cart Layout</h4>
                  <label className="setting-field">
                    <span>Cart Style</span>
                    <select value={st.cartLayout || "default"} onChange={(e) => setSetting("cartLayout", e.target.value)}>
                      <option value="default">Default (Theme)</option>
                      <option value="modern">Modern Card</option>
                      <option value="minimal">Minimal List</option>
                      <option value="sidebar">Sidebar / Drawer</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Columns</span>
                    <select value={st.cartColumns || "2"} onChange={(e) => setSetting("cartColumns", e.target.value)}>
                      <option value="1">1 Column</option>
                      <option value="2">2 Columns (items + totals)</option>
                    </select>
                  </label>
                </div>
                <div className="items-editor">
                  <h4>Cart Heading</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCartHeading !== false} onChange={(e) => setSetting("showCartHeading", e.target.checked)} />
                    <span>Show Cart Heading</span>
                  </label>
                  {st.showCartHeading !== false && (
                    <label className="setting-field">
                      <span>Heading Text</span>
                      <input type="text" value={st.cartHeading || "Your Cart"} onChange={(e) => setSetting("cartHeading", e.target.value)} />
                    </label>
                  )}
                </div>
                <div className="items-editor">
                  <h4>Cart Elements</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCartItems !== false} onChange={(e) => setSetting("showCartItems", e.target.checked)} />
                    <span>Show Cart Items</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCoupon !== false} onChange={(e) => setSetting("showCoupon", e.target.checked)} />
                    <span>Show Coupon Field</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCartTotal !== false} onChange={(e) => setSetting("showCartTotal", e.target.checked)} />
                    <span>Show Cart Total</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showContinueShopping !== false} onChange={(e) => setSetting("showContinueShopping", e.target.checked)} />
                    <span>Show Continue Shopping Button</span>
                  </label>
                  {st.showContinueShopping !== false && (
                    <label className="setting-field">
                      <span>Continue Shopping Text</span>
                      <input type="text" value={st.continueShoppingText || "Continue Shopping"} onChange={(e) => setSetting("continueShoppingText", e.target.value)} />
                    </label>
                  )}
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showUpdateCartButton !== false} onChange={(e) => setSetting("showUpdateCartButton", e.target.checked)} />
                    <span>Show Update Cart Button</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCheckoutButton !== false} onChange={(e) => setSetting("showCheckoutButton", e.target.checked)} />
                    <span>Show Checkout Button</span>
                  </label>
                  {st.showCheckoutButton !== false && (
                    <label className="setting-field">
                      <span>Checkout Button Text</span>
                      <input type="text" value={st.checkoutButtonText || "Proceed to Checkout"} onChange={(e) => setSetting("checkoutButtonText", e.target.value)} />
                    </label>
                  )}
                </div>
                <div className="items-editor">
                  <h4>Empty / Cross-sell</h4>
                  <label className="setting-field">
                    <span>Empty Cart Message</span>
                    <textarea rows={3} value={st.emptyCartMessage || "Your cart is currently empty."} onChange={(e) => setSetting("emptyCartMessage", e.target.value)} />
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCrossSells === true} onChange={(e) => setSetting("showCrossSells", e.target.checked)} />
                    <span>Show Cross-sells</span>
                  </label>
                  {st.showCrossSells === true && (
                    <label className="setting-field">
                      <span>Cross-sells Heading</span>
                      <input type="text" value={st.crossSellsHeading || "You may also like"} onChange={(e) => setSetting("crossSellsHeading", e.target.value)} />
                    </label>
                  )}
                </div>
              </>
            )}

            {isCheckoutWidget && (
              <>
                <div className="items-editor">
                  <h4>💳 Checkout Layout</h4>
                  <label className="setting-field">
                    <span>Layout</span>
                    <select value={st.checkoutLayout || "two-column"} onChange={(e) => setSetting("checkoutLayout", e.target.value)}>
                      <option value="two-column">Two Column (form + order summary)</option>
                      <option value="one-column">One Column</option>
                      <option value="multi-step">Multi-step</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Order Summary Position</span>
                    <select value={st.orderSummaryPosition || "right"} onChange={(e) => setSetting("orderSummaryPosition", e.target.value)}>
                      <option value="right">Right</option>
                      <option value="left">Left</option>
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                    </select>
                  </label>
                </div>
                <div className="items-editor">
                  <h4>Checkout Sections</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCoupon !== false} onChange={(e) => setSetting("showCoupon", e.target.checked)} />
                    <span>Show Coupon Field</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showBillingForm !== false} onChange={(e) => setSetting("showBillingForm", e.target.checked)} />
                    <span>Show Billing Details</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showShippingForm === true} onChange={(e) => setSetting("showShippingForm", e.target.checked)} />
                    <span>Show Shipping Details</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showOrderNotes !== false} onChange={(e) => setSetting("showOrderNotes", e.target.checked)} />
                    <span>Show Order Notes</span>
                  </label>
                  {st.showOrderNotes !== false && (
                    <label className="setting-field">
                      <span>Order Notes Placeholder</span>
                      <input type="text" value={st.orderNotesPlaceholder || "Notes about your order, e.g. special notes for delivery."} onChange={(e) => setSetting("orderNotesPlaceholder", e.target.value)} />
                    </label>
                  )}
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showTerms !== false} onChange={(e) => setSetting("showTerms", e.target.checked)} />
                    <span>Show Terms & Conditions Checkbox</span>
                  </label>
                  {st.showTerms !== false && (
                    <>
                      <label className="setting-field">
                        <span>Terms Text</span>
                        <input type="text" value={st.termsText || "I have read and agree to the website terms and conditions"} onChange={(e) => setSetting("termsText", e.target.value)} />
                      </label>
                      <label className="setting-field">
                        <span>Terms Page Link</span>
                        <LinkPicker value={st.termsLink || ""} onChange={(url) => setSetting("termsLink", url)} onRemove={() => setSetting("termsLink", "")} />
                      </label>
                    </>
                  )}
                </div>
                <div className="items-editor">
                  <h4>Buttons & Navigation</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showReturnToCart !== false} onChange={(e) => setSetting("showReturnToCart", e.target.checked)} />
                    <span>Show "Return to Cart" Link</span>
                  </label>
                  {st.showReturnToCart !== false && (
                    <label className="setting-field">
                      <span>Return to Cart Text</span>
                      <input type="text" value={st.returnToCartText || "← Return to cart"} onChange={(e) => setSetting("returnToCartText", e.target.value)} />
                    </label>
                  )}
                  <label className="setting-field">
                    <span>Place Order Button Text</span>
                    <input type="text" value={st.placeOrderText || "Place Order"} onChange={(e) => setSetting("placeOrderText", e.target.value)} />
                  </label>
                </div>
                <div className="items-editor">
                  <h4>Payment Methods</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showCod !== false} onChange={(e) => setSetting("showCod", e.target.checked)} />
                    <span>Cash on Delivery</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showBankTransfer !== false} onChange={(e) => setSetting("showBankTransfer", e.target.checked)} />
                    <span>Bank Transfer</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showRazorpay === true} onChange={(e) => setSetting("showRazorpay", e.target.checked)} />
                    <span>Razorpay (Online Payment)</span>
                  </label>
                </div>
              </>
            )}

            {isMyAccountWidget && (
              <>
                <div className="items-editor">
                  <h4>👤 My Account Layout</h4>
                  <label className="setting-field">
                    <span>Layout</span>
                    <select value={st.accountLayout || "sidebar"} onChange={(e) => setSetting("accountLayout", e.target.value)}>
                      <option value="sidebar">Sidebar Navigation</option>
                      <option value="tabs-top">Tabs on Top</option>
                      <option value="tabs-left">Vertical Tabs Left</option>
                      <option value="minimal">Minimal (no nav)</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Navigation Position</span>
                    <select value={st.accountNavPosition || "left"} onChange={(e) => setSetting("accountNavPosition", e.target.value)}>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                      <option value="top">Top</option>
                    </select>
                  </label>
                </div>
                <div className="items-editor">
                  <h4>Account Navigation</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showAccountNav !== false} onChange={(e) => setSetting("showAccountNav", e.target.checked)} />
                    <span>Show Account Navigation</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showDashboardLink !== false} onChange={(e) => setSetting("showDashboardLink", e.target.checked)} />
                    <span>Dashboard Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showOrdersLink !== false} onChange={(e) => setSetting("showOrdersLink", e.target.checked)} />
                    <span>Orders Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showDownloadsLink !== false} onChange={(e) => setSetting("showDownloadsLink", e.target.checked)} />
                    <span>Downloads Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showAddressesLink !== false} onChange={(e) => setSetting("showAddressesLink", e.target.checked)} />
                    <span>Addresses Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showAccountDetailsLink !== false} onChange={(e) => setSetting("showAccountDetailsLink", e.target.checked)} />
                    <span>Account Details Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showLogoutLink !== false} onChange={(e) => setSetting("showLogoutLink", e.target.checked)} />
                    <span>Logout Link</span>
                  </label>
                  {st.showLogoutLink !== false && (
                    <label className="setting-field">
                      <span>Logout Text</span>
                      <input type="text" value={st.logoutText || "Log out"} onChange={(e) => setSetting("logoutText", e.target.value)} />
                    </label>
                  )}
                </div>
                <div className="items-editor">
                  <h4>Welcome Message</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showWelcomeMessage !== false} onChange={(e) => setSetting("showWelcomeMessage", e.target.checked)} />
                    <span>Show Welcome Message</span>
                  </label>
                  {st.showWelcomeMessage !== false && (
                    <label className="setting-field">
                      <span>Welcome Text (use {"{name}"} for username)</span>
                      <input type="text" value={st.welcomeText || "Hello {name}, welcome back!"} onChange={(e) => setSetting("welcomeText", e.target.value)} />
                    </label>
                  )}
                </div>
                <div className="items-editor">
                  <h4>Default Tab</h4>
                  <label className="setting-field">
                    <span>Default Active Tab</span>
                    <select value={st.defaultAccountTab || "dashboard"} onChange={(e) => setSetting("defaultAccountTab", e.target.value)}>
                      <option value="dashboard">Dashboard</option>
                      <option value="orders">Orders</option>
                      <option value="downloads">Downloads</option>
                      <option value="addresses">Addresses</option>
                      <option value="account_details">Account Details</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showOrderLookupForm !== false} onChange={(e) => setSetting("showOrderLookupForm", e.target.checked)} />
                    <span>Show Order Lookup Form</span>
                  </label>
                </div>
              </>
            )}

            {isOrderSummaryWidget && (
              <>
                <div className="items-editor">
                  <h4>🧾 Order Summary Layout</h4>
                  <label className="setting-field">
                    <span>Layout Style</span>
                    <select value={st.orderSummaryLayout || "card"} onChange={(e) => setSetting("orderSummaryLayout", e.target.value)}>
                      <option value="card">Card</option>
                      <option value="plain">Plain List</option>
                      <option value="table">Table</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Content Width</span>
                    <select value={st.orderSummaryWidth || "full"} onChange={(e) => setSetting("orderSummaryWidth", e.target.value)}>
                      <option value="full">Full Width</option>
                      <option value="boxed">Boxed (600px)</option>
                    </select>
                  </label>
                </div>
                <div className="items-editor">
                  <h4>Order Details</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showOrderNumber !== false} onChange={(e) => setSetting("showOrderNumber", e.target.checked)} />
                    <span>Show Order Number</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showOrderDate !== false} onChange={(e) => setSetting("showOrderDate", e.target.checked)} />
                    <span>Show Order Date</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showPaymentStatus !== false} onChange={(e) => setSetting("showPaymentStatus", e.target.checked)} />
                    <span>Show Payment Status</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showOrderItems !== false} onChange={(e) => setSetting("showOrderItems", e.target.checked)} />
                    <span>Show Order Items</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showOrderTotals !== false} onChange={(e) => setSetting("showOrderTotals", e.target.checked)} />
                    <span>Show Order Totals (subtotal, shipping, tax)</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showShippingDetails === true} onChange={(e) => setSetting("showShippingDetails", e.target.checked)} />
                    <span>Show Shipping Details</span>
                  </label>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showBillingDetails === true} onChange={(e) => setSetting("showBillingDetails", e.target.checked)} />
                    <span>Show Billing Details</span>
                  </label>
                </div>
                <div className="items-editor">
                  <h4>Thank-you Message</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showThankYouMessage !== false} onChange={(e) => setSetting("showThankYouMessage", e.target.checked)} />
                    <span>Show Thank-you Message</span>
                  </label>
                  {st.showThankYouMessage !== false && (
                    <>
                      <label className="setting-field">
                        <span>Thank-you Heading</span>
                        <input type="text" value={st.thankYouHeading || "Thank you. Your order has been received."} onChange={(e) => setSetting("thankYouHeading", e.target.value)} />
                      </label>
                      <label className="setting-field">
                        <span>Thank-you Description</span>
                        <textarea rows={3} value={st.thankYouDescription || "We'll notify you once your order is on its way."} onChange={(e) => setSetting("thankYouDescription", e.target.value)} />
                      </label>
                    </>
                  )}
                </div>
                <div className="items-editor">
                  <h4>Continue Shopping Button</h4>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={st.showContinueShoppingButton !== false} onChange={(e) => setSetting("showContinueShoppingButton", e.target.checked)} />
                    <span>Show Continue Shopping Button</span>
                  </label>
                  {st.showContinueShoppingButton !== false && (
                    <>
                      <label className="setting-field">
                        <span>Button Text</span>
                        <input type="text" value={st.continueShoppingButtonText || "Continue Shopping"} onChange={(e) => setSetting("continueShoppingButtonText", e.target.value)} />
                      </label>
                      <label className="setting-field">
                        <span>Button Link</span>
                        <LinkPicker value={st.continueShoppingLink || "/shop"} onChange={(url) => setSetting("continueShoppingLink", url)} onRemove={() => setSetting("continueShoppingLink", "")} />
                      </label>
                    </>
                  )}
                </div>
                <div className="items-editor">
                  <h4>Empty Order Fallback</h4>
                  <label className="setting-field">
                    <span>When no order is found</span>
                    <input type="text" value={st.emptyOrderText || "We couldn't find an order matching those details."} onChange={(e) => setSetting("emptyOrderText", e.target.value)} />
                  </label>
                </div>
              </>
            )}

            {isProductWidget &&
              !["products", "product_grid"].includes(widget.type) && (
                <div className="items-editor">
                  <h4>Product Preview</h4>
                  <label className="setting-field">
                    <span>Preview product</span>
                    <select
                      value={widget.settings?.previewProductId || ""}
                      onChange={(event) => {
                        const selected = previewProducts.find(
                          (product) => product.id === event.target.value,
                        );
                        onChangeSettings({
                          previewProductId: selected?.id || "",
                          previewProduct: selected
                            ? {
                                id: selected.id,
                                title: selected.name,
                                price: Number(selected.price || 0),
                                image: selected.image || "",
                                description: selected.description || "",
                                short_description:
                                  selected.short_description || "",
                                quantity: Number(selected.quantity || 0),
                                manage_stock:
                                  selected.manage_stock !== false,
                                category: selected.category || "",
                                tags: selected.tags || [],
                                gallery: selected.gallery || [],
                                sku: (selected as any).sku || "",
                                barcode: (selected as any).barcode || "",
                                brand: selected.brand || "",
                                weight: Number(
                                  (selected as any).weight || 0,
                                ),
                                dimensions:
                                  (selected as any).dimensions || {},
                                attributes:
                                  (selected as any).attributes || [],
                                variations:
                                  (selected as any).variations || [],
                                stock_status:
                                  (selected as any).stock_status ||
                                  (Number(selected.quantity || 0) > 0
                                    ? "in_stock"
                                    : "out_of_stock"),
                                status: selected.status || "published",
                              }
                            : undefined,
                        });
                      }}
                    >
                      <option value="">Choose a product preview</option>
                      {previewProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {previewProductError && (
                    <p role="alert" className="field-error">
                      {previewProductError}
                    </p>
                  )}
                  <small>
                    This selection is only for the builder canvas. Published
                    product templates use the current product automatically.
                  </small>
                </div>
              )}

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
                            "flex-start",
                            "center",
                            "flex-end",
                            "space-between",
                            "space-around",
                            "space-evenly",
                          ] as ContainerJustify[]
                        ).map((j) => (
                          <button
                            key={j}
                            type="button"
                            className={currentJustify === j ? "active" : ""}
                            onClick={() => updateStyle({ justifyContent: j })}
                          >
                            {j === "flex-start"
                              ? "|←"
                              : j === "center"
                                ? "|↔|"
                                : j === "flex-end"
                                  ? "→|"
                                  : j === "space-between"
                                    ? "|=|"
                                    : j === "space-around"
                                      ? "|·|"
                                      : "|···|"}
                          </button>
                        ))}
                      </div>
                    </label>

                    <label className="setting-field">
                      <span>Align Items</span>
                      <div className="button-group">
                        {(
                          [
                            "flex-start",
                            "center",
                            "flex-end",
                            "stretch",
                          ] as ContainerAlign[]
                        ).map((a) => (
                          <button
                            key={a}
                            type="button"
                            className={currentAlign === a ? "active" : ""}
                            onClick={() => updateStyle({ alignItems: a })}
                          >
                            {a === "flex-start"
                              ? "T"
                              : a === "center"
                                ? "↕"
                                : a === "flex-end"
                                  ? "B"
                                  : "⇕"}
                          </button>
                        ))}
                      </div>
                    </label>

                    <label className="setting-field">
                      <span>Wrap</span>
                      <div className="button-group">
                        <button
                          type="button"
                          className={
                            currentWrap === "nowrap" ? "active" : ""
                          }
                          onClick={() => updateStyle({ flexWrap: "nowrap" })}
                          title="No Wrap"
                        >
                          →|
                        </button>
                        <button
                          type="button"
                          className={currentWrap === "wrap" ? "active" : ""}
                          onClick={() => updateStyle({ flexWrap: "wrap" })}
                          title="Wrap"
                        >
                          ↩
                        </button>
                      </div>
                    </label>

                    <p
                      style={{
                        fontSize: 11,
                        color: "#888",
                        fontStyle: "italic",
                        marginTop: -8,
                        marginBottom: 12,
                      }}
                    >
                      Items within the container can stay in a single line (No
                      wrap), or break into multiple lines (Wrap).
                    </p>

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
                        value={(rs as any)?.gridColumns ?? s.gridColumns ?? 2}
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
                      else if (val === "full")
                        updateStyle({ maxWidth: "100%" });
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
                              }),
                            );
                          }}
                        >
                          + {t.charAt(0).toUpperCase() + t.slice(1)}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </>
            )}

            {widget.type === "icon" && (
              <div className="items-editor">
                <h4>Icon</h4>
                <div className="setting-field" style={{ marginBottom: 20 }}>
                  <span>Current Icon</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      background: "#f8f9fc",
                      border: "1px solid #e3e6eb",
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#fff",
                        border: "1px solid #e3e6eb",
                        borderRadius: 6,
                        fontSize: 28,
                      }}
                    >
                      {widget.url ? (
                        <img
                          src={widget.url}
                          alt=""
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: "contain",
                          }}
                        />
                      ) : widget.settings?.customIcon ? (
                        (() => {
                          const found = ICON_LIBRARY.find(
                            (i) => i.name === widget.settings?.customIcon,
                          );
                          if (found) {
                            const IconComp = found.Icon;
                            return <IconComp size={32} />;
                          }
                          return widget.content || "★";
                        })()
                      ) : (
                        widget.content || "★"
                      )}
                    </div>
                    <button
                      type="button"
                      className="change-media-btn"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setIconPickerTarget("main");
                        setIconPickerOpen(true);
                      }}
                    >
                      Choose Icon (Library / Upload / Character)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {["products", "product_grid"].includes(widget.type) && (
              <div className="items-editor">
                <h4>Product Query</h4>
                <label className="setting-field">
                  <span>Products to show</span>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={widget.settings?.postsPerPage || 8}
                    onChange={(event) =>
                      onChangeSettings({
                        postsPerPage: Math.max(
                          1,
                          Math.min(100, Number(event.target.value) || 1),
                        ),
                      })
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Columns</span>
                  <input
                    type="number"
                    min={1}
                    max={6}
                    value={widget.settings?.columns || 4}
                    onChange={(event) =>
                      onChangeSettings({
                        columns: Math.max(
                          1,
                          Math.min(6, Number(event.target.value) || 1),
                        ),
                      })
                    }
                  />
                </label>
              </div>
            )}

            {isLinkBio && (
              <div className="items-editor">
                <h4>Link in Bio Profile</h4>
                <label className="setting-field">
                  <span>Profile Name</span>
                  <input
                    value={widget.settings?.profileName || ""}
                    onChange={(event) =>
                      onChangeSettings({ profileName: event.target.value })
                    }
                    placeholder="Your name"
                  />
                </label>
                <label className="setting-field">
                  <span>Profile Description</span>
                  <textarea
                    rows={3}
                    value={widget.content || ""}
                    onChange={(event) => onChangeContent(event.target.value)}
                    placeholder="A short introduction"
                  />
                </label>
                <div className="setting-field">
                  <span>Profile Image</span>
                  {widget.url && (
                    <img
                      src={widget.url}
                      alt="Profile preview"
                      className="icon-list-image-preview"
                    />
                  )}
                  <button
                    type="button"
                    className="change-media-btn"
                    onClick={() => openMediaPicker("bio-avatar")}
                  >
                    Choose or Upload Profile Image
                  </button>
                  {widget.url && (
                    <button
                      type="button"
                      className="remove-media-btn"
                      onClick={() => onChangeUrl("")}
                    >
                      Remove Image
                    </button>
                  )}
                </div>
                <div className="items-header">
                  <span>Bio Links</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: `bio-link-${widget.id}-${iconListItemSequence.current++}`,
                          title: "New Link",
                          link: { url: "" },
                        },
                      ])
                    }
                  >
                    + Add Link
                  </button>
                </div>
                {(widget.items || []).map((item, index) => (
                  <div key={item.id} className="item-editor">
                    <label className="setting-field">
                      <span>Link Title</span>
                      <input
                        value={item.title || ""}
                        onChange={(event) => {
                          const items = [...(widget.items || [])];
                          items[index] = { ...item, title: event.target.value };
                          onChangeItems(items);
                        }}
                      />
                    </label>
                    <label className="setting-field">
                      <span>Destination</span>
                      <LinkPicker
                        value={item.link?.url || ""}
                        onChange={(url) => {
                          const items = [...(widget.items || [])];
                          items[index] = {
                            ...item,
                            link: { ...item.link, url },
                          };
                          onChangeItems(items);
                        }}
                        onRemove={() => {
                          const items = [...(widget.items || [])];
                          items[index] = {
                            ...item,
                            link: { ...item.link, url: "" },
                          };
                          onChangeItems(items);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="remove-item"
                      onClick={() =>
                        onChangeItems(
                          (widget.items || []).filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove Link
                    </button>
                  </div>
                ))}
              </div>
            )}

            {widget.type === "image_box" && (
              <>
                <label className="setting-field">
                  <span>Image Box Title</span>
                  <input
                    value={widget.settings?.title || ""}
                    onChange={(event) =>
                      onChangeSettings({ title: event.target.value })
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Description</span>
                  <textarea
                    rows={4}
                    value={widget.content || ""}
                    onChange={(event) => onChangeContent(event.target.value)}
                  />
                </label>
              </>
            )}

            {widget.type === "soundcloud" && (
              <label className="setting-field">
                <span>SoundCloud Track URL</span>
                <input
                  type="url"
                  value={widget.url || ""}
                  onChange={(event) => onChangeUrl(event.target.value)}
                  placeholder="https://soundcloud.com/artist/track"
                />
              </label>
            )}

            {widget.type === "form" && (
              <>
                <label className="setting-field">
                  <span>Submit Button Text</span>
                  <input
                    value={widget.settings?.submitText || "Submit"}
                    onChange={(event) =>
                      onChangeSettings({ submitText: event.target.value })
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Confirmation Message</span>
                  <input
                    value={widget.settings?.successMessage || ""}
                    onChange={(event) =>
                      onChangeSettings({ successMessage: event.target.value })
                    }
                    placeholder="Thank you for your message."
                  />
                </label>
                <small>
                  Entries are saved in Content → Form Submissions in the admin
                  dashboard.
                </small>
              </>
            )}

            {widget.type === "shortcode" && (
              <label className="setting-field">
                <span>Shortcode</span>
                <textarea
                  rows={4}
                  value={widget.content || ""}
                  onChange={(event) => onChangeContent(event.target.value)}
                  placeholder="[shortcode]"
                />
                <small>
                  Shortcodes are shown as text unless a matching renderer is
                  installed.
                </small>
              </label>
            )}

            {widget.type === "menu_anchor" && (
              <label className="setting-field">
                <span>Anchor ID</span>
                <input
                  value={widget.content || ""}
                  onChange={(event) => onChangeContent(event.target.value)}
                  placeholder="section-name"
                />
              </label>
            )}

            {(widget.type === "read_more" || widget.type === "sidebar") && (
              <>
                <label className="setting-field">
                  <span>
                    {widget.type === "sidebar" ? "Sidebar Title" : "Link Text"}
                  </span>
                  <input
                    value={widget.content || ""}
                    onChange={(event) => onChangeContent(event.target.value)}
                  />
                </label>
                {widget.type === "read_more" && (
                  <label className="setting-field">
                    <span>Destination</span>
                    <LinkPicker
                      value={widget.link?.url || widget.url || ""}
                      onChange={onChangeUrl}
                      onRemove={() => onChangeUrl("")}
                    />
                  </label>
                )}
              </>
            )}

            {widget.type === "sidebar" && (
              <RepeaterItemsEditor
                items={widget.items || []}
                onChange={onChangeItems}
                itemLabel="Link"
                addLabel="Add Link"
                showItemLink
                showContent={false}
              />
            )}

            {widget.type === "rating" && (
              <label className="setting-field">
                <span>Rating (0–5)</span>
                <input
                  type="number"
                  min={0}
                  max={5}
                  step={0.5}
                  value={widget.settings?.rating ?? 4}
                  onChange={(event) =>
                    onChangeSettings({
                      rating: Math.max(
                        0,
                        Math.min(5, Number(event.target.value)),
                      ),
                    })
                  }
                />
              </label>
            )}

            {widget.type === "text_path" && (
              <label className="setting-field">
                <span>Text on Path</span>
                <input
                  value={widget.content || ""}
                  onChange={(event) => onChangeContent(event.target.value)}
                  placeholder="Text to display along the curve"
                />
              </label>
            )}

            {widget.type === "tablepress" && (
              <div className="items-editor">
                <h4>Table</h4>
                <label className="setting-field">
                  <span>Headers (comma separated)</span>
                  <input
                    value={(widget.settings?.tableHeaders || [
                      "Name",
                      "Role",
                    ]).join(", ")}
                    onChange={(event) =>
                      onChangeSettings({
                        tableHeaders: event.target.value
                          .split(",")
                          .map((h) => h.trim())
                          .slice(0, 2),
                      })
                    }
                  />
                </label>
                <RepeaterItemsEditor
                  items={widget.items || []}
                  onChange={onChangeItems}
                  itemLabel="Row"
                  addLabel="Add Row"
                  showTitle
                  showContent
                />
              </div>
            )}

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
                      <span className="elementor-label">Title</span>
                      <textarea
                        value={widget.content || ""}
                        placeholder="Enter title"
                        rows={3}
                        onChange={(e) => onChangeContent(e.target.value)}
                      />
                    </label>
                    <label className="elementor-field">
                      <span className="elementor-label">Link</span>
                      <LinkPicker
                        value={widget.link?.url || ""}
                        onChange={(url) =>
                          onChangeSettings({ link: { ...widget.link, url } })
                        }
                        onRemove={() =>
                          onChangeSettings({ link: { ...widget.link, url: "" } })
                        }
                      />
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

            {widget.type === "text" && (
              <RichTextEditor
                value={widget.content || ""}
                onChange={onChangeContent}
                placeholder="Enter your text..."
                minHeight={200}
              />
            )}

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
                  <LinkPicker
                    value={widget.link?.url || widget.url || ""}
                    onChange={(url) => {
                      onChangeUrl(url);
                      onChangeSettings({ link: { ...widget.link, url } });
                    }}
                    onRemove={() => {
                      onChangeUrl("");
                      onChangeSettings({ link: { ...widget.link, url: "" } });
                    }}
                  />
                </label>
                <label className="setting-field">
                  <span>Open in</span>
                  <select
                    value={widget.link?.target || "_self"}
                    onChange={(e) =>
                      onChangeSettings({
                        link: { ...widget.link, target: e.target.value },
                      })
                    }
                  >
                    <option value="_self">Same Window</option>
                    <option value="_blank">New Window</option>
                  </select>
                </label>
              </>
            )}

            {isImageWidget && (
              <>
                <label className="setting-field">
                  <span>
                    {widget.type === "site_logo" ? "Site Logo" : "Image"}
                  </span>
                </label>
                {widget.url ? (
                  <div className="image-preview-box">
                    <img src={widget.url} alt={widget.label} />
                    <div className="image-preview-actions">
                      <button
                        type="button"
                        className="change-media-btn"
                        onClick={() =>
                          openMediaPicker(
                            widget.type === "site_logo" ? "logo" : "image",
                            false,
                          )
                        }
                      >
                        🔄 Change{" "}
                        {widget.type === "site_logo" ? "Site Logo" : "Image"}
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
                    onClick={() =>
                      openMediaPicker(
                        widget.type === "site_logo" ? "logo" : "image",
                        false,
                      )
                    }
                  >
                    🖼 Select / Upload{" "}
                    {widget.type === "site_logo" ? "Logo" : "Image"}
                  </button>
                )}
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
                <label className="setting-field">
                  <span>Link</span>
                  <LinkPicker
                    value={widget.link?.url || ""}
                    onChange={(url) =>
                      onChangeSettings({ link: { ...widget.link, url } })
                    }
                    onRemove={() =>
                      onChangeSettings({ link: { ...widget.link, url: "" } })
                    }
                  />
                </label>
              </>
            )}

            {widget.type === "video" && (
              <>
                <div className="setting-field">
                  <span>Video File</span>
                  <button
                    type="button"
                    className={
                      widget.url ? "change-media-btn" : "select-media-btn"
                    }
                    style={{ width: "100%" }}
                    onClick={() => openMediaPicker("video")}
                  >
                    {widget.url
                      ? "🔄 Change Video File"
                      : "🎬 Upload / Choose Video File"}
                  </button>
                </div>
                <label className="setting-field">
                  <span>Or Video URL (YouTube / Vimeo / MP4)</span>
                  <input
                    type="text"
                    value={widget.url || ""}
                    placeholder="https://..."
                    onChange={(e) => onChangeUrl(e.target.value)}
                  />
                </label>
              </>
            )}

            {isMenuWidget && (
              <>
                <div className="setting-field">
                  <span>Select Menu</span>
                  <select
                    value={(widget.settings as any)?.selectedMenuId || ""}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const selectedMenu = availableMenus.find(
                        (m) => m.id === selectedId,
                      );
                      let treeItems: any[] = [];
                      if (selectedMenu && Array.isArray(selectedMenu.items)) {
                        const buildTree = (
                          parentId: string | null,
                          depth: number = 0,
                        ): any[] => {
                          return selectedMenu.items
                            .filter((item: any) => {
                              const itemParent =
                                item.parent_id ?? item.parentId ?? null;
                              const isRoot =
                                itemParent === null ||
                                itemParent === "" ||
                                itemParent === 0 ||
                                itemParent === "0";
                              return isRoot
                                ? parentId === null
                                : String(itemParent) === parentId;
                            })
                            .map((item: any, idx: number) => ({
                              id:
                                String(item.id || "") ||
                                `menu-item-${Date.now()}-${depth}-${idx}`,
                              title: item.title || item.label || "Menu Item",
                              link: {
                                url:
                                  item.url ||
                                  item.link?.url ||
                                  item.link ||
                                  "#",
                              },
                              children: buildTree(
                                String(item.id || item._id || ""),
                                depth + 1,
                              ),
                            }));
                        };
                        treeItems = buildTree(null);
                      }
                      onChangeSettings({
                        selectedMenuId: selectedId,
                        menuName: selectedMenu?.name || "",
                        items: treeItems,
                      });
                    }}
                  >
                    <option value="">— Select a menu —</option>
                    {availableMenus.map((menu) => (
                      <option key={menu.id} value={menu.id}>
                        {menu.name}
                      </option>
                    ))}
                  </select>
                  {menuLoadError && (
                    <small style={{ color: "#b91c1c", fontSize: 11 }}>
                      ⚠ Failed to load menus
                    </small>
                  )}
                </div>
                <label className="setting-field">
                  <span>Horizontal Menu Position</span>
                  <select
                    value={(s.justifyContent as string) || "center"}
                    onChange={(e) =>
                      updateStyle({ justifyContent: e.target.value })
                    }
                  >
                    <option value="flex-start">Left</option>
                    <option value="center">Center</option>
                    <option value="flex-end">Right</option>
                    <option value="space-between">Justified</option>
                  </select>
                </label>
                <label className="setting-field">
                  <span>Responsive Breakpoint</span>
                  <select
                    value={s.mobileBreakpoint || "mobile"}
                    onChange={(e) =>
                      updateStyle({ mobileBreakpoint: e.target.value as any })
                    }
                  >
                    <option value="mobile">Mobile (≤ 768px)</option>
                    <option value="tablet">Tablet (≤ 1024px)</option>
                  </select>
                </label>
              </>
            )}

            {isSlider && (
              <SliderSettings
                widget={widget}
                onChangeSettings={onChangeSettings}
                onChangeItems={onChangeItems}
              />
            )}

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
                            (_, idx) => idx !== i,
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

            {widget.type === "copyright" && (
              <label className="setting-field">
                <span>Copyright Text</span>
                <input
                  type="text"
                  value={widget.content || ""}
                  placeholder={`© ${new Date().getFullYear()} Your Company`}
                  onChange={(e) => onChangeContent(e.target.value)}
                />
              </label>
            )}

            {(widget.type === "site_title" ||
              widget.type === "site_tagline") && (
              <label className="setting-field">
                <span>Text</span>
                <input
                  type="text"
                  value={widget.content || ""}
                  onChange={(e) => onChangeContent(e.target.value)}
                />
              </label>
            )}

            {isIconList && (
              <div className="items-editor">
                <div className="items-header">
                  <span>Icon List Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: `icon-list-${widget.id}-${iconListItemSequence.current++}`,
                          title: `List Item ${(widget.items || []).length + 1}`,
                          icon: "FaCheck",
                          link: { url: "" },
                        },
                      ])
                    }
                  >
                    + Add Item
                  </button>
                </div>
                {(widget.items || []).map((item, index) => (
                  <div
                    key={item.id}
                    className="item-editor icon-list-editor-item"
                  >
                    <label className="setting-field">
                      <span>Text</span>
                      <input
                        type="text"
                        value={item.title || ""}
                        onChange={(event) => {
                          const items = [...(widget.items || [])];
                          items[index] = {
                            ...item,
                            title: event.target.value,
                          };
                          onChangeItems(items);
                        }}
                        placeholder="List item text"
                      />
                    </label>
                    <div className="setting-field">
                      <span>Icon</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
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
                            borderRadius: 4,
                            fontSize: 18,
                          }}
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt=""
                              style={{
                                width: 24,
                                height: 24,
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <BuilderIcon name={item.icon} />
                          )}
                        </div>
                        <button
                          type="button"
                          className="change-media-btn"
                          style={{ flex: 1, fontSize: 11 }}
                          onClick={() => {
                            setIconPickerItemIndex(index);
                            setIconPickerTarget("item");
                            setIconPickerOpen(true);
                          }}
                        >
                          Choose Icon (Library / Upload)
                        </button>
                      </div>
                    </div>
                    <label className="setting-field">
                      <span>Link</span>
                      <LinkPicker
                        value={item.link?.url || ""}
                        onChange={(url) => {
                          const items = [...(widget.items || [])];
                          items[index] = {
                            ...item,
                            link: { ...item.link, url },
                          };
                          onChangeItems(items);
                        }}
                        onRemove={() => {
                          const items = [...(widget.items || [])];
                          items[index] = {
                            ...item,
                            link: { ...item.link, url: "" },
                          };
                          onChangeItems(items);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="remove-item"
                      onClick={() =>
                        onChangeItems(
                          (widget.items || []).filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove Item
                    </button>
                  </div>
                ))}
              </div>
            )}

            {widget.type === "icon_box" && (
              <>
                <div className="setting-field">
                  <span>Icon</span>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: 12,
                      background: "#f8f9fc",
                      border: "1px solid #e3e6eb",
                      borderRadius: 6,
                    }}
                  >
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "#fff",
                        border: "1px solid #e3e6eb",
                        borderRadius: 6,
                        fontSize: 28,
                      }}
                    >
                      {widget.url ? (
                        <img
                          src={widget.url}
                          alt=""
                          style={{
                            width: 40,
                            height: 40,
                            objectFit: "contain",
                          }}
                        />
                      ) : widget.settings?.customIcon ? (
                        (() => {
                          const found = ICON_LIBRARY.find(
                            (i) => i.name === widget.settings?.customIcon,
                          );
                          if (found) {
                            const IconComp = found.Icon;
                            return <IconComp size={32} />;
                          }
                          return widget.content || "★";
                        })()
                      ) : (
                        widget.content || "★"
                      )}
                    </div>
                    <button
                      type="button"
                      className="change-media-btn"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setIconPickerTarget("main");
                        setIconPickerOpen(true);
                      }}
                    >
                      Choose Icon
                    </button>
                  </div>
                </div>
                <label className="setting-field">
                  <span>Title</span>
                  <input
                    value={
                      widget.items?.[0]?.title ||
                      widget.settings?.items?.[0]?.title ||
                      ""
                    }
                    onChange={(event) => {
                      const item =
                        widget.items?.[0] ||
                        widget.settings?.items?.[0] || {
                          id: `${widget.id}-feature`,
                        };
                      onChangeItems([{ ...item, title: event.target.value }]);
                    }}
                  />
                </label>
                <label className="setting-field">
                  <span>Description</span>
                  <textarea
                    rows={3}
                    value={
                      widget.items?.[0]?.content ||
                      widget.settings?.items?.[0]?.content ||
                      ""
                    }
                    onChange={(event) => {
                      const item =
                        widget.items?.[0] ||
                        widget.settings?.items?.[0] || {
                          id: `${widget.id}-feature`,
                        };
                      onChangeItems([{ ...item, content: event.target.value }]);
                    }}
                  />
                </label>
              </>
            )}

            {widget.type === "counter" && (
              <>
                <label className="setting-field">
                  <span>Number</span>
                  <input
                    value={
                      widget.items?.[0]?.content ||
                      widget.settings?.items?.[0]?.content ||
                      widget.content ||
                      ""
                    }
                    onChange={(event) => {
                      const item =
                        widget.items?.[0] ||
                        widget.settings?.items?.[0] || {
                          id: `${widget.id}-counter`,
                        };
                      onChangeItems([{ ...item, content: event.target.value }]);
                    }}
                  />
                </label>
                <label className="setting-field">
                  <span>Label</span>
                  <input
                    value={
                      widget.items?.[0]?.title ||
                      widget.settings?.items?.[0]?.title ||
                      ""
                    }
                    onChange={(event) => {
                      const item =
                        widget.items?.[0] ||
                        widget.settings?.items?.[0] || {
                          id: `${widget.id}-counter`,
                        };
                      onChangeItems([{ ...item, title: event.target.value }]);
                    }}
                  />
                </label>
              </>
            )}

            {(widget.type === "testimonial" ||
              widget.type === "progress_bar") && (
              <div className="items-editor">
                <label className="setting-field">
                  <span>
                    {widget.type === "testimonial"
                      ? "Quote"
                      : "Progress Label"}
                  </span>
                  <input
                    value={
                      widget.type === "testimonial"
                        ? widget.items?.[0]?.content || ""
                        : widget.items?.[0]?.title || ""
                    }
                    onChange={(event) => {
                      const item = widget.items?.[0] || {
                        id: `${widget.id}-item`,
                      };
                      onChangeItems([
                        {
                          ...item,
                          [widget.type === "testimonial"
                            ? "content"
                            : "title"]: event.target.value,
                        },
                      ]);
                    }}
                  />
                </label>
                {widget.type === "testimonial" ? (
                  <label className="setting-field">
                    <span>Author</span>
                    <input
                      value={widget.items?.[0]?.title || ""}
                      onChange={(event) => {
                        const item = widget.items?.[0] || {
                          id: `${widget.id}-item`,
                        };
                        onChangeItems([{ ...item, title: event.target.value }]);
                      }}
                    />
                  </label>
                ) : (
                  <label className="setting-field">
                    <span>Progress Percent</span>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={widget.items?.[0]?.content || "80"}
                      onChange={(event) => {
                        const item = widget.items?.[0] || {
                          id: `${widget.id}-item`,
                        };
                        const percentage = Math.max(
                          0,
                          Math.min(100, Number(event.target.value)),
                        );
                        onChangeItems([
                          { ...item, content: String(percentage) },
                        ]);
                      }}
                    />
                  </label>
                )}
              </div>
            )}

            {widget.type === "social_icons" && (
              <div className="items-editor">
                <div className="items-header">
                  <span>Social Links</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: `social-${widget.id}-${iconListItemSequence.current++}`,
                          title: "Social",
                          icon: "•",
                          link: { url: "" },
                        },
                      ])
                    }
                  >
                    + Add Social Link
                  </button>
                </div>
                {(widget.items || []).map((item, index) => (
                  <div className="item-editor" key={item.id}>
                    <label className="setting-field">
                      <span>Platform Name</span>
                      <input
                        value={item.title || ""}
                        onChange={(event) => {
                          const items = [...(widget.items || [])];
                          items[index] = { ...item, title: event.target.value };
                          onChangeItems(items);
                        }}
                      />
                    </label>
                    <div className="setting-field">
                      <span>Icon</span>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "#f8f9fc",
                            border: "1px solid #e3e6eb",
                            borderRadius: 4,
                            fontSize: 14,
                          }}
                        >
                          {item.image ? (
                            <img
                              src={item.image}
                              alt=""
                              style={{
                                width: 22,
                                height: 22,
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            (item.icon || item.title || "•").slice(0, 2)
                          )}
                        </div>
                        <button
                          type="button"
                          className="change-media-btn"
                          style={{ flex: 1, fontSize: 11 }}
                          onClick={() => {
                            setIconPickerItemIndex(index);
                            setIconPickerTarget("item");
                            setIconPickerOpen(true);
                          }}
                        >
                          Choose Icon
                        </button>
                      </div>
                    </div>
                    <label className="setting-field">
                      <span>Profile URL</span>
                      <LinkPicker
                        value={item.link?.url || ""}
                        onChange={(url) => {
                          const items = [...(widget.items || [])];
                          items[index] = {
                            ...item,
                            link: { ...item.link, url },
                          };
                          onChangeItems(items);
                        }}
                        onRemove={() => {
                          const items = [...(widget.items || [])];
                          items[index] = {
                            ...item,
                            link: { ...item.link, url: "" },
                          };
                          onChangeItems(items);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="remove-item"
                      onClick={() =>
                        onChangeItems(
                          (widget.items || []).filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {["accordion", "tabs", "toggle"].includes(widget.type) && (
              <RepeaterItemsEditor
                items={widget.items || []}
                onChange={onChangeItems}
                itemLabel={
                  widget.type === "accordion"
                    ? "Accordion Item"
                    : widget.type === "tabs"
                      ? "Tab"
                      : "Toggle Item"
                }
                addLabel={
                  widget.type === "accordion"
                    ? "Add Accordion Item"
                    : widget.type === "tabs"
                      ? "Add Tab"
                      : "Add Toggle Item"
                }
                allowNestedChildren
                showTitle
                showContent={false}
              />
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* ====== STYLE TAB ========================== */}
        {/* ============================================ */}
        {activeTab === "style" && (
          <>
            {isMenuWidget && (
              <div className="settings-section">
                <div
                  className="collapsible-header"
                  onClick={() => toggleSection("menuItemStyle")}
                >
                  <span>
                    {openSections.menuItemStyle ? "▾" : "▸"} 🎨 Menu Item Style
                  </span>
                </div>
                {openSections.menuItemStyle && (
                  <div className="collapsible-content">
                    <div className="button-group" style={{ marginBottom: 12 }}>
                      <button
                        type="button"
                        className={
                          menuItemStyleTab === "normal" ? "active" : ""
                        }
                        onClick={() => setMenuItemStyleTab("normal")}
                      >
                        Normal
                      </button>
                      <button
                        type="button"
                        className={menuItemStyleTab === "hover" ? "active" : ""}
                        onClick={() => setMenuItemStyleTab("hover")}
                      >
                        Hover
                      </button>
                      <button
                        type="button"
                        className={
                          menuItemStyleTab === "active" ? "active" : ""
                        }
                        onClick={() => setMenuItemStyleTab("active")}
                      >
                        Active
                      </button>
                    </div>
                    {menuItemStyleTab === "normal" && (
                      <>
                        <label className="setting-field">
                          <span>Item Text Color</span>
                          <div className="color-input-group">
                            <input
                              type="color"
                              value={s.color || "#1a1a2e"}
                              onChange={(e) =>
                                updateStyle({ color: e.target.value })
                              }
                            />
                            <input
                              type="text"
                              value={s.color || "#1a1a2e"}
                              onChange={(e) =>
                                updateStyle({ color: e.target.value })
                              }
                            />
                          </div>
                        </label>
                        <div className="field-row">
                          <label className="setting-field">
                            <span>Font Size (px)</span>
                            <input
                              type="number"
                              value={s.fontSize || 14}
                              onChange={(e) =>
                                updateStyle({
                                  fontSize: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="setting-field">
                            <span>Font Weight</span>
                            <select
                              value={s.fontWeight || 500}
                              onChange={(e) =>
                                updateStyle({
                                  fontWeight: Number(e.target.value),
                                })
                              }
                            >
                              <option value={300}>Light</option>
                              <option value={400}>Normal</option>
                              <option value={500}>Medium</option>
                              <option value={600}>Semi Bold</option>
                              <option value={700}>Bold</option>
                            </select>
                          </label>
                        </div>
                      </>
                    )}
                    {menuItemStyleTab === "hover" && (
                      <>
                        <label className="setting-field">
                          <span>Hover Text Color</span>
                          <div className="color-input-group">
                            <input
                              type="color"
                              value={s.hoverColor || "#f0b429"}
                              onChange={(e) =>
                                updateStyle({ hoverColor: e.target.value })
                              }
                            />
                            <input
                              type="text"
                              value={s.hoverColor || "#f0b429"}
                              onChange={(e) =>
                                updateStyle({ hoverColor: e.target.value })
                              }
                            />
                          </div>
                        </label>
                        <label className="setting-field">
                          <span>Hover Underline</span>
                          <select
                            value={
                              s.hoverTextDecoration === "underline"
                                ? "underline"
                                : "none"
                            }
                            onChange={(e) =>
                              updateStyle({
                                hoverTextDecoration: e.target.value as any,
                              })
                            }
                          >
                            <option value="none">None</option>
                            <option value="underline">Underline</option>
                            <option value="overline">Overline</option>
                            <option value="line-through">Line Through</option>
                          </select>
                        </label>
                      </>
                    )}
                    {menuItemStyleTab === "active" && (
                      <label className="setting-field">
                        <span>Active Item Color</span>
                        <div className="color-input-group">
                          <input
                            type="color"
                            value={(s as any).activeColor || "#0c2f55"}
                            onChange={(e) =>
                              updateStyle({
                                activeColor: e.target.value,
                              } as any)
                            }
                          />
                          <input
                            type="text"
                            value={(s as any).activeColor || "#0c2f55"}
                            onChange={(e) =>
                              updateStyle({
                                activeColor: e.target.value,
                              } as any)
                            }
                          />
                        </div>
                      </label>
                    )}
                  </div>
                )}
              </div>
            )}

            {!isContainer && !isImageWidget && (
              <div className="settings-section">
                <div
                  className="collapsible-header"
                  onClick={() => toggleSection("typography")}
                >
                  <span>{openSections.typography ? "▾" : "▸"} Typography</span>
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
                        {(["left", "center", "right", "justify"] as const).map(
                          (a) => (
                            <button
                              key={a}
                              type="button"
                              className={
                                currentStyle.textAlign === a ? "active" : ""
                              }
                              onClick={() => updateStyle({ textAlign: a })}
                            >
                              {a === "left"
                                ? "⬅"
                                : a === "center"
                                  ? "↔"
                                  : a === "right"
                                    ? "➡"
                                    : "☰"}
                            </button>
                          ),
                        )}
                      </div>
                    </label>
                  </div>
                )}
              </div>
            )}

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("sizeControl")}
              >
                <span>
                  {openSections.sizeControl ? "▾" : "▸"} 📐 Size & Dimensions
                </span>
              </div>
              {openSections.sizeControl && (
                <div className="collapsible-content">
                  <div className="field-row">
                    <UnitInput
                      label="Width"
                      value={s.width || "auto"}
                      onChange={(val) => updateStyle({ width: val })}
                    />
                    <UnitInput
                      label="Height"
                      value={s.height || "auto"}
                      onChange={(val) => updateStyle({ height: val })}
                    />
                  </div>
                  <div className="field-row">
                    <UnitInput
                      label="Min Width"
                      value={s.minWidth || ""}
                      onChange={(val) => updateStyle({ minWidth: val })}
                    />
                    <UnitInput
                      label="Max Width"
                      value={s.maxWidth || ""}
                      onChange={(val) => updateStyle({ maxWidth: val })}
                    />
                  </div>
                  <div className="field-row">
                    <UnitInput
                      label="Min Height"
                      value={s.minHeight || ""}
                      onChange={(val) => updateStyle({ minHeight: val })}
                    />
                    <UnitInput
                      label="Max Height"
                      value={s.maxHeight || ""}
                      onChange={(val) => updateStyle({ maxHeight: val })}
                    />
                  </div>
                  {(isImageWidget || widget.type === "site_logo") && (
                    <label className="setting-field">
                      <span>Object Fit</span>
                      <select
                        value={s.objectFit || "contain"}
                        onChange={(e) =>
                          updateStyle({ objectFit: e.target.value as any })
                        }
                      >
                        <option value="cover">Cover</option>
                        <option value="contain">Contain</option>
                        <option value="fill">Fill</option>
                        <option value="none">None</option>
                        <option value="scale-down">Scale Down</option>
                      </select>
                    </label>
                  )}
                  <label className="setting-field">
                    <span>Quick Presets</span>
                    <div className="button-group button-group-wrap">
                      {["25%", "50%", "75%", "100%"].map((w) => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => updateStyle({ width: w })}
                        >
                          {w}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          updateStyle({ width: "auto", height: "auto" })
                        }
                      >
                        Auto
                      </button>
                    </div>
                  </label>
                </div>
              )}
            </div>

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
                  {isIconList && (
                    <div className="field-row">
                      <label className="setting-field">
                        <span>Icon Size (px)</span>
                        <input
                          type="number"
                          min="8"
                          max="96"
                          value={s.iconSize ?? 20}
                          onChange={(event) =>
                            updateStyle({
                              iconSize: Number(event.target.value),
                            })
                          }
                        />
                      </label>
                      <label className="setting-field">
                        <span>Icon Color</span>
                        <input
                          type="color"
                          value={s.iconColor || "#0c2f55"}
                          onChange={(event) =>
                            updateStyle({ iconColor: event.target.value })
                          }
                        />
                      </label>
                    </div>
                  )}
                  <div className="setting-field">
                    <span>Background Image</span>
                    {s.backgroundImage && (
                      <div className="background-image-preview">
                        <img src={s.backgroundImage} alt="Background preview" />
                        <button
                          type="button"
                          className="remove-media-btn"
                          onClick={() => updateStyle({ backgroundImage: "" })}
                        >
                          Remove
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      className="change-media-btn"
                      onClick={() => openMediaPicker("background")}
                    >
                      Choose from Media Library or Upload
                    </button>
                  </div>
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

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("hoverEffects")}
              >
                <span>
                  {openSections.hoverEffects ? "▾" : "▸"} ✨ Hover Effects
                </span>
              </div>
              {openSections.hoverEffects && (
                <div className="collapsible-content">
                  <label className="setting-field">
                    <span>Hover Background Color</span>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={s.hoverBackgroundColor || "#0c2f55"}
                        onChange={(e) =>
                          updateStyle({ hoverBackgroundColor: e.target.value })
                        }
                      />
                      <input
                        type="text"
                        value={s.hoverBackgroundColor || ""}
                        onChange={(e) =>
                          updateStyle({ hoverBackgroundColor: e.target.value })
                        }
                      />
                    </div>
                  </label>
                  <label className="setting-field">
                    <span>Hover Text Color</span>
                    <div className="color-input-group">
                      <input
                        type="color"
                        value={s.hoverColor || "#0c2f55"}
                        onChange={(e) =>
                          updateStyle({ hoverColor: e.target.value })
                        }
                      />
                      <input
                        type="text"
                        value={s.hoverColor || ""}
                        onChange={(e) =>
                          updateStyle({ hoverColor: e.target.value })
                        }
                      />
                    </div>
                  </label>
                  <label className="setting-field">
                    <span>Hover Box Shadow</span>
                    <input
                      type="text"
                      value={s.hoverBoxShadow || ""}
                      onChange={(e) =>
                        updateStyle({ hoverBoxShadow: e.target.value })
                      }
                      placeholder="0 8px 24px rgba(0,0,0,0.15)"
                    />
                  </label>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Scale</span>
                      <input
                        type="number"
                        step="0.05"
                        min="0.5"
                        max="2"
                        value={s.hoverScale || 1}
                        onChange={(e) =>
                          updateStyle({ hoverScale: Number(e.target.value) })
                        }
                      />
                    </label>
                    <label className="setting-field">
                      <span>Opacity</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        max="1"
                        value={s.hoverOpacity ?? 1}
                        onChange={(e) =>
                          updateStyle({ hoverOpacity: Number(e.target.value) })
                        }
                      />
                    </label>
                  </div>
                  <label className="setting-field">
                    <span>Move Y on Hover (px)</span>
                    <input
                      type="number"
                      value={s.hoverTranslateY || 0}
                      onChange={(e) =>
                        updateStyle({
                          hoverTranslateY: Number(e.target.value),
                        })
                      }
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("animation")}
              >
                <span>{openSections.animation ? "▾" : "▸"} 🎬 Animation</span>
              </div>
              {openSections.animation && (
                <div className="collapsible-content">
                  <label className="setting-field">
                    <span>Animation Type</span>
                    <select
                      value={s.animation || "none"}
                      onChange={(e) =>
                        updateStyle({ animation: e.target.value as any })
                      }
                    >
                      <option value="none">None</option>
                      <option value="fadeIn">Fade In</option>
                      <option value="slideUp">Slide Up</option>
                      <option value="slideDown">Slide Down</option>
                      <option value="slideLeft">Slide Left</option>
                      <option value="slideRight">Slide Right</option>
                      <option value="zoomIn">Zoom In</option>
                      <option value="bounce">Bounce</option>
                      <option value="pulse">Pulse</option>
                    </select>
                  </label>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Duration (ms)</span>
                      <input
                        type="number"
                        value={s.animationDuration || 600}
                        onChange={(e) =>
                          updateStyle({
                            animationDuration: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                    <label className="setting-field">
                      <span>Delay (ms)</span>
                      <input
                        type="number"
                        value={s.animationDelay || 0}
                        onChange={(e) =>
                          updateStyle({
                            animationDelay: Number(e.target.value),
                          })
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("scrollEffects")}
              >
                <span>
                  {openSections.scrollEffects ? "▾" : "▸"} 📜 Scroll Effects
                </span>
              </div>
              {openSections.scrollEffects && (
                <div className="collapsible-content">
                  <label className="setting-field">
                    <span>Sticky Position</span>
                    <select
                      value={(s as any).sticky || "none"}
                      onChange={(e) =>
                        updateStyle({ sticky: e.target.value } as any)
                      }
                    >
                      <option value="none">None</option>
                      <option value="top">Sticky Top</option>
                      <option value="bottom">Sticky Bottom</option>
                    </select>
                  </label>
                  {(s as any).sticky && (s as any).sticky !== "none" && (
                    <label className="setting-field">
                      <span>Sticky Offset (px)</span>
                      <input
                        type="number"
                        value={(s as any).stickyOffset || 0}
                        onChange={(e) =>
                          updateStyle({
                            stickyOffset: Number(e.target.value),
                          } as any)
                        }
                      />
                    </label>
                  )}
                  <label className="setting-field">
                    <span>Scroll Animation</span>
                    <select
                      value={(s as any).scrollAnimation || "none"}
                      onChange={(e) =>
                        updateStyle({
                          scrollAnimation: e.target.value,
                        } as any)
                      }
                    >
                      <option value="none">None</option>
                      <option value="fadeInUp">Fade In Up</option>
                      <option value="fadeInDown">Fade In Down</option>
                      <option value="zoomIn">Zoom In</option>
                      <option value="slideInLeft">Slide In Left</option>
                      <option value="slideInRight">Slide In Right</option>
                    </select>
                  </label>
                </div>
              )}
            </div>

            <div className="settings-section">
              <div
                className="collapsible-header"
                onClick={() => toggleSection("entranceAnimation")}
              >
                <span>
                  {openSections.entranceAnimation ? "▾" : "▸"} 🎬 Entrance
                  Animation
                </span>
              </div>
              {openSections.entranceAnimation && (
                <div className="collapsible-content">
                  <label className="setting-field">
                    <span>Animation</span>
                    <select
                      value={(s as any).entranceAnimation || "none"}
                      onChange={(e) =>
                        updateStyle({
                          entranceAnimation: e.target.value,
                        } as any)
                      }
                    >
                      <option value="none">None</option>
                      <option value="fadeIn">Fade In</option>
                      <option value="fadeInUp">Fade In Up</option>
                      <option value="fadeInDown">Fade In Down</option>
                      <option value="fadeInLeft">Fade In Left</option>
                      <option value="fadeInRight">Fade In Right</option>
                      <option value="zoomIn">Zoom In</option>
                      <option value="slideInUp">Slide In Up</option>
                      <option value="slideInDown">Slide In Down</option>
                      <option value="bounce">Bounce</option>
                      <option value="pulse">Pulse</option>
                    </select>
                  </label>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Duration (ms)</span>
                      <input
                        type="number"
                        value={(s as any).entranceAnimationDuration || 600}
                        onChange={(e) =>
                          updateStyle({
                            entranceAnimationDuration: Number(e.target.value),
                          } as any)
                        }
                      />
                    </label>
                    <label className="setting-field">
                      <span>Delay (ms)</span>
                      <input
                        type="number"
                        value={(s as any).entranceAnimationDelay || 0}
                        onChange={(e) =>
                          updateStyle({
                            entranceAnimationDelay: Number(e.target.value),
                          } as any)
                        }
                      />
                    </label>
                  </div>
                </div>
              )}
            </div>

            {isMenuWidget && (
              <div className="settings-section">
                <div
                  className="collapsible-header"
                  onClick={() => toggleSection("mobileMenu")}
                >
                  <span>
                    {openSections.mobileMenu ? "▾" : "▸"} 📱 Mobile Menu
                  </span>
                </div>
                {openSections.mobileMenu && (
                  <div className="collapsible-content">
                    <label className="setting-field">
                      <span>Hamburger Icon Color</span>
                      <div className="color-input-group">
                        <input
                          type="color"
                          value={s.hamburgerColor || "#0c2f55"}
                          onChange={(e) =>
                            updateStyle({ hamburgerColor: e.target.value })
                          }
                        />
                        <input
                          type="text"
                          value={s.hamburgerColor || "#0c2f55"}
                          onChange={(e) =>
                            updateStyle({ hamburgerColor: e.target.value })
                          }
                        />
                      </div>
                    </label>
                    <label className="setting-field">
                      <span>Mobile Menu Background</span>
                      <div className="color-input-group">
                        <input
                          type="color"
                          value={s.mobileMenuBgColor || "#ffffff"}
                          onChange={(e) =>
                            updateStyle({
                              mobileMenuBgColor: e.target.value,
                            })
                          }
                        />
                        <input
                          type="text"
                          value={s.mobileMenuBgColor || "#ffffff"}
                          onChange={(e) =>
                            updateStyle({
                              mobileMenuBgColor: e.target.value,
                            })
                          }
                        />
                      </div>
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
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 8,
                    }}
                  >
                    <label className="setting-field" style={{ margin: 0 }}>
                      Padding (px)
                    </label>
                    <button
                      type="button"
                      onClick={() => setLinkedPadding(!linkedPadding)}
                      style={{
                        background: linkedPadding ? "#e0e7ff" : "transparent",
                        border: "1px solid #ccc",
                        padding: "2px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      🔗 {linkedPadding ? "Linked" : "Unlinked"}
                    </button>
                  </div>
                  <div className="spacing-grid">
                    <NumberInput
                      placeholder="Top"
                      value={(rs?.padding || s.padding)?.top || 0}
                      onChange={(val: number) =>
                        updateSpacing("padding", "top", val)
                      }
                    />
                    <NumberInput
                      placeholder="Right"
                      value={(rs?.padding || s.padding)?.right || 0}
                      onChange={(val: number) =>
                        updateSpacing("padding", "right", val)
                      }
                    />
                    <NumberInput
                      placeholder="Bottom"
                      value={(rs?.padding || s.padding)?.bottom || 0}
                      onChange={(val: number) =>
                        updateSpacing("padding", "bottom", val)
                      }
                    />
                    <NumberInput
                      placeholder="Left"
                      value={(rs?.padding || s.padding)?.left || 0}
                      onChange={(val: number) =>
                        updateSpacing("padding", "left", val)
                      }
                    />
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginTop: 16,
                      marginBottom: 8,
                    }}
                  >
                    <label className="setting-field" style={{ margin: 0 }}>
                      Margin (px)
                    </label>
                    <button
                      type="button"
                      onClick={() => setLinkedMargin(!linkedMargin)}
                      style={{
                        background: linkedMargin ? "#e0e7ff" : "transparent",
                        border: "1px solid #ccc",
                        padding: "2px 8px",
                        borderRadius: 4,
                        cursor: "pointer",
                        fontSize: 12,
                      }}
                    >
                      🔗 {linkedMargin ? "Linked" : "Unlinked"}
                    </button>
                  </div>
                  <div className="spacing-grid">
                    <NumberInput
                      placeholder="Top"
                      value={(rs?.margin || s.margin)?.top || 0}
                      onChange={(val: number) =>
                        updateSpacing("margin", "top", val)
                      }
                    />
                    <NumberInput
                      placeholder="Right"
                      value={(rs?.margin || s.margin)?.right || 0}
                      onChange={(val: number) =>
                        updateSpacing("margin", "right", val)
                      }
                    />
                    <NumberInput
                      placeholder="Bottom"
                      value={(rs?.margin || s.margin)?.bottom || 0}
                      onChange={(val: number) =>
                        updateSpacing("margin", "bottom", val)
                      }
                    />
                    <NumberInput
                      placeholder="Left"
                      value={(rs?.margin || s.margin)?.left || 0}
                      onChange={(val: number) =>
                        updateSpacing("margin", "left", val)
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
        {/* ====== ADVANCED TAB ====================== */}
        {/* ============================================ */}
        {activeTab === "advanced" && (
          <>
            <div className="settings-section">
              <h4 className="section-title">Responsive Visibility</h4>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isHiddenOnDevice("desktop")}
                  onChange={() => toggleHideForDevice("desktop")}
                />
                <span>Hide on Desktop</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isHiddenOnDevice("tablet")}
                  onChange={() => toggleHideForDevice("tablet")}
                />
                <span>Hide on Tablet</span>
              </label>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={isHiddenOnDevice("mobile")}
                  onChange={() => toggleHideForDevice("mobile")}
                />
                <span>Hide on Mobile</span>
              </label>
            </div>
            <div className="settings-section">
              <h4 className="section-title">Custom CSS</h4>
              <label className="setting-field">
                <span>Custom CSS (this element only)</span>
                <textarea
                  rows={8}
                  className="code-textarea"
                  value={(s as any).customCSS || ""}
                  placeholder={`selector {\n  color: red;\n}\n\nselector:hover {\n  transform: scale(1.05);\n}`}
                  onChange={(e) =>
                    updateStyle({ customCSS: e.target.value } as any)
                  }
                />
              </label>
              <small style={{ color: "#888", fontSize: 11 }}>
                Use <code>selector</code> to target this widget only.
              </small>
            </div>
            <div className="settings-section">
              <h4 className="section-title">CSS Classes</h4>
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
            </div>
          </>
        )}
      </div>

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

      <IconPickerPopup
        isOpen={iconPickerOpen}
        currentIcon={
          iconPickerTarget === "item" && iconPickerItemIndex >= 0
            ? (widget.items || [])[iconPickerItemIndex]?.icon
            : widget.content
        }
        currentImage={
          iconPickerTarget === "item" && iconPickerItemIndex >= 0
            ? (widget.items || [])[iconPickerItemIndex]?.image
            : widget.url
        }
        onClose={() => setIconPickerOpen(false)}
        onSelectIcon={handleIconSelect}
        onSelectImage={handleIconImageSelect}
        onClear={handleIconClear}
      />
    </div>
  );
};

export default SettingsPanel;