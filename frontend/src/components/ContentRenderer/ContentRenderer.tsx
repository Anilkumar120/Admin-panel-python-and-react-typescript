import { useMemo } from "react";
import { getImageUrl } from "../../api/config";
import type { PageWidget, ResponsiveDevice } from "../../types/pageBuilder";

// ============================================================
// CONTENT RENDERER — Renders HTML string content
// ============================================================

interface ContentRendererProps {
  layout: string | any;
}

const ContentRenderer = ({ layout }: ContentRendererProps) => {
  const safeLayout = useMemo(() => {
    if (typeof layout === "string") return layout;
    if (layout === null || layout === undefined) return "";
    console.warn(
      "ContentRenderer: layout is not a string. Received:",
      typeof layout,
    );
    return String(layout);
  }, [layout]);

  if (!safeLayout) {
    return null;
  }

  return (
    <div
      className="content-renderer"
      dangerouslySetInnerHTML={{ __html: safeLayout }}
    />
  );
};

export default ContentRenderer;

// ============================================================
// BUILDER RENDERER — Renders array of PageWidget
// ============================================================

interface BuilderRendererProps {
  layout: PageWidget[];
  device?: ResponsiveDevice;
}

// ============ STYLE RENDERER ============
const renderStyles = (
  style: any,
  device: ResponsiveDevice,
): React.CSSProperties => {
  if (!style) return {};

  const rs = style.responsive?.[device] || {};

  const getPadding = () => {
    const p = rs.padding || style.padding;
    if (!p) return undefined;
    return `${p.top || 0}px ${p.right || 0}px ${p.bottom || 0}px ${p.left || 0}px`;
  };

  const getMargin = () => {
    const m = rs.margin || style.margin;
    if (!m) return undefined;
    return `${m.top || 0}px ${m.right || 0}px ${m.bottom || 0}px ${m.left || 0}px`;
  };

  const overlayGradient =
    rs.overlayGradient ||
    style.overlayGradient ||
    ((rs.overlayColor ?? style.overlayColor)
      ? `linear-gradient(color-mix(in srgb, ${rs.overlayColor ?? style.overlayColor} ${(Number(rs.overlayOpacity ?? style.overlayOpacity ?? 0.35) * 100)}%, transparent), color-mix(in srgb, ${rs.overlayColor ?? style.overlayColor} ${(Number(rs.overlayOpacity ?? style.overlayOpacity ?? 0.35) * 100)}%, transparent))`
      : "");
  const overlayImage = rs.overlayImage ?? style.overlayImage;
  const backgroundImage = rs.backgroundImage ?? style.backgroundImage;
  const backgroundGradient = rs.backgroundGradient || style.backgroundGradient;
  const baseBackgroundLayer = backgroundGradient
    ? backgroundGradient
    : backgroundImage
      ? `url("${getImageUrl(backgroundImage)}")`
      : "";
  const backgroundSizeFor = (value?: string) =>
    value && value !== "default" ? value : "cover";
  const backgroundPositionFor = (value?: string) =>
    value && value !== "default" ? value : "center";
  const backgroundLayers = [
    ...(overlayGradient ? ["cover"] : []),
    ...(overlayImage
      ? [backgroundSizeFor(rs.overlayImageSize ?? style.overlayImageSize)]
      : []),
    ...(baseBackgroundLayer
      ? [backgroundSizeFor(rs.backgroundSize ?? style.backgroundSize)]
      : []),
  ];
  const backgroundPositions = [
    ...(overlayGradient ? ["center"] : []),
    ...(overlayImage
      ? [
          backgroundPositionFor(
            rs.overlayImagePosition ?? style.overlayImagePosition,
          ),
        ]
      : []),
    ...(baseBackgroundLayer
      ? [backgroundPositionFor(rs.backgroundPosition ?? style.backgroundPosition)]
      : []),
  ];

  return {
    backgroundColor: rs.backgroundColor || style.backgroundColor || undefined,
    backgroundImage: [
      overlayGradient,
      overlayImage ? `url("${getImageUrl(overlayImage)}")` : "",
      baseBackgroundLayer,
    ].filter(Boolean).join(", ") || undefined,
    backgroundSize: backgroundLayers.join(", ") || "cover",
    backgroundPosition: backgroundPositions.join(", ") || "center",
    backgroundRepeat: rs.backgroundRepeat || style.backgroundRepeat || "no-repeat",
    color: rs.color || style.color || undefined,
    fontSize: rs.fontSize
      ? `${rs.fontSize}px`
      : style.fontSize
        ? `${style.fontSize}px`
        : undefined,
    fontFamily: style.fontFamily || undefined,
    fontWeight: style.fontWeight || undefined,
    lineHeight: style.lineHeight || undefined,
    letterSpacing: style.letterSpacing
      ? `${style.letterSpacing}px`
      : undefined,
    textAlign: (rs.textAlign || style.textAlign) as any,
    textTransform: style.textTransform || undefined,
    textDecoration: style.textDecoration || undefined,
    textShadow: style.textShadow || undefined,
    width: style.width || undefined,
    height: style.height || undefined,
    minWidth: style.minWidth || undefined,
    maxWidth: style.maxWidth || undefined,
    minHeight: style.minHeight || undefined,
    maxHeight: style.maxHeight || undefined,
    padding: getPadding(),
    margin: getMargin(),
    borderColor: style.borderColor || undefined,
    borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
    borderStyle: style.borderStyle || undefined,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    boxShadow: style.boxShadow || undefined,
    opacity: style.opacity ?? undefined,
    position: style.position || undefined,
    zIndex: style.zIndex || undefined,
    overflow: style.overflow || undefined,
    display: (rs.display || style.display) as any,
    flexDirection: (rs.flexDirection || style.flexDirection) as any,
    justifyContent: rs.justifyContent || style.justifyContent || undefined,
    alignItems: rs.alignItems || style.alignItems || undefined,
    gap:
      rs.gap !== undefined || style.gap !== undefined
        ? `${rs.gap ?? style.gap ?? 0}px`
        : undefined,
    gridTemplateColumns: style.gridColumns
      ? `repeat(${style.gridColumns}, 1fr)`
      : undefined,
    gridColumnGap: style.gridColumnGap
      ? `${style.gridColumnGap}px`
      : undefined,
    gridRowGap: style.gridRowGap ? `${style.gridRowGap}px` : undefined,
  };
};

