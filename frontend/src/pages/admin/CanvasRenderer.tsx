import { useState, useCallback } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type {
  PageWidget,
  ResponsiveDevice,
  WidgetStyle,
  WidgetType,
} from "../../types/pageBuilder";
import ResizeHandles from "./ResizeHandles";
import MediaPicker, { type PickedMedia } from "./MediaPicker";

// ============ STYLE RENDERER ============
export const renderWidgetStyles = (
  style: WidgetStyle,
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

  // ✅ Compute resolved display/direction once
  const resolvedDisplay = (rs.display || style.display) as string | undefined;
  const resolvedFlexDirection = (rs.flexDirection || style.flexDirection) as
    | string
    | undefined;

  const isFlexOrGrid =
    resolvedDisplay === "flex" || resolvedDisplay === "grid";

  // ✅ ALWAYS emit gap for flex/grid containers (fallback 20px)
  const computeGap = (): string | undefined => {
    if (rs.gap !== undefined) return `${rs.gap}px`;
    if (style.gap !== undefined) return `${style.gap}px`;
    if (isFlexOrGrid) return "20px";
    return undefined;
  };

  const responsiveStyle: React.CSSProperties = {
    display: resolvedDisplay as any,
    flexDirection: resolvedFlexDirection as any,
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
    columnGap: style.gridColumnGap ? `${style.gridColumnGap}px` : undefined,
    rowGap: style.gridRowGap ? `${style.gridRowGap}px` : undefined,
  };

  return {
    backgroundColor: rs.backgroundColor || style.backgroundColor || undefined,
    backgroundImage: style.backgroundImage
      ? `url(${style.backgroundImage})`
      : style.backgroundGradient || undefined,
    backgroundSize: style.backgroundSize || "cover",
    backgroundPosition: style.backgroundPosition || "center",
    backgroundRepeat: style.backgroundRepeat || "no-repeat",
    color: rs.color || style.color || undefined,
    fontSize: rs.fontSize
      ? `${rs.fontSize}px`
      : style.fontSize
        ? `${style.fontSize}px`
        : undefined,
    fontFamily: style.fontFamily || undefined,
    fontWeight: style.fontWeight || undefined,
    fontStyle: style.fontStyle || undefined,
    lineHeight: style.lineHeight || undefined,
    letterSpacing: style.letterSpacing ? `${style.letterSpacing}px` : undefined,
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
    top: style.top || undefined,
    right: style.right || undefined,
    bottom: style.bottom || undefined,
    left: style.left || undefined,
    zIndex: style.zIndex || undefined,
    overflow: style.overflow || undefined,
    cursor: style.cursor || undefined,
    ...responsiveStyle,
  };
};

// ============ CONTAINER DROP ZONE ============
const ContainerDropZone = ({
  containerId,
  isEmpty,
  activeDragType,
}: {
  containerId: string;
  isEmpty: boolean;
  activeDragType: string | null;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `drop-${containerId}`,
    data: { type: "container-drop", containerId },
  });

  const isDraggingNew = activeDragType?.startsWith("library-");
  const showExpanded = isOver || (isEmpty && isDraggingNew);

  return (
    <div
      ref={setNodeRef}
      className={`container-drop-zone ${
        showExpanded ? "active" : ""
      } ${isEmpty ? "empty" : "has-children"}`}
      data-drop-zone="true"
    >
      {(isEmpty || showExpanded) && (
        <div className="container-drop-hint">
          <span className="drop-icon">⬇</span>
          <span>{isEmpty ? "Drop widget here" : "Drop inside container"}</span>
        </div>
      )}
    </div>
  );
};

