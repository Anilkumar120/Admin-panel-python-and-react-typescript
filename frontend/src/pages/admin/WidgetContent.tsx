import type { PageWidget, ResponsiveDevice } from "../../types/pageBuilder";
import { getImageUrl } from "../../api/products";

interface WidgetContentProps {
  widget: PageWidget;
  device: ResponsiveDevice;
  isEditMode?: boolean;
  onOpenMedia?: (multiple?: boolean, target?: string) => void;
}

const safeList = <T,>(value: T[] | undefined | null): T[] => value ?? [];

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
  const productPreview = widget.settings?.previewProduct;

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
            color: rs.color || s.color || "#ffffff",
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
                onOpenMedia(false, "image");
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
          onAction={() => onOpenMedia?.(false, "image")}
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
          onAction={() => onOpenMedia?.(false, "video")}
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

    case "cart":
    case "checkout":
    case "my_account":
    case "order_summary":
      return (
        <EmptyState
          icon={widget.type === "cart" ? "🛒" : widget.type === "checkout" ? "💳" : "▤"}
          title={`${widget.label} section`}
          subtitle="This interactive store section is rendered on the published page."
        />
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
          onAction={() => onOpenMedia?.(true, "gallery")}
        />
      );

    // ===== CAROUSEL / SLIDER =====
    case "carousel":
    case "slider": {
      const images = safeList(widget.settings?.images);
      const items = safeList(widget.items);
      const totalSlides = Math.max(images.length, items.length);

      if (totalSlides === 0) {
        return (
          <EmptyState
            icon={widget.type === "slider" ? "🎞" : "🎠"}
            title={
              widget.type === "slider"
                ? "Add Slider Images"
                : "Add Carousel Images"
            }
            subtitle="Select multiple images for slideshow"
            actionLabel="📁 Add Images"
            onAction={() => onOpenMedia?.(true, "slider")}
          />
        );
      }

      const firstImage = images[0];
      const firstItem = items[0];

      const contentPosition = firstItem?.contentPosition || "center";
      const contentTextAlign =
        firstItem?.contentTextAlign ||
        (contentPosition === "left"
          ? "left"
          : contentPosition === "right"
            ? "right"
            : "center");

      const alignContent =
        contentPosition === "left"
          ? "flex-start"
          : contentPosition === "right"
            ? "flex-end"
            : "center";

      const contentColor = firstItem?.contentColor || "#ffffff";

      const sliderHeight =
        widget.type === "slider"
          ? widget.settings?.sliderHeight
            ? `${widget.settings.sliderHeight}${
                widget.settings.sliderHeightUnit || "px"
              }`
            : "400px"
          : "250px";

      return (
        <div
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: 8,
            background: "#000",
            minHeight: sliderHeight,
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          {firstImage?.url && (
            <img
              src={firstImage.url}
              alt={firstImage.alt || firstItem?.imageAlt || ""}
              style={{
                width: "100%",
                height: sliderHeight,
                objectFit: "cover",
                display: "block",
                opacity: 0.9,
              }}
            />
          )}

          {widget.type === "slider" && (
            <div
              className="slider-preview-content"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: alignContent,
                justifyContent: "center",
                color: contentColor,
                textAlign: contentTextAlign as any,
                padding: 40,
                background:
                  "linear-gradient(135deg, rgba(12, 47, 85, 0.6), rgba(0, 0, 0, 0.4))",
              }}
            >
              {firstItem?.title && (
                <h2
                  style={{
                    fontSize: 42,
                    fontWeight: 700,
                    margin: "0 0 16px",
                    textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                    color: contentColor,
                  }}
                >
                  {firstItem.title}
                </h2>
              )}

              {firstItem?.content && (
                <p
                  style={{
                    fontSize: 18,
                    margin: "0 0 24px",
                    opacity: 0.95,
                    color: contentColor,
                    maxWidth: 600,
                  }}
                >
                  {firstItem.content}
                </p>
              )}

              {/* ✅ NEW: Buttons */}
              {(firstItem?.button1Text || firstItem?.button2Text) && (
                <div
                  style={{
                    display: "flex",
                    gap: 10,
                    marginTop: 8,
                    flexWrap: "wrap",
                    justifyContent: alignContent,
                  }}
                >
                  {firstItem?.button1Text && (
                    <span
                      style={{
                        padding: "10px 22px",
                        background: "#0c2f55",
                        color: "#fff",
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {firstItem.button1Text}
                    </span>
                  )}
                  {firstItem?.button2Text && (
                    <span
                      style={{
                        padding: "10px 22px",
                        background: "transparent",
                        color: "#fff",
                        border: "2px solid #fff",
                        borderRadius: 6,
                        fontWeight: 600,
                        fontSize: 14,
                      }}
                    >
                      {firstItem.button2Text}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 8,
            }}
          >
            {Array.from({ length: Math.min(totalSlides, 8) }).map((_, i) => (
              <span
                key={i}
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: i === 0 ? "#fff" : "rgba(255,255,255,0.5)",
                  display: "inline-block",
                }}
              />
            ))}
          </div>

          <button
            type="button"
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              left: 16,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              color: "#0c2f55",
              border: "none",
              fontSize: 24,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ‹
          </button>
          <button
            type="button"
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              right: 16,
              width: 44,
              height: 44,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              color: "#0c2f55",
              border: "none",
              fontSize: 24,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ›
          </button>

          {isEditMode && (
            <button
              type="button"
              className="widget-image-change-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMedia?.(true, "slider");
              }}
              style={{
                position: "absolute",
                bottom: 16,
                right: 16,
                padding: 8,
                background: "#0c2f55",
                color: "#fff",
                border: "none",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              + Add Slide
            </button>
          )}
        </div>
      );
    }

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
            width: "100%",
            alignSelf: "stretch",
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
            width: "100%",
            alignSelf: "stretch",
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
            width: "100%",
            alignSelf: "stretch",
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
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          {widget.items?.map((item, i) => (
            <details
              key={item.id}
              style={{
                borderBottom:
                  i < (widget.items?.length || 0) - 1
                    ? "1px solid #e0e0e0"
                    : "none",
              }}
              open={i === (widget.settings?.defaultActiveItem ?? 0)}
            >
              <summary
                style={{
                  padding: "14px 16px",
                  fontWeight: 600,
                  background: "#f8f9fc",
                  cursor: "pointer",
                }}
              >
                {item.title}
              </summary>
              <div
                style={{ padding: "12px 16px", color: "#666", fontSize: 14 }}
              >
                {item.content}
              </div>
            </details>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="☰"
          title="Add Accordion Items"
          subtitle="Configure from Content tab"
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
          subtitle="Configure from Content tab"
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
            width: "100%",
            alignSelf: "stretch",
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
            "
            {widget.items?.[0]?.content ||
              "Great product, highly recommended!"}
            "
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
        <div
          style={{
            textAlign: "center",
            padding: 20,
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: color || "#0c2f55",
              lineHeight: 1,
            }}
          >
            {widget.items?.[0]?.content ||
              widget.settings?.items?.[0]?.content ||
              "1000"}
          </div>
          <div style={{ color, marginTop: 12, fontSize: 15, opacity: 0.75 }}>
            {widget.items?.[0]?.title ||
              widget.settings?.items?.[0]?.title ||
              "Happy Clients"}
          </div>
        </div>
      );

    // ===== PROGRESS BAR =====    case "progress_bar":
      return (
        <div style={{ padding: "8px 0", width: "100%", alignSelf: "stretch" }}>
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

    // ===== FORM =====
    case "form":
      return (
        <div
          style={{
            padding: 24,
            background: bgColor || "#f8f9fc",
            borderRadius: 12,
            width: "100%",
            alignSelf: "stretch",
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
            readOnly
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
            readOnly
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
            readOnly
          />
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
            width: "100%",
            alignSelf: "stretch",
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

    // ===== SOCIAL ICONS =====
    case "social_icons":
      return (
        <div
          style={{
            display: "flex",
            gap: 12,
            justifyContent: "center",
            padding: 16,
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          {(widget.items || []).map((item) => (
            <a
              key={item.id}
              href={item.link?.url || "#"}
              onClick={(event) => event.preventDefault()}
              aria-label={item.title || "Social profile"}
              style={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                background: bgColor || "#0c2f55",
                color: color || "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              {(item.icon || item.title || "•").slice(0, 2)}
            </a>
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
            width: "100%",
            alignSelf: "stretch",
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
        <div style={{ width: "100%", alignSelf: "stretch" }}>
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

    // ================= PRODUCT WIDGETS (canvas preview) =================
    case "product_title":
      return (
        <div style={{ ...baseStyle, fontWeight: 600 }}>
          {productPreview?.title || "Choose a product preview"}
        </div>
      );

    case "product_price":
      return (
        <div style={{ ...baseStyle, fontWeight: 700 }}>
          {productPreview
            ? `₹${Number(productPreview.price || 0).toFixed(2)}`
            : "Product Price"}
        </div>
      );

    case "product_image":
      return productPreview?.image ? (
        <img
          src={getImageUrl(productPreview.image)}
          alt={productPreview.title}
          style={{
            display: "block",
            width: s.width || "100%",
            height: s.height || "auto",
            maxWidth: "100%",
            objectFit: s.objectFit || "contain",
          }}
        />
      ) : (
        <div
          style={{
            ...baseStyle,
            minHeight: 160,
            display: "grid",
            placeItems: "center",
            background: "#f3f4f6",
          }}
        >
          Choose a product preview in Content settings to show its image
        </div>
      );

    case "product_gallery":
      return productPreview?.gallery?.length ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
            gap: 8,
          }}
        >
          {productPreview.gallery.map((image, index) => (
            <img
              key={`${image.url}-${index}`}
              src={getImageUrl(image.url)}
              alt={image.alt || productPreview.title}
              style={{
                width: "100%",
                aspectRatio: "1",
                objectFit: "cover",
                borderRadius: 6,
              }}
            />
          ))}
        </div>
      ) : productPreview?.image ? (
        <img
          src={getImageUrl(productPreview.image)}
          alt={productPreview.title}
          style={{
            display: "block",
            width: "100%",
            maxHeight: 360,
            objectFit: "contain",
          }}
        />
      ) : (
        <div
          style={{
            ...baseStyle,
            minHeight: 160,
            display: "grid",
            placeItems: "center",
            background: "#f3f4f6",
          }}
        >
          Choose a product preview to show its gallery
        </div>
      );

    case "product_short_description":
      return (
        <div style={baseStyle}>
          {productPreview?.short_description || "Product Short Description"}
        </div>
      );

    case "product_description":
      return (
        <div style={baseStyle}>
          {productPreview?.description || "Product Description"}
        </div>
      );

    case "product_sku":
      return (
        <div style={baseStyle}>{productPreview?.sku || "Product SKU"}</div>
      );

    case "product_categories":
      return (
        <div style={baseStyle}>
          {productPreview?.category || "Product Categories"}
        </div>
      );

    case "product_tags":
      return (
        <div style={baseStyle}>
          {productPreview?.tags?.join(", ") || "Product Tags"}
        </div>
      );

    case "product_stock":
      return (
        <div style={baseStyle}>
          {productPreview
            ? productPreview.quantity
              ? `In stock (${productPreview.quantity})`
              : "Out of stock"
            : "Product Stock"}
        </div>
      );

    case "product_attributes":
      return productPreview?.attributes?.length ? (
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <tbody>
            {productPreview.attributes.map((attr, i) => (
              <tr key={i}>
                <th
                  style={{
                    textAlign: "left",
                    padding: "8px 12px",
                    background: "#f8f9fc",
                    border: "1px solid #e5e7eb",
                    width: "30%",
                  }}
                >
                  {attr.name}
                </th>
                <td
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e7eb",
                  }}
                >
                  {safeList(attr.options).join(", ")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={baseStyle}>Product Attributes</div>
      );

    case "product_variations":
      return productPreview?.variations?.length ? (
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <thead>
            <tr style={{ background: "#f8f9fc" }}>
              <th
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                }}
              >
                SKU
              </th>
              <th
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                }}
              >
                Price
              </th>
              <th
                style={{
                  padding: "8px 12px",
                  border: "1px solid #e5e7eb",
                  textAlign: "left",
                }}
              >
                Stock
              </th>
            </tr>
          </thead>
          <tbody>
            {productPreview.variations.map((v, i) => (
              <tr key={i}>
                <td
                  style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}
                >
                  {v.sku || "—"}
                </td>
                <td
                  style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}
                >
                  ₹{v.price ?? 0}
                </td>
                <td
                  style={{ padding: "8px 12px", border: "1px solid #e5e7eb" }}
                >
                  {v.quantity ?? 0}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={baseStyle}>Product Variations</div>
      );

    case "quantity":
      return (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 32, height: 32, textAlign: "center", lineHeight: "32px", border: "1px solid #ddd", borderRadius: 4 }}>
            −
          </span>
          <input
            type="number"
            value={1}
            readOnly
            style={{
              width: 64,
              padding: 8,
              textAlign: "center",
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          />
          <span style={{ width: 32, height: 32, textAlign: "center", lineHeight: "32px", border: "1px solid #ddd", borderRadius: 4 }}>
            +
          </span>
        </div>
      );

    case "add_to_cart":
      return (
        <button
          type="button"
          disabled={!productPreview}
          style={{
            padding: "10px 18px",
            opacity: 0.8,
            background: "#0c2f55",
            color: "#fff",
            border: "none",
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Add to Cart
        </button>
      );

    case "related_products":
    case "recent_products":
    case "products":
    case "product_grid":
      return (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 16,
            width: "100%",
            alignSelf: "stretch",
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
                  style={{ color: "#0c2f55", fontWeight: 700, fontSize: 14 }}
                >
                  ₹99.00
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
          style={{ width: "100%", alignSelf: "stretch" }}
          dangerouslySetInnerHTML={{
            __html: widget.content || "<p>Custom HTML content</p>",
          }}
        />
      );

    // ===== MAP =====
    case "map": {
      const address = widget.settings?.mapAddress || widget.content || "";
      return address ? (
        <iframe
          title={`Map: ${address}`}
          src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`}
          loading="lazy"
          style={{ width: "100%", minHeight: 320, border: 0, borderRadius: 8 }}
        />
      ) : (
        <EmptyState
          icon="⌖"
          title="Set Map Location"
          subtitle="Enter an address in the Content tab"
        />
      );
    }

    case "soundcloud":
      return widget.url ? (
        <iframe
          title="SoundCloud player"
          src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(widget.url)}`}
          allow="autoplay"
          loading="lazy"
          style={{ width: "100%", height: 166, border: 0 }}
        />
      ) : (
        <EmptyState
          icon="♫"
          title="Add a SoundCloud Track"
          subtitle="Paste its URL in the Content tab"
        />
      );

    case "shortcode":
      return (
        <code className="builder-shortcode">
          {widget.content || "[shortcode]"}
        </code>
      );

    case "menu_anchor": {
      const anchorId = (widget.content || "")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "-");
      return anchorId ? <span id={anchorId} aria-hidden="true" /> : null;
    }

    case "sidebar":
      return (
        <aside>
          {widget.content && <h3>{widget.content}</h3>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(widget.items || []).map((item) => (
              <li key={item.id} style={{ padding: "8px 0" }}>
                <a href={item.link?.url || "#"}>{item.title}</a>
              </li>
            ))}
          </ul>
        </aside>
      );

    case "read_more":
      return (
        <a
          href={widget.link?.url || widget.url || "#"}
          onClick={(event) => event.preventDefault()}
          style={{
            display: "inline-block",
            padding: "10px 18px",
            borderRadius: s.borderRadius ?? 6,
            background: bgColor || "#0c2f55",
            color: color || "#ffffff",
            textDecoration: "none",
          }}
        >
          {widget.content || "Read More"}
        </a>
      );

    case "rating": {
      const rating = Math.max(0, Math.min(5, widget.settings?.rating ?? 4));
      return (
        <div
          role="img"
          aria-label={`${rating} out of 5 stars`}
          style={{ color: "#f0b429" }}
        >
          {"★".repeat(Math.floor(rating))}
          {rating % 1 ? "½" : ""}
          {"☆".repeat(5 - Math.ceil(rating))}
        </div>
      );
    }

    case "text_path":
      return (
        <svg
          viewBox="0 0 320 180"
          role="img"
          aria-label={widget.content || "Text on a path"}
          style={{ width: "100%", overflow: "visible" }}
        >
          <defs>
            <path id={`text-path-${widget.id}`} d="M 20,145 Q 160,-20 300,145" />
          </defs>
          <text fill={color || "#0c2f55"} fontSize={fontSize || 22}>
            <textPath
              href={`#text-path-${widget.id}`}
              startOffset="50%"
              textAnchor="middle"
            >
              {widget.content || "Text on a path"}
            </textPath>
          </text>
        </svg>
      );

    case "tablepress": {
      const headers = widget.settings?.tableHeaders || ["Name", "Role"];
      return (
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={`${header}-${index}`}
                    scope="col"
                    style={{
                      textAlign: "left",
                      padding: 10,
                      borderBottom: "2px solid #d9dee7",
                    }}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(widget.items || []).map((item) => (
                <tr key={item.id}>
                  <td
                    style={{ padding: 10, borderBottom: "1px solid #e5e7eb" }}
                  >
                    {item.title}
                  </td>
                  {headers.length > 1 && (
                    <td
                      style={{
                        padding: 10,
                        borderBottom: "1px solid #e5e7eb",
                      }}
                    >
                      {item.content}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

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