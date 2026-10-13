import type { PageWidget, ResponsiveDevice } from "../../types/pageBuilder";

interface WidgetContentProps {
  widget: PageWidget;
  device: ResponsiveDevice;
  isEditMode?: boolean;
  onOpenMedia?: () => void;
}

const WidgetContent = ({
  widget,
  device,
  isEditMode = true,
  onOpenMedia,
}: WidgetContentProps) => {
  const s = widget.style;
  const rs = s.responsive?.[device] || {};

  const fontSize = rs.fontSize ?? s.fontSize ?? 16;
  const textAlign = rs.textAlign ?? s.textAlign ?? "left";
  const color = rs.color ?? s.color ?? "#1a1a2e";
  const bgColor = rs.backgroundColor ?? s.backgroundColor;

  const baseStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    textAlign: textAlign as any,
    color: color,
    fontFamily: s.fontFamily || "inherit",
    fontWeight: s.fontWeight || 400,
    fontStyle: s.fontStyle || "normal",
    lineHeight: s.lineHeight || 1.5,
    letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
    textTransform: (s.textTransform as any) || undefined,
    textDecoration: s.textDecoration || undefined,
    textShadow: s.textShadow || undefined,
  };

  // Helper for empty widget state
  const EmptyState = ({
    icon,
    title,
    subtitle,
    actionLabel,
    onAction,
  }: {
    icon: string;
    title: string;
    subtitle?: string;
    actionLabel?: string;
    onAction?: () => void;
  }) => (
    <div className="widget-empty-state">
      <div className="widget-empty-icon">{icon}</div>
      <div className="widget-empty-title">{title}</div>
      {subtitle && <div className="widget-empty-subtitle">{subtitle}</div>}
      {actionLabel && onAction && (
        <button
          type="button"
          className="widget-empty-action"
          onClick={(e) => {
            e.stopPropagation();
            onAction();
          }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );

  switch (widget.type) {
    // ===== BASIC =====
    case "heading":
      return (
        <h2 style={{ ...baseStyle, margin: 0, padding: 0 }}>
          {widget.content || "Heading"}
        </h2>
      );

    case "text":
      return (
        <p style={{ ...baseStyle, margin: 0, padding: 0 }}>
          {widget.content || "Add your text here..."}
        </p>
      );

    case "button":
      return (
        <span
          style={{
            ...baseStyle,
            backgroundColor: bgColor || "#0c2f55",
            color: color || "#ffffff",
            padding: "12px 24px",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "6px",
            display: "inline-block",
            fontWeight: s.fontWeight || 600,
            cursor: "pointer",
          }}
        >
          {widget.content || "Click Here"}
        </span>
      );

    // ===== IMAGE =====
    case "image":
      return widget.url ? (
        <div className="widget-image-wrapper">
          <img
            src={widget.url}
            alt={widget.accessibility?.altText || widget.label}
            style={{
              width: "100%",
              display: "block",
              borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
            }}
          />
          {isEditMode && onOpenMedia && (
            <button
              type="button"
              className="widget-image-change-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMedia();
              }}
            >
              🔄 Change Image
            </button>
          )}
        </div>
      ) : (
        <EmptyState
          icon="🖼"
          title="Select an Image"
          subtitle="Click below to choose from Media Library"
          actionLabel="📁 Choose Image"
          onAction={onOpenMedia}
        />
      );

    // ===== VIDEO =====
    case "video":
      return widget.url ? (
        <div
          style={{
            position: "relative",
            paddingBottom: "56.25%",
            height: 0,
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
            overflow: "hidden",
          }}
        >
          <iframe
            src={widget.url}
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              border: "none",
            }}
            allowFullScreen
          />
        </div>
      ) : (
        <EmptyState
          icon="🎬"
          title="Add a Video"
          subtitle="YouTube, Vimeo, or MP4 URL"
          actionLabel="📁 Choose Video"
          onAction={onOpenMedia}
        />
      );

    // ===== ICON =====
    case "icon":
      return (
        <div
          style={{
            fontSize: `${fontSize || 48}px`,
            textAlign: "center",
            color: color || "#0c2f55",
            lineHeight: 1,
            padding: 16,
          }}
        >
          {widget.content || "★"}
        </div>
      );

    // ===== ICON BOX =====
    case "icon_box":
      return (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color,
            backgroundColor: bgColor || "transparent",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
          }}
        >
          <div
            style={{
              fontSize: 48,
              marginBottom: 16,
              color: color || "#0c2f55",
            }}
          >
            {widget.content || "★"}
          </div>
          <h3 style={{ margin: "0 0 8px", fontSize: 20, color }}>
            {widget.settings?.items?.[0]?.title || "Feature Title"}
          </h3>
          <p style={{ margin: 0, color, fontSize: 14, opacity: 0.75 }}>
            {widget.settings?.items?.[0]?.content ||
              "Add feature description here."}
          </p>
        </div>
      );

    // ===== GALLERY =====
    case "gallery":
      return widget.settings?.images && widget.settings.images.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 8,
          }}
        >
          {widget.settings.images.map((img, i) => (
            <img
              key={img.id || i}
              src={img.url}
              alt={img.alt || ""}
              style={{
                width: "100%",
                height: 120,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🖼"
          title="Add Gallery Images"
          subtitle="Select multiple images from library"
          actionLabel="📁 Add Images"
          onAction={onOpenMedia}
        />
      );

    // ===== CAROUSEL / SLIDER =====
    case "carousel":
    case "slider":
      return widget.settings?.images && widget.settings.images.length > 0 ? (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 8,
            background: "#000",
          }}
        >
          <img
            src={widget.settings.images[0].url}
            alt=""
            style={{
              width: "100%",
              height: widget.type === "slider" ? 300 : 220,
              objectFit: "cover",
              display: "block",
              opacity: 0.85,
            }}
          />
          {/* Overlay title */}
          {widget.type === "slider" && (
            <div className="slider-preview-content">
              <h2>{widget.settings.images[0].title || "Slide 1"}</h2>
              <p>Banner slider preview</p>
            </div>
          )}
          {/* Dots */}
          <div className="slider-preview-dots">
            {widget.settings.images.slice(0, 5).map((_, i) => (
              <span
                key={i}
                className={i === 0 ? "dot active" : "dot"}
              />
            ))}
          </div>
          {/* Arrows */}
          <button className="slider-preview-arrow prev">‹</button>
          <button className="slider-preview-arrow next">›</button>
        </div>
      ) : (
        <EmptyState
          icon={widget.type === "slider" ? "🎞" : "🎠"}
          title={
            widget.type === "slider"
              ? "Add Slider Images"
              : "Add Carousel Images"
          }
          subtitle="Select multiple images for slideshow"
          actionLabel="📁 Add Images"
          onAction={onOpenMedia}
        />
      );

    // ===== SPACER =====
    case "spacer":
      return (
        <div
          style={{
            minHeight: `${s.padding?.top || 40}px`,
            background:
              "repeating-linear-gradient(45deg, #f3f5f8, #f3f5f8 6px, #e5e9ef 6px, #e5e9ef 12px)",
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#8a95a5",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          SPACER
        </div>
      );

    // ===== DIVIDER =====
    case "divider":
      return (
        <hr
          style={{
            borderColor: s.borderColor || "#e0e0e0",
            borderWidth: `${s.borderWidth || 1}px`,
            borderStyle: s.borderStyle || "solid",
            margin: "16px 0",
          }}
        />
      );

    // ===== ALERT =====
    case "alert":
      return (
        <div
          style={{
            padding: 16,
            background: bgColor || "#e8f4ff",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "6px",
            color: color || "#0c2f55",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 20 }}>ℹ</span>
          <span>{widget.content || "Important message goes here"}</span>
        </div>
      );

    // ===== ACCORDION =====
    case "accordion":
    case "toggle":
      return (widget.items || []).length > 0 ? (
        <div
          style={{
            border: "1px solid #e0e0e0",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          {widget.items?.map((item, i) => (
            <div
              key={item.id}
              style={{
                borderBottom:
                  i < (widget.items?.length || 0) - 1
                    ? "1px solid #e0e0e0"
                    : "none",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  fontWeight: 600,
                  background: "#f8f9fc",
                  display: "flex",
                  justifyContent: "space-between",
                }}
              >
                {item.title}
                <span>▾</span>
              </div>
              {i === 0 && (
                <div
                  style={{ padding: "12px 16px", color: "#666", fontSize: 14 }}
                >
                  {item.content}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="☰"
          title="Add Accordion Items"
          subtitle="Add items from Content tab"
        />
      );

    // ===== TABS =====
    case "tabs":
      return (widget.items || []).length > 0 ? (
        <div>
          <div
            style={{
              display: "flex",
              gap: 4,
              borderBottom: "1px solid #e0e0e0",
              marginBottom: 12,
            }}
          >
            {widget.items?.map((item, i) => (
              <div
                key={item.id}
                style={{
                  padding: "10px 20px",
                  fontWeight: i === 0 ? 700 : 500,
                  color: i === 0 ? "#0c2f55" : "#666",
                  borderBottom: i === 0 ? "2px solid #0c2f55" : "none",
                  cursor: "pointer",
                }}
              >
                {item.title}
              </div>
            ))}
          </div>
          <div style={{ padding: 12, color: "#666" }}>
            {widget.items?.[0]?.content}
          </div>
        </div>
      ) : (
        <EmptyState
          icon="▭"
          title="Add Tab Items"
          subtitle="Add tabs from Content tab"
        />
      );

    // ===== TESTIMONIAL =====
    case "testimonial":
      return (
        <div
          style={{
            background: bgColor || "#f8f9fc",
            padding: 32,
            borderRadius: 12,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 32, color: "#f0b429", marginBottom: 12 }}>
            ★★★★★
          </div>
          <p
            style={{
              fontStyle: "italic",
              color: "#444",
              marginBottom: 16,
              fontSize: 15,
            }}
          >
            "{widget.items?.[0]?.content || "Great product, highly recommended!"}"
          </p>
          <div style={{ fontWeight: 700 }}>
            {widget.items?.[0]?.title || "John Doe"}
          </div>
          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
            Happy Customer
          </div>
        </div>
      );

    // ===== COUNTER =====
    case "counter":
      return (
        <div style={{ textAlign: "center", padding: 20 }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: color || "#0c2f55",
              lineHeight: 1,
            }}
          >
            {widget.settings?.items?.[0]?.content || "1000"}
          </div>
          <div style={{ color, marginTop: 12, fontSize: 15, opacity: 0.75 }}>
            {widget.settings?.items?.[0]?.title || "Happy Clients"}
          </div>
        </div>
      );

    // ===== PROGRESS BAR =====
    case "progress_bar":
      return (
        <div style={{ padding: "8px 0" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: 8,
              color,
            }}
          >
            <span style={{ fontWeight: 600 }}>
              {widget.items?.[0]?.title || "Design"}
            </span>
            <span>{widget.items?.[0]?.content || "80"}%</span>
          </div>
          <div
            style={{
              background: "#e0e0e0",
              borderRadius: 6,
              height: 12,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${widget.items?.[0]?.content || 80}%`,
                height: "100%",
                background: color || "#0c2f55",
                borderRadius: 6,
              }}
            />
          </div>
        </div>
      );

    // ===== FORM =====
    case "form":
      return (
        <div
          style={{
            padding: 20,
            background: bgColor || "#f8f9fc",
            borderRadius: 12,
          }}
        >
          <div style={{ marginBottom: 12 }}>
            <input
              type="text"
              placeholder="Name"
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
              }}
              readOnly
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <input
              type="email"
              placeholder="Email"
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
              }}
              readOnly
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <textarea
              placeholder="Message"
              rows={4}
              style={{
                width: "100%",
                padding: 12,
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
              }}
              readOnly
            />
          </div>
          <button
            style={{
              width: "100%",
              padding: "14px",
              background: "#0c2f55",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {widget.settings?.submitText || "Submit"}
          </button>
        </div>
      );

    // ===== SEARCH =====
    case "search":
      return (
        <div
          style={{
            display: "flex",
            maxWidth: 500,
            margin: "0 auto",
          }}
        >
          <input
            type="text"
            placeholder="Search..."
            style={{
              flex: 1,
              padding: "12px 16px",
              border: "1px solid #d9dee7",
              borderRadius: "6px 0 0 6px",
              fontSize: 14,
              outline: "none",
            }}
            readOnly
          />
          <button
            style={{
              padding: "12px 24px",
              background: "#0c2f55",
              color: "#fff",
              border: "none",
              borderRadius: "0 6px 6px 0",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            🔍 Search
          </button>
        </div>
      );

    // ===== MENU =====
    case "menu":
      return (
        <nav
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "center",
            padding: 12,
          }}
        >
          {["Home", "About", "Services", "Contact"].map((item) => (
            <a
              key={item}
              href="#"
              style={{
                color,
                textDecoration: "none",
                fontWeight: 500,
                fontSize: 14,
              }}
              onClick={(e) => e.preventDefault()}
            >
              {item}
            </a>
          ))}
        </nav>
      );

    // ===== SOCIAL ICONS =====
    case "social_icons":
      return (
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            padding: 16,
          }}
        >
          {["f", "t", "in", "ig"].map((icon, i) => (
            <span
              key={i}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: bgColor || "#0c2f55",
                color: color || "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {icon}
            </span>
          ))}
        </div>
      );

    // ===== POST GRID =====
    case "post_grid":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 20,
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                overflow: "hidden",
                background: "#fff",
              }}
            >
              <img
                src={`https://picsum.photos/400/250?post${i}`}
                alt=""
                style={{ width: "100%", height: 160, objectFit: "cover" }}
              />
              <div style={{ padding: 14 }}>
                <div
                  style={{
                    fontSize: 11,
                    color: "#0c2f55",
                    fontWeight: 600,
                    marginBottom: 6,
                  }}
                >
                  CATEGORY
                </div>
                <h4 style={{ margin: "0 0 8px", fontSize: 16 }}>
                  Sample Post Title {i}
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
                  Short excerpt of the post content...
                </p>
              </div>
            </div>
          ))}
        </div>
      );

    // ===== POST LIST =====
    case "post_list":
      return (
        <div>
          {[1, 2].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "1px solid #eee",
              }}
            >
              <img
                src={`https://picsum.photos/200/150?list${i}`}
                alt=""
                style={{
                  width: 140,
                  height: 100,
                  objectFit: "cover",
                  borderRadius: 6,
                }}
              />
              <div>
                <h4 style={{ margin: "0 0 8px", fontSize: 16 }}>
                  Post Title {i}
                </h4>
                <p style={{ margin: 0, fontSize: 13, color: "#666" }}>
                  Excerpt text goes here...
                </p>
              </div>
            </div>
          ))}
        </div>
      );

    // ===== PRODUCTS =====
    case "products":
    case "product_grid":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
          }}
        >
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{
                border: "1px solid #e0e0e0",
                borderRadius: 8,
                overflow: "hidden",
                textAlign: "center",
                background: "#fff",
              }}
            >
              <img
                src={`https://picsum.photos/300/300?product${i}`}
                alt=""
                style={{ width: "100%" }}
              />
              <div style={{ padding: 12 }}>
                <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>
                  Product {i}
                </h4>
                <div
                  style={{
                    color: "#0c2f55",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  $99.00
                </div>
              </div>
            </div>
          ))}
        </div>
      );

    // ===== HTML =====
    case "html":
      return (
        <div
          dangerouslySetInnerHTML={{
            __html: widget.content || "<p>Custom HTML content</p>",
          }}
        />
      );

    default:
      return (
        <EmptyState
          icon="◆"
          title={`${widget.label} Widget`}
          subtitle="Configure this widget from Content tab"
        />
      );
  }
};

export default WidgetContent;