// ============ EMPTY STATE ============
const WidgetEmptyState = ({
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
      onClick={(e) => e.preventDefault()}
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

// ============ WIDGET CONTENT ============
const WidgetContent = ({
  widget,
  device,
  isEditMode,
  onOpenMedia,
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
  isEditMode: boolean;
  onOpenMedia: (multiple: boolean, target?: string) => void;
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

  switch (widget.type) {
    // ===== HEADING =====
    case "heading": {
      const tag = (s.htmlTag || "h2").toLowerCase();
      const validTags = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span"];
      const HeadingTag = (validTags.includes(tag) ? tag : "h2") as any;
      const headingAlign = (rs.textAlign ?? s.textAlign ?? "left") as any;

      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              width: "100%",
              textAlign: headingAlign,
              alignSelf: "stretch",
              flexBasis: "100%",
            }}
          >
            <HeadingTag
              style={{
                ...baseStyle,
                textAlign: headingAlign,
                margin: 0,
                padding: 0,
                fontWeight: s.fontWeight || 700,
                display: "block",
              }}
              dangerouslySetInnerHTML={{ __html: widget.content || "Heading" }}
            />
          </div>
        </MaybeLink>
      );
    }

    // ===== TEXT =====
    case "text": {
      const textAlignVal = (rs.textAlign ?? s.textAlign ?? "left") as any;

      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              ...baseStyle,
              textAlign: textAlignVal,
              margin: 0,
              padding: 0,
              width: "100%",
              display: "block",
              alignSelf: "stretch",
              flexBasis: "100%",
            }}
            dangerouslySetInnerHTML={{
              __html: widget.content || "<p>Text content goes here...</p>",
            }}
          />
        </MaybeLink>
      );
    }

    // ===== BUTTON =====
    case "button": {
      const btnTextAlign = (rs.textAlign ?? s.textAlign ?? "left") as
        | "left"
        | "center"
        | "right"
        | "justify";

      const justifyContent: React.CSSProperties["justifyContent"] = {
        left: "flex-start",
        center: "center",
        right: "flex-end",
        justify: "stretch",
      }[btnTextAlign];

      const isJustified = btnTextAlign === "justify";

      const buttonStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        width: isJustified ? "100%" : undefined,
        maxWidth: "100%",
        minHeight: 44,
        padding: s.padding
          ? `${s.padding.top ?? 12}px ${s.padding.right ?? 24}px ${
              s.padding.bottom ?? 12
            }px ${s.padding.left ?? 24}px`
          : "12px 24px",
        margin: 0,
        fontSize: `${fontSize}px`,
        color: color || "#ffffff",
        fontFamily: s.fontFamily || "inherit",
        fontWeight: s.fontWeight || 600,
        fontStyle: s.fontStyle || "normal",
        lineHeight: s.lineHeight || 1.5,
        letterSpacing: s.letterSpacing ? `${s.letterSpacing}px` : undefined,
        textAlign: "center",
        textTransform: s.textTransform as React.CSSProperties["textTransform"],
        textDecoration: s.textDecoration || "none",
        textShadow: s.textShadow || undefined,
        backgroundColor: bgColor || "#0c2f55",
        borderRadius: s.borderRadius ? `${s.borderRadius}px` : "6px",
        borderColor: s.borderColor || undefined,
        borderWidth: s.borderWidth ? `${s.borderWidth}px` : undefined,
        borderStyle: s.borderStyle || undefined,
        boxShadow: s.boxShadow || undefined,
        opacity: s.opacity ?? 1,
        cursor: "pointer",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        verticalAlign: "middle",
      };

      return (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent,
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        >
          <MaybeLink widget={widget}>
            <span style={buttonStyle}>{widget.content || "Click Here"}</span>
          </MaybeLink>
        </div>
      );
    }

    // ===== IMAGE =====
    case "image":
      return widget.url ? (
        <div
          className="widget-image-wrapper"
          style={{
            textAlign: (s.textAlign as any) || "left",
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          <MaybeLink widget={widget}>
            <img
              src={widget.url}
              alt={widget.accessibility?.altText || widget.label}
              style={{
                width: s.width || "100%",
                height: s.height || "auto",
                maxWidth: s.maxWidth || "100%",
                display: "inline-block",
                borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
                objectFit: (widget.settings?.imageFit as any) || "cover",
              }}
            />
          </MaybeLink>
          {isEditMode && (
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
        <WidgetEmptyState
          icon="🖼"
          title="Select an Image"
          subtitle="Choose from your Media Library"
          actionLabel="📁 Choose Image"
          onAction={() => onOpenMedia(false, "image")}
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
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          {widget.url.match(/\.(mp4|webm|ogg)$/i) ? (
            <video
              src={widget.url}
              controls
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
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
      ) : (
        <WidgetEmptyState
          icon="🎬"
          title="Add a Video"
          subtitle="YouTube, Vimeo, or MP4 file"
          actionLabel="📁 Choose Video"
          onAction={() => onOpenMedia(false, "video")}
        />
      );

    // ===== ICON =====
    case "icon":
      return (
        <MaybeLink widget={widget}>
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
        </MaybeLink>
      );

    // ===== ICON BOX =====
    case "icon_box":
      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              textAlign: "center",
              padding: 24,
              color,
              backgroundColor: bgColor || "transparent",
              borderRadius: s.borderRadius ? `${s.borderRadius}px` : "8px",
              alignSelf: "stretch",
              width: "100%",
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
        </MaybeLink>
      );

    // ===== GALLERY =====
    case "gallery":
      return widget.settings?.images && widget.settings.images.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${widget.settings?.columns || 3}, 1fr)`,
            gap: 8,
            width: "100%",
            alignSelf: "stretch",
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
          {isEditMode && (
            <button
              type="button"
              className="widget-grid-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                onOpenMedia(true, "gallery");
              }}
            >
              + Add Image
            </button>
          )}
        </div>
      ) : (
        <WidgetEmptyState
          icon="🖼"
          title="Add Gallery Images"
          subtitle="Select multiple images at once"
          actionLabel="📁 Add Images"
          onAction={() => onOpenMedia(true, "gallery")}
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
            minHeight: widget.type === "slider" ? 400 : 250,
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          <img
            src={widget.settings.images[0].url}
            alt=""
            style={{
              width: "100%",
              height: widget.type === "slider" ? 400 : 250,
              objectFit: "cover",
              display: "block",
              opacity: 0.9,
            }}
          />
          {widget.type === "slider" && (
            <div
              className="slider-preview-content"
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                textAlign: "center",
                padding: 40,
                background:
                  "linear-gradient(135deg, rgba(12, 47, 85, 0.6), rgba(0, 0, 0, 0.4))",
              }}
            >
              <h2
                style={{
                  fontSize: 42,
                  fontWeight: 700,
                  margin: "0 0 16px",
                  textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  color: "#fff",
                }}
              >
                {widget.settings.images[0].title || "Slide Title"}
              </h2>
              <p
                style={{
                  fontSize: 18,
                  margin: "0 0 24px",
                  opacity: 0.95,
                  color: "#fff",
                  maxWidth: 600,
                }}
              >
                {widget.settings?.items?.[0]?.content ||
                  "Slide description goes here. Add your content."}
              </p>
              <div
                style={{
                  display: "flex",
                  gap: 12,
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    backgroundColor: "#f0b429",
                    color: "#0c2f55",
                    padding: "12px 28px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 15,
                    display: "inline-block",
                  }}
                >
                  {widget.settings?.items?.[0]?.title || "Learn More"}
                </span>
                <span
                  style={{
                    backgroundColor: "transparent",
                    color: "#fff",
                    padding: "12px 28px",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 15,
                    display: "inline-block",
                    border: "2px solid #fff",
                  }}
                >
                  {widget.settings?.items?.[1]?.title || "Contact Us"}
                </span>
              </div>
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
            {widget.settings.images.slice(0, 8).map((_, i) => (
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
                onOpenMedia(true, "slider");
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
      ) : (
        <WidgetEmptyState
          icon={widget.type === "slider" ? "🎞" : "🎠"}
          title={
            widget.type === "slider"
              ? "Add Slider Images"
              : "Add Carousel Images"
          }
          subtitle="Select multiple images for slideshow"
          actionLabel="📁 Add Images"
          onAction={() => onOpenMedia(true, "slider")}
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

    // ===== ACCORDION / TOGGLE =====
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
        <WidgetEmptyState
          icon="☰"
          title="Add Accordion Items"
          subtitle="Configure from Content tab"
        />
      );

    // ===== TABS =====
    case "tabs":
      return (widget.items || []).length > 0 ? (
        <div style={{ width: "100%", alignSelf: "stretch" }}>
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
        <WidgetEmptyState
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
            "{widget.items?.[0]?.content}"
          </p>
          <div style={{ fontWeight: 700 }}>{widget.items?.[0]?.title}</div>
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

    // ===== MENU =====
    case "menu":
      return (
        <nav
          style={{
            display: "flex",
            gap: 24,
            justifyContent: "center",
            padding: 12,
            flexWrap: "wrap",
            width: "100%",
            alignSelf: "stretch",
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
            width: "100%",
            alignSelf: "stretch",
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

    // ===== PRODUCTS =====
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

    // ===== DEFAULT =====
    default:
      return (
        <WidgetEmptyState
          icon="◆"
          title={`${widget.label} Widget`}
          subtitle="Configure this widget from Content tab"
        />
      );
  }
};

// ============ MAIN CANVAS RENDERER ============
interface CanvasRendererProps {
  widget: PageWidget;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAddInside: (parentId: string, type: WidgetType) => void;
  onResize?: (id: string, changes: Partial<WidgetStyle>) => void;
  onUpdateWidget?: (id: string, changes: Partial<PageWidget>) => void;
  device: ResponsiveDevice;
  isPreview: boolean;
  activeDragType?: string | null;
}

const CanvasRenderer = ({
  widget,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onResize = () => undefined,
  onUpdateWidget,
  device,
  isPreview,
  activeDragType = null,
}: CanvasRendererProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: isPreview });

  const [resizing, setResizing] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerMultiple, setMediaPickerMultiple] = useState(false);

  const isSelected = selectedId === widget.id;
  const isContainer = ["container", "section", "column", "grid"].includes(
    widget.type,
  );

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  // ============================================================
  // ✅ BUTTON FIX: force block + width for alignment to work
  // ============================================================
  const rawWidgetStyle = renderWidgetStyles(widget.style, device);

  const widgetStyle: React.CSSProperties =
    widget.type === "button"
      ? {
          ...rawWidgetStyle,
          display: "block",
          width: "100%",
          backgroundColor: "transparent",
          padding: 0,
          margin: 0,
          borderRadius: 0,
          boxShadow: undefined,
          cursor: "default",
        }
      : rawWidgetStyle;

  const handleResize = useCallback(
    (direction: string, deltaX: number, deltaY: number) => {
      const el = document.querySelector(
        `[data-widget-id="${widget.id}"]`,
      ) as HTMLElement;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      let newWidth = rect.width;
      let newHeight = rect.height;

      if (direction.includes("e")) newWidth = rect.width + deltaX;
      if (direction.includes("w")) newWidth = rect.width - deltaX;
      if (direction.includes("s")) newHeight = rect.height + deltaY;
      if (direction.includes("n")) newHeight = rect.height - deltaY;

      newWidth = Math.max(30, newWidth);
      newHeight = Math.max(20, newHeight);

      setResizing({
        width: Math.round(newWidth),
        height: Math.round(newHeight),
      });

      onResize(widget.id, {
        width: `${Math.round(newWidth)}px`,
        height: `${Math.round(newHeight)}px`,
      });
    },
    [widget.id, onResize],
  );

  const handleResizeEnd = useCallback(() => setResizing(null), []);

  const handleOpenMedia = (multiple: boolean, _target?: string) => {
    setMediaPickerMultiple(multiple);
    setMediaPickerOpen(true);
  };

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    if (!onUpdateWidget) return;
    const pickedArray = Array.isArray(media) ? media : [media];

    if (widget.type === "image" || widget.type === "video") {
      const picked = pickedArray[0];
      onUpdateWidget(widget.id, {
        url: picked.url,
        accessibility: { ...widget.accessibility, altText: picked.alt },
      });
    } else if (["gallery", "carousel", "slider"].includes(widget.type)) {
      const currentImages = widget.settings?.images || [];
      const newImages = [
        ...currentImages,
        ...pickedArray.map((p) => ({
          id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: p.url,
          type: "image" as const,
          alt: p.alt,
          title: p.title,
        })),
      ];
      const currentItems = widget.settings?.items || [];
      const defaultItems =
        currentItems.length === 0
          ? [
              {
                id: `item-${Date.now()}-1`,
                title: "Learn More",
                content: "Discover our amazing services and solutions.",
              },
              { id: `item-${Date.now()}-2`, title: "Contact Us", content: "" },
            ]
          : currentItems;

      onUpdateWidget(widget.id, {
        settings: {
          ...widget.settings,
          images: newImages,
          items: defaultItems,
        },
      });
    }
    setMediaPickerOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isPreview) return;
    e.stopPropagation();
    onSelect(widget.id);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        data-widget-id={widget.id}
        style={style}
        className={`canvas-element ${
          isSelected ? "active" : ""
        } ${isPreview ? "preview-mode" : ""} ${
          isContainer ? "is-container" : ""
        } ${widget.children?.length ? "has-children" : "no-children"}`}
        onClick={handleClick}
      >
        {isSelected && !isPreview && !isContainer && (
          <ResizeHandles
            onResize={handleResize}
            onResizeEnd={handleResizeEnd}
          />
        )}

        {resizing && (
          <div className="resize-size-label">
            {resizing.width} × {resizing.height}
          </div>
        )}

        {!isPreview && (
          <div className="canvas-element-label">
            <span
              className="element-drag-handle"
              {...attributes}
              {...listeners}
              onClick={(e) => e.stopPropagation()}
              style={{ touchAction: "none" }}
            >
              ⠿ {widget.label}
            </span>
            <div className="element-actions">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(widget.id);
                }}
                title="Duplicate"
              >
                ⧉
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(widget.id);
                }}
                title="Delete"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div style={widgetStyle} className="canvas-element-inner">
          {isContainer ? (
            <>
              <SortableContext
                items={(widget.children || []).map((c) => c.id)}
                strategy={verticalListSortingStrategy}
              >
                {widget.children?.map((child) => (
                  <CanvasRenderer
                    key={child.id}
                    widget={child}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onAddInside={() => undefined}
                    onResize={onResize}
                    onUpdateWidget={onUpdateWidget}
                    device={device}
                    isPreview={isPreview}
                    activeDragType={activeDragType}
                  />
                ))}
              </SortableContext>

              {!isPreview && (
                <ContainerDropZone
                  containerId={widget.id}
                  isEmpty={!widget.children?.length}
                  activeDragType={activeDragType}
                />
              )}
            </>
          ) : (
            <WidgetContent
              widget={widget}
              device={device}
              isEditMode={!isPreview}
              onOpenMedia={handleOpenMedia}
            />
          )}
        </div>
      </div>

      <MediaPicker
        isOpen={mediaPickerOpen}
        onClose={() => setMediaPickerOpen(false)}
        onSelect={handleMediaSelect}
        multiple={mediaPickerMultiple}
        fileType={widget.type === "video" ? "video" : "image"}
      />
    </>
  );
};

export default CanvasRenderer;