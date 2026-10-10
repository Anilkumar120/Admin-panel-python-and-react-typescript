
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaLinkedinIn,
  FaWhatsapp,
  FaTelegramPlane,
  FaPinterestP,
  FaGithub,
  FaTwitter,
  FaHome,
  FaUser,
  FaSearch,
  FaPhone,
  FaEnvelope,
  FaBars,
  FaStar,
  FaHeart,
  FaCheck,
  FaArrowRight,
  FaGlobe,
  FaMapMarkerAlt,
  FaCalendar,
  FaClock,
  FaShoppingCart,
} from "react-icons/fa";

interface Props {
  element: any;
  selectedId: string | null;
  menus?: any[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMove?: (activeId: string, overId: string) => void;
  onAddElement: (type: string, parentId?: string | null) => void;
}

const STRUCTURE_ELEMENTS = ["container", "row", "column", "block"];

const canHaveChildren = (type: string) =>
  STRUCTURE_ELEMENTS.includes(type);

const SortableElement = ({
  element,
  selectedId,
  menus = [],
  onSelect,
  onDelete,
  onAddElement,
}: Props) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: String(element.id) });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isSelected = String(selectedId) === String(element.id);
  const isStructure = canHaveChildren(element.type);
  const children = Array.isArray(element.children) ? element.children : [];

  const handleChildDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();

    const type = event.dataTransfer.getData("application/hf-element");
    if (!type) return;

    onAddElement(type, String(element.id));
  };

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onSelect(String(element.id));
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isSelected
          ? "hf-sortable-element selected"
          : "hf-sortable-element"
      }
      onClick={handleClick}
      {...attributes}
    >
      <div className="hf-element-toolbar">
        <button
          type="button"
          className="hf-drag-handle"
          {...listeners}
          title="Drag"
        >
          ⋮⋮
        </button>

        <span className="hf-element-type">{element.type}</span>

        <div className="hf-element-toolbar-actions">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDelete(String(element.id));
            }}
            title="Delete"
          >
            ×
          </button>
        </div>
      </div>

      {isStructure ? (
        <div
          className={`hf-structure-element hf-structure-${element.type}`}
          style={getStructureStyle(element)}
        >
          <div className="hf-structure-label">
            {getStructureLabel(element.type)}
          </div>

          <SortableContext
            items={children.map((child: any) => String(child.id))}
            strategy={verticalListSortingStrategy}
          >
            <div
              className={
                children.length === 0
                  ? "hf-child-drop-zone empty"
                  : "hf-child-drop-zone"
              }
              onDragOver={(event) => {
                event.preventDefault();
                event.stopPropagation();
                event.dataTransfer.dropEffect = "copy";
              }}
              onDrop={handleChildDrop}
            >
              {children.length === 0 && (
                <div className="hf-drop-placeholder">
                  <strong>Drop Element Here</strong>
                  <span>
                    Drag Image, Text, Heading, Button or any element here
                  </span>
                </div>
              )}

              {children.map((child: any) => (
                <SortableElement
                  key={String(child.id)}
                  element={child}
                  selectedId={selectedId}
                  menus={menus}
                  onSelect={onSelect}
                  onDelete={onDelete}
                  onAddElement={onAddElement}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      ) : (
        <ElementPreview element={element} menus={menus} />
      )}
    </div>
  );
};

const getStructureLabel = (type: string) => {
  switch (type) {
    case "container":
      return "Container";
    case "row":
      return "Row";
    case "column":
      return "Column";
    case "block":
      return "Block";
    default:
      return "Structure";
  }
};

const getStructureStyle = (element: any): React.CSSProperties => {
  const settings = element.settings || {};

  if (element.type === "row") {
    return {
      display: "flex",
      flexDirection: settings.direction || "row",
      gap: `${settings.gap ?? 20}px`,
      alignItems: settings.align || "stretch",
      justifyContent: settings.justify || "flex-start",
      flexWrap: settings.wrap === false ? "nowrap" : "wrap",
    };
  }

  if (element.type === "column") {
    return {
      width: `${settings.width ?? 100}%`,
      minHeight: `${settings.minHeight ?? 80}px`,
      padding: `${settings.paddingTop ?? 10}px ${
        settings.paddingRight ?? 10
      }px ${settings.paddingBottom ?? 10}px ${
        settings.paddingLeft ?? 10
      }px`,
      background: settings.background || "transparent",
    };
  }

  if (element.type === "container") {
    return {
      width: settings.width || "100%",
      display: "flex",
      flexDirection: settings.direction || "column",
      gap: `${settings.gap ?? 20}px`,
      padding: `${settings.paddingTop ?? 20}px ${
        settings.paddingRight ?? 20
      }px ${settings.paddingBottom ?? 20}px ${
        settings.paddingLeft ?? 20
      }px`,
      background: settings.background || "transparent",
    };
  }

  return {
    width: settings.width || "100%",
    display: "flex",
    flexDirection: "column",
    gap: `${settings.gap ?? 10}px`,
    padding: `${settings.paddingTop ?? 10}px ${
      settings.paddingRight ?? 10
    }px ${settings.paddingBottom ?? 10}px ${
      settings.paddingLeft ?? 10
    }px`,
    background: settings.background || "transparent",
  };
};

const ElementPreview = ({
  element,
  menus,
}: {
  element: any;
  menus: any[];
}) => {
  const settings = element.settings || {};

  switch (element.type) {
    case "logo":
      return (
        <div className="hf-preview-logo" style={{ textAlign: "left" }}>
          {settings.src ? (
            <img
              src={getMediaUrl(settings.src)}
              alt="Logo"
              style={{
                width: `${settings.width || 150}px`,
                maxWidth: "100%",
                objectFit: "contain",
              }}
            />
          ) : (
            <div className="hf-preview-placeholder">Logo</div>
          )}
        </div>
      );

    case "heading": {
      const HeadingTag = settings.tag || "h2";

      return (
        <HeadingTag
          style={{
            fontSize: `${settings.fontSize || 28}px`,
            color: settings.color || "#222222",
            textAlign: settings.align || "left",
            marginTop: `${settings.marginTop ?? 0}px`,
            marginBottom: `${settings.marginBottom ?? 10}px`,
          }}
        >
          {settings.text || "Your Heading"}
        </HeadingTag>
      );
    }

    case "text":
      return (
        <div
          style={{
            fontSize: `${settings.fontSize || 16}px`,
            color: settings.color || "#333333",
            textAlign: settings.align || "left",
            lineHeight: settings.lineHeight || 1.6,
          }}
          dangerouslySetInnerHTML={{
            __html: settings.text || "<p>Your text goes here...</p>",
          }}
        />
      );

    case "button":
      return (
        <div style={{ textAlign: settings.align || "left" }}>
          <span
            style={{
              display: "inline-block",
              background: settings.background || "#0c2f55",
              color: settings.color || "#ffffff",
              fontSize: `${settings.fontSize || 16}px`,
              padding: `${settings.paddingTop ?? 10}px ${
                settings.paddingRight ?? 20
              }px ${settings.paddingBottom ?? 10}px ${
                settings.paddingLeft ?? 20
              }px`,
              borderRadius: `${settings.borderRadius ?? 5}px`,
            }}
          >
            {settings.text || "Click Here"}
          </span>
        </div>
      );

    case "image":
      return settings.src ? (
        <img
          src={getMediaUrl(settings.src)}
          alt={settings.alt || ""}
          style={{
            width: `${settings.width || 300}px`,
            maxWidth: "100%",
            height: "auto",
            display: "block",
          }}
        />
      ) : (
        <div className="hf-preview-placeholder">Image</div>
      );

    case "icon":
      return (
        <IconPreview
          icon={settings.icon || "home"}
          size={settings.size || 30}
          color={settings.color || "#0c2f55"}
        />
      );

    case "social":
      return (
        <div
          style={{
            display: "flex",
            gap: `${settings.gap ?? 10}px`,
            justifyContent:
              settings.align === "center"
                ? "center"
                : settings.align === "right"
                  ? "flex-end"
                  : "flex-start",
          }}
        >
          {(settings.items || []).map((item: any, index: number) => (
            <SocialIcon
              key={item.id ?? `${item.platform}-${index}`}
              platform={item.platform}
              size={settings.size || 30}
              color={item.color || settings.color || "#0c2f55"}
            />
          ))}
        </div>
      );

    case "search":
      return (
        <div style={{ width: `${settings.width || 250}px`, maxWidth: "100%" }}>
          <div
            style={{
              height: `${settings.height || 40}px`,
              border: "1px solid #ddd",
              display: "flex",
              alignItems: "center",
              padding: "0 12px",
              color: "#888",
              borderRadius: "4px",
            }}
          >
            <FaSearch style={{ marginRight: "8px" }} />
            {settings.placeholder || "Search..."}
          </div>
        </div>
      );

    case "divider":
      return (
        <div style={{ width: `${settings.width || 100}%` }}>
          <div
            style={{
              borderTop: `${settings.thickness || 1}px ${
                settings.style || "solid"
              } ${settings.color || "#ddd"}`,
            }}
          />
        </div>
      );

    case "spacer":
      return <div style={{ height: `${settings.height || 30}px` }} />;

    case "html":
      return (
        <div
          dangerouslySetInnerHTML={{
            __html: settings.html || "<div>Custom HTML</div>",
          }}
        />
      );

    case "menu":
      return <MenuPreview settings={settings} menus={menus} />;

    default:
      return (
        <div className="hf-preview-placeholder">
          {element.type}
        </div>
      );
  }
};

const getMediaUrl = (src: string): string => {
  if (!src || /^https?:\/\//i.test(src)) return src;

  const base = String(import.meta.env.VITE_API_URL || "").replace(/\/$/, "");
  return `${base}${src.startsWith("/") ? "" : "/"}${src}`;
};

const IconPreview = ({
  icon,
  size,
  color,
}: {
  icon: string;
  size: number;
  color: string;
}) => {
  const icons: Record<string, any> = {
    home: FaHome,
    user: FaUser,
    search: FaSearch,
    phone: FaPhone,
    envelope: FaEnvelope,
    bars: FaBars,
    star: FaStar,
    heart: FaHeart,
    check: FaCheck,
    arrowRight: FaArrowRight,
    globe: FaGlobe,
    location: FaMapMarkerAlt,
    calendar: FaCalendar,
    clock: FaClock,
    cart: FaShoppingCart,
  };

  const Icon = icons[icon] || FaStar;
  return <Icon size={size} color={color} />;
};

const SocialIcon = ({
  platform,
  size,
  color,
}: {
  platform: string;
  size: number;
  color: string;
}) => {
  const icons: Record<string, any> = {
    facebook: FaFacebookF,
    instagram: FaInstagram,
    youtube: FaYoutube,
    linkedin: FaLinkedinIn,
    whatsapp: FaWhatsapp,
    telegram: FaTelegramPlane,
    pinterest: FaPinterestP,
    github: FaGithub,
    twitter: FaTwitter,
  };

  const Icon = icons[platform] || FaGlobe;

  return (
    <span
      style={{
        width: `${size}px`,
        height: `${size}px`,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        border: `1px solid ${color}`,
        borderRadius: "50%",
      }}
    >
      <Icon />
    </span>
  );
};

// Normalize IDs and parent IDs because the API may return numbers or strings.
const normalizeId = (value: any): string | null => {
  if (value === undefined || value === null || value === "" || value === 0 || value === "0") {
    return null;
  }

  return String(value);
};

const getMenuId = (menu: any): string =>
  String(menu?.id ?? menu?._id ?? menu?.menu_id ?? "");

const getItemId = (item: any): string =>
  String(item?.id ?? item?._id ?? item?.item_id ?? "");

const getParentId = (item: any): string | null =>
  normalizeId(item?.parent_id ?? item?.parentId ?? item?.parent);

const MenuPreview = ({
  settings,
  menus,
}: {
  settings: any;
  menus: any[];
}) => {
  const selectedMenuId = String(settings.menuId ?? "");

  const menu = menus.find(
    (item: any) => getMenuId(item) === selectedMenuId
  );

  if (!selectedMenuId) {
    return (
      <div className="hf-preview-placeholder">
        Select a menu in Element Settings
      </div>
    );
  }

  if (!menu) {
    return (
      <div className="hf-preview-placeholder">
        Selected menu not found. Refresh the menu list and select it again.
      </div>
    );
  }

  const items = Array.isArray(menu.items)
    ? menu.items
    : Array.isArray(menu.menu_items)
      ? menu.menu_items
      : Array.isArray(menu.menuItems)
        ? menu.menuItems
        : [];

  if (items.length === 0) {
    return (
      <div className="hf-preview-placeholder">
        This menu has no items.
      </div>
    );
  }

  const itemsWithIds = items.map((item: any, index: number) => ({
    ...item,
    __normalizedId: getItemId(item) || `menu-item-${index}`,
    __normalizedParentId: getParentId(item),
  }));

  const allIds = new Set(
    itemsWithIds.map((item: any) => item.__normalizedId)
  );

  const buildTree = (
    parentId: string | null,
    ancestors: Set<string> = new Set()
  ): any[] => {
    return itemsWithIds
      .filter((item: any) => {
        const itemParent = item.__normalizedParentId;

        // Null, empty, and "0" parent values indicate a root item.
        if (parentId === null) return itemParent === null;

        return itemParent === parentId;
      })
      .filter((item: any) => !ancestors.has(item.__normalizedId))
      .map((item: any) => {
        const nextAncestors = new Set(ancestors);
        nextAncestors.add(item.__normalizedId);

        return {
          ...item,
          children: buildTree(item.__normalizedId, nextAncestors),
        };
      });
  };

  let tree = buildTree(null);

  // If the API has a non-standard parent reference, still show the menu items.
  if (tree.length === 0) {
    tree = itemsWithIds.map((item: any) => ({
      ...item,
      children: [],
    }));
  } else {
    // Orphan items whose parent ID does not exist are shown as root items.
    const rootIds = new Set(
      tree.map((item: any) => item.__normalizedId)
    );

    const orphanItems = itemsWithIds.filter(
      (item: any) =>
        item.__normalizedParentId !== null &&
        !allIds.has(item.__normalizedParentId)
    );

    if (orphanItems.length > 0) {
      tree = [
        ...tree,
        ...orphanItems
          .filter((item: any) => !rootIds.has(item.__normalizedId))
          .map((item: any) => ({ ...item, children: [] })),
      ];
    }
  }

  return (
    <div
      className={
        settings.layout === "vertical"
          ? "hf-menu-preview hf-menu-preview-vertical"
          : "hf-menu-preview hf-menu-preview-horizontal"
      }
      style={{
        display: "flex",
        flexDirection: settings.layout === "vertical" ? "column" : "row",
        flexWrap: "wrap",
        alignItems: "center",
        gap: `${settings.itemGap ?? 25}px`,
        fontSize: `${settings.fontSize || 16}px`,
        color: settings.textColor || "#222222",
        background: settings.backgroundColor || "transparent",
      }}
    >
      {tree.map((item: any) => (
        <MenuPreviewItem
          key={item.__normalizedId}
          item={item}
          settings={settings}
        />
      ))}
    </div>
  );
};

const MenuPreviewItem = ({
  item,
  settings,
}: {
  item: any;
  settings: any;
}) => {
  const children = Array.isArray(item.children) ? item.children : [];
  const hasChildren = children.length > 0;
  const label = item.label ?? item.title ?? item.name ?? "Menu item";

  return (
    <div
      className={
        hasChildren
          ? "hf-menu-preview-item has-submenu"
          : "hf-menu-preview-item"
      }
      style={{ position: "relative" }}
    >
      <div
        className="hf-menu-preview-label"
        style={{
          color: settings.textColor || "#222222",
          cursor: "default",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          whiteSpace: "nowrap",
        }}
      >
        <span>{label}</span>
        {hasChildren && <span className="hf-menu-arrow">▾</span>}
      </div>

      {hasChildren && (
        <div className="hf-submenu-dropdown">
          {children.map((child: any) => (
            <MenuPreviewItem
              key={child.__normalizedId}
              item={child}
              settings={settings}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default SortableElement;