// ============ WIDGET RENDERER ============
const WidgetRenderer = ({
  widget,
  device,
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
}) => {
  if (!widget) return null;

  const s = widget.style || {};
  const rs = (s as any).responsive?.[device] || {};

  const fontSize = rs.fontSize ?? s.fontSize ?? 16;
  const textAlign = rs.textAlign ?? s.textAlign ?? "left";
  const color = rs.color ?? s.color ?? "#1a1a2e";
  const bgColor = rs.backgroundColor ?? s.backgroundColor;

  const baseStyle: React.CSSProperties = {
    fontSize: `${fontSize}px`,
    textAlign: textAlign as any,
    color,
    fontFamily: s.fontFamily,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
  };

  const isContainer = ["container", "section", "column", "grid"].includes(
    widget.type,
  );

  if (isContainer) {
    return (
      <div style={renderStyles(widget.style, device)}>
        {widget.children?.map((child) => (
          <WidgetRenderer key={child.id} widget={child} device={device} />
        ))}
      </div>
    );
  }

  switch (widget.type) {
    case "heading":
      return (
        <h2 style={{ ...baseStyle, margin: 0, padding: 0 }}>
          {widget.content}
        </h2>
      );

    case "text":
      return (
        <p
          style={{ ...baseStyle, margin: 0, padding: 0 }}
          dangerouslySetInnerHTML={{ __html: widget.content || "" }}
        />
      );

    case "button":
      return (
        <a
          href={widget.url || "#"}
          target={(widget.link?.target as any) || "_self"}
          style={{
            ...baseStyle,
            backgroundColor: bgColor || "#0c2f55",
            color: color || "#ffffff",
            padding: "12px 24px",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "6px",
            display: "inline-block",
            fontWeight: s.fontWeight || 600,
            textDecoration: "none",
          }}
        >
          {widget.content}
        </a>
      );

    case "image":
      if (!widget.url) return null;
      return (
        <img
          src={getImageUrl(widget.url)}
          alt={widget.accessibility?.altText || widget.label || "Image"}
          style={{
            width: "100%",
            height: "auto",
            display: "block",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
            marginTop: s.margin?.top ? `${s.margin.top}px` : undefined,
            marginBottom: s.margin?.bottom
              ? `${s.margin.bottom}px`
              : undefined,
          }}
        />
      );

    case "video":
      if (!widget.url) return null;
      return (
        <div
          style={{
            position: "relative",
            paddingBottom: "56.25%",
            height: 0,
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
            overflow: "hidden",
          }}
        >
          {widget.url.match(/\.(mp4|webm|ogg)$/i) ? (
            <video
              src={getImageUrl(widget.url)}
              controls
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
              }}
            />
          ) : (
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
          )}
        </div>
      );

    case "icon":
      return (
        <div
          style={{
            fontSize: `${fontSize || 48}px`,
            textAlign: "center",
            color: color || "#0c2f55",
            lineHeight: 1,
          }}
        >
          {widget.content || "★"}
        </div>
      );

    case "icon_box":
      return (
        <div
          style={{
            textAlign: "center",
            padding: 24,
            color,
            backgroundColor: bgColor,
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
            {widget.settings?.items?.[0]?.title}
          </h3>
          <p style={{ margin: 0, color, fontSize: 14, opacity: 0.75 }}>
            {widget.settings?.items?.[0]?.content}
          </p>
        </div>
      );

    case "gallery":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${s.gridColumns || 3}, 1fr)`,
            gap: s.gridColumnGap || 12,
          }}
        >
          {(widget.settings?.images || []).map((img, i) => (
            <img
              key={img.id || i}
              src={getImageUrl(img.url)}
              alt={img.alt || ""}
              style={{
                width: "100%",
                height: 200,
                objectFit: "cover",
                borderRadius: 4,
              }}
            />
          ))}
        </div>
      );

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
            src={getImageUrl(widget.settings.images[0].url)}
            alt=""
            style={{
              width: "100%",
              height: widget.type === "slider" ? 400 : 250,
              objectFit: "cover",
              display: "block",
            }}
          />
          {widget.type === "slider" && (
            <div className="slider-preview-content">
              <h2>{widget.settings.images[0].title || "Slide 1"}</h2>
            </div>
          )}
        </div>
      ) : null;

    case "spacer":
      return <div style={{ minHeight: `${s.padding?.top || 40}px` }} />;

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

    case "html":
      return (
        <div dangerouslySetInnerHTML={{ __html: widget.content || "" }} />
      );

    case "alert":
      return (
        <div
          style={{
            padding: 16,
            background: bgColor || "#e8f4ff",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : "6px",
            color: color || "#0c2f55",
          }}
        >
          ℹ {widget.content}
        </div>
      );

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
                }}
              >
                {item.title}
              </div>
              <div
                style={{ padding: "12px 16px", color: "#666", fontSize: 14 }}
              >
                {item.content}
              </div>
            </div>
          ))}
        </div>
      ) : null;

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
      ) : null;

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
            "{widget.items?.[0]?.content}"
          </p>
          <div style={{ fontWeight: 700 }}>{widget.items?.[0]?.title}</div>
        </div>
      );

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
              {widget.items?.[0]?.title || "Progress"}
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

    case "form":
      return (
        <div
          style={{
            padding: 24,
            background: bgColor || "#f8f9fc",
            borderRadius: 12,
          }}
        >
          <input
            type="text"
            placeholder="Name"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              border: "1px solid #ddd",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
          <input
            type="email"
            placeholder="Email"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              border: "1px solid #ddd",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
          <textarea
            placeholder="Message"
            rows={4}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              border: "1px solid #ddd",
              borderRadius: 6,
              boxSizing: "border-box",
            }}
          />
          <button
            style={{
              padding: "12px 24px",
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

    case "search":
      return (
        <div style={{ display: "flex", maxWidth: 500, margin: "0 auto" }}>
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
            >
              {item}
            </a>
          ))}
        </nav>
      );

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

    default:
      console.warn("⚠️ Unknown widget type:", widget.type, widget);
      return null;
  }
};

// ============ MAIN BUILDER RENDERER ============
export const BuilderRenderer = ({
  layout,
  device = "desktop",
}: BuilderRendererProps) => {
  // ✅ Defensive: guarantee layout is always an array
  const safeLayout = useMemo(() => {
    if (Array.isArray(layout)) return layout;
    if (layout === null || layout === undefined) return [];
    console.warn(
      "⚠️ BuilderRenderer: layout is not an array. Received type:",
      typeof layout,
      "Value:",
      layout,
    );
    return [];
  }, [layout]);

  if (!safeLayout.length) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
        No content
      </div>
    );
  }

  return (
    <div className="builder-renderer">
      {safeLayout.map((widget) => (
        <WidgetRenderer key={widget.id} widget={widget} device={device} />
      ))}
    </div>
  );
};