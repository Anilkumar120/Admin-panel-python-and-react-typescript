import { useState, useEffect, useRef } from "react";
import axios from "axios";
import type {
  BoxSpacing,
  PageWidget,
  ResponsiveDevice,
  WidgetStyle,
  BuilderGlobals,
  WidgetItem,
} from "../../types/pageBuilder";
import MediaPicker, { type PickedMedia } from "./MediaPicker";
import UnitInput, { toUnitInputValue } from "./UnitInput";
import SliderSettings from "./SliderSettings";
import RichTextEditor from "./RichTextEditor";
import BuilderIcon from "../../components/BuilderIcon";
import { ICON_LIBRARY } from "../../components/iconLibrary";
import IconPickerPopup from "./IconPickerPopup";
import { getMenusForDropdown } from "../../api/menus";
import { API_URL } from "../../api/config";
import { getProducts, type Product } from "../../api/products";
import { getProductCategories } from "../../api/products";
import {
  getCategories,
  getPostTypes,
  getTags,
  type Category,
  type PostType,
  type Tag,
} from "../../api/content";
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

const createEditorItemId = () =>
  `item-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const cloneWidgetWithFreshIds = (source: PageWidget): PageWidget => {
  const clone = JSON.parse(JSON.stringify(source)) as PageWidget;
  const refreshIds = (widget: PageWidget) => {
    widget.id = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    widget.children?.forEach(refreshIds);
    widget.items?.forEach((item) => {
      item.id = createEditorItemId();
      item.children?.forEach(refreshIds);
    });
  };
  refreshIds(clone);
  return clone;
};

// ============ NUMBER INPUT WITH KEYBOARD SUPPORT ============
interface NumberInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  ...props
}: NumberInputProps) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const currentVal = Number(value) || 0;
      const newValue =
        e.key === "ArrowUp" ? currentVal + step : currentVal - step;

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
      aria-label={props.placeholder}
      {...props}
    />
  );
};

type SpacingSide = "top" | "right" | "bottom" | "left";
type SpacingProperty = "padding" | "margin";

const SpacingEditor = ({
  label,
  spacing,
  linked,
  allowNegative,
  onToggleLinked,
  onChangeSide,
  onChangeUnit,
}: {
  label: string;
  spacing?: BoxSpacing;
  linked: boolean;
  allowNegative?: boolean;
  onToggleLinked: () => void;
  onChangeSide: (side: SpacingSide, value: number) => void;
  onChangeUnit: (unit: string) => void;
}) => (
  <div className="spacing-editor">
    <div className="spacing-editor-header">
      <span>{label}</span>
      <div className="spacing-editor-actions">
        <select
          aria-label={`${label} unit`}
          value={spacing?.unit || "px"}
          onChange={(event) => onChangeUnit(event.target.value)}
        >
          {["px", "em", "rem", "%", "vw", "vh"].map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
        </select>
        <button
          type="button"
          aria-pressed={linked}
          onClick={onToggleLinked}
          title={linked ? "Unlink values" : "Link values"}
        >
          {linked ? "🔗" : "⛓"}
        </button>
      </div>
    </div>
    <div className="spacing-grid">
      {(["top", "right", "bottom", "left"] as const).map((side) => (
        <label key={side} className="spacing-side">
          <NumberInput
            placeholder={side}
            value={spacing?.[side] ?? 0}
            min={allowNegative ? undefined : 0}
            onChange={(value) => onChangeSide(side, value)}
          />
          <span>{side[0].toUpperCase() + side.slice(1)}</span>
        </label>
      ))}
    </div>
  </div>
);

type EdgeValueKey =
  | "borderTopWidth"
  | "borderRightWidth"
  | "borderBottomWidth"
  | "borderLeftWidth"
  | "borderTopLeftRadius"
  | "borderTopRightRadius"
  | "borderBottomRightRadius"
  | "borderBottomLeftRadius";

const borderWidthEdges: { key: EdgeValueKey; label: string }[] = [
  { key: "borderTopWidth", label: "Top" },
  { key: "borderRightWidth", label: "Right" },
  { key: "borderBottomWidth", label: "Bottom" },
  { key: "borderLeftWidth", label: "Left" },
];

const borderRadiusEdges: { key: EdgeValueKey; label: string }[] = [
  { key: "borderTopLeftRadius", label: "Top left" },
  { key: "borderTopRightRadius", label: "Top right" },
  { key: "borderBottomRightRadius", label: "Bottom right" },
  { key: "borderBottomLeftRadius", label: "Bottom left" },
];

const EdgeValuesEditor = ({
  label,
  values,
  linked,
  onToggleLinked,
  onChange,
}: {
  label: string;
  values: readonly { key: EdgeValueKey; label: string; value: number }[];
  linked: boolean;
  onToggleLinked: () => void;
  onChange: (key: EdgeValueKey, value: number) => void;
}) => (
  <div className="spacing-editor">
    <div className="spacing-editor-header">
      <span>{label}</span>
      <div className="spacing-editor-actions">
        <button
          type="button"
          aria-pressed={linked}
          onClick={onToggleLinked}
          title={linked ? "Unlink values" : "Link values"}
        >
          {linked ? "🔗" : "⛓"}
        </button>
      </div>
    </div>
    <div className="spacing-grid">
      {values.map((entry) => (
        <label key={entry.key} className="spacing-side">
          <NumberInput
            placeholder={entry.label}
            value={entry.value}
            min={0}
            onChange={(value) => onChange(entry.key, value)}
          />
          <span>{entry.label}</span>
        </label>
      ))}
    </div>
  </div>
);

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
  const [expandedIconListItems, setExpandedIconListItems] = useState<
    Record<string, boolean>
  >({});
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [iconBoxPickerOpen, setIconBoxPickerOpen] = useState(false);
  const [iconListPickerOpen, setIconListPickerOpen] = useState(false);
  const [iconWidgetPickerOpen, setIconWidgetPickerOpen] = useState(false);
  const [formFieldDragIndex, setFormFieldDragIndex] = useState<number | null>(null);
  const [iconListItemIndex, setIconListItemIndex] = useState<number | null>(
    null,
  );
  const [showLinkPopup, setShowLinkPopup] = useState(false);
  const [linkInput, setLinkInput] = useState(widget.link?.url || "");

  // ✅ FIX: Chain Link States for Spacing
  const [linkedPadding, setLinkedPadding] = useState(false);
  const [linkedMargin, setLinkedMargin] = useState(false);
  const [linkedBorderWidths, setLinkedBorderWidths] = useState(false);
  const [linkedBorderRadii, setLinkedBorderRadii] = useState(false);
  const [containerStyleTab, setContainerStyleTab] = useState<
    "normal" | "hover"
  >("normal");
  const [imageStyleTab, setImageStyleTab] = useState<"normal" | "hover">(
    "normal",
  );
  const [overlayStyleTab, setOverlayStyleTab] = useState<"normal" | "hover">(
    "normal",
  );
  const [borderStyleTab, setBorderStyleTab] = useState<"normal" | "hover">(
    "normal",
  );
  const [transformStyleTab, setTransformStyleTab] = useState<
    "normal" | "hover"
  >("normal");

  const [availableMenus, setAvailableMenus] = useState<
    { id: string; name: string; items: any[] }[]
  >([]);
  const [menuLoadError, setMenuLoadError] = useState(false);
  const [previewProducts, setPreviewProducts] = useState<Product[]>([]);
  const [previewProductError, setPreviewProductError] = useState("");
  const [loopPostTypes, setLoopPostTypes] = useState<PostType[]>([]);
  const [loopCategories, setLoopCategories] = useState<Category[]>([]);
  const [loopTags, setLoopTags] = useState<Tag[]>([]);
  const [loopProductCategories, setLoopProductCategories] = useState<string[]>([]);
  const [loopProductTags, setLoopProductTags] = useState<string[]>([]);
  const [loopQueryError, setLoopQueryError] = useState("");

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
    if (!["loop_grid", "loop_carousel", "post_grid", "post_carousel"].includes(widget.type)) return;
    let active = true;
    const loadLoopOptions = async () => {
      try {
        const [types, productCategories, productResponse] = await Promise.all([
          getPostTypes(),
          getProductCategories(),
          getProducts(1, 100),
        ]);
        if (!active) return;
        setLoopPostTypes(types.filter((type) => type.is_active));
        setLoopProductCategories(productCategories);
        setLoopProductTags(
          [...new Set(productResponse.products.flatMap((product) => product.tags || []))]
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b)),
        );
      } catch (error) {
        console.error("Unable to load loop query options:", error);
        if (active) setLoopQueryError("Some query filters could not be loaded.");
      }
    };
    void loadLoopOptions();
    return () => {
      active = false;
    };
  }, [widget.type]);

  useEffect(() => {
    if (!["loop_grid", "loop_carousel", "post_grid", "post_carousel"].includes(widget.type)) return;
    const source = widget.settings?.loopSource || "posts";
    if (source === "products") return;
    const postTypeSlug = source === "custom" ? widget.settings?.loopPostType || "" : "posts";
    if (!postTypeSlug) {
      setLoopCategories([]);
      setLoopTags([]);
      return;
    }
    let active = true;
    Promise.all([getCategories(postTypeSlug), getTags(postTypeSlug)])
      .then(([categories, tags]) => {
        if (!active) return;
        setLoopCategories(categories);
        setLoopTags(tags);
      })
      .catch((error) => {
        console.error("Unable to load loop taxonomies:", error);
        if (active) setLoopQueryError("Categories or tags could not be loaded.");
      });
    return () => {
      active = false;
    };
  }, [widget.type, widget.settings?.loopSource, widget.settings?.loopPostType]);

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

  const updateEdgeValue = (
    key: EdgeValueKey,
    value: number,
    keys: readonly EdgeValueKey[],
    linked: boolean,
  ) => {
    const changes: Partial<WidgetStyle> = {};
    for (const edgeKey of linked ? keys : [key]) {
      changes[edgeKey] = value;
    }
    updateStyle(changes);
  };

  const updateBackgroundGradient = (changes: Partial<WidgetStyle>) => {
    const next = { ...currentStyle, ...changes };
    const color1 = next.backgroundGradientColor1 || "#0c2f55";
    const color2 = next.backgroundGradientColor2 || "#ffffff";
    const location1 = Math.max(0, Math.min(100, Number(next.backgroundGradientLocation1 ?? 0)));
    const location2 = Math.max(0, Math.min(100, Number(next.backgroundGradientLocation2 ?? 100)));
    const backgroundGradient = next.backgroundGradientType === "radial"
      ? `radial-gradient(circle, ${color1} ${location1}%, ${color2} ${location2}%)`
      : `linear-gradient(${Number(next.backgroundGradientAngle ?? 135)}deg, ${color1} ${location1}%, ${color2} ${location2}%)`;
    updateStyle({ ...changes, backgroundGradient });
  };

  // ✅ FIX: Spacing logic with Chain Link support
  const updateSpacing = (
    key: "padding" | "margin",
    side: "top" | "right" | "bottom" | "left",
    value: number,
  ) => {
    const current = { ...(rs?.[key] || s[key] || {}) };

    let newSpacing;
    if (key === "padding" && linkedPadding) {
      newSpacing = { ...current, top: value, right: value, bottom: value, left: value };
    } else if (key === "margin" && linkedMargin) {
      newSpacing = { ...current, top: value, right: value, bottom: value, left: value };
    } else {
      newSpacing = { ...current, [side]: value };
    }

    updateStyle({ [key]: newSpacing } as any);
  };

  const updateSpacingUnit = (key: SpacingProperty, unit: string) => {
    const current = { ...(rs?.[key] || s[key] || {}) };
    updateStyle({ [key]: { ...current, unit } } as any);
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
  const isImageWidget = ["image", "site_logo", "image_box"].includes(
    widget.type,
  );
  const isLinkBio = widget.type.startsWith("link_bio_");
  const isContainer = [
    "container",
    "section",
    "column",
    "grid",
    "box",
    "col",
    "flex",
    "flexbox",
    "fbox",
  ].includes(widget.type);
  const isSlider = ["carousel", "slider", "post_carousel"].includes(widget.type);
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
            iconType: "image",
          };
          onChangeItems(items);
        }
      } else if (mediaPickerTarget === "bio-avatar") {
        onChangeUrl(picked.url);
      } else {
        // Update metadata first and URL last. The parent callbacks previously
        // used the same render snapshot, so the later settings update could
        // overwrite the newly selected image URL.
        if (mediaPickerTarget === "icon-image") {
          onChangeContent("");
          onChangeSettings({ customIcon: null });
        }
        onChangeSettings({
          accessibility: {
            ...widget.accessibility,
            altText: picked.alt,
          },
        });
        onChangeUrl(picked.url);
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

  // Helper to read current settings with fallback
  const st = widget.settings || {};
  const setSetting = (key: string, value: any) =>
    onChangeSettings({ [key]: value });
  const formFields: WidgetItem[] = widget.settings?.formFields || [
    { id: "name", title: "Name", fieldType: "text", required: true, placeholder: "Your name" },
    { id: "email", title: "Email", fieldType: "email", required: true, placeholder: "you@example.com" },
    { id: "message", title: "Message", fieldType: "textarea", required: true, placeholder: "Your message" },
  ];
  const updateFormField = (index: number, updates: Record<string, unknown>) => {
    const fields = [...formFields];
    fields[index] = { ...fields[index], ...updates };
    setSetting("formFields", fields);
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
          ✏ Content
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
            {["audio", "blockquote", "breadcrumbs", "call_to_action", "flip_box", "price_list", "price_table", "share_buttons", "slides"].includes(widget.type) && (
              <div className="items-editor">
                <h4>{widget.label} Content</h4>
                {widget.type === "audio" && (
                  <>
                    <label className="setting-field">
                      <span>Audio URL</span>
                      <input
                        type="url"
                        value={widget.url || ""}
                        onChange={(event) => onChangeUrl(event.target.value)}
                        placeholder="https://example.com/audio.mp3"
                      />
                    </label>
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={widget.settings?.controls !== false}
                        onChange={(event) =>
                          onChangeSettings({ controls: event.target.checked })
                        }
                      />
                      <span>Show audio controls</span>
                    </label>
                  </>
                )}
                {widget.type === "blockquote" && (
                  <>
                    <label className="setting-field">
                      <span>Quote</span>
                      <textarea
                        rows={4}
                        value={widget.content || ""}
                        onChange={(event) => onChangeContent(event.target.value)}
                      />
                    </label>
                    <label className="setting-field">
                      <span>Attribution</span>
                      <input
                        value={widget.settings?.author || ""}
                        onChange={(event) =>
                          onChangeSettings({ author: event.target.value })
                        }
                      />
                    </label>
                  </>
                )}
                {widget.type === "call_to_action" && (
                  <>
                    <label className="setting-field">
                      <span>Title</span>
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
                        rows={3}
                        value={widget.settings?.description || ""}
                        onChange={(event) =>
                          onChangeSettings({ description: event.target.value })
                        }
                      />
                    </label>
                    <label className="setting-field">
                      <span>Button text</span>
                      <input
                        value={widget.content || ""}
                        onChange={(event) => onChangeContent(event.target.value)}
                      />
                    </label>
                    <label className="setting-field">
                      <span>Button URL</span>
                      <input
                        type="url"
                        value={widget.url || ""}
                        onChange={(event) => onChangeUrl(event.target.value)}
                      />
                    </label>
                  </>
                )}
                {widget.type === "price_table" && (
                  <>
                    <label className="setting-field">
                      <span>Plan name</span>
                      <input
                        value={widget.settings?.title || ""}
                        onChange={(event) =>
                          onChangeSettings({ title: event.target.value })
                        }
                      />
                    </label>
                    <label className="setting-field">
                      <span>Price and billing period</span>
                      <input
                        value={widget.settings?.author || ""}
                        onChange={(event) =>
                          onChangeSettings({ author: event.target.value })
                        }
                        placeholder="$19 / month"
                      />
                    </label>
                    <label className="setting-field">
                      <span>Description</span>
                      <textarea
                        rows={2}
                        value={widget.content || ""}
                        onChange={(event) => onChangeContent(event.target.value)}
                      />
                    </label>
                  </>
                )}
                {["breadcrumbs", "flip_box", "price_list", "price_table", "share_buttons", "slides"].includes(widget.type) && (
                  <div className="builder-items-list">
                    {(widget.items || []).map((item, index) => (
                      <div className="builder-item-card item-editor" key={item.id}>
                        <label className="setting-field">
                          <span>{widget.type === "breadcrumbs" ? "Label" : widget.type === "share_buttons" ? "Network" : widget.type === "slides" ? "Slide title" : widget.type === "flip_box" ? `${index === 0 ? "Front" : "Back"} title` : "Item title"}</span>
                          <input
                            value={item.title || ""}
                            onChange={(event) => {
                              const items = [...(widget.items || [])];
                              items[index] = { ...item, title: event.target.value };
                              onChangeItems(items);
                            }}
                          />
                        </label>
                        {widget.type !== "breadcrumbs" && widget.type !== "share_buttons" && (
                          <label className="setting-field">
                            <span>{widget.type === "price_list" ? "Description" : "Content"}</span>
                            <textarea
                              rows={2}
                              value={item.content || ""}
                              onChange={(event) => {
                                const items = [...(widget.items || [])];
                                items[index] = { ...item, content: event.target.value };
                                onChangeItems(items);
                              }}
                            />
                          </label>
                        )}
                        {widget.type === "price_list" && (
                          <label className="setting-field">
                            <span>Price</span>
                            <input
                              value={item.label || ""}
                              onChange={(event) => {
                                const items = [...(widget.items || [])];
                                items[index] = { ...item, label: event.target.value };
                                onChangeItems(items);
                              }}
                            />
                          </label>
                        )}
                        {widget.type === "slides" && (
                          <label className="setting-field">
                            <span>Image URL</span>
                            <input
                              type="url"
                              value={item.image || ""}
                              onChange={(event) => {
                                const items = [...(widget.items || [])];
                                items[index] = { ...item, image: event.target.value };
                                onChangeItems(items);
                              }}
                            />
                          </label>
                        )}
                        {widget.type === "share_buttons" && (
                          <label className="setting-field">
                            <span>Link URL</span>
                            <input
                              type="url"
                              value={item.link?.url || ""}
                              onChange={(event) => {
                                const items = [...(widget.items || [])];
                                items[index] = {
                                  ...item,
                                  link: { ...item.link, url: event.target.value },
                                };
                                onChangeItems(items);
                              }}
                            />
                          </label>
                        )}
                        <button
                          type="button"
                          className="remove-media-btn"
                          onClick={() =>
                            onChangeItems((widget.items || []).filter((_, itemIndex) => itemIndex !== index))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {widget.type !== "breadcrumbs" && widget.type !== "share_buttons" && widget.type !== "flip_box" && (
                      <button
                        type="button"
                        className="change-media-btn"
                        onClick={() =>
                          onChangeItems([
                            ...(widget.items || []),
                            { id: createEditorItemId(), title: widget.type === "slides" ? "New Slide" : "New Item", content: "", label: "" },
                          ])
                        }
                      >
                        Add Item
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
            {/* ============================================================ */}
            {/* 🛒 CART WIDGET */}
            {/* ============================================================ */}
            {isCartWidget && (
              <>
                <div className="items-editor">
                  <h4>🛒 Cart Layout</h4>
                  <label className="setting-field">
                    <span>Cart Style</span>
                    <select
                      value={st.cartLayout || "default"}
                      onChange={(e) => setSetting("cartLayout", e.target.value)}
                    >
                      <option value="default">Default (Theme)</option>
                      <option value="modern">Modern Card</option>
                      <option value="minimal">Minimal List</option>
                      <option value="sidebar">Sidebar / Drawer</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Columns</span>
                    <select
                      value={st.cartColumns || "2"}
                      onChange={(e) =>
                        setSetting("cartColumns", e.target.value)
                      }
                    >
                      <option value="1">1 Column</option>
                      <option value="2">2 Columns (items + totals)</option>
                    </select>
                  </label>
                </div>

                <div className="items-editor">
                  <h4>Cart Heading</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showCartHeading !== false}
                      onChange={(e) =>
                        setSetting("showCartHeading", e.target.checked)
                      }
                    />
                    <span>Show Cart Heading</span>
                  </label>
                  {st.showCartHeading !== false && (
                    <label className="setting-field">
                      <span>Heading Text</span>
                      <input
                        type="text"
                        value={st.cartHeading || "Your Cart"}
                        onChange={(e) =>
                          setSetting("cartHeading", e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>

                <div className="items-editor">
                  <h4>Cart Elements</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showCartItems !== false}
                      onChange={(e) =>
                        setSetting("showCartItems", e.target.checked)
                      }
                    />
                    <span>Show Cart Items</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showCoupon !== false}
                      onChange={(e) =>
                        setSetting("showCoupon", e.target.checked)
                      }
                    />
                    <span>Show Coupon Field</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showCartTotal !== false}
                      onChange={(e) =>
                        setSetting("showCartTotal", e.target.checked)
                      }
                    />
                    <span>Show Cart Total</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showContinueShopping !== false}
                      onChange={(e) =>
                        setSetting("showContinueShopping", e.target.checked)
                      }
                    />
                    <span>Show Continue Shopping Button</span>
                  </label>
                  {st.showContinueShopping !== false && (
                    <label className="setting-field">
                      <span>Continue Shopping Text</span>
                      <input
                        type="text"
                        value={st.continueShoppingText || "Continue Shopping"}
                        onChange={(e) =>
                          setSetting("continueShoppingText", e.target.value)
                        }
                      />
                    </label>
                  )}
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showUpdateCartButton !== false}
                      onChange={(e) =>
                        setSetting("showUpdateCartButton", e.target.checked)
                      }
                    />
                    <span>Show Update Cart Button</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showCheckoutButton !== false}
                      onChange={(e) =>
                        setSetting("showCheckoutButton", e.target.checked)
                      }
                    />
                    <span>Show Checkout Button</span>
                  </label>
                  {st.showCheckoutButton !== false && (
                    <label className="setting-field">
                      <span>Checkout Button Text</span>
                      <input
                        type="text"
                        value={st.checkoutButtonText || "Proceed to Checkout"}
                        onChange={(e) =>
                          setSetting("checkoutButtonText", e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>

                <div className="items-editor">
                  <h4>Empty / Cross-sell</h4>
                  <label className="setting-field">
                    <span>Empty Cart Message</span>
                    <textarea
                      rows={3}
                      value={
                        st.emptyCartMessage || "Your cart is currently empty."
                      }
                      onChange={(e) =>
                        setSetting("emptyCartMessage", e.target.value)
                      }
                    />
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showCrossSells === true}
                      onChange={(e) =>
                        setSetting("showCrossSells", e.target.checked)
                      }
                    />
                    <span>Show Cross-sells</span>
                  </label>
                  {st.showCrossSells === true && (
                    <label className="setting-field">
                      <span>Cross-sells Heading</span>
                      <input
                        type="text"
                        value={st.crossSellsHeading || "You may also like"}
                        onChange={(e) =>
                          setSetting("crossSellsHeading", e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>
              </>
            )}

            {/* ============================================================ */}
            {/* 💳 CHECKOUT WIDGET */}
            {/* ============================================================ */}
            {isCheckoutWidget && (
              <>
                <div className="items-editor">
                  <h4>💳 Checkout Layout</h4>
                  <label className="setting-field">
                    <span>Layout</span>
                    <select
                      value={st.checkoutLayout || "two-column"}
                      onChange={(e) =>
                        setSetting("checkoutLayout", e.target.value)
                      }
                    >
                      <option value="two-column">
                        Two Column (form + order summary)
                      </option>
                      <option value="one-column">One Column</option>
                      <option value="multi-step">Multi-step</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Order Summary Position</span>
                    <select
                      value={st.orderSummaryPosition || "right"}
                      onChange={(e) =>
                        setSetting("orderSummaryPosition", e.target.value)
                      }
                    >
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
                    <input
                      type="checkbox"
                      checked={st.showCoupon !== false}
                      onChange={(e) =>
                        setSetting("showCoupon", e.target.checked)
                      }
                    />
                    <span>Show Coupon Field</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showBillingForm !== false}
                      onChange={(e) =>
                        setSetting("showBillingForm", e.target.checked)
                      }
                    />
                    <span>Show Billing Details</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showShippingForm === true}
                      onChange={(e) =>
                        setSetting("showShippingForm", e.target.checked)
                      }
                    />
                    <span>Show Shipping Details</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showOrderNotes !== false}
                      onChange={(e) =>
                        setSetting("showOrderNotes", e.target.checked)
                      }
                    />
                    <span>Show Order Notes</span>
                  </label>
                  {st.showOrderNotes !== false && (
                    <label className="setting-field">
                      <span>Order Notes Placeholder</span>
                      <input
                        type="text"
                        value={
                          st.orderNotesPlaceholder ||
                          "Notes about your order, e.g. special notes for delivery."
                        }
                        onChange={(e) =>
                          setSetting("orderNotesPlaceholder", e.target.value)
                        }
                      />
                    </label>
                  )}
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showTerms !== false}
                      onChange={(e) =>
                        setSetting("showTerms", e.target.checked)
                      }
                    />
                    <span>Show Terms & Conditions Checkbox</span>
                  </label>
                  {st.showTerms !== false && (
                    <>
                      <label className="setting-field">
                        <span>Terms Text</span>
                        <input
                          type="text"
                          value={
                            st.termsText ||
                            "I have read and agree to the website terms and conditions"
                          }
                          onChange={(e) =>
                            setSetting("termsText", e.target.value)
                          }
                        />
                      </label>
                      <label className="setting-field">
                        <span>Terms Page Link</span>
                        <LinkPicker
                          value={st.termsLink || ""}
                          onChange={(url) => setSetting("termsLink", url)}
                          onRemove={() => setSetting("termsLink", "")}
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="items-editor">
                  <h4>Buttons & Navigation</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showReturnToCart !== false}
                      onChange={(e) =>
                        setSetting("showReturnToCart", e.target.checked)
                      }
                    />
                    <span>Show "Return to Cart" Link</span>
                  </label>
                  {st.showReturnToCart !== false && (
                    <label className="setting-field">
                      <span>Return to Cart Text</span>
                      <input
                        type="text"
                        value={st.returnToCartText || "← Return to cart"}
                        onChange={(e) =>
                          setSetting("returnToCartText", e.target.value)
                        }
                      />
                    </label>
                  )}
                  <label className="setting-field">
                    <span>Place Order Button Text</span>
                    <input
                      type="text"
                      value={st.placeOrderText || "Place Order"}
                      onChange={(e) =>
                        setSetting("placeOrderText", e.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="items-editor">
                  <h4>Payment Methods</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showCod !== false}
                      onChange={(e) => setSetting("showCod", e.target.checked)}
                    />
                    <span>Cash on Delivery</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showBankTransfer !== false}
                      onChange={(e) =>
                        setSetting("showBankTransfer", e.target.checked)
                      }
                    />
                    <span>Bank Transfer</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showRazorpay === true}
                      onChange={(e) =>
                        setSetting("showRazorpay", e.target.checked)
                      }
                    />
                    <span>Razorpay (Online Payment)</span>
                  </label>
                  {st.showCod !== false && (
                    <label className="setting-field">
                      <span>Cash on Delivery Label</span>
                      <input
                        value={st.cashOnDeliveryLabel || "Cash on delivery"}
                        onChange={(event) => setSetting("cashOnDeliveryLabel", event.target.value)}
                      />
                    </label>
                  )}
                  {st.showBankTransfer !== false && (
                    <>
                      <label className="setting-field">
                        <span>Bank Transfer Label</span>
                        <input
                          value={st.bankTransferLabel || "Offline bank transfer"}
                          onChange={(event) => setSetting("bankTransferLabel", event.target.value)}
                        />
                      </label>
                      <label className="setting-field">
                        <span>Bank Transfer Instructions</span>
                        <textarea
                          rows={4}
                          value={st.bankTransferInstructions || ""}
                          placeholder="Enter bank account and transfer instructions"
                          onChange={(event) => setSetting("bankTransferInstructions", event.target.value)}
                        />
                      </label>
                    </>
                  )}
                  {st.showRazorpay === true && (
                    <label className="setting-field">
                      <span>Razorpay Label</span>
                      <input
                        value={st.razorpayLabel || "Pay online (Razorpay)"}
                        onChange={(event) => setSetting("razorpayLabel", event.target.value)}
                      />
                    </label>
                  )}
                </div>
              </>
            )}

            {/* ============================================================ */}
            {/* 👤 MY ACCOUNT WIDGET */}
            {/* ============================================================ */}
            {isMyAccountWidget && (
              <>
                <div className="items-editor">
                  <h4>👤 My Account Layout</h4>
                  <label className="setting-field">
                    <span>Layout</span>
                    <select
                      value={st.accountLayout || "sidebar"}
                      onChange={(e) =>
                        setSetting("accountLayout", e.target.value)
                      }
                    >
                      <option value="sidebar">Sidebar Navigation</option>
                      <option value="tabs-top">Tabs on Top</option>
                      <option value="tabs-left">Vertical Tabs Left</option>
                      <option value="minimal">Minimal (no nav)</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Navigation Position</span>
                    <select
                      value={st.accountNavPosition || "left"}
                      onChange={(e) =>
                        setSetting("accountNavPosition", e.target.value)
                      }
                    >
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                      <option value="top">Top</option>
                    </select>
                  </label>
                </div>

                <div className="items-editor">
                  <h4>Account Navigation</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showAccountNav !== false}
                      onChange={(e) =>
                        setSetting("showAccountNav", e.target.checked)
                      }
                    />
                    <span>Show Account Navigation</span>
                  </label>

                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showDashboardLink !== false}
                      onChange={(e) =>
                        setSetting("showDashboardLink", e.target.checked)
                      }
                    />
                    <span>Dashboard Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showOrdersLink !== false}
                      onChange={(e) =>
                        setSetting("showOrdersLink", e.target.checked)
                      }
                    />
                    <span>Orders Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showDownloadsLink !== false}
                      onChange={(e) =>
                        setSetting("showDownloadsLink", e.target.checked)
                      }
                    />
                    <span>Downloads Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showAddressesLink !== false}
                      onChange={(e) =>
                        setSetting("showAddressesLink", e.target.checked)
                      }
                    />
                    <span>Addresses Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showAccountDetailsLink !== false}
                      onChange={(e) =>
                        setSetting("showAccountDetailsLink", e.target.checked)
                      }
                    />
                    <span>Account Details Link</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showLogoutLink !== false}
                      onChange={(e) =>
                        setSetting("showLogoutLink", e.target.checked)
                      }
                    />
                    <span>Logout Link</span>
                  </label>
                  {st.showLogoutLink !== false && (
                    <label className="setting-field">
                      <span>Logout Text</span>
                      <input
                        type="text"
                        value={st.logoutText || "Log out"}
                        onChange={(e) =>
                          setSetting("logoutText", e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>

                <div className="items-editor">
                  <h4>Welcome Message</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showWelcomeMessage !== false}
                      onChange={(e) =>
                        setSetting("showWelcomeMessage", e.target.checked)
                      }
                    />
                    <span>Show Welcome Message</span>
                  </label>
                  {st.showWelcomeMessage !== false && (
                    <label className="setting-field">
                      <span>Welcome Text (use {"{name}"} for username)</span>
                      <input
                        type="text"
                        value={st.welcomeText || "Hello {name}, welcome back!"}
                        onChange={(e) =>
                          setSetting("welcomeText", e.target.value)
                        }
                      />
                    </label>
                  )}
                </div>

                <div className="items-editor">
                  <h4>Default Tab</h4>
                  <label className="setting-field">
                    <span>Default Active Tab</span>
                    <select
                      value={st.defaultAccountTab || "dashboard"}
                      onChange={(e) =>
                        setSetting("defaultAccountTab", e.target.value)
                      }
                    >
                      <option value="dashboard">Dashboard</option>
                      <option value="orders">Orders</option>
                      <option value="downloads">Downloads</option>
                      <option value="addresses">Addresses</option>
                      <option value="account_details">Account Details</option>
                    </select>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showOrderLookupForm !== false}
                      onChange={(e) =>
                        setSetting("showOrderLookupForm", e.target.checked)
                      }
                    />
                    <span>Show Order Lookup Form</span>
                  </label>
                </div>
              </>
            )}

            {/* ============================================================ */}
            {/* 🧾 ORDER SUMMARY WIDGET */}
            {/* ============================================================ */}
            {isOrderSummaryWidget && (
              <>
                <div className="items-editor">
                  <h4>🧾 Order Summary Layout</h4>
                  <label className="setting-field">
                    <span>Layout Style</span>
                    <select
                      value={st.orderSummaryLayout || "card"}
                      onChange={(e) =>
                        setSetting("orderSummaryLayout", e.target.value)
                      }
                    >
                      <option value="card">Card</option>
                      <option value="plain">Plain List</option>
                      <option value="table">Table</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Content Width</span>
                    <select
                      value={st.orderSummaryWidth || "full"}
                      onChange={(e) =>
                        setSetting("orderSummaryWidth", e.target.value)
                      }
                    >
                      <option value="full">Full Width</option>
                      <option value="boxed">Boxed (600px)</option>
                    </select>
                  </label>
                </div>

                <div className="items-editor">
                  <h4>Order Details</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showOrderNumber !== false}
                      onChange={(e) =>
                        setSetting("showOrderNumber", e.target.checked)
                      }
                    />
                    <span>Show Order Number</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showOrderDate !== false}
                      onChange={(e) =>
                        setSetting("showOrderDate", e.target.checked)
                      }
                    />
                    <span>Show Order Date</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showPaymentStatus !== false}
                      onChange={(e) =>
                        setSetting("showPaymentStatus", e.target.checked)
                      }
                    />
                    <span>Show Payment Status</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showOrderItems !== false}
                      onChange={(e) =>
                        setSetting("showOrderItems", e.target.checked)
                      }
                    />
                    <span>Show Order Items</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showOrderTotals !== false}
                      onChange={(e) =>
                        setSetting("showOrderTotals", e.target.checked)
                      }
                    />
                    <span>Show Order Totals (subtotal, shipping, tax)</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showShippingDetails === true}
                      onChange={(e) =>
                        setSetting("showShippingDetails", e.target.checked)
                      }
                    />
                    <span>Show Shipping Details</span>
                  </label>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showBillingDetails === true}
                      onChange={(e) =>
                        setSetting("showBillingDetails", e.target.checked)
                      }
                    />
                    <span>Show Billing Details</span>
                  </label>
                </div>

                <div className="items-editor">
                  <h4>Thank-you Message</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showThankYouMessage !== false}
                      onChange={(e) =>
                        setSetting("showThankYouMessage", e.target.checked)
                      }
                    />
                    <span>Show Thank-you Message</span>
                  </label>
                  {st.showThankYouMessage !== false && (
                    <>
                      <label className="setting-field">
                        <span>Thank-you Heading</span>
                        <input
                          type="text"
                          value={
                            st.thankYouHeading ||
                            "Thank you. Your order has been received."
                          }
                          onChange={(e) =>
                            setSetting("thankYouHeading", e.target.value)
                          }
                        />
                      </label>
                      <label className="setting-field">
                        <span>Thank-you Description</span>
                        <textarea
                          rows={3}
                          value={
                            st.thankYouDescription ||
                            "We'll notify you once your order is on its way."
                          }
                          onChange={(e) =>
                            setSetting("thankYouDescription", e.target.value)
                          }
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="items-editor">
                  <h4>Continue Shopping Button</h4>
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={st.showContinueShoppingButton !== false}
                      onChange={(e) =>
                        setSetting(
                          "showContinueShoppingButton",
                          e.target.checked,
                        )
                      }
                    />
                    <span>Show Continue Shopping Button</span>
                  </label>
                  {st.showContinueShoppingButton !== false && (
                    <>
                      <label className="setting-field">
                        <span>Button Text</span>
                        <input
                          type="text"
                          value={
                            st.continueShoppingButtonText || "Continue Shopping"
                          }
                          onChange={(e) =>
                            setSetting(
                              "continueShoppingButtonText",
                              e.target.value,
                            )
                          }
                        />
                      </label>
                      <label className="setting-field">
                        <span>Button Link</span>
                        <LinkPicker
                          value={st.continueShoppingLink || "/shop"}
                          onChange={(url) =>
                            setSetting("continueShoppingLink", url)
                          }
                          onRemove={() =>
                            setSetting("continueShoppingLink", "")
                          }
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="items-editor">
                  <h4>Empty Order Fallback</h4>
                  <label className="setting-field">
                    <span>When no order is found</span>
                    <input
                      type="text"
                      value={
                        st.emptyOrderText ||
                        "We couldn't find an order matching those details."
                      }
                      onChange={(e) =>
                        setSetting("emptyOrderText", e.target.value)
                      }
                    />
                  </label>
                </div>
              </>
            )}

            {/* ====== PRODUCT PREVIEW ====== */}
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
                                weight: Number((selected as any).weight || 0),
                                dimensions: (selected as any).dimensions || {},
                                attributes: (selected as any).attributes || [],
                                variations: (selected as any).variations || [],
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

                    <label className="setting-field">
                      <span>Wrap</span>
                      <div className="button-group">
                        <button
                          type="button"
                          className={currentWrap === "nowrap" ? "active" : ""}
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

                <div className="settings-group" style={{ marginTop: 16 }}>
                  <h4>Additional Options</h4>
                  <label className="setting-field">
                    <span>Overflow</span>
                    <select
                      value={(currentStyle as any).overflow || "visible"}
                      onChange={(e) =>
                        updateStyle({ overflow: e.target.value } as any)
                      }
                    >
                      <option value="visible">Default</option>
                      <option value="hidden">Hidden</option>
                      <option value="auto">Auto</option>
                      <option value="scroll">Scroll</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>HTML Tag</span>
                    <select
                      value={(currentStyle as any).htmlTag || "div"}
                      onChange={(e) =>
                        updateStyle({ htmlTag: e.target.value } as any)
                      }
                    >
                      {(
                        [
                          "div",
                          "section",
                          "main",
                          "header",
                          "footer",
                          "article",
                          "aside",
                          "nav",
                        ] as const
                      ).map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  </label>
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

            {widget.type === "spacer" && (
              <div className="settings-group">
                <h4>Spacer</h4>
                <label className="setting-field">
                  <span>Space</span>
                  <div className="spacer-height-control">
                    <input
                      type="range"
                      min="0"
                      max="500"
                      value={Number(s.spacerHeight ?? s.padding?.top ?? 50)}
                      onChange={(event) =>
                        updateStyle({
                          spacerHeight: Number(event.target.value),
                        } as Partial<WidgetStyle>)
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      max="2000"
                      value={Number(s.spacerHeight ?? s.padding?.top ?? 50)}
                      onChange={(event) =>
                        updateStyle({
                          spacerHeight: Math.max(
                            0,
                            Number(event.target.value) || 0,
                          ),
                        } as Partial<WidgetStyle>)
                      }
                    />
                    <select
                      aria-label="Spacer unit"
                      value={s.spacerUnit || "px"}
                      onChange={(event) =>
                        updateStyle({
                          spacerUnit: event.target.value,
                        } as Partial<WidgetStyle>)
                      }
                    >
                      {["px", "em", "rem", "%", "vh", "vw"].map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>
            )}

            {/* ====== ICON ====== */}
            {widget.type === "icon" && (
              <div className="items-editor">
                <h4>Choose Icon</h4>
                <div className="setting-field">
                  <span>Selected Icon</span>
                  <div className="icon-list-selection-preview">
                    {widget.url ? (
                      <img
                        src={widget.url}
                        alt=""
                        className="icon-list-image-preview"
                      />
                    ) : (
                      <BuilderIcon
                        name={widget.settings?.customIcon || widget.content || "FaStar"}
                      />
                    )}
                    <span>
                      {widget.url
                        ? "Custom image"
                        : widget.settings?.customIcon || widget.content || "Choose an icon"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="change-media-btn"
                    onClick={() => setIconWidgetPickerOpen(true)}
                  >
                    Choose Icon
                  </button>
                  {(widget.content || widget.settings?.customIcon || widget.url) && (
                    <button
                      type="button"
                      className="remove-media-btn"
                      onClick={() => {
                        onChangeContent("");
                        onChangeUrl("");
                        onChangeSettings({ customIcon: null });
                      }}
                    >
                      Remove Icon
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ====== PRODUCTS GRID ====== */}
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

            {["posts", "post_grid", "loop_grid", "post_carousel", "loop_carousel"].includes(widget.type) && (
              <div className="items-editor">
                <h4>{widget.type.startsWith("loop_") ? "Loop Query" : "Posts Query"}</h4>
                <label className="setting-field">
                  <span>Source</span>
                  <select
                    value={widget.settings?.loopSource || "posts"}
                    onChange={(event) =>
                      onChangeSettings({ loopSource: event.target.value })
                    }
                  >
                    <option value="posts">Posts</option>
                    <option value="products">Products</option>
                    <option value="custom">Custom post type</option>
                  </select>
                </label>
                {widget.settings?.loopSource === "custom" && (
                  <label className="setting-field">
                    <span>Post type</span>
                    <select
                      value={widget.settings?.loopPostType || ""}
                      onChange={(event) =>
                        onChangeSettings({ loopPostType: event.target.value })
                      }
                    >
                      <option value="">Select a post type</option>
                      {loopPostTypes.map((type) => (
                        <option key={type.id} value={type.slug}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {(widget.type === "loop_grid" || widget.type === "loop_carousel") && (
                  <div className="setting-field">
                    <span>Filter mode</span>
                    <div className="loop-query-mode">
                      {(["include", "exclude"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          className={(widget.settings?.includeExclude || "include") === mode ? "active" : ""}
                          onClick={() => onChangeSettings({ includeExclude: mode })}
                        >
                          {mode === "include" ? "Include" : "Exclude"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <label className="setting-field">
                  <span>Categories</span>
                  <select
                    multiple
                    value={widget.settings?.loopCategories || []}
                    onChange={(event) =>
                      onChangeSettings({
                        loopCategories: Array.from(event.target.selectedOptions, (option) => option.value),
                      })
                    }
                    size={Math.min(5, Math.max(2, (widget.settings?.loopSource === "products" ? loopProductCategories : loopCategories).length))}
                  >
                    {(widget.settings?.loopSource === "products"
                      ? loopProductCategories.map((name) => ({ slug: name, name }))
                      : loopCategories
                    ).map((category) => (
                      <option key={category.slug} value={category.slug}>{category.name}</option>
                    ))}
                  </select>
                  <small>Use Ctrl/Cmd to select more than one.</small>
                </label>
                <label className="setting-field">
                  <span>Tags</span>
                  <select
                    multiple
                    value={widget.settings?.loopTags || []}
                    onChange={(event) =>
                      onChangeSettings({
                        loopTags: Array.from(event.target.selectedOptions, (option) => option.value),
                      })
                    }
                    size={Math.min(5, Math.max(2, (widget.settings?.loopSource === "products" ? loopProductTags : loopTags).length))}
                  >
                    {(widget.settings?.loopSource === "products"
                      ? loopProductTags.map((name) => ({ slug: name, name }))
                      : loopTags
                    ).map((tag) => (
                      <option key={tag.slug} value={tag.slug}>{tag.name}</option>
                    ))}
                  </select>
                  <small>Use Ctrl/Cmd to select more than one.</small>
                </label>
                <label className="setting-field">
                  <span>Items to show</span>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={widget.settings?.postsPerPage || 6}
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
                {(widget.type === "loop_grid" || widget.type === "post_grid") && (
                  <label className="setting-field">
                    <span>Columns</span>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={widget.settings?.columns || 3}
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
                )}
                  <label className="setting-field">
                    <span>Order by</span>
                    <select
                      value={widget.settings?.loopOrderBy || "date"}
                      onChange={(event) =>
                        onChangeSettings({ loopOrderBy: event.target.value })
                      }
                    >
                      <option value="date">Date</option>
                      <option value="title">Title</option>
                      {widget.settings?.loopSource === "products" && (
                        <option value="price">Price</option>
                      )}
                    </select>
                  </label>
                  {widget.settings?.loopSource !== "products" && (
                    <label className="setting-field">
                      <span>Date</span>
                      <select
                        value={widget.settings?.loopDate || "all"}
                        onChange={(event) =>
                          onChangeSettings({ loopDate: event.target.value })
                        }
                      >
                        <option value="all">All</option>
                        <option value="day">Last 24 hours</option>
                        <option value="week">Last week</option>
                        <option value="month">Last month</option>
                        <option value="year">Last year</option>
                      </select>
                    </label>
                  )}
                  <label className="setting-field">
                    <span>Order</span>
                    <select
                      value={widget.settings?.loopOrder || "DESC"}
                      onChange={(event) =>
                        onChangeSettings({ loopOrder: event.target.value })
                      }
                    >
                      <option value="DESC">Descending</option>
                      <option value="ASC">Ascending</option>
                    </select>
                  </label>
                  {(widget.type === "loop_grid" || widget.type === "loop_carousel") && (
                    <label className="setting-field">
                      <span>Pagination</span>
                      <select
                        value={widget.settings?.loopPagination || "none"}
                        onChange={(event) =>
                          onChangeSettings({ loopPagination: event.target.value })
                        }
                      >
                        <option value="none">None</option>
                        <option value="numbers">Numbers</option>
                        <option value="load_more">Load more</option>
                      </select>
                    </label>
                  )}
                  {widget.settings?.loopSource === "products" && (
                    <p className="loop-template-hint">
                      Product loop item: drag Image, Product Title, and Product Price widgets into this loop on the canvas. Sale prices display alongside the regular price when available.
                    </p>
                  )}
                  {loopQueryError && <p className="loop-query-error" role="alert">{loopQueryError}</p>}
              </div>
            )}

            {/* ====== LINK BIO ====== */}
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

            {/* ====== IMAGE BOX ====== */}
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

            {/* ====== MAP ====== */}
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

            {/* ====== SOUNDCLOUD ====== */}
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

            {/* ====== FORM ====== */}
            {widget.type === "form" && (
              <div className="items-editor">
                <div className="items-header">
                  <span>Form Fields</span>
                  <select
                    aria-label="Add form field"
                    value=""
                    disabled={formFields.length >= 20}
                    onChange={(event) => {
                      const fieldType = event.target.value as WidgetItem["fieldType"];
                      if (!fieldType) return;
                      const fields = formFields;
                      if (fields.length >= 20) return;
                      const id = `field-${Date.now()}-${fields.length}`;
                      const title = fieldType === "textarea" ? "Message" : fieldType === "email" ? "Email" : `New ${fieldType} field`;
                      setSetting("formFields", [
                        ...fields,
                        { id, title, fieldType, required: false, placeholder: "" },
                      ]);
                      event.currentTarget.value = "";
                    }}
                  >
                    <option value="">+ Add Field</option>
                    <option value="text">Text</option>
                    <option value="email">Email</option>
                    <option value="tel">Phone</option>
                    <option value="number">Number</option>
                    <option value="textarea">Textarea</option>
                    <option value="select">Select</option>
                    <option value="checkbox">Checkbox</option>
                  </select>
                </div>
                {formFields.map((field, index) => (
                  <div
                    key={field.id}
                    className="item-editor"
                    draggable
                    onDragStart={() => setFormFieldDragIndex(index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      if (formFieldDragIndex === null || formFieldDragIndex === index) return;
                      const fields = [...formFields];
                      const [moved] = fields.splice(formFieldDragIndex, 1);
                      fields.splice(index, 0, moved);
                      setSetting("formFields", fields);
                      setFormFieldDragIndex(null);
                    }}
                    onDragEnd={() => setFormFieldDragIndex(null)}
                  >
                    <label className="setting-field">
                      <span>Label</span>
                      <input value={field.title || ""} onChange={(event) => updateFormField(index, { title: event.target.value })} />
                    </label>
                    <label className="setting-field">
                      <span>Field Type</span>
                      <select value={field.fieldType || "text"} onChange={(event) => updateFormField(index, { fieldType: event.target.value })}>
                        {["text", "email", "tel", "number", "textarea", "select", "checkbox"].map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    {field.fieldType !== "checkbox" && (
                      <label className="setting-field">
                        <span>Placeholder</span>
                        <input value={field.placeholder || ""} onChange={(event) => updateFormField(index, { placeholder: event.target.value })} />
                      </label>
                    )}
                    {field.fieldType === "select" && (
                      <label className="setting-field">
                        <span>Options (one per line)</span>
                        <textarea rows={3} value={(field.options || []).join("\n")} onChange={(event) => updateFormField(index, { options: event.target.value.split("\n").map((option) => option.trim()).filter(Boolean) })} />
                      </label>
                    )}
                    <label className="setting-field">
                      <span><input type="checkbox" checked={field.required !== false} onChange={(event) => updateFormField(index, { required: event.target.checked })} /> Required</span>
                    </label>
                    <button type="button" className="remove-item" onClick={() => setSetting("formFields", formFields.filter((_, fieldIndex) => fieldIndex !== index))}>Remove Field</button>
                  </div>
                ))}
                <label className="setting-field">
                  <span>Submit Button Text</span>
                  <input value={widget.settings?.submitText || "Submit"} onChange={(event) => setSetting("submitText", event.target.value)} />
                </label>
                <label className="setting-field">
                  <span>Confirmation Message</span>
                  <input value={widget.settings?.successMessage || ""} onChange={(event) => setSetting("successMessage", event.target.value)} placeholder="Thank you for your message." />
                </label>
                <details>
                  <summary>Email Template</summary>
                  <label className="setting-field">
                    <span>Email Subject</span>
                    <input value={widget.settings?.emailSubject || "New form submission"} onChange={(event) => setSetting("emailSubject", event.target.value)} />
                  </label>
                  <label className="setting-field">
                    <span>Email Body</span>
                    <textarea rows={5} value={widget.settings?.emailTemplate || "New submission from {{page_title}}\n\n{{fields}}"} onChange={(event) => setSetting("emailTemplate", event.target.value)} />
                  </label>
                  <small>Template variables: {"{{page_title}}"}, {"{{fields}}"}, or a field ID such as {"{{email}}"}.</small>
                </details>
                <small>Drag fields to reorder. Entries are saved in Content → Form Submissions.</small>
              </div>
            )}

            {widget.type === "divider" && (
              <div className="field-row">
                <UnitInput
                  label="Width"
                  value={toUnitInputValue(currentStyle.width || "100%")}
                  onChange={(value) => updateStyle({ width: value })}
                />
                <label className="setting-field">
                  <span>Color</span>
                  <input type="color" value={currentStyle.borderColor || "#e0e0e0"} onChange={(event) => updateStyle({ borderColor: event.target.value })} />
                </label>
              </div>
            )}

            {/* ====== SHORTCODE ====== */}
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

            {/* ====== MENU ANCHOR ====== */}
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

            {/* ====== READ MORE / SIDEBAR ====== */}
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

            {/* ====== SIDEBAR LINKS ====== */}
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

            {/* ====== RATING ====== */}
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

            {/* ====== TEXT PATH ====== */}
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

            {/* ====== TABLEPRESS ====== */}
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
                          (widget.items || []).filter(
                            (_, row) => row !== index,
                          ),
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
                    <span>Image Fit</span>
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

                {widget.type !== "site_logo" && (
                  <>
                    <label className="setting-field">
                      <span>Caption</span>
                      <select
                        value={st.captionType || "none"}
                        onChange={(event) =>
                          setSetting("captionType", event.target.value)
                        }
                      >
                        <option value="none">None</option>
                        <option value="title">Title</option>
                        <option value="custom">Custom Caption</option>
                      </select>
                    </label>
                    {st.captionType === "custom" && (
                      <label className="setting-field">
                        <span>Caption Text</span>
                        <input
                          type="text"
                          value={st.captionText || ""}
                          onChange={(event) =>
                            setSetting("captionText", event.target.value)
                          }
                        />
                      </label>
                    )}
                  </>
                )}

                <label className="setting-field">
                  <span>Link</span>
                  <select
                    value={
                      st.imageLinkType ||
                      (widget.link?.url ? "custom" : "none")
                    }
                    onChange={(event) => {
                      const imageLinkType = event.target.value;
                      onChangeSettings({
                        imageLinkType,
                        ...(imageLinkType === "media"
                          ? { link: { ...widget.link, url: widget.url || "" } }
                          : imageLinkType === "none"
                            ? { link: { ...widget.link, url: "" } }
                            : {}),
                      });
                    }}
                  >
                    <option value="none">None</option>
                    <option value="media">Media File</option>
                    <option value="custom">Custom URL</option>
                  </select>
                </label>
                {(st.imageLinkType === "custom" ||
                  (!st.imageLinkType && widget.link?.url)) && (
                  <label className="setting-field">
                    <span>Custom URL</span>
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

            {/* ====== ICON LIST ====== */}
            {isIconList && (
              <div className="items-editor">
                <label className="setting-field">
                  <span>Layout</span>
                  <select
                    value={widget.settings?.iconListLayout || "list"}
                    onChange={(event) =>
                      onChangeSettings({ iconListLayout: event.target.value })
                    }
                  >
                    <option value="list">List</option>
                    <option value="inline">Inline</option>
                  </select>
                </label>
                <div className="items-header">
                  <span>Icon List Items</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: createEditorItemId(),
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
                    <div className="accordion-item-header">
                      <button
                        type="button"
                        className="accordion-item-toggle"
                        aria-expanded={expandedIconListItems[item.id] ?? index === 0}
                        onClick={() =>
                          setExpandedIconListItems((current) => ({
                            ...current,
                            [item.id]: !(current[item.id] ?? index === 0),
                          }))
                        }
                      >
                        <span className="accordion-item-chevron">
                          {(expandedIconListItems[item.id] ?? index === 0) ? "▾" : "▸"}
                        </span>
                        <span>{item.title || `Item #${index + 1}`}</span>
                      </button>
                      <div className="accordion-item-actions">
                        <button
                          type="button"
                          title="Duplicate item"
                          aria-label={`Duplicate ${item.title || `item ${index + 1}`}`}
                          onClick={() => {
                            const clone = JSON.parse(JSON.stringify(item)) as WidgetItem;
                            clone.id = createEditorItemId();
                            const items = [...(widget.items || [])];
                            items.splice(index + 1, 0, clone);
                            onChangeItems(items);
                            setExpandedIconListItems((current) => ({
                              ...current,
                              [clone.id]: false,
                            }));
                          }}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="accordion-item-remove"
                          title="Remove item"
                          aria-label={`Remove ${item.title || `item ${index + 1}`}`}
                          onClick={() =>
                            onChangeItems(
                              (widget.items || []).filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {(expandedIconListItems[item.id] ?? index === 0) && (
                      <div className="accordion-item-fields">
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
                    <label className="setting-field">
                      <span>List marker</span>
                      <select
                        value={item.iconType || (item.image ? "image" : "icon")}
                        onChange={(event) => {
                          const items = [...(widget.items || [])];
                          items[index] = { ...item, iconType: event.target.value as WidgetItem["iconType"] };
                          onChangeItems(items);
                        }}
                      >
                        <option value="icon">Icon</option>
                        <option value="text">Text only</option>
                        <option value="image">Image</option>
                      </select>
                    </label>
                    {(!item.iconType || item.iconType === "icon") && !item.image && <div className="setting-field">
                      <span>Icon</span>
                      <div className="icon-list-selection-preview">
                        <BuilderIcon name={item.icon} />
                        <span>{item.icon || "Choose an icon"}</span>
                      </div>
                      <button
                        type="button"
                        className="change-media-btn"
                        onClick={() => {
                          setIconListItemIndex(index);
                          setIconListPickerOpen(true);
                        }}
                      >
                        Choose from Icon Library
                      </button>
                    </div>}
                    {item.iconType === "image" && <div className="setting-field">
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
                    </div>}
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
                    )}
                  </div>
                ))}
                <label className="setting-field">
                  <span>Apply Link On</span>
                  <select
                    value={widget.settings?.iconListLinkFullWidth ? "full" : "icon"}
                    onChange={(event) =>
                      onChangeSettings({
                        iconListLinkFullWidth: event.target.value === "full",
                      })
                    }
                  >
                    <option value="full">Full Width</option>
                    <option value="icon">Icon and Text</option>
                  </select>
                </label>
              </div>
            )}

            {/* ====== ICON BOX ====== */}
            {widget.type === "icon_box" && (
              <>
                <div className="setting-field">
                  <span>Icon</span>
                  {widget.url ? <img src={widget.url} alt="" className="icon-list-image-preview" /> : <div className="icon-list-selection-preview"><BuilderIcon name={widget.content || "FaStar"} /><span>{widget.content || "Choose an icon"}</span></div>}
                  <button
                    type="button"
                    className="change-media-btn"
                    onClick={() => setIconBoxPickerOpen(true)}
                  >
                    Choose Icon
                  </button>
                </div>
                <label className="setting-field">
                  <span>Icon Position</span>
                  <select
                    value={widget.settings?.iconPosition || "top"}
                    onChange={(event) =>
                      onChangeSettings({ iconPosition: event.target.value })
                    }
                  >
                    <option value="top">Top</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
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
                      const item = widget.items?.[0] ||
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
                      const item = widget.items?.[0] ||
                        widget.settings?.items?.[0] || {
                          id: `${widget.id}-feature`,
                        };
                      onChangeItems([{ ...item, content: event.target.value }]);
                    }}
                  />
                </label>
              </>
            )}

            {/* ====== COUNTER ====== */}
            {widget.type === "counter" && (
              <div className="items-editor">
                <h4>Counter</h4>
                <label className="setting-field">
                  <span>Starting Number</span>
                  <input
                    type="number"
                    value={st.counterStart ?? 0}
                    onChange={(event) =>
                      setSetting("counterStart", Number(event.target.value) || 0)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Ending Number</span>
                  <input
                    type="number"
                    value={
                      st.counterEnd ??
                      Number(
                        widget.items?.[0]?.content ||
                          widget.settings?.items?.[0]?.content ||
                          widget.content ||
                          100,
                      )
                    }
                    onChange={(event) =>
                      setSetting("counterEnd", Number(event.target.value) || 0)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Number Prefix</span>
                  <input
                    value={st.counterPrefix || ""}
                    onChange={(event) =>
                      setSetting("counterPrefix", event.target.value)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Number Suffix</span>
                  <input
                    value={st.counterSuffix || ""}
                    onChange={(event) =>
                      setSetting("counterSuffix", event.target.value)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Animation Duration (ms)</span>
                  <input
                    type="number"
                    min="0"
                    value={st.counterDuration ?? 2000}
                    onChange={(event) =>
                      setSetting(
                        "counterDuration",
                        Math.max(0, Number(event.target.value) || 0),
                      )
                    }
                  />
                </label>
                <label className="setting-field setting-toggle-row">
                  <span>Thousand Separator</span>
                  <input
                    type="checkbox"
                    checked={st.counterThousandsSeparator ?? true}
                    onChange={(event) =>
                      setSetting("counterThousandsSeparator", event.target.checked)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Separator</span>
                  <select
                    value={st.counterSeparator || ","}
                    onChange={(event) =>
                      setSetting("counterSeparator", event.target.value)
                    }
                    disabled={st.counterThousandsSeparator === false}
                  >
                    <option value=",">Default (,)</option>
                    <option value=".">Period (.)</option>
                    <option value=" ">Space</option>
                  </select>
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
                      const item = widget.items?.[0] ||
                        widget.settings?.items?.[0] || {
                          id: `${widget.id}-counter`,
                        };
                      onChangeItems([{ ...item, title: event.target.value }]);
                    }}
                  />
                </label>
                <label className="setting-field">
                  <span>Title HTML Tag</span>
                  <select
                    value={st.counterTitleTag || "div"}
                    onChange={(event) =>
                      setSetting("counterTitleTag", event.target.value)
                    }
                  >
                    {["div", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {/* ====== TESTIMONIAL / PROGRESS BAR ====== */}
            {widget.type === "testimonial" && (
              <div className="items-editor">
                <h4>Slides</h4>
                <label className="setting-field">
                  <span>Slides Name</span>
                  <input
                    value={st.testimonialSlidesName || "Slides"}
                    onChange={(event) =>
                      setSetting("testimonialSlidesName", event.target.value)
                    }
                  />
                </label>
                <div className="items-header">
                  <span>Slides ({(widget.items || []).length})</span>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeItems([
                        ...(widget.items || []),
                        {
                          id: createEditorItemId(),
                          title: `Item #${(widget.items || []).length + 1}`,
                          content: "",
                        },
                      ])
                    }
                  >
                    + Add Item
                  </button>
                </div>
                {(widget.items || []).map((item, index) => (
                  <div className="item-editor" key={item.id}>
                    <div className="accordion-item-header">
                      <span className="accordion-item-toggle">
                        Item #{index + 1}
                      </span>
                      <div className="accordion-item-actions">
                        <button
                          type="button"
                          title="Duplicate slide"
                          aria-label={`Duplicate slide ${index + 1}`}
                          onClick={() => {
                            const clone = JSON.parse(JSON.stringify(item)) as WidgetItem;
                            clone.id = createEditorItemId();
                            const items = [...(widget.items || [])];
                            items.splice(index + 1, 0, clone);
                            onChangeItems(items);
                          }}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="accordion-item-remove"
                          title="Remove slide"
                          aria-label={`Remove slide ${index + 1}`}
                          onClick={() =>
                            onChangeItems(
                              (widget.items || []).filter((_, i) => i !== index),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    <label className="setting-field">
                      <span>Quote</span>
                      <textarea
                        rows={3}
                        value={item.content || ""}
                        onChange={(event) => {
                          const items = [...(widget.items || [])];
                          items[index] = { ...item, content: event.target.value };
                          onChangeItems(items);
                        }}
                      />
                    </label>
                    <label className="setting-field">
                      <span>Author</span>
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
                      <span>Job Title</span>
                      <input
                        value={item.label || ""}
                        onChange={(event) => {
                          const items = [...(widget.items || [])];
                          items[index] = { ...item, label: event.target.value };
                          onChangeItems(items);
                        }}
                      />
                    </label>
                  </div>
                ))}
                <label className="setting-field">
                  <span>Skin</span>
                  <select
                    value={st.testimonialSkin || "default"}
                    onChange={(event) =>
                      setSetting("testimonialSkin", event.target.value)
                    }
                  >
                    <option value="default">Default</option>
                    <option value="bubble">Bubble</option>
                    <option value="card">Card</option>
                  </select>
                </label>
                <label className="setting-field">
                  <span>Layout</span>
                  <select
                    value={st.testimonialLayout || "image-inline"}
                    onChange={(event) =>
                      setSetting("testimonialLayout", event.target.value)
                    }
                  >
                    <option value="image-inline">Image Inline</option>
                    <option value="image-above">Image Above</option>
                    <option value="image-left">Image Left</option>
                  </select>
                </label>
                <label className="setting-field">
                  <span>Alignment</span>
                  <select
                    value={st.testimonialAlignment || "center"}
                    onChange={(event) =>
                      setSetting("testimonialAlignment", event.target.value)
                    }
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>
            )}

            {widget.type === "progress_bar" && (
              <div className="items-editor">
                <h4>Progress Bar</h4>
                <label className="setting-field">
                  <span>Title</span>
                  <input
                    value={st.progressTitle ?? widget.items?.[0]?.title ?? "My Skill"}
                    onChange={(event) =>
                      setSetting("progressTitle", event.target.value)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Title HTML Tag</span>
                  <select
                    value={st.progressTitleTag || "span"}
                    onChange={(event) =>
                      setSetting("progressTitleTag", event.target.value)
                    }
                  >
                    {["span", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6"].map((tag) => (
                      <option key={tag} value={tag}>{tag}</option>
                    ))}
                  </select>
                </label>
                <label className="setting-field setting-toggle-row">
                  <span>Display Title</span>
                  <input
                    type="checkbox"
                    checked={st.showProgressTitle ?? true}
                    onChange={(event) =>
                      setSetting("showProgressTitle", event.target.checked)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Percentage</span>
                  <div className="spacer-height-control">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={st.progressPercent ?? Number(widget.items?.[0]?.content || 50)}
                      onChange={(event) =>
                        setSetting("progressPercent", Number(event.target.value))
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={st.progressPercent ?? Number(widget.items?.[0]?.content || 50)}
                      onChange={(event) =>
                        setSetting(
                          "progressPercent",
                          Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                        )
                      }
                    />
                  </div>
                </label>
                <label className="setting-field setting-toggle-row">
                  <span>Display Percentage</span>
                  <input
                    type="checkbox"
                    checked={st.showProgressPercent ?? true}
                    onChange={(event) =>
                      setSetting("showProgressPercent", event.target.checked)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Inner Text</span>
                  <input
                    value={st.progressInnerText ?? ""}
                    onChange={(event) =>
                      setSetting("progressInnerText", event.target.value)
                    }
                  />
                </label>
              </div>
            )}

            {/* ====== SOCIAL ICONS ====== */}
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
                          title: "Social Link",
                          icon: "FaGlobe",
                          iconType: "icon",
                          link: { url: "" },
                        },
                      ])
                    }
                  >
                    + Add Social Link
                  </button>
                </div>
                {(widget.items || []).map((item, index) => (
                  <div className="item-editor icon-list-editor-item" key={item.id}>
                    <div className="accordion-item-header">
                      <button
                        type="button"
                        className="accordion-item-toggle"
                        aria-expanded={expandedIconListItems[item.id] ?? index === 0}
                        onClick={() =>
                          setExpandedIconListItems((current) => ({
                            ...current,
                            [item.id]: !(current[item.id] ?? index === 0),
                          }))
                        }
                      >
                        <span className="accordion-item-chevron">
                          {(expandedIconListItems[item.id] ?? index === 0) ? "▾" : "▸"}
                        </span>
                        <span>{item.title || `Social Link #${index + 1}`}</span>
                      </button>
                      <div className="accordion-item-actions">
                        <button
                          type="button"
                          title="Duplicate social link"
                          aria-label={`Duplicate ${item.title || `social link ${index + 1}`}`}
                          onClick={() => {
                            const clone = JSON.parse(JSON.stringify(item)) as WidgetItem;
                            clone.id = createEditorItemId();
                            const items = [...(widget.items || [])];
                            items.splice(index + 1, 0, clone);
                            onChangeItems(items);
                            setExpandedIconListItems((current) => ({
                              ...current,
                              [clone.id]: false,
                            }));
                          }}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="accordion-item-remove"
                          title="Remove social link"
                          aria-label={`Remove ${item.title || `social link ${index + 1}`}`}
                          onClick={() =>
                            onChangeItems(
                              (widget.items || []).filter(
                                (_, itemIndex) => itemIndex !== index,
                              ),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {(expandedIconListItems[item.id] ?? index === 0) && (
                      <div className="accordion-item-fields">
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
                      <span>Icon or image</span>
                      <div className="icon-list-selection-preview">
                        {item.image ? (
                          <img src={item.image} alt="" className="icon-list-image-preview" />
                        ) : (
                          <BuilderIcon name={item.icon} />
                        )}
                        <span>{item.image ? "Custom image" : item.icon || "Choose an icon"}</span>
                      </div>
                      <button
                        type="button"
                        className="change-media-btn"
                        onClick={() => {
                          setIconListItemIndex(index);
                          setIconListPickerOpen(true);
                        }}
                      >
                        Choose Icon or Upload SVG / PNG
                      </button>
                      {item.image && (
                        <button
                          type="button"
                          className="remove-media-btn"
                          onClick={() => {
                            const items = [...(widget.items || [])];
                            items[index] = { ...item, image: "", icon: "", iconType: "text" };
                            onChangeItems(items);
                          }}
                        >
                          Remove Icon Image
                        </button>
                      )}
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
                    )}
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
                    onClick={() => {
                      const newItem: WidgetItem = {
                        id: createEditorItemId(),
                        title: "New Item",
                        content: "Content",
                      };
                      onChangeItems([
                        ...(widget.items || []),
                        newItem,
                      ]);
                      setExpandedItems((current) => ({
                        ...current,
                        [newItem.id]: true,
                      }));
                    }}
                  >
                    + Add Item
                  </button>
                </div>
                {(widget.items || []).map((item, i) => (
                  <div key={item.id} className="item-editor accordion-item-editor">
                    <div className="accordion-item-header">
                      <button
                        type="button"
                        className="accordion-item-toggle"
                        aria-expanded={expandedItems[item.id] ?? i === 0}
                        onClick={() =>
                          setExpandedItems((current) => ({
                            ...current,
                            [item.id]: !(current[item.id] ?? i === 0),
                          }))
                        }
                      >
                        <span className="accordion-item-chevron">
                          {(expandedItems[item.id] ?? i === 0) ? "▾" : "▸"}
                        </span>
                        <span>{item.title || `Item #${i + 1}`}</span>
                      </button>
                      <div className="accordion-item-actions">
                        <button
                          type="button"
                          aria-label={`Duplicate ${item.title || `item ${i + 1}`}`}
                          title="Duplicate item"
                          onClick={() => {
                            const clone = JSON.parse(JSON.stringify(item)) as WidgetItem;
                            clone.id = createEditorItemId();
                            clone.children = clone.children?.map(cloneWidgetWithFreshIds);
                            const items = [...(widget.items || [])];
                            items.splice(i + 1, 0, clone);
                            onChangeItems(items);
                            setExpandedItems((current) => ({
                              ...current,
                              [clone.id]: false,
                            }));
                          }}
                        >
                          ⧉
                        </button>
                        <button
                          type="button"
                          className="accordion-item-remove"
                          aria-label={`Remove ${item.title || `item ${i + 1}`}`}
                          title="Remove item"
                          onClick={() =>
                            onChangeItems(
                              (widget.items || []).filter((_, idx) => idx !== i),
                            )
                          }
                        >
                          ×
                        </button>
                      </div>
                    </div>
                    {(expandedItems[item.id] ?? i === 0) && (
                      <div className="accordion-item-fields">
                        <label className="setting-field">
                          <span>Title</span>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(event) => {
                              const items = [...(widget.items || [])];
                              items[i] = { ...item, title: event.target.value };
                              onChangeItems(items);
                            }}
                            placeholder={`Item #${i + 1}`}
                          />
                        </label>
                        <label className="setting-field">
                          <span>CSS ID</span>
                          <input
                            type="text"
                            value={item.cssId || ""}
                            onChange={(event) => {
                              const items = [...(widget.items || [])];
                              items[i] = { ...item, cssId: event.target.value };
                              onChangeItems(items);
                            }}
                            placeholder="Optional CSS ID"
                          />
                        </label>
                        <label className="setting-field">
                          <span>Text content</span>
                          <textarea
                            value={item.content || ""}
                            onChange={(event) => {
                              const items = [...(widget.items || [])];
                              items[i] = { ...item, content: event.target.value };
                              onChangeItems(items);
                            }}
                            placeholder="Content"
                            rows={2}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ============================================ */}
        {/* ====== STYLE TAB =============== */}
        {/* ============================================ */}
        {activeTab === "style" && (
          <>
            {isImageWidget && (
              <div className="settings-section">
                <h4 className="section-title">Image</h4>
                <label className="setting-field">
                  <span>Alignment</span>
                  <div className="button-group">
                    {(["left", "center", "right"] as const).map((alignment) => (
                      <button
                        key={alignment}
                        type="button"
                        className={
                          (currentStyle.elementAlign ||
                            currentStyle.textAlign ||
                            "left") === alignment
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          updateStyle({
                            elementAlign: alignment,
                            textAlign: alignment,
                          } as any)
                        }
                        aria-label={`Align image ${alignment}`}
                      >
                        {alignment === "left"
                          ? "☰"
                          : alignment === "center"
                            ? "☷"
                            : "☷"}
                      </button>
                    ))}
                  </div>
                </label>
                <div className="field-row">
                  <UnitInput
                    label="Width"
                    value={toUnitInputValue(currentStyle.width || "100%")}
                    onChange={(value) => updateStyle({ width: value })}
                  />
                  <UnitInput
                    label="Max Width"
                    value={toUnitInputValue(currentStyle.maxWidth || "100%")}
                    onChange={(value) => updateStyle({ maxWidth: value })}
                  />
                </div>
                <div className="field-row">
                  <UnitInput
                    label="Height"
                    value={toUnitInputValue(currentStyle.height || "auto")}
                    onChange={(value) => updateStyle({ height: value })}
                  />
                  <label className="setting-field">
                    <span>Object Fit</span>
                    <select
                      value={currentStyle.objectFit || "cover"}
                      onChange={(event) =>
                        updateStyle({
                          objectFit: event.target.value as WidgetStyle["objectFit"],
                        })
                      }
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="fill">Fill</option>
                      <option value="none">None</option>
                      <option value="scale-down">Scale Down</option>
                    </select>
                  </label>
                </div>
                <label className="setting-field">
                  <span>Object Position</span>
                  <select
                    value={currentStyle.objectPosition || "center center"}
                    onChange={(event) =>
                      updateStyle({ objectPosition: event.target.value })
                    }
                  >
                    <option value="center center">Center Center</option>
                    <option value="center top">Center Top</option>
                    <option value="center bottom">Center Bottom</option>
                    <option value="left center">Left Center</option>
                    <option value="right center">Right Center</option>
                  </select>
                </label>
                <div className="button-group" style={{ marginBottom: 12 }}>
                  {(["normal", "hover"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={imageStyleTab === tab ? "active" : ""}
                      onClick={() => setImageStyleTab(tab)}
                    >
                      {tab === "normal" ? "Normal" : "Hover"}
                    </button>
                  ))}
                </div>
                <label className="setting-field">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={
                      imageStyleTab === "hover"
                        ? currentStyle.hoverOpacity ?? 1
                        : currentStyle.opacity ?? 1
                    }
                    onChange={(event) =>
                      updateStyle(
                        imageStyleTab === "hover"
                          ? { hoverOpacity: Number(event.target.value) }
                          : { opacity: Number(event.target.value) },
                      )
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>CSS Filters</span>
                  <input
                    type="text"
                    value={
                      imageStyleTab === "hover"
                        ? (currentStyle as any).hoverCssFilters || ""
                        : currentStyle.cssFilters || ""
                    }
                    placeholder="brightness(1.1) contrast(1.1)"
                    onChange={(event) =>
                      updateStyle(
                        imageStyleTab === "hover"
                          ? ({ hoverCssFilters: event.target.value } as any)
                          : { cssFilters: event.target.value },
                      )
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Border Type</span>
                  <select
                    value={currentStyle.borderStyle || "none"}
                    onChange={(event) =>
                      updateStyle({
                        borderStyle: event.target.value as WidgetStyle["borderStyle"],
                      })
                    }
                  >
                    <option value="none">Default</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                  </select>
                </label>
                <UnitInput
                  label="Border Radius"
                  value={`${currentStyle.borderRadius ?? 0}px`}
                  onChange={(value) =>
                    updateStyle({
                      borderRadius: Number.parseFloat(value) || 0,
                    })
                  }
                />
              </div>
            )}
            {isContainer ? (
              <>
                <div className="settings-section">
                  <h4 className="section-title">Background</h4>
                  <div className="button-group" style={{ marginBottom: 12 }}>
                    {(["normal", "hover"] as const).map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        className={containerStyleTab === tab ? "active" : ""}
                        onClick={() => setContainerStyleTab(tab)}
                      >
                        {tab === "normal" ? "Normal" : "Hover"}
                      </button>
                    ))}
                  </div>
                  <label className="setting-field">
                    <span>Background Type</span>
                    <select
                      value={(currentStyle as any).backgroundType || "classic"}
                      onChange={(e) =>
                        updateStyle({ backgroundType: e.target.value } as any)
                      }
                    >
                      <option value="classic">Classic</option>
                      <option value="gradient">Gradient</option>
                      <option value="video">Video</option>
                      <option value="slideshow">Slideshow</option>
                    </select>
                  </label>
                  {containerStyleTab === "normal" ? (
                    <>
                      {(currentStyle as any).backgroundType === "gradient" ? (
                        <>
                          <label className="setting-field">
                            <span>Type</span>
                            <select
                              value={currentStyle.backgroundGradientType || "linear"}
                              onChange={(event) =>
                                updateBackgroundGradient({
                                  backgroundGradientType: event.target.value as "linear" | "radial",
                                })
                              }
                            >
                              <option value="linear">Linear</option>
                              <option value="radial">Radial</option>
                            </select>
                          </label>
                          <label className="setting-field">
                            <span>Color</span>
                            <input
                              type="color"
                              value={
                                (currentStyle as any)
                                  .backgroundGradientColor1 || "#0c2f55"
                              }
                              onChange={(e) =>
                                updateBackgroundGradient({
                                  backgroundGradientColor1: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="setting-field">
                            <span>Location (%)</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentStyle.backgroundGradientLocation1 ?? 0}
                              onChange={(event) =>
                                updateBackgroundGradient({
                                  backgroundGradientLocation1: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          <label className="setting-field">
                            <span>Second Color</span>
                            <input
                              type="color"
                              value={
                                (currentStyle as any)
                                  .backgroundGradientColor2 || "#ffffff"
                              }
                              onChange={(e) =>
                                updateBackgroundGradient({
                                  backgroundGradientColor2: e.target.value,
                                })
                              }
                            />
                          </label>
                          <label className="setting-field">
                            <span>Location (%)</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={currentStyle.backgroundGradientLocation2 ?? 100}
                              onChange={(event) =>
                                updateBackgroundGradient({
                                  backgroundGradientLocation2: Number(event.target.value),
                                })
                              }
                            />
                          </label>
                          {(currentStyle.backgroundGradientType || "linear") === "linear" && (
                          <label className="setting-field">
                            <span>Angle (deg)</span>
                            <input
                              type="number"
                              min="0"
                              max="360"
                              value={
                                (currentStyle as any).backgroundGradientAngle ??
                                135
                              }
                              onChange={(e) =>
                                updateBackgroundGradient({
                                  backgroundGradientAngle: Number(
                                    e.target.value,
                                  ),
                                })
                              }
                            />
                          </label>
                          )}
                        </>
                      ) : (
                        <>
                          <label className="setting-field">
                            <span>Background Color</span>
                            <input
                              type="color"
                              value={currentStyle.backgroundColor || "#ffffff"}
                              onChange={(e) =>
                                updateStyle({
                                  backgroundColor: e.target.value,
                                  backgroundGradient: undefined as any,
                                } as any)
                              }
                            />
                          </label>
                          <label className="setting-field">
                            <span>Background Image URL</span>
                            <input
                              type="text"
                              value={currentStyle.backgroundImage || ""}
                              placeholder="Image URL"
                              onChange={(e) =>
                                updateStyle({
                                  backgroundImage: e.target.value,
                                } as any)
                              }
                            />
                          </label>
                        </>
                      )}
                      {(currentStyle as any).backgroundType === "video" && (
                        <label className="setting-field">
                          <span>Background Video URL</span>
                          <input
                            type="url"
                            value={(currentStyle as any).backgroundVideo || ""}
                            onChange={(e) =>
                              updateStyle({
                                backgroundVideo: e.target.value,
                              } as any)
                            }
                            placeholder="MP4 URL"
                          />
                        </label>
                      )}
                      {(currentStyle as any).backgroundType === "slideshow" && (
                        <label className="setting-field">
                          <span>Slideshow Image URLs (comma separated)</span>
                          <textarea
                            value={(
                              (currentStyle as any).backgroundSlideshow || []
                            ).join(", ")}
                            onChange={(e) =>
                              updateStyle({
                                backgroundSlideshow: e.target.value
                                  .split(",")
                                  .map((v: string) => v.trim())
                                  .filter(Boolean),
                              } as any)
                            }
                            placeholder="image1.jpg, image2.jpg"
                          />
                        </label>
                      )}
                    </>
                  ) : (
                    <>
                      <label className="setting-field">
                        <span>Hover Background Color</span>
                        <input
                          type="color"
                          value={
                            (currentStyle as any).hoverBackgroundColor ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            updateStyle({
                              hoverBackgroundColor: e.target.value,
                            } as any)
                          }
                        />
                      </label>
                      <label className="setting-field">
                        <span>Hover Gradient CSS</span>
                        <input
                          type="text"
                          value={
                            (currentStyle as any).hoverBackgroundGradient || ""
                          }
                          placeholder="linear-gradient(135deg, #111, #555)"
                          onChange={(e) =>
                            updateStyle({
                              hoverBackgroundGradient: e.target.value,
                            } as any)
                          }
                        />
                      </label>
                    </>
                  )}
                </div>

                <div className="settings-section">
                  <h4 className="section-title">Background Overlay</h4>
                  <div className="button-group" style={{ marginBottom: 12 }}>
                    {(["normal", "hover"] as const).map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        className={overlayStyleTab === tab ? "active" : ""}
                        onClick={() => setOverlayStyleTab(tab)}
                      >
                        {tab === "normal" ? "Normal" : "Hover"}
                      </button>
                    ))}
                  </div>
                  <label className="setting-field">
                    <span>Overlay Color</span>
                    <input
                      type="color"
                      value={
                        overlayStyleTab === "hover"
                          ? (currentStyle as any).hoverOverlayColor || "#000000"
                          : (currentStyle as any).overlayColor || "#000000"
                      }
                      onChange={(e) =>
                        updateStyle(
                          overlayStyleTab === "hover"
                            ? ({ hoverOverlayColor: e.target.value } as any)
                            : ({ overlayColor: e.target.value } as any),
                        )
                      }
                    />
                  </label>
                  <label className="setting-field">
                    <span>Overlay Gradient CSS</span>
                    <input
                      type="text"
                      value={
                        overlayStyleTab === "hover"
                          ? (currentStyle as any).hoverOverlayGradient || ""
                          : (currentStyle as any).overlayGradient || ""
                      }
                      placeholder="linear-gradient(...)"
                      onChange={(e) =>
                        updateStyle(
                          overlayStyleTab === "hover"
                            ? ({ hoverOverlayGradient: e.target.value } as any)
                            : ({ overlayGradient: e.target.value } as any),
                        )
                      }
                    />
                  </label>
                  {overlayStyleTab === "hover" && (
                    <label className="setting-field">
                      <span>CSS Filters</span>
                      <input
                        type="text"
                        value={(currentStyle as any).hoverCssFilters || ""}
                        placeholder="brightness(1.1) contrast(1.1)"
                        onChange={(e) =>
                          updateStyle({
                            hoverCssFilters: e.target.value,
                          } as any)
                        }
                      />
                    </label>
                  )}
                  <label className="setting-field">
                    <span>Overlay Opacity</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={(currentStyle as any).overlayOpacity ?? 0.35}
                      onChange={(e) =>
                        updateStyle({
                          overlayOpacity: Number(e.target.value),
                        } as any)
                      }
                    />
                  </label>
                </div>

                <div className="settings-section">
                  <h4 className="section-title">Border</h4>
                  <div className="button-group" style={{ marginBottom: 12 }}>
                    {(["normal", "hover"] as const).map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        className={borderStyleTab === tab ? "active" : ""}
                        onClick={() => setBorderStyleTab(tab)}
                      >
                        {tab === "normal" ? "Normal" : "Hover"}
                      </button>
                    ))}
                  </div>
                  <label className="setting-field">
                    <span>Border Type</span>
                    <select
                      value={currentStyle.borderStyle || "none"}
                      onChange={(e) =>
                        updateStyle({ borderStyle: e.target.value as any })
                      }
                    >
                      <option value="none">None</option>
                      <option value="solid">Solid</option>
                      <option value="double">Double</option>
                      <option value="dotted">Dotted</option>
                      <option value="dashed">Dashed</option>
                      <option value="groove">Groove</option>
                    </select>
                  </label>
                  {borderStyleTab === "normal" && (
                    <EdgeValuesEditor
                      label="Border Width (px)"
                      values={borderWidthEdges.map((edge) => ({
                        ...edge,
                        value:
                          currentStyle[edge.key] ?? currentStyle.borderWidth ?? 0,
                      }))}
                      linked={linkedBorderWidths}
                      onToggleLinked={() =>
                        setLinkedBorderWidths((value) => !value)
                      }
                      onChange={(key, value) =>
                        updateEdgeValue(
                          key,
                          value,
                          borderWidthEdges.map((edge) => edge.key),
                          linkedBorderWidths,
                        )
                      }
                    />
                  )}
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Border Color</span>
                      <input
                        type="color"
                        value={
                          borderStyleTab === "hover"
                            ? (currentStyle as any).hoverBorderColor ||
                              "#0c2f55"
                            : currentStyle.borderColor || "#e5e7eb"
                        }
                        onChange={(e) =>
                          updateStyle(
                            borderStyleTab === "hover"
                              ? ({ hoverBorderColor: e.target.value } as any)
                              : { borderColor: e.target.value },
                          )
                        }
                      />
                    </label>
                  </div>
                  {borderStyleTab === "normal" ? (
                    <EdgeValuesEditor
                      label="Border Radius (px)"
                      values={borderRadiusEdges.map((edge) => ({
                        ...edge,
                        value:
                          currentStyle[edge.key] ??
                          currentStyle.borderRadius ??
                          0,
                      }))}
                      linked={linkedBorderRadii}
                      onToggleLinked={() =>
                        setLinkedBorderRadii((value) => !value)
                      }
                      onChange={(key, value) =>
                        updateEdgeValue(
                          key,
                          value,
                          borderRadiusEdges.map((edge) => edge.key),
                          linkedBorderRadii,
                        )
                      }
                    />
                  ) : (
                    <label className="setting-field">
                      <span>Border Radius (px)</span>
                      <input
                        type="number"
                        min="0"
                        value={
                          (currentStyle as any).hoverBorderRadius ??
                          currentStyle.borderRadius ??
                          0
                        }
                        onChange={(e) =>
                          updateStyle({
                            hoverBorderRadius: Number(e.target.value),
                          } as any)
                        }
                      />
                    </label>
                  )}
                  <label className="setting-field">
                    <span>Box Shadow CSS</span>
                    <input
                      type="text"
                      value={
                        borderStyleTab === "hover"
                          ? (currentStyle as any).hoverBoxShadow || ""
                          : currentStyle.boxShadow || ""
                      }
                      placeholder="0 4px 18px rgba(0,0,0,.12)"
                      onChange={(e) =>
                        updateStyle(
                          borderStyleTab === "hover"
                            ? ({ hoverBoxShadow: e.target.value } as any)
                            : { boxShadow: e.target.value },
                        )
                      }
                    />
                  </label>
                </div>

                <div className="settings-section">
                  <h4 className="section-title">Shape Divider</h4>
                  {(["top", "bottom"] as const).map((side) => (
                    <div key={side} className="settings-group">
                      <div className="field-row">
                        <label className="setting-field">
                          <span>{side === "top" ? "Top" : "Bottom"} Shape</span>
                          <select
                            value={
                              (currentStyle as any)[
                                `shapeDivider${side}Type`
                              ] || "none"
                            }
                            onChange={(e) =>
                              updateStyle({
                                [`shapeDivider${side}Type`]: e.target.value,
                              } as any)
                            }
                          >
                            <option value="none">None</option>
                            <option value="triangle">Triangle</option>
                            <option value="tilt">Tilt</option>
                            <option value="curve">Curve</option>
                            <option value="wave">Wave</option>
                          </select>
                        </label>
                        <label className="setting-field">
                          <span>Height</span>
                          <input
                            type="number"
                            min="0"
                            value={
                              (currentStyle as any)[
                                `shapeDivider${side}Height`
                              ] ?? 50
                            }
                            onChange={(e) =>
                              updateStyle({
                                [`shapeDivider${side}Height`]: Number(
                                  e.target.value,
                                ),
                              } as any)
                            }
                          />
                        </label>
                      </div>
                      <label className="setting-field">
                        <span>
                          {side === "top" ? "Top" : "Bottom"} Shape Color
                        </span>
                        <input
                          type="color"
                          value={
                            (currentStyle as any)[`shapeDivider${side}Color`] ||
                            "#ffffff"
                          }
                          onChange={(e) =>
                            updateStyle({
                              [`shapeDivider${side}Color`]: e.target.value,
                            } as any)
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {isMenuWidget && (
                  <div className="settings-section">
                    <div
                      className="collapsible-header"
                      onClick={() => toggleSection("menuItemStyle")}
                    >
                      <span>
                        {openSections.menuItemStyle ? "▾" : "▸"} 🎨 Menu Item
                        Style
                      </span>
                    </div>
                    {openSections.menuItemStyle && (
                      <div className="collapsible-content">
                        <div
                          className="button-group"
                          style={{ marginBottom: 12 }}
                        >
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
                            className={
                              menuItemStyleTab === "hover" ? "active" : ""
                            }
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
                                <option value="line-through">
                                  Line Through
                                </option>
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
                          <input
                            type="text"
                            list="builder-google-font-families"
                            value={currentStyle.fontFamily || ""}
                            onChange={(e) =>
                              updateStyle({ fontFamily: e.target.value })
                            }
                            placeholder="Default or enter a Google Font name"
                          />
                          <datalist id="builder-google-font-families">
                            {[
                              "Inter",
                              "Roboto",
                              "Open Sans",
                              "Lato",
                              "Montserrat",
                              "Poppins",
                              "Oswald",
                              "Nunito",
                              "Playfair Display",
                              "Merriweather",
                              "Source Sans 3",
                              "Roboto Condensed",
                              "Arial",
                              "Georgia",
                              "Verdana",
                              "Tahoma",
                              "Trebuchet MS",
                              "Times New Roman",
                              "Courier New",
                              "System UI",
                              "DM Sans",
                              "Manrope",
                              "Work Sans",
                              "Rubik",
                              "Inter",
                              "Raleway",
                              "Ubuntu",
                              "Mulish",
                              "Barlow",
                              "Barlow Condensed",
                              "Karla",
                              "Figtree",
                              "Plus Jakarta Sans",
                              "DM Serif Display",
                              "Lora",
                              "Libre Baskerville",
                              "Cormorant Garamond",
                              "Bodoni Moda",
                              "Crimson Text",
                              "Playfair Display",
                              "Roboto Slab",
                              "Bitter",
                              "Zilla Slab",
                              "Space Grotesk",
                              "Space Mono",
                              "IBM Plex Sans",
                              "IBM Plex Serif",
                              "IBM Plex Mono",
                              "Fira Sans",
                              "Fira Code",
                              "Inconsolata",
                              "Overpass",
                              "Kanit",
                              "Outfit",
                              "Sora",
                              "Urbanist",
                              "Lexend",
                              "Josefin Sans",
                              "Quicksand",
                              "Comfortaa",
                              "Cabin",
                              "Archivo",
                              "Asap",
                              "Exo 2",
                              "Titillium Web",
                              "Noto Sans",
                              "Noto Serif",
                              "Noto Sans JP",
                              "PT Sans",
                              "PT Serif",
                              "Public Sans",
                              "Signika",
                              "Red Hat Display",
                              "Red Hat Text",
                              "Albert Sans",
                              "Alegreya",
                              "Alegreya Sans",
                              "Anton",
                              "Bebas Neue",
                              "Dosis",
                              "Heebo",
                              "Hind",
                              "Manjari",
                              "M PLUS 1",
                              "M PLUS Rounded 1c",
                              "Mukta",
                              "Nanum Gothic",
                              "Oxygen",
                              "Prompt",
                              "Sarabun",
                              "Tajawal",
                              "Varela Round",
                              "Yanone Kaffeesatz",
                              "Archivo Black",
                              "Barlow Semi Condensed",
                              "Chakra Petch",
                              "Josefin Slab",
                              "Libre Franklin",
                              "Newsreader",
                              "PT Sans Narrow",
                              "Roboto Mono",
                              "Roboto Serif",
                              "Source Code Pro",
                              "Source Serif 4",
                            ]
                              .concat(
                                (globals.fonts || []).map((font) => font.family),
                              )
                              .map((family) => (
                                <option key={family} value={family} />
                              ))}
                          </datalist>
                        </label>

                        <div className="field-row">
                          <label className="setting-field">
                            <span>Font Size (px)</span>
                            <input
                              type="number"
                              value={currentStyle.fontSize || 16}
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
                              value={currentStyle.fontWeight || 400}
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
                                {a === "left"
                                  ? "⬅"
                                  : a === "center"
                                    ? "↔"
                                    : a === "right"
                                      ? "➡"
                                      : "☰"}
                              </button>
                            ))}
                          </div>
                        </label>
                        <label className="setting-field">
                          <span>Text Transform</span>
                          <select
                            value={currentStyle.textTransform || "none"}
                            onChange={(e) =>
                              updateStyle({
                                textTransform: e.target.value as
                                  | "none"
                                  | "uppercase"
                                  | "lowercase"
                                  | "capitalize",
                              })
                            }
                          >
                            <option value="none">Default</option>
                            <option value="uppercase">UPPERCASE</option>
                            <option value="lowercase">lowercase</option>
                            <option value="capitalize">Capitalize</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </div>

                {/* ============ SIZE & DIMENSIONS ============ */}
                <div className="settings-section">
                  <div
                    className="collapsible-header"
                    onClick={() => toggleSection("sizeControl")}
                  >
                    <span>
                      {openSections.sizeControl ? "▾" : "▸"} 📐 Size &
                      Dimensions
                    </span>
                  </div>
                  {openSections.sizeControl && (
                    <div className="collapsible-content">
                      <div className="field-row">
                        <UnitInput
                          label="Width"
                          value={toUnitInputValue(currentStyle.width || "auto")}
                          onChange={(val) => updateStyle({ width: val })}
                        />
                        <UnitInput
                          label="Height"
                          value={toUnitInputValue(currentStyle.height || "auto")}
                          onChange={(val) => updateStyle({ height: val })}
                        />
                      </div>

                      <label className="setting-field">
                        <span>Element Alignment</span>
                        <select
                          value={(currentStyle as any).elementAlign || "left"}
                          onChange={(e) =>
                            updateStyle({
                              elementAlign: e.target.value,
                              horizontalAlign: e.target.value,
                              align: e.target.value,
                            } as any)
                          }
                        >
                          <option value="left">Left</option>
                          <option value="center">Center</option>
                          <option value="right">Right</option>
                        </select>
                      </label>

                      <div className="field-row">
                        <UnitInput
                          label="Min Width"
                          value={toUnitInputValue(currentStyle.minWidth)}
                          onChange={(val) => updateStyle({ minWidth: val })}
                        />
                        <UnitInput
                          label="Max Width"
                          value={toUnitInputValue(currentStyle.maxWidth)}
                          onChange={(val) => updateStyle({ maxWidth: val })}
                        />
                      </div>

                      <div className="field-row">
                        <UnitInput
                          label="Min Height"
                          value={toUnitInputValue(currentStyle.minHeight)}
                          onChange={(val) => updateStyle({ minHeight: val })}
                        />
                        <UnitInput
                          label="Max Height"
                          value={toUnitInputValue(currentStyle.maxHeight)}
                          onChange={(val) => updateStyle({ maxHeight: val })}
                        />
                      </div>

                      {(isImageWidget || widget.type === "site_logo") && (
                        <>
                          <label className="setting-field">
                            <span>Object Fit</span>
                            <select
                              value={currentStyle.objectFit || "contain"}
                              onChange={(e) =>
                                updateStyle({
                                  objectFit: e.target.value as any,
                                })
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
                              value={currentStyle.objectPosition || "center"}
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
                            <img
                              src={s.backgroundImage}
                              alt="Background preview"
                            />
                            <button
                              type="button"
                              className="remove-media-btn"
                              onClick={() =>
                                updateStyle({ backgroundImage: "" })
                              }
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
                              updateStyle({
                                hoverBackgroundColor: e.target.value,
                              })
                            }
                          />
                          <input
                            type="text"
                            value={s.hoverBackgroundColor || ""}
                            onChange={(e) =>
                              updateStyle({
                                hoverBackgroundColor: e.target.value,
                              })
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
                              updateStyle({
                                hoverScale: Number(e.target.value),
                              })
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
                              updateStyle({
                                hoverOpacity: Number(e.target.value),
                              })
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
                    <span>
                      {openSections.animation ? "▾" : "▸"} 🎬 Animation
                    </span>
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

                {/* ============ SPACING WITH CHAIN LINK ============ */}
                <div className="settings-section">
                  <div
                    className="collapsible-header"
                    onClick={() => toggleSection("spacing")}
                  >
                    <span>{openSections.spacing ? "▾" : "▸"} Spacing</span>
                  </div>
                  {openSections.spacing && (
                    <div className="collapsible-content">
                      <SpacingEditor
                        label="Padding"
                        spacing={rs?.padding || s.padding}
                        linked={linkedPadding}
                        onToggleLinked={() => setLinkedPadding((value) => !value)}
                        onChangeSide={(side, value) =>
                          updateSpacing("padding", side, value)
                        }
                        onChangeUnit={(unit) =>
                          updateSpacingUnit("padding", unit)
                        }
                      />
                      <SpacingEditor
                        label="Margin"
                        spacing={rs?.margin || s.margin}
                        linked={linkedMargin}
                        allowNegative
                        onToggleLinked={() => setLinkedMargin((value) => !value)}
                        onChangeSide={(side, value) =>
                          updateSpacing("margin", side, value)
                        }
                        onChangeUnit={(unit) => updateSpacingUnit("margin", unit)}
                      />
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
                            updateStyle({
                              borderRadius: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* ============================================ */}
        {/* ====== ADVANCED TAB =========== */}
        {/* ============================================ */}
        {activeTab === "advanced" && (
          <>
            <div className="settings-section">
              <h4 className="section-title">Background &amp; Overlay</h4>
              <label className="setting-field">
                <span>Background Color</span>
                <input
                  type="color"
                  value={currentStyle.backgroundColor || "#ffffff"}
                  onChange={(event) =>
                    updateStyle({ backgroundColor: event.target.value })
                  }
                />
              </label>
              <label className="setting-field">
                <span>Background Image URL</span>
                <input
                  type="url"
                  value={currentStyle.backgroundImage || ""}
                  placeholder="https://example.com/image.jpg"
                  onChange={(event) =>
                    updateStyle({ backgroundImage: event.target.value })
                  }
                />
              </label>
              <div className="field-row">
                <label className="setting-field">
                  <span>Overlay Color</span>
                  <input
                    type="color"
                    value={(currentStyle as any).overlayColor || "#000000"}
                    onChange={(event) =>
                      updateStyle({ overlayColor: event.target.value } as any)
                    }
                  />
                </label>
                <label className="setting-field">
                  <span>Overlay Opacity</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={(currentStyle as any).overlayOpacity ?? 0.35}
                    onChange={(event) =>
                      updateStyle({
                        overlayOpacity: Number(event.target.value),
                      } as any)
                    }
                  />
                </label>
              </div>
              <label className="setting-field">
                <span>Overlay Gradient CSS</span>
                <input
                  type="text"
                  value={(currentStyle as any).overlayGradient || ""}
                  placeholder="linear-gradient(...)"
                  onChange={(event) =>
                    updateStyle({ overlayGradient: event.target.value } as any)
                  }
                />
              </label>
            </div>
            <div className="settings-section">
              <h4 className="section-title">Border Sides &amp; Corners</h4>
              <div className="field-row">
                <label className="setting-field">
                  <span>Border Type</span>
                  <select
                    value={currentStyle.borderStyle || "solid"}
                    onChange={(event) =>
                      updateStyle({
                        borderStyle: event.target.value as WidgetStyle["borderStyle"],
                      })
                    }
                  >
                    <option value="none">None</option>
                    <option value="solid">Solid</option>
                    <option value="dashed">Dashed</option>
                    <option value="dotted">Dotted</option>
                    <option value="double">Double</option>
                  </select>
                </label>
                <label className="setting-field">
                  <span>Border Color</span>
                  <input
                    type="color"
                    value={currentStyle.borderColor || "#e5e7eb"}
                    onChange={(event) =>
                      updateStyle({ borderColor: event.target.value })
                    }
                  />
                </label>
              </div>
              <EdgeValuesEditor
                label="Border Width (px)"
                values={borderWidthEdges.map((edge) => ({
                  ...edge,
                  value: currentStyle[edge.key] ?? 0,
                }))}
                linked={linkedBorderWidths}
                onToggleLinked={() =>
                  setLinkedBorderWidths((value) => !value)
                }
                onChange={(key, value) =>
                  updateEdgeValue(
                    key,
                    value,
                    borderWidthEdges.map((edge) => edge.key),
                    linkedBorderWidths,
                  )
                }
              />
              <EdgeValuesEditor
                label="Border Radius (px)"
                values={borderRadiusEdges.map((edge) => ({
                  ...edge,
                  value: currentStyle[edge.key] ?? 0,
                }))}
                linked={linkedBorderRadii}
                onToggleLinked={() =>
                  setLinkedBorderRadii((value) => !value)
                }
                onChange={(key, value) =>
                  updateEdgeValue(
                    key,
                    value,
                    borderRadiusEdges.map((edge) => edge.key),
                    linkedBorderRadii,
                  )
                }
              />
            </div>
            {!isContainer && (
              <div className="settings-section">
                <h4 className="section-title">Layout</h4>
                <div className="field-row">
                  <label className="setting-field">
                    <span>Width</span>
                    <select
                      value={(currentStyle as any).widthMode || "default"}
                      onChange={(event) => {
                        const widthMode = event.target.value;
                        updateStyle({
                          widthMode,
                          width:
                            widthMode === "full"
                              ? "100%"
                              : widthMode === "inline"
                                ? "fit-content"
                                : widthMode === "custom"
                                  ? toUnitInputValue(currentStyle.width) || "400px"
                                  : undefined,
                        } as any);
                      }}
                    >
                      <option value="default">Default</option>
                      <option value="full">Full Width</option>
                      <option value="inline">Inline</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Order</span>
                    <NumberInput
                      value={(currentStyle as any).order ?? 0}
                      onChange={(value) => updateStyle({ order: value } as any)}
                    />
                  </label>
                </div>
                <div className="field-row">
                  <label className="setting-field">
                    <span>Align Self</span>
                    <select
                      value={(currentStyle as any).alignSelf || "auto"}
                      onChange={(event) =>
                        updateStyle({ alignSelf: event.target.value } as any)
                      }
                    >
                      <option value="auto">Default</option>
                      <option value="flex-start">Start</option>
                      <option value="center">Center</option>
                      <option value="flex-end">End</option>
                      <option value="stretch">Stretch</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Size / Flex Grow</span>
                    <NumberInput
                      min={0}
                      value={(currentStyle as any).flexGrow ?? 0}
                      onChange={(value) =>
                        updateStyle({ flexGrow: value } as any)
                      }
                    />
                  </label>
                </div>
                {((currentStyle as any).widthMode || "default") === "custom" && (
                  <UnitInput
                    label="Custom Width"
                    value={toUnitInputValue(currentStyle.width)}
                    onChange={(value) =>
                      updateStyle({ width: value, widthMode: "custom" } as any)
                    }
                  />
                )}
                <div className="field-row">
                  <UnitInput
                    label="Height"
                    value={toUnitInputValue(currentStyle.height)}
                    onChange={(value) => updateStyle({ height: value })}
                  />
                  <UnitInput
                    label="Min Height"
                    value={toUnitInputValue(currentStyle.minHeight)}
                    onChange={(value) => updateStyle({ minHeight: value })}
                  />
                </div>
                <div className="field-row">
                  <label className="setting-field">
                    <span>Position</span>
                    <select
                      value={currentStyle.position || "static"}
                      onChange={(event) =>
                        updateStyle({
                          position: event.target.value as WidgetStyle["position"],
                        })
                      }
                    >
                      <option value="static">Default</option>
                      <option value="relative">Relative</option>
                      <option value="absolute">Absolute</option>
                      <option value="fixed">Fixed</option>
                      <option value="sticky">Sticky</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Z-Index</span>
                    <NumberInput
                      value={currentStyle.zIndex ?? 0}
                      onChange={(value) => updateStyle({ zIndex: value })}
                    />
                  </label>
                </div>
                <SpacingEditor
                  label="Padding"
                  spacing={rs?.padding || s.padding}
                  linked={linkedPadding}
                  onToggleLinked={() => setLinkedPadding((value) => !value)}
                  onChangeSide={(side, value) =>
                    updateSpacing("padding", side, value)
                  }
                  onChangeUnit={(unit) => updateSpacingUnit("padding", unit)}
                />
                <SpacingEditor
                  label="Margin"
                  spacing={rs?.margin || s.margin}
                  linked={linkedMargin}
                  allowNegative
                  onToggleLinked={() => setLinkedMargin((value) => !value)}
                  onChangeSide={(side, value) =>
                    updateSpacing("margin", side, value)
                  }
                  onChangeUnit={(unit) => updateSpacingUnit("margin", unit)}
                />
              </div>
            )}
            {!isContainer && (
              <>
                <div className="settings-section">
                  <h4 className="section-title">Motion Effects</h4>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Sticky</span>
                      <select
                        value={currentStyle.sticky || "none"}
                        onChange={(event) =>
                          updateStyle({
                            sticky: event.target.value as WidgetStyle["sticky"],
                            position:
                              event.target.value === "none"
                                ? "static"
                                : "sticky",
                          })
                        }
                      >
                        <option value="none">None</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </label>
                    <label className="setting-field">
                      <span>Sticky Offset (px)</span>
                      <NumberInput
                        min={0}
                        value={currentStyle.stickyOffset ?? 0}
                        onChange={(value) =>
                          updateStyle({ stickyOffset: value })
                        }
                      />
                    </label>
                  </div>
                  <label className="setting-field">
                    <span>Entrance Animation</span>
                    <select
                      value={currentStyle.animation || "none"}
                      onChange={(event) =>
                        updateStyle({ animation: event.target.value })
                      }
                    >
                      <option value="none">None</option>
                      <option value="fadeIn">Fade In</option>
                      <option value="slideUp">Fade In Up</option>
                      <option value="slideDown">Fade In Down</option>
                      <option value="slideLeft">Fade In Left</option>
                      <option value="slideRight">Fade In Right</option>
                      <option value="zoomIn">Zoom In</option>
                      <option value="bounce">Bounce</option>
                      <option value="pulse">Pulse</option>
                    </select>
                  </label>
                </div>
                <div className="settings-section">
                  <h4 className="section-title">Transform</h4>
                  <div className="button-group" style={{ marginBottom: 12 }}>
                    {(["normal", "hover"] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        className={transformStyleTab === tab ? "active" : ""}
                        onClick={() => setTransformStyleTab(tab)}
                      >
                        {tab === "normal" ? "Normal" : "Hover"}
                      </button>
                    ))}
                  </div>
                  {transformStyleTab === "normal" ? (
                    <>
                      <div className="field-row">
                        <label className="setting-field">
                          <span>Rotate (deg)</span>
                          <NumberInput
                            value={(currentStyle as any).rotate ?? 0}
                            onChange={(value) =>
                              updateStyle({ rotate: value } as any)
                            }
                          />
                        </label>
                        <label className="setting-field">
                          <span>Scale</span>
                          <NumberInput
                            min={0}
                            step={0.1}
                            value={(currentStyle as any).scale ?? 1}
                            onChange={(value) =>
                              updateStyle({ scale: value } as any)
                            }
                          />
                        </label>
                      </div>
                      <div className="field-row">
                        <UnitInput
                          label="Translate X"
                          value={toUnitInputValue(
                            (currentStyle as any).translateX || "0px",
                          )}
                          onChange={(value) =>
                            updateStyle({ translateX: value } as any)
                          }
                        />
                        <UnitInput
                          label="Translate Y"
                          value={toUnitInputValue(
                            (currentStyle as any).translateY || "0px",
                          )}
                          onChange={(value) =>
                            updateStyle({ translateY: value } as any)
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field-row">
                        <label className="setting-field">
                          <span>Hover Rotate (deg)</span>
                          <NumberInput
                            value={(currentStyle as any).hoverRotate ?? 0}
                            onChange={(value) =>
                              updateStyle({ hoverRotate: value } as any)
                            }
                          />
                        </label>
                        <label className="setting-field">
                          <span>Hover Scale</span>
                          <NumberInput
                            min={0}
                            step={0.1}
                            value={currentStyle.hoverScale ?? 1}
                            onChange={(value) =>
                              updateStyle({ hoverScale: value })
                            }
                          />
                        </label>
                      </div>
                      <label className="setting-field">
                        <span>Hover Translate Y (px)</span>
                        <NumberInput
                          value={currentStyle.hoverTranslateY ?? 0}
                          onChange={(value) =>
                            updateStyle({ hoverTranslateY: value })
                          }
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="settings-section">
                  <h4 className="section-title">Mask</h4>
                  <label className="setting-field">
                    <span>Mask Shape</span>
                    <select
                      value={(currentStyle as any).maskShape || "none"}
                      onChange={(event) =>
                        updateStyle({ maskShape: event.target.value } as any)
                      }
                    >
                      <option value="none">None</option>
                      <option value="circle">Circle</option>
                      <option value="triangle">Triangle</option>
                      <option value="diamond">Diamond</option>
                      <option value="hexagon">Hexagon</option>
                    </select>
                  </label>
                </div>
              </>
            )}
            {isContainer ? (
              <>
                <div className="settings-section">
                  <h4 className="section-title">Layout</h4>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Width</span>
                      <select
                        value={(currentStyle as any).widthMode || "default"}
                        onChange={(e) =>
                          updateStyle({
                            widthMode: e.target.value,
                            width:
                              e.target.value === "full"
                                ? "100%"
                                : e.target.value === "inline"
                                  ? "fit-content"
                                  : e.target.value === "custom"
                                    ? currentStyle.width || "400px"
                                    : undefined,
                          } as any)
                        }
                      >
                        <option value="default">Default</option>
                        <option value="full">Full Width</option>
                        <option value="inline">Inline</option>
                        <option value="custom">Custom</option>
                      </select>
                    </label>
                    <label className="setting-field">
                      <span>Order</span>
                      <input
                        type="number"
                        value={(currentStyle as any).order ?? 0}
                        onChange={(e) =>
                          updateStyle({ order: Number(e.target.value) } as any)
                        }
                      />
                    </label>
                  </div>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Align Self</span>
                      <select
                        value={(currentStyle as any).alignSelf || "auto"}
                        onChange={(e) =>
                          updateStyle({ alignSelf: e.target.value } as any)
                        }
                      >
                        <option value="auto">Default</option>
                        <option value="flex-start">Start</option>
                        <option value="center">Center</option>
                        <option value="flex-end">End</option>
                        <option value="stretch">Stretch</option>
                      </select>
                    </label>
                    <label className="setting-field">
                      <span>Size / Flex Grow</span>
                      <input
                        type="number"
                        min="0"
                        value={(currentStyle as any).flexGrow ?? 0}
                        onChange={(e) =>
                          updateStyle({
                            flexGrow: Number(e.target.value),
                          } as any)
                        }
                      />
                    </label>
                  </div>
                  <div className="field-row">
                    <UnitInput
                      label="Custom Width"
                      value={toUnitInputValue(currentStyle.width)}
                      onChange={(val) =>
                        updateStyle({ width: val, widthMode: "custom" } as any)
                      }
                    />
                    <UnitInput
                      label="Min Height"
                      value={toUnitInputValue(currentStyle.minHeight)}
                      onChange={(val) => updateStyle({ minHeight: val })}
                    />
                  </div>
                  <SpacingEditor
                    label="Padding"
                    spacing={rs?.padding || s.padding}
                    linked={linkedPadding}
                    onToggleLinked={() => setLinkedPadding((value) => !value)}
                    onChangeSide={(side, value) =>
                      updateSpacing("padding", side, value)
                    }
                    onChangeUnit={(unit) => updateSpacingUnit("padding", unit)}
                  />
                  <SpacingEditor
                    label="Margin"
                    spacing={rs?.margin || s.margin}
                    linked={linkedMargin}
                    allowNegative
                    onToggleLinked={() => setLinkedMargin((value) => !value)}
                    onChangeSide={(side, value) =>
                      updateSpacing("margin", side, value)
                    }
                    onChangeUnit={(unit) => updateSpacingUnit("margin", unit)}
                  />
                </div>
                <div className="settings-section">
                  <h4 className="section-title">Motion Effects</h4>
                  <label className="setting-field">
                    <span>Scrolling Effect</span>
                    <select
                      value={(currentStyle as any).scrollingEffect || "none"}
                      onChange={(e) =>
                        updateStyle({ scrollingEffect: e.target.value } as any)
                      }
                    >
                      <option value="none">None</option>
                      <option value="fade">Fade</option>
                      <option value="translate">Vertical Scroll</option>
                      <option value="scale">Scale</option>
                      <option value="rotate">Rotate</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Mouse Effect</span>
                    <select
                      value={(currentStyle as any).mouseEffect || "none"}
                      onChange={(e) =>
                        updateStyle({ mouseEffect: e.target.value } as any)
                      }
                    >
                      <option value="none">None</option>
                      <option value="track">Mouse Track</option>
                      <option value="tilt">3D Tilt</option>
                    </select>
                  </label>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Sticky</span>
                      <select
                        value={(currentStyle as any).sticky || "none"}
                        onChange={(e) =>
                          updateStyle({ sticky: e.target.value } as any)
                        }
                      >
                        <option value="none">None</option>
                        <option value="top">Top</option>
                        <option value="bottom">Bottom</option>
                      </select>
                    </label>
                    <label className="setting-field">
                      <span>Entrance Animation</span>
                      <select
                        value={(currentStyle as any).animation || "none"}
                        onChange={(e) =>
                          updateStyle({ animation: e.target.value } as any)
                        }
                      >
                        <option value="none">None</option>
                        <option value="fadeIn">Fade In</option>
                        <option value="slideUp">Fade In Up</option>
                        <option value="slideDown">Fade In Down</option>
                        <option value="slideLeft">Fade In Left</option>
                        <option value="slideRight">Fade In Right</option>
                        <option value="zoomIn">Zoom In</option>
                        <option value="bounce">Bounce</option>
                        <option value="pulse">Pulse</option>
                      </select>
                    </label>
                  </div>
                  <div className="field-row">
                    <label className="setting-field">
                      <span>Duration (ms)</span>
                      <input
                        type="number"
                        min="0"
                        value={(currentStyle as any).animationDuration ?? 600}
                        onChange={(e) =>
                          updateStyle({
                            animationDuration: Number(e.target.value),
                          } as any)
                        }
                      />
                    </label>
                    <label className="setting-field">
                      <span>Delay (ms)</span>
                      <input
                        type="number"
                        min="0"
                        value={(currentStyle as any).animationDelay ?? 0}
                        onChange={(e) =>
                          updateStyle({
                            animationDelay: Number(e.target.value),
                          } as any)
                        }
                      />
                    </label>
                  </div>
                </div>
                <div className="settings-section">
                  <h4 className="section-title">Transform</h4>
                  <div className="button-group" style={{ marginBottom: 12 }}>
                    {(["normal", "hover"] as const).map((tab) => (
                      <button
                        type="button"
                        key={tab}
                        className={transformStyleTab === tab ? "active" : ""}
                        onClick={() => setTransformStyleTab(tab)}
                      >
                        {tab === "normal" ? "Normal" : "Hover"}
                      </button>
                    ))}
                  </div>
                  {transformStyleTab === "normal" ? (
                    <>
                      <div className="field-row">
                        <label className="setting-field">
                          <span>Rotate (deg)</span>
                          <input
                            type="number"
                            value={(currentStyle as any).rotate ?? 0}
                            onChange={(e) =>
                              updateStyle({
                                rotate: Number(e.target.value),
                              } as any)
                            }
                          />
                        </label>
                        <label className="setting-field">
                          <span>Scale</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={(currentStyle as any).scale ?? 1}
                            onChange={(e) =>
                              updateStyle({
                                scale: Number(e.target.value),
                              } as any)
                            }
                          />
                        </label>
                      </div>
                      <div className="field-row">
                        <UnitInput
                          label="Translate X"
                          value={(currentStyle as any).translateX || "0px"}
                          onChange={(val) =>
                            updateStyle({ translateX: val } as any)
                          }
                        />
                        <UnitInput
                          label="Translate Y"
                          value={(currentStyle as any).translateY || "0px"}
                          onChange={(val) =>
                            updateStyle({ translateY: val } as any)
                          }
                        />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="field-row">
                        <label className="setting-field">
                          <span>Hover Rotate (deg)</span>
                          <input
                            type="number"
                            value={(currentStyle as any).hoverRotate ?? 0}
                            onChange={(e) =>
                              updateStyle({
                                hoverRotate: Number(e.target.value),
                              } as any)
                            }
                          />
                        </label>
                        <label className="setting-field">
                          <span>Hover Scale</span>
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={(currentStyle as any).hoverScale ?? 1}
                            onChange={(e) =>
                              updateStyle({
                                hoverScale: Number(e.target.value),
                              } as any)
                            }
                          />
                        </label>
                      </div>
                      <UnitInput
                        label="Hover Translate Y"
                        value={`${(currentStyle as any).hoverTranslateY ?? 0}px`}
                        onChange={(val) =>
                          updateStyle({
                            hoverTranslateY: Number.parseFloat(val) || 0,
                          } as any)
                        }
                      />
                    </>
                  )}
                </div>
                <div className="settings-section">
                  <h4 className="section-title">Mask</h4>
                  <label className="setting-field">
                    <span>Mask Shape</span>
                    <select
                      value={(currentStyle as any).maskShape || "none"}
                      onChange={(e) =>
                        updateStyle({ maskShape: e.target.value } as any)
                      }
                    >
                      <option value="none">None</option>
                      <option value="circle">Circle</option>
                      <option value="triangle">Triangle</option>
                      <option value="diamond">Diamond</option>
                      <option value="hexagon">Hexagon</option>
                    </select>
                  </label>
                  <label className="setting-field">
                    <span>Mask Size</span>
                    <select
                      value={(currentStyle as any).maskSize || "cover"}
                      onChange={(e) =>
                        updateStyle({ maskSize: e.target.value } as any)
                      }
                    >
                      <option value="cover">Cover</option>
                      <option value="contain">Contain</option>
                      <option value="auto">Auto</option>
                    </select>
                  </label>
                </div>
                <div className="settings-section">
                  <h4 className="section-title">Responsive</h4>
                  {(["desktop", "tablet", "mobile"] as const).map((d) => (
                    <label className="checkbox-label" key={d}>
                      <input
                        type="checkbox"
                        checked={isHiddenOnDevice(d)}
                        onChange={() => toggleHideForDevice(d)}
                      />
                      <span>Hide on {d[0].toUpperCase() + d.slice(1)}</span>
                    </label>
                  ))}
                  <label className="setting-field">
                    <span>HTML Attributes (JSON)</span>
                    <textarea
                      value={(currentStyle as any).customAttributes || "{}"}
                      onChange={(e) =>
                        updateStyle({ customAttributes: e.target.value } as any)
                      }
                      placeholder='{"data-name":"value","aria-label":"Section"}'
                    />
                  </label>
                </div>
                <div className="settings-section">
                  <h4 className="section-title">Custom CSS</h4>
                  <label className="setting-field">
                    <span>CSS ID</span>
                    <input
                      type="text"
                      value={(s as any).cssId || ""}
                      onChange={(event) =>
                        updateStyle({ cssId: event.target.value } as any)
                      }
                    />
                  </label>
                  <label className="setting-field">
                    <span>CSS ID</span>
                    <input
                      type="text"
                      value={(currentStyle as any).cssId || ""}
                      onChange={(event) =>
                        updateStyle({ cssId: event.target.value } as any)
                      }
                    />
                  </label>
                  <label className="setting-field">
                    <span>CSS Classes</span>
                    <input
                      value={(currentStyle as any).customClasses || ""}
                      onChange={(e) =>
                        updateStyle({ customClasses: e.target.value } as any)
                      }
                      placeholder="my-section another-class"
                    />
                  </label>
                  <label className="setting-field">
                    <span>Custom CSS</span>
                    <textarea
                      rows={8}
                      value={(currentStyle as any).customCss || ""}
                      onChange={(e) =>
                        updateStyle({ customCss: e.target.value } as any)
                      }
                      placeholder="selector { color: red; }"
                    />
                  </label>
                </div>
              </>
            ) : (
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
                    💡 Hidden widgets don't appear on the selected device
                    (public page).
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
                  <label className="setting-field">
                    <span>Custom CSS</span>
                    <textarea
                      rows={6}
                      value={(currentStyle as any).customCss || ""}
                      onChange={(event) =>
                        updateStyle({ customCss: event.target.value } as any)
                      }
                      placeholder="selector { color: red; }"
                    />
                  </label>
                  <label className="setting-field">
                    <span>HTML Attributes (JSON)</span>
                    <textarea
                      value={(currentStyle as any).customAttributes || "{}"}
                      onChange={(event) =>
                        updateStyle({ customAttributes: event.target.value } as any)
                      }
                      placeholder='{"data-name":"value","aria-label":"Widget"}'
                    />
                  </label>
                </div>
              </>
            )}
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
        isOpen={iconListPickerOpen || iconBoxPickerOpen || iconWidgetPickerOpen}
        currentIcon={
          iconListPickerOpen
            ? iconListItemIndex === null
              ? undefined
              : widget.items?.[iconListItemIndex]?.icon
            : widget.type === "icon"
              ? widget.settings?.customIcon || widget.content
              : widget.content
        }
        currentImage={
          iconListPickerOpen && iconListItemIndex !== null
            ? widget.items?.[iconListItemIndex]?.image
            : widget.url
        }
        onClose={() => {
          setIconListPickerOpen(false);
          setIconBoxPickerOpen(false);
          setIconWidgetPickerOpen(false);
        }}
        onSelectIcon={(icon) => {
          if (iconListPickerOpen) {
            if (iconListItemIndex === null) return;
            const items = [...(widget.items || [])];
            const item = items[iconListItemIndex];
            if (!item) return;
            items[iconListItemIndex] = { ...item, icon, image: "", iconType: "icon" };
            onChangeItems(items);
          } else if (widget.type === "icon_box") {
            onChangeContent(icon);
            onChangeUrl("");
          } else {
            onChangeContent(
              ICON_LIBRARY.some((entry) => entry.name === icon) ? "" : icon,
            );
            onChangeUrl("");
            onChangeSettings({
              customIcon: ICON_LIBRARY.some((entry) => entry.name === icon)
                ? icon
                : null,
            });
          }
        }}
        onSelectImage={(image) => {
          if (iconListPickerOpen) {
            if (iconListItemIndex === null) return;
            const items = [...(widget.items || [])];
            const item = items[iconListItemIndex];
            if (!item) return;
            items[iconListItemIndex] = { ...item, icon: "", image, iconType: "image" };
            onChangeItems(items);
          } else {
            onChangeContent("");
            onChangeUrl(image);
            if (widget.type === "icon") onChangeSettings({ customIcon: null });
          }
        }}
        onClear={() => {
          if (iconListPickerOpen) {
            if (iconListItemIndex === null) return;
            const items = [...(widget.items || [])];
            const item = items[iconListItemIndex];
            if (!item) return;
            items[iconListItemIndex] = { ...item, icon: "", image: "", iconType: "text" };
            onChangeItems(items);
          } else {
            onChangeContent("");
            onChangeUrl("");
            if (widget.type === "icon") onChangeSettings({ customIcon: null });
          }
        }}
      />
    </div>
  );
};

export default SettingsPanel;