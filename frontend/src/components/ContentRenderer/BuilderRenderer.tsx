import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { getImageUrl } from "../../api/config";
import type { PageWidget, ResponsiveDevice } from "../../types/pageBuilder";

interface BuilderRendererProps {
  layout: PageWidget[];
  device?: ResponsiveDevice;
}

// ============ STYLE RENDERER ============
const renderStyles = (
  style: any,
  device: ResponsiveDevice,
): React.CSSProperties => {
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

  // ✅ Compute resolved display / direction once
  const resolvedDisplay = (rs.display || style.display) as string | undefined;
  const isFlexOrGrid =
    resolvedDisplay === "flex" || resolvedDisplay === "grid";

  // ✅ ALWAYS emit gap for flex/grid containers (fallback 20px)
  const computeGap = (): string | undefined => {
    if (rs.gap !== undefined) return `${rs.gap}px`;
    if (style.gap !== undefined) return `${style.gap}px`;
    if (isFlexOrGrid) return "20px";
    return undefined;
  };

  return {
    backgroundColor: rs.backgroundColor || style.backgroundColor,
    backgroundImage: style.backgroundImage
      ? `url(${getImageUrl(style.backgroundImage)})`
      : style.backgroundGradient,
    backgroundSize: style.backgroundSize || "cover",
    backgroundPosition: style.backgroundPosition || "center",
    backgroundRepeat: style.backgroundRepeat || "no-repeat",
    color: rs.color || style.color,
    fontSize: rs.fontSize
      ? `${rs.fontSize}px`
      : style.fontSize
        ? `${style.fontSize}px`
        : undefined,
    fontFamily: style.fontFamily,
    fontWeight: style.fontWeight,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
    textAlign: rs.textAlign || style.textAlign,
    textTransform: style.textTransform,
    textDecoration: style.textDecoration,
    textShadow: style.textShadow,
    width: style.width,
    height: style.height,
    minWidth: style.minWidth,
    maxWidth: style.maxWidth,
    minHeight: style.minHeight,
    maxHeight: style.maxHeight,
    padding: getPadding(),
    margin: getMargin(),
    borderColor: style.borderColor,
    borderWidth: style.borderWidth ? `${style.borderWidth}px` : undefined,
    borderStyle: style.borderStyle,
    borderRadius: style.borderRadius ? `${style.borderRadius}px` : undefined,
    boxShadow: style.boxShadow,
    opacity: style.opacity,
    position: style.position,
    top: style.top,
    right: style.right,
    bottom: style.bottom,
    left: style.left,
    zIndex: style.zIndex,
    overflow: style.overflow,
    display: resolvedDisplay as any,
    flexDirection: (rs.flexDirection || style.flexDirection) as any,
    flexWrap: (rs.flexWrap || style.flexWrap) as any,
    justifyContent: rs.justifyContent || style.justifyContent,
    alignItems: rs.alignItems || style.alignItems,
    gap: computeGap(),
    gridTemplateColumns:
      rs.gridTemplateColumns ||
      style.gridTemplateColumns ||
      (style.gridColumns ? `repeat(${style.gridColumns}, 1fr)` : undefined),
    gridTemplateRows:
      rs.gridTemplateRows ||
      style.gridTemplateRows ||
      (style.gridRows ? `repeat(${style.gridRows}, 1fr)` : undefined),
    gridColumnGap: style.gridColumnGap ? `${style.gridColumnGap}px` : undefined,
    gridRowGap: style.gridRowGap ? `${style.gridRowGap}px` : undefined,
  };
};

// ============ LINK WRAPPER ============
const MaybeLink = ({
  widget,
  children,
}: {
  widget: PageWidget;
  children: React.ReactNode;
}) => {
  const linkUrl = widget.link?.url || widget.url;

  if (!linkUrl || linkUrl === "#") {
    return <>{children}</>;
  }

  return (
    <a
      href={linkUrl}
      target={widget.link?.target || "_self"}
      rel={widget.link?.noFollow ? "nofollow noopener" : undefined}
      style={{
        textDecoration: "none",
        color: "inherit",
        display: "contents",
      }}
    >
      {children}
    </a>
  );
};

