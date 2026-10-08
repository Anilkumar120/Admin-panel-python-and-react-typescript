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

  menus: any[];

  onSelect: (id: string) => void;

  onDelete: (id: string) => void;

  onAddElement: (type: string, parentId?: string | null) => void;
}

const STRUCTURE_ELEMENTS = ["container", "row", "column", "block"];

const canHaveChildren = (type: string) => {
  return STRUCTURE_ELEMENTS.includes(type);
};

const SortableElement = ({
  element,
  selectedId,
  menus,
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
  } = useSortable({
    id: element.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),

    transition,

    opacity: isDragging ? 0.5 : 1,
  };

  const isSelected = selectedId === element.id;

  const isStructure = canHaveChildren(element.type);

  const children = element.children || [];

  const handleChildDrop = (event: React.DragEvent) => {
    event.preventDefault();

    event.stopPropagation();

    const type = event.dataTransfer.getData("application/hf-element");

    if (!type) {
      return;
    }

    onAddElement(type, element.id);
  };

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();

    onSelect(element.id);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isSelected ? "hf-sortable-element selected" : "hf-sortable-element"
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

              onDelete(element.id);
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
            items={children.map((child: any) => child.id)}
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
                  key={child.id}
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

const getStructureStyle = (element: any) => {
  const settings = element.settings || {};

  if (element.type === "row") {
    return {
      display: "flex",

      flexDirection: settings.direction || "row",

      gap: `${settings.gap ?? 20}px`,

      alignItems: settings.align || "stretch",

      justifyContent: settings.justify || "flex-start",

      flexWrap: settings.wrap === false ? "nowrap" : "wrap",
    } as React.CSSProperties;
  }

  if (element.type === "column") {
    return {
      width: `${settings.width ?? 100}%`,

      minHeight: `${settings.minHeight ?? 80}px`,

      padding: `${settings.paddingTop ?? 10}px ${
        settings.paddingRight ?? 10
      }px ${settings.paddingBottom ?? 10}px ${settings.paddingLeft ?? 10}px`,

      background:
        settings.background === "transparent"
          ? "transparent"
          : settings.background || "transparent",
    } as React.CSSProperties;
  }

  if (element.type === "container") {
    return {
      width: settings.width || "100%",

      display: "flex",

      flexDirection: settings.direction || "column",

      gap: `${settings.gap ?? 20}px`,

      padding: `${settings.paddingTop ?? 20}px ${
        settings.paddingRight ?? 20
      }px ${settings.paddingBottom ?? 20}px ${settings.paddingLeft ?? 20}px`,

      background:
        settings.background === "transparent"
          ? "transparent"
          : settings.background || "transparent",
    } as React.CSSProperties;
  }

  return {
    width: settings.width || "100%",

    display: "flex",

    flexDirection: "column",

    gap: `${settings.gap ?? 10}px`,

    padding: `${settings.paddingTop ?? 10}px ${settings.paddingRight ?? 10}px ${
      settings.paddingBottom ?? 10
    }px ${settings.paddingLeft ?? 10}px`,

    background:
      settings.background === "transparent"
        ? "transparent"
        : settings.background || "transparent",
  } as React.CSSProperties;
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
    case "logo": {
      return (
        <div
          className="hf-preview-logo"
          style={{
            textAlign: "left",
          }}
        >
          {settings.src ? (
            <img
              src={
                settings.src.startsWith("http")
                  ? settings.src
                  : `${import.meta.env.VITE_API_URL}${settings.src}`
              }
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
    }

    case "heading": {
      const HeadingTag = settings.tag || "h2";

      return (
        <HeadingTag
          style={{
            fontSize: `${settings.fontSize || 28}px`,

            color: settings.color || "#222222",

            textAlign: settings.align || "left",

            marginTop: `${settings.marginTop || 0}px`,

            marginBottom: `${settings.marginBottom || 10}px`,
          }}
        >
          {settings.text || "Your Heading"}
        </HeadingTag>
      );
    }

    case "text": {
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
    }

    case "button": {
      return (
        <div
          style={{
            textAlign: settings.align || "left",
          }}
        >
          <span
            style={{
              display: "inline-block",

              background: settings.background || "#0c2f55",

              color: settings.color || "#ffffff",

              fontSize: `${settings.fontSize || 16}px`,

              padding: `${settings.paddingTop || 10}px ${
                settings.paddingRight || 20
              }px ${settings.paddingBottom || 10}px ${
                settings.paddingLeft || 20
              }px`,

              borderRadius: `${settings.borderRadius || 5}px`,
            }}
          >
            {settings.text || "Click Here"}
          </span>
        </div>
      );
    }

    case "image": {
      return (
        <div>
          {settings.src ? (
            <img
              src={
                settings.src.startsWith("http")
                  ? settings.src
                  : `${import.meta.env.VITE_API_URL}${settings.src}`
              }
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
          )}
        </div>
      );
    }

    case "icon": {
      return (
        <IconPreview
          icon={settings.icon || "home"}
          size={settings.size || 30}
          color={settings.color || "#0c2f55"}
        />
      );
    }

    case "social": {
      return (
        <div
          style={{
            display: "flex",

            gap: `${settings.gap || 10}px`,

            justifyContent:
              settings.align === "center"
                ? "center"
                : settings.align === "right"
                  ? "flex-end"
                  : "flex-start",
          }}
        >
          {(settings.items || []).map((item: any) => (
            <SocialIcon
              key={item.id}
              platform={item.platform}
              size={settings.size || 30}
              color={item.color || settings.color || "#0c2f55"}
            />
          ))}
        </div>
      );
    }

    case "search": {
      return (
        <div
          style={{
            width: `${settings.width || 250}px`,

            maxWidth: "100%",
          }}
        >
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
            <FaSearch
              style={{
                marginRight: "8px",
              }}
            />

            {settings.placeholder || "Search..."}
          </div>
        </div>
      );
    }

    case "divider": {
      return (
        <div
          style={{
            width: `${settings.width || 100}%`,
          }}
        >
          <div
            style={{
              borderTop: `${settings.thickness || 1}px ${
                settings.style || "solid"
              } ${settings.color || "#ddd"}`,
            }}
          />
        </div>
      );
    }

    case "spacer": {
      return (
        <div
          style={{
            height: `${settings.height || 30}px`,
          }}
        />
      );
    }

    case "html": {
      return (
        <div
          dangerouslySetInnerHTML={{
            __html: settings.html || "<div>Custom HTML</div>",
          }}
        />
      );
    }

    case "menu": {
      return <MenuPreview settings={settings} menus={menus} />;
    }

    default:
      return <div className="hf-preview-placeholder">{element.type}</div>;
  }
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
  const icons: any = {
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
  const icons: any = {
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

const MenuPreview = ({
  settings,
  menus,
}: {
  settings: any;

  menus: any[];
}) => {
  const menu = menus.find((item: any) => item.id === settings.menuId);

  if (!menu) {
    return <div className="hf-preview-placeholder">Select Menu</div>;
  }

  const items = Array.isArray(menu.items) ? menu.items : [];

  const buildTree = (parentId: string | null): any[] => {
    return items
      .filter((item: any) => (item.parent_id || null) === parentId)
      .map((item: any) => ({
        ...item,

        children: buildTree(item.id),
      }));
  };

  const tree = buildTree(null);

  return (
    <div
      className={
        settings.layout === "vertical"
          ? "hf-menu-preview hf-menu-preview-vertical"
          : "hf-menu-preview hf-menu-preview-horizontal"
      }
      style={{
        fontSize: `${settings.fontSize || 16}px`,

        color: settings.textColor || "#222222",

        background: settings.backgroundColor || "transparent",
      }}
    >
      {tree.map((item: any) => (
        <MenuPreviewItem key={item.id} item={item} settings={settings} />
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
  const children = item.children || [];

  const hasChildren = children.length > 0;

  return (
    <div
      className={
        hasChildren
          ? "hf-menu-preview-item has-submenu"
          : "hf-menu-preview-item"
      }
    >
      <div
        className="hf-menu-preview-label"
        style={{
          color: settings.textColor || "#222222",
        }}
      >
        <span>{item.label || item.title}</span>

        {hasChildren && <span className="hf-menu-arrow">▾</span>}
      </div>

      {hasChildren && (
        <div className="hf-submenu-dropdown">
          {children.map((child: any) => (
            <MenuPreviewItem key={child.id} item={child} settings={settings} />
          ))}
        </div>
      )}
    </div>
  );
};

export default SortableElement;
