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
  const [iconListItemIndex, setIconListItemIndex] = useState<number | null>(
    null,
  );
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkInput, setLinkInput] = useState(widget.link?.url || "");

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
    updateStyle({ [key]: { ...current, [side]: value } } as any);
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
      mediaPickerTarget === "video" ||
      mediaPickerTarget === "logo" ||
      mediaPickerTarget === "icon-image" ||
      mediaPickerTarget === "icon-list-item" ||
      mediaPickerTarget === "bio-avatar"
    ) {
      const picked = arr[0];
      if (mediaPickerTarget === "background") {
        updateStyle({ backgroundImage: picked.url });
      } else if (
        mediaPickerTarget === "icon-list-item" &&
        iconListItemIndex !== null
      ) {
        const items = [...(widget.items || [])];
        const current = items[iconListItemIndex];
        if (current) {
          items[iconListItemIndex] = {
            ...current,
            image: picked.url,
            icon: "",
          };
          onChangeItems(items);
        }
      } else if (mediaPickerTarget === "bio-avatar") {
        onChangeUrl(picked.url);
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
                                manage_stock: selected.manage_stock !== false,
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

            {/* ====== CONTAINER ====== */}
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

                    {/* ✅ NEW: Wrap control */}
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
                <h4>Choose Icon</h4>
                <label className="setting-field">
                  <span>Custom icon character</span>
                  <input
                    value={widget.content || "★"}
                    onChange={(event) => onChangeContent(event.target.value)}
                    placeholder="Paste a symbol or emoji"
                  />
                </label>
                <div
                  className="setting-field"
                  role="group"
                  aria-label="Icon choices"
                  style={{ display: "flex", flexWrap: "wrap", gap: 8 }}
                >
                  {[
                    ["Star", "★"],
                    ["Heart", "♥"],
                    ["Check", "✓"],
                    ["Arrow", "→"],
                    ["Phone", "☎"],
                    ["Email", "✉"],
                    ["Settings", "⚙"],
                    ["Lightning", "⚡"],
                    ["Home", "⌂"],
                    ["Plus", "+"],
                    ["Globe", "◎"],
                    ["Music", "♫"],
                  ].map(([label, symbol]) => (
                    <button
                      key={label}
                      type="button"
                      title={label}
                      aria-label={`${label} icon`}
                      aria-pressed={(widget.content || "★") === symbol}
                      onClick={() => onChangeContent(symbol)}
                      style={{
                        width: 42,
                        height: 42,
                        fontSize: 22,
                        border:
                          (widget.content || "★") === symbol
                            ? "2px solid #2563eb"
                            : "1px solid #d1d5db",
                        borderRadius: 6,
                        background: "#fff",
                        cursor: "pointer",
                      }}
                    >
                      {symbol}
                    </button>
                  ))}
                </div>
                <div className="setting-field">
                  <span>Image icon (optional)</span>
                  {widget.url && (
                    <img
                      src={widget.url}
                      alt="Selected icon"
                      className="icon-list-image-preview"
                    />
                  )}
                  <button
                    type="button"
                    className="change-media-btn"
                    onClick={() => openMediaPicker("icon-image")}
                  >
                    Choose or Upload Icon Image
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

            {widget.type === "map" && (
              <label className="setting-field">
                <span>Map Location</span>
                <input
                  value={widget.settings?.mapAddress || widget.content || ""}
                  onChange={(event) =>
                    onChangeSettings({ mapAddress: event.target.value })
                  }
                  placeholder="Enter an address or place"
                />
              </label>
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
              <div className="items-editor">
                <div className="items-header">
                  <span>Sidebar Links</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: `sidebar-${widget.id}-${iconListItemSequence.current++}`,
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
                  <div className="item-editor" key={item.id}>
                    <input
                      aria-label="Sidebar link title"
                      value={item.title || ""}
                      onChange={(event) => {
                        const items = [...(widget.items || [])];
                        items[index] = { ...item, title: event.target.value };
                        onChangeItems(items);
                      }}
                    />
                    <LinkPicker
                      value={item.link?.url || ""}
                      onChange={(url) => {
                        const items = [...(widget.items || [])];
                        items[index] = { ...item, link: { ...item.link, url } };
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
              <>
                <label className="setting-field">
                  <span>Column Headings (two columns)</span>
                  <input
                    value={(
                      widget.settings?.tableHeaders || ["Name", "Role"]
                    ).join(", ")}
                    onChange={(event) =>
                      onChangeSettings({
                        tableHeaders: event.target.value
                          .split(",")
                          .map((heading) => heading.trim())
                          .slice(0, 2),
                      })
                    }
                  />
                </label>
                <div className="items-header">
                  <span>Table Rows</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: `table-row-${widget.id}-${iconListItemSequence.current++}`,
                          title: "Cell 1",
                          content: "Cell 2",
                        },
                      ])
                    }
                  >
                    + Add Row
                  </button>
                </div>
                {(widget.items || []).map((item, index) => (
                  <div key={item.id} className="field-row">
                    <input
                      aria-label={`Row ${index + 1}, first cell`}
                      value={item.title || ""}
                      onChange={(event) => {
                        const items = [...(widget.items || [])];
                        items[index] = { ...item, title: event.target.value };
                        onChangeItems(items);
                      }}
                    />
                    <input
                      aria-label={`Row ${index + 1}, second cell`}
                      value={item.content || ""}
                      onChange={(event) => {
                        const items = [...(widget.items || [])];
                        items[index] = { ...item, content: event.target.value };
                        onChangeItems(items);
                      }}
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onChangeItems(
                          (widget.items || []).filter((_, row) => row !== index),
                        )
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
              </>
            )}

            {/* ====== HEADING ====== */}
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
                              widget.content || "",
                            );
                            if (val !== null) onChangeContent(val);
                          }}
                        >
                          ⛶
                        </button>
                      </div>
                    </label>

                    <label className="elementor-field">
                      <span className="elementor-label">Link</span>
                      <LinkPicker
                        value={widget.link?.url || ""}
                        onChange={(url) =>
                          onChangeSettings({
                            link: { ...widget.link, url },
                          })
                        }
                        onRemove={() =>
                          onChangeSettings({
                            link: { ...widget.link, url: "" },
                          })
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

            {/* ====== TEXT ====== */}
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
                  <LinkPicker
                    value={widget.link?.url || widget.url || ""}
                    onChange={(url) => {
                      onChangeUrl(url);
                      onChangeSettings({
                        link: { ...widget.link, url },
                      });
                    }}
                    onRemove={() => {
                      onChangeUrl("");
                      onChangeSettings({
                        link: { ...widget.link, url: "" },
                      });
                    }}
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
              </>
            )}

            {/* ====== IMAGE / SITE LOGO ====== */}
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
                    🖼 Select {widget.type === "site_logo" ? "Logo" : "Image"}
                  </button>
                )}

                {widget.type === "site_logo" && (
                  <label className="setting-field">
                    <span>Image Resolution</span>
                    <select
                      value={s.objectFit || "contain"}
                      onChange={(e) =>
                        updateStyle({ objectFit: e.target.value as any })
                      }
                    >
                      <option value="contain">Full</option>
                      <option value="cover">Cover</option>
                      <option value="fill">Fill</option>
                      <option value="none">None</option>
                      <option value="scale-down">Scale Down (Custom)</option>
                    </select>
                  </label>
                )}

                <label className="setting-field">
                  <span>Link</span>
                  <LinkPicker
                    value={widget.link?.url || ""}
                    onChange={(url) =>
                      onChangeSettings({
                        link: { ...widget.link, url },
                      })
                    }
                    onRemove={() =>
                      onChangeSettings({
                        link: { ...widget.link, url: "" },
                      })
                    }
                  />
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

            {/* ====== NAV MENU ====== */}
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

                  {availableMenus.length === 0 && !menuLoadError && (
                    <small style={{ color: "#888", fontSize: 11 }}>
                      No menus found. Create one in Appearance → Menus.
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
                    <option value="space-around">Space Around</option>
                    <option value="space-evenly">Space Evenly</option>
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

                {(widget.items || []).length > 0 && (
                  <div
                    style={{
                      marginTop: 16,
                      padding: 12,
                      background: "#f7f9fc",
                      borderRadius: 6,
                      border: "1px solid #e0e6ed",
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        marginBottom: 8,
                        color: "#0c2f55",
                        fontSize: 12,
                      }}
                    >
                      📋 Loaded Menu ({(widget.items || []).length} items)
                    </div>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      {(widget.items || []).map((item, i) => (
                        <div
                          key={item.id || i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 0",
                            color: "#333",
                          }}
                        >
                          <span style={{ color: "#0c2f55" }}>•</span>
                          <span style={{ flex: 1 }}>{item.title}</span>
                          {item.children && item.children.length > 0 && (
                            <span
                              style={{
                                fontSize: 10,
                                background: "#0c2f55",
                                color: "#fff",
                                padding: "1px 6px",
                                borderRadius: 8,
                              }}
                            >
                              {item.children.length} sub
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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

            {/* ====== COPYRIGHT ====== */}
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

            {/* ====== SITE TITLE / TAGLINE ====== */}
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
                      <span>Choose Icon</span>
                      <div className="icon-library-grid" role="group" aria-label={`Choose icon for ${item.title || "list item"}`}>
                        {ICON_LIBRARY.map(({ name, label, Icon }) => (
                          <button
                            type="button"
                            key={name}
                            title={label}
                            aria-label={label}
                            aria-pressed={item.icon === name}
                            className={item.icon === name ? "icon-library-option selected" : "icon-library-option"}
                            onClick={() => {
                              const items = [...(widget.items || [])];
                              items[index] = { ...item, icon: name, image: "" };
                              onChangeItems(items);
                            }}
                          >
                            <Icon aria-hidden="true" />
                          </button>
                        ))}
                      </div>
                      <div className="icon-list-selection-preview">
                        <BuilderIcon name={item.icon} />
                        <span>{item.icon || "Choose an icon"}</span>
                      </div>
                    </div>
                    <div className="setting-field">
                      <span>Icon Image (SVG or PNG)</span>
                      {item.image && (
                        <img
                          src={item.image}
                          alt=""
                          className="icon-list-image-preview"
                        />
                      )}
                      <button
                        type="button"
                        className="change-media-btn"
                        onClick={() => {
                          setIconListItemIndex(index);
                          openMediaPicker("icon-list-item");
                        }}
                      >
                        Choose from Media Library or Upload
                      </button>
                      {item.image && (
                        <button
                          type="button"
                          className="remove-media-btn"
                          onClick={() => {
                            const items = [...(widget.items || [])];
                            items[index] = { ...item, image: "" };
                            onChangeItems(items);
                          }}
                        >
                          Remove Icon Image
                        </button>
                      )}
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
                <label className="setting-field">
                  <span>Icon</span>
                  <input
                    value={widget.content || ""}
                    onChange={(event) => onChangeContent(event.target.value)}
                  />
                </label>
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
                        onChangeItems([
                          { ...item, title: event.target.value },
                        ]);
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
                    <label className="setting-field">
                      <span>Icon / Initials</span>
                      <input
                        value={item.icon || ""}
                        onChange={(event) => {
                          const items = [...(widget.items || [])];
                          items[index] = { ...item, icon: event.target.value };
                          onChangeItems(items);
                        }}
                      />
                    </label>
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
                          (widget.items || []).filter((_, idx) => idx !== i),
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
        {/* ====== STYLE TAB =========================== */}
        {/* ============================================ */}
        {activeTab === "style" && (
          <>
            {/* ============ MENU ITEM STYLE ============ */}
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

            {/* ============ SIZE & DIMENSIONS ============ */}
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
                    <>
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

                      <label className="setting-field">
                        <span>Object Position</span>
                        <input
                          type="text"
                          value={s.objectPosition || "center"}
                          onChange={(e) =>
                            updateStyle({ objectPosition: e.target.value })
                          }
                          placeholder="center, top, bottom"
                        />
                      </label>
                    </>
                  )}

                  <label className="setting-field">
                    <span>Quick Presets</span>
                    <div className="button-group button-group-wrap">
                      <button
                        type="button"
                        onClick={() => updateStyle({ width: "25%" })}
                      >
                        25%
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStyle({ width: "50%" })}
                      >
                        50%
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStyle({ width: "75%" })}
                      >
                        75%
                      </button>
                      <button
                        type="button"
                        onClick={() => updateStyle({ width: "100%" })}
                      >
                        100%
                      </button>
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

            {/* ============ COLORS ============ */}
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
                    {s.backgroundImage && (
                      <div className="field-row">
                        <label className="setting-field">
                          <span>Size</span>
                          <select
                            value={s.backgroundSize || "cover"}
                            onChange={(event) =>
                              updateStyle({
                                backgroundSize: event.target.value,
                              })
                            }
                          >
                            <option value="cover">Cover</option>
                            <option value="contain">Contain</option>
                            <option value="auto">Auto</option>
                          </select>
                        </label>
                        <label className="setting-field">
                          <span>Position</span>
                          <select
                            value={s.backgroundPosition || "center"}
                            onChange={(event) =>
                              updateStyle({
                                backgroundPosition: event.target.value,
                              })
                            }
                          >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                      </div>
                    )}
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

            {/* ============ HOVER EFFECTS ============ */}
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
                        placeholder="transparent"
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

                  <label className="setting-field">
                    <span>Quick Presets</span>
                    <div className="button-group button-group-wrap">
                      <button
                        type="button"
                        onClick={() =>
                          updateStyle({
                            hoverScale: 1.05,
                            hoverBoxShadow: "0 8px 24px rgba(0,0,0,0.15)",
                            transitionDuration: 300,
                          })
                        }
                      >
                        🔍 Zoom
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateStyle({
                            hoverTranslateY: -5,
                            hoverBoxShadow: "0 12px 28px rgba(0,0,0,0.18)",
                            transitionDuration: 300,
                          })
                        }
                      >
                        ⬆ Lift
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateStyle({
                            hoverBackgroundColor: "#0c2f55",
                            hoverColor: "#ffffff",
                            transitionDuration: 250,
                          })
                        }
                      >
                        🎨 Fill
                      </button>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* ============ ANIMATION ============ */}
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

            {/* ============ MOBILE MENU ============ */}
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

            {/* ============ SPACING ============ */}
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
                        updateSpacing(
                          "padding",
                          "right",
                          Number(e.target.value),
                        )
                      }
                    />
                    <input
                      type="number"
                      placeholder="Bottom"
                      value={(rs?.padding || s.padding)?.bottom || 0}
                      onChange={(e) =>
                        updateSpacing(
                          "padding",
                          "bottom",
                          Number(e.target.value),
                        )
                      }
                    />
                    <input
                      type="number"
                      placeholder="Left"
                      value={(rs?.padding || s.padding)?.left || 0}
                      onChange={(e) =>
                        updateSpacing(
                          "padding",
                          "left",
                          Number(e.target.value),
                        )
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
                        updateSpacing(
                          "margin",
                          "bottom",
                          Number(e.target.value),
                        )
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

            {/* ============ BORDER ============ */}
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

              <p
                style={{
                  fontSize: 11,
                  color: "#888",
                  marginTop: 8,
                  fontStyle: "italic",
                }}
              >
                💡 Hidden widgets don't appear on the selected device (public
                page).
              </p>
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
    </div>
  );
};

export default SettingsPanel;