// ============ SLIDER RENDERER ============
const SliderRenderer = ({ widget }: { widget: PageWidget }) => {
  const settings = widget.settings || {};
  const slides = widget.items || [];
  const images = settings.images || [];

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const totalSlides = Math.max(slides.length, images.length);

  const getSliderHeight = () => {
    if (settings.sliderHeight && typeof settings.sliderHeight === "number") {
      const unit = settings.sliderHeightUnit || "px";
      return `${settings.sliderHeight}${unit}`;
    }

    switch (settings.sliderHeight as any) {
      case "small":
        return "300px";
      case "large":
        return "700px";
      case "full":
        return "100vh";
      case "medium":
      default:
        return "500px";
    }
  };

  const navigation = settings.navigation || "arrows-dots";
  const showArrows =
    navigation === "arrows" ||
    navigation === "arrows-dots" ||
    settings.showArrows === true;
  const showDots =
    navigation === "dots" ||
    navigation === "arrows-dots" ||
    settings.showDots === true;

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides);
  }, [totalSlides]);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides);
  }, [totalSlides]);

  useEffect(() => {
    if (settings.autoplay === false || isPaused || totalSlides <= 1) return;

    autoplayRef.current = setInterval(
      nextSlide,
      settings.autoplaySpeed || 5000,
    );

    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [
    settings.autoplay,
    settings.autoplaySpeed,
    isPaused,
    totalSlides,
    nextSlide,
  ]);

  if (totalSlides === 0) return null;

  const currentImage = images[currentSlide];
  const currentItem = slides[currentSlide];

  const imageUrl = currentImage?.url || currentItem?.image || "";

  const horizontalAlign = currentItem?.contentPosition || "center";
  const contentJustify =
    horizontalAlign === "left"
      ? "flex-start"
      : horizontalAlign === "right"
        ? "flex-end"
        : "center";

  const contentAlign = currentItem?.contentTextAlign || "center";
  const contentColor = currentItem?.contentColor || "#ffffff";

  const overlayColor = widget.style?.overlayColor || "#000000";
  const overlayOpacity = widget.style?.overlayOpacity ?? 0.5;

  return (
    <div
      className="public-slider"
      style={{
        position: "relative",
        width: "100%",
        height: getSliderHeight(),
        minHeight: "300px",
        overflow: "hidden",
        borderRadius: widget.style?.borderRadius
          ? `${widget.style.borderRadius}px`
          : "8px",
        backgroundColor: "#000",
      }}
      onMouseEnter={() => settings.pauseOnHover !== false && setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {imageUrl && (
        <img
          key={currentSlide}
          src={getImageUrl(imageUrl)}
          alt={currentImage?.alt || currentItem?.imageAlt || ""}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: `opacity ${settings.transitionSpeed || 500}ms ease`,
          }}
        />
      )}

      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: overlayColor,
          opacity: overlayOpacity,
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: contentJustify,
          justifyContent: "center",
          padding: "40px 60px",
          textAlign: contentAlign as any,
          color: contentColor,
        }}
      >
        <div style={{ maxWidth: 800, width: "100%" }}>
          {currentItem?.title && (
            <h2
              style={{
                fontSize: 48,
                fontWeight: 700,
                margin: "0 0 16px",
                color: contentColor,
                textShadow: "0 2px 12px rgba(0,0,0,0.5)",
                lineHeight: 1.2,
              }}
            >
              {currentItem.title}
            </h2>
          )}

          {currentItem?.content && (
            <p
              style={{
                fontSize: 20,
                margin: "0 0 28px",
                color: contentColor,
                lineHeight: 1.5,
                opacity: 0.95,
              }}
            >
              {currentItem.content}
            </p>
          )}

          {(currentItem?.button1Text || currentItem?.button2Text) && (
            <div
              style={{
                display: "flex",
                gap: 16,
                justifyContent: contentJustify,
                flexWrap: "wrap",
              }}
            >
              {currentItem.button1Text && (
                <a
                  href={currentItem.button1Link || "#"}
                  style={{
                    padding: "14px 32px",
                    backgroundColor: "#f0b429",
                    color: "#0c2f55",
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 16,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {currentItem.button1Text}
                </a>
              )}

              {currentItem.button2Text && (
                <a
                  href={currentItem.button2Link || "#"}
                  style={{
                    padding: "14px 32px",
                    backgroundColor: "transparent",
                    color: contentColor,
                    borderRadius: 6,
                    fontWeight: 600,
                    fontSize: 16,
                    textDecoration: "none",
                    display: "inline-block",
                    border: `2px solid ${contentColor}`,
                  }}
                >
                  {currentItem.button2Text}
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {showArrows && totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={prevSlide}
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              left: 20,
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              color: "#0c2f55",
              border: "none",
              fontSize: 28,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            }}
            aria-label="Previous slide"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={nextSlide}
            style={{
              position: "absolute",
              top: "50%",
              transform: "translateY(-50%)",
              right: 20,
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.9)",
              color: "#0c2f55",
              border: "none",
              fontSize: 28,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              boxShadow: "0 2px 12px rgba(0,0,0,0.15)",
            }}
            aria-label="Next slide"
          >
            ›
          </button>
        </>
      )}

      {showDots && totalSlides > 1 && (
        <div
          style={{
            position: "absolute",
            bottom: 20,
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: 10,
            zIndex: 10,
          }}
        >
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentSlide(i)}
              style={{
                width: i === currentSlide ? 24 : 12,
                height: 12,
                borderRadius: 6,
                border: "none",
                background:
                  i === currentSlide ? "#fff" : "rgba(255,255,255,0.5)",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ============ WIDGET RENDERER ============
const WidgetRenderer = ({
  widget,
  device,
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
}) => {
  const s = widget.style;
  const rs = s.responsive?.[device] || {};

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

  // ✅ Containers — compute layout class
  if (isContainer) {
    const styles = renderStyles(widget.style, device);

    const displayValue = (rs.display || s.display) as string | undefined;
    const flexDirectionValue = (rs.flexDirection || s.flexDirection) as
      | string
      | undefined;

    let layoutClass = "layout-block";
    if (displayValue === "grid") {
      layoutClass = "layout-grid";
    } else if (displayValue === "flex") {
      layoutClass = `layout-flex-${flexDirectionValue || "row"}`;
    }

    return (
      <div
        style={styles}
        className={`public-widget public-widget-${widget.type} ${layoutClass}`}
        data-widget-type={widget.type}
        data-widget-id={widget.id}
        data-layout={layoutClass}
      >
        {widget.children?.map((child) => (
          <WidgetRenderer key={child.id} widget={child} device={device} />
        ))}
      </div>
    );
  }

  switch (widget.type) {
    // ============ HEADING ============
    case "heading": {
      const tag = (s.htmlTag || "h2").toLowerCase();
      const validTags = [
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        "p",
        "div",
        "span",
      ];
      const HeadingTag = (validTags.includes(tag) ? tag : "h2") as any;
      const headingTextAlign = (rs.textAlign || s.textAlign || "left") as any;

      return (
        <MaybeLink widget={widget}>
          <div style={{ width: "100%", textAlign: headingTextAlign }}>
            <HeadingTag
              style={{
                ...baseStyle,
                textAlign: headingTextAlign,
                margin: 0,
                padding: 0,
                display: "block",
              }}
              dangerouslySetInnerHTML={{ __html: widget.content || "" }}
            />
          </div>
        </MaybeLink>
      );
    }

    // ============ TEXT ============
    case "text": {
      const textTextAlign = (rs.textAlign || s.textAlign || "left") as any;

      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              ...baseStyle,
              textAlign: textTextAlign,
              width: "100%",
              display: "block",
              margin: 0,
              padding: 0,
            }}
            dangerouslySetInnerHTML={{ __html: widget.content || "" }}
          />
        </MaybeLink>
      );
    }

    // ============ BUTTON ============
    case "button": {
      const btnTextAlign = (rs.textAlign || s.textAlign || "left") as any;

      return (
        <div
          style={{
            textAlign: btnTextAlign,
            width: "100%",
            display: "block",
          }}
        >
          <a
            href={widget.link?.url || widget.url || "#"}
            target={widget.link?.target || "_self"}
            rel={widget.link?.noFollow ? "nofollow noopener" : undefined}
            style={{
              ...baseStyle,
              textAlign: btnTextAlign,
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
        </div>
      );
    }

    // ============ IMAGE ============
    case "image":
      return widget.url ? (
        <MaybeLink widget={widget}>
          <img
            src={getImageUrl(widget.url)}
            alt={widget.accessibility?.altText || widget.label}
            style={{
              width: s.width || "100%",
              height: s.height || "auto",
              display: "block",
              borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
              objectFit: (widget.settings?.imageFit as any) || "cover",
            }}
          />
        </MaybeLink>
      ) : null;

    // ============ VIDEO ============
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
      ) : null;

    // ============ ICON ============
    case "icon":
      return (
        <MaybeLink widget={widget}>
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
        </MaybeLink>
      );

    // ============ ICON BOX ============
    case "icon_box":
      return (
        <MaybeLink widget={widget}>
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
        </MaybeLink>
      );

    // ============ GALLERY ============
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

    // ============ SLIDER / CAROUSEL ============
    case "carousel":
    case "slider":
    case "post_carousel":
      return <SliderRenderer widget={widget} />;

    // ============ SPACER ============
    case "spacer":
      return (
        <div
          style={{
            minHeight: `${s.padding?.top || 40}px`,
          }}
        />
      );

    // ============ DIVIDER ============
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

    // ============ HTML ============
    case "html":
      return (
        <div
          dangerouslySetInnerHTML={{
            __html: widget.content || "",
          }}
        />
      );

    // ============ ALERT ============
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

    // ============ ACCORDION / TOGGLE ============
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

    // ============ TABS ============
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

    // ============ TESTIMONIAL ============
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

    // ============ COUNTER ============
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

    // ============ PROGRESS BAR ============
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

    // ============ FORM ============
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

    // ============ SEARCH ============
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

    // ============ MENU ============
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

    // ============ SOCIAL ICONS ============
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

    // ============ POST GRID ============
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

    // ============ POST LIST ============
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

    // ============ PRODUCTS ============
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
                <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Product {i}</h4>
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

    default:
      return null;
  }
};

// ============ MAIN RENDERER ============
const BuilderRenderer = ({
  layout,
  device = "desktop",
}: BuilderRendererProps) => {
  const memoizedLayout = useMemo(() => layout || [], [layout]);

  if (!memoizedLayout.length) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#999" }}>
        No content
      </div>
    );
  }

  return (
    <div className="builder-renderer">
      {memoizedLayout.map((widget) => (
        <WidgetRenderer key={widget.id} widget={widget} device={device} />
      ))}
    </div>
  );
};

export default BuilderRenderer;