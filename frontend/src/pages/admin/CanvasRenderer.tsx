import { useState, useCallback, useEffect } from "react";
import type { ElementType } from "react";
import {
  useSortable,
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type {
  DimensionValue,
  PageWidget,
  ResponsiveDevice,
  WidgetItem,
  WidgetStyle,
  WidgetType,
} from "../../types/pageBuilder";
import ResizeHandles from "./ResizeHandles";
import MediaPicker, { type PickedMedia } from "./MediaPicker";
import { getImageUrl } from "../../api/products";
import BuilderIcon from "../../components/BuilderIcon";
import { ICON_LIBRARY } from "../../components/iconLibrary";
import { loadGoogleFont } from "../../utils/googleFonts";
import { lazy, Suspense } from "react";

const StorefrontWidget = lazy(
  () => import("../../pages/Storefront/Storefront"),
);

const toCssDimension = (
  value: DimensionValue | string | null | undefined,
): string | undefined => {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string") return value;
  if (typeof value !== "object") return undefined;
  if (value.unit === "auto" || value.value === "auto") return "auto";
  return `${value.value}${value.unit}`;
};

// ============ STYLE INJECTOR ============
const StyleInjector = ({ css }: { css: string }) => {
  if (!css) return null;
  return (
    <style
      dangerouslySetInnerHTML={{ __html: css }}
      data-builder-style="true"
    />
  );
};

// ============ HOVER + ANIMATION ============
const getHoverAndAnimation = (style: any, widgetId: string) => {
  const hasHoverBorderRadius =
    style?.hoverBorderRadius != null &&
    Number.isFinite(Number(style.hoverBorderRadius));
  const hasHoverOpacity =
    style?.hoverOpacity != null &&
    Number.isFinite(Number(style.hoverOpacity)) &&
    Number(style.hoverOpacity) !== 1;
  const hasHover =
    style?.hoverBackgroundColor ||
    style?.hoverColor ||
    style?.hoverBorderColor ||
    hasHoverBorderRadius ||
    style?.hoverBackgroundGradient ||
    style?.hoverOverlayImage ||
    style?.hoverOverlayGradient ||
    style?.hoverOverlayColor ||
    style?.hoverCssFilters ||
    style?.hoverBoxShadow ||
    (style?.hoverScale && style.hoverScale !== 1) ||
    hasHoverOpacity ||
    style?.hoverTranslateY;

  const hasAnimation = style?.animation && style.animation !== "none";
  const hasCustomCss = Boolean(String(style?.customCss || "").trim());
  const hasVisualEffects = (style?.backgroundType === "video" && style?.backgroundVideo) || (style?.backgroundType === "slideshow" && Array.isArray(style?.backgroundSlideshow) && style.backgroundSlideshow.length) || ["top", "bottom"].some((side) => style?.[`shapeDivider${side}Type`] && style[`shapeDivider${side}Type`] !== "none");

  if (!hasHover && !hasAnimation && !hasCustomCss && !hasVisualEffects) {
    return { className: "", cssText: "" };
  }

  const uid = `w-${widgetId.replace(/[^a-z0-9]/gi, "")}`;
  const cssParts: string[] = [];
  const classes: string[] = [];

  if (hasHover) {
    const hoverClass = `${uid}-hover`;
    classes.push(hoverClass);
    const duration = style.transitionDuration || 300;
    const hoverRules: string[] = [];
    const hoverBackgroundLayers: string[] = [];
    if (style.hoverBackgroundColor)
      hoverRules.push(`background-color: ${style.hoverBackgroundColor} !important;`);
    if (style.hoverOverlayColor)
      hoverBackgroundLayers.push(`linear-gradient(color-mix(in srgb, ${style.hoverOverlayColor} ${(Number(style.overlayOpacity ?? 0.35) * 100)}%, transparent), color-mix(in srgb, ${style.hoverOverlayColor} ${(Number(style.overlayOpacity ?? 0.35) * 100)}%, transparent))`);
    if (style.hoverOverlayGradient)
      hoverBackgroundLayers.push(style.hoverOverlayGradient);
    if (style.hoverOverlayImage)
      hoverBackgroundLayers.push(`url("${style.hoverOverlayImage}")`);
    if (style.hoverBackgroundGradient)
      hoverBackgroundLayers.push(style.hoverBackgroundGradient);
    if (hoverBackgroundLayers.length)
      hoverRules.push(`background-image: ${hoverBackgroundLayers.join(", ")} !important;`);
    if (style.hoverColor)
      hoverRules.push(`color: ${style.hoverColor} !important;`);
    if (style.hoverBorderColor)
      hoverRules.push(`border-color: ${style.hoverBorderColor} !important;`);
    if (hasHoverBorderRadius)
      hoverRules.push(`border-radius: ${style.hoverBorderRadius}px !important;`);
    if (style.hoverCssFilters)
      hoverRules.push(`filter: ${style.hoverCssFilters} !important;`);
    if (style.hoverBoxShadow)
      hoverRules.push(`box-shadow: ${style.hoverBoxShadow} !important;`);
    const transforms: string[] = [];
    if (style.hoverScale && style.hoverScale !== 1)
      transforms.push(`scale(${style.hoverScale})`);
    if (style.hoverTranslateY)
      transforms.push(`translateY(${style.hoverTranslateY}px)`);
    if (style.hoverRotate) transforms.push(`rotate(${style.hoverRotate}deg)`);
    if (transforms.length)
      hoverRules.push(`transform: ${transforms.join(" ")} !important;`);
    if (hasHoverOpacity)
      hoverRules.push(`opacity: ${style.hoverOpacity} !important;`);
    cssParts.push(`
      .${hoverClass} {
        transition: all ${duration}ms ease-in-out;
      }
      .${hoverClass}:hover {
        ${hoverRules.join("\n")}
      }
    `);
  }

  if (hasAnimation) {
    const animClass = `${uid}-anim`;
    classes.push(animClass);
    const duration = style.animationDuration || 600;
    const delay = style.animationDelay || 0;
    const easing = style.animationEasing || "ease";
    const keyframesMap: Record<string, string> = {
      fadeIn: `from { opacity: 0; } to { opacity: 1; }`,
      slideUp: `from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); }`,
      slideDown: `from { opacity: 0; transform: translateY(-30px); } to { opacity: 1; transform: translateY(0); }`,
      slideLeft: `from { opacity: 0; transform: translateX(30px); } to { opacity: 1; transform: translateX(0); }`,
      slideRight: `from { opacity: 0; transform: translateX(-30px); } to { opacity: 1; transform: translateX(0); }`,
      zoomIn: `from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); }`,
      bounce: `0%,20%,50%,80%,100% { transform: translateY(0); } 40% { transform: translateY(-15px); } 60% { transform: translateY(-8px); }`,
      pulse: `0% { transform: scale(1); } 50% { transform: scale(1.05); } 100% { transform: scale(1); }`,
    };
    const kfName = `${uid}-kf`;
    const kfBody = keyframesMap[style.animation] || keyframesMap.fadeIn;
    cssParts.push(`
      @keyframes ${kfName} { ${kfBody} }
      .${animClass} {
        animation: ${kfName} ${duration}ms ${easing} ${delay}ms both;
      }
    `);
  }

  if (style?.backgroundType === "slideshow" && Array.isArray(style?.backgroundSlideshow) && style.backgroundSlideshow.length) {
    const images: string[] = style.backgroundSlideshow.filter((url: unknown) => typeof url === "string" && url.trim()).map((url: string) => `url("${url}")`);
    if (images.length) {
      const slideClass = `${uid}-slideshow`;
      classes.push(slideClass);
      const frames = images.map((bg, i) => `${(i / images.length) * 100}% { background-image: ${bg}; }`).join(" ");
      cssParts.push(`@keyframes ${uid}-slides { ${frames} 100% { background-image: ${images[0]}; } } .${slideClass} { animation: ${uid}-slides ${Math.max(3, images.length * 3)}s infinite; background-size: cover; background-position: center; }`);
    }
  }
  const shapeSides = ["top", "bottom"].filter((side) => style?.[`shapeDivider${side}Type`] && style[`shapeDivider${side}Type`] !== "none");
  if (shapeSides.length) {
    const shapeClass = `${uid}-shape-divider`;
    classes.push(shapeClass);
    const shapeRules = shapeSides.map((side) => {
      const type = style[`shapeDivider${side}Type`];
      const height = Math.max(0, Number(style[`shapeDivider${side}Height`] ?? 50));
      const color = style[`shapeDivider${side}Color`] || "#ffffff";
      const clip = type === "triangle" ? (side === "top" ? "polygon(0 0, 100% 0, 50% 100%)" : "polygon(0 100%, 100% 100%, 50% 0)") : type === "tilt" ? (side === "top" ? "polygon(0 0, 100% 0, 100% 35%, 0 100%)" : "polygon(0 65%, 100% 0, 100% 100%, 0 100%)") : type === "curve" ? "ellipse(75% 100% at 50% 0%)" : type === "wave" ? (side === "top" ? "polygon(0 0, 100% 0, 100% 65%, 75% 100%, 50% 65%, 25% 100%, 0 65%)" : "polygon(0 35%, 25% 0, 50% 35%, 75% 0, 100% 35%, 100% 100%, 0 100%)") : "none";
      return `.${shapeClass}::${side === "top" ? "before" : "after"} { content: ""; position: absolute; left: 0; right: 0; ${side}: 0; width: 100%; height: ${height}px; background: ${color}; clip-path: ${clip}; pointer-events: none; z-index: 2; }`;
    }).join("\n");
    cssParts.push(`.${shapeClass} { position: relative; } ${shapeRules}`);
  }
  if (style?.backgroundType === "video" && style?.backgroundVideo) {
    const videoClass = `${uid}-video-bg`;
    classes.push(videoClass);
    cssParts.push(`.${videoClass} > *:not(video) { position: relative; z-index: 1; }`);
  }
  const customCss = String(style?.customCss || "").trim();
  const customClass = `${uid}-custom`;
  if (customCss) {
    classes.push(customClass);
    const scopedCss = customCss.replace(/selector/g, `.${customClass}`);
    cssParts.push(scopedCss.includes(`.${customClass}`) ? scopedCss : `.${customClass} { ${scopedCss} }`);
  }

  return {
    className: classes.join(" "),
    cssText: cssParts.join("\n"),
  };
};

// ============ STYLE RENDERER ============
export const renderWidgetStyles = (
  style: WidgetStyle,
  device: ResponsiveDevice,
): React.CSSProperties => {
  const rs = style.responsive?.[device] || {};

  const getPadding = () => {
    const p = rs.padding || style.padding;
    if (!p) return undefined;
    const unit = p.unit || "px";
    return `${p.top || 0}${unit} ${p.right || 0}${unit} ${p.bottom || 0}${unit} ${p.left || 0}${unit}`;
  };

  const getMargin = () => {
    const m = rs.margin || style.margin;
    if (!m) return undefined;
    const unit = m.unit || "px";
    return `${m.top || 0}${unit} ${m.right || 0}${unit} ${m.bottom || 0}${unit} ${m.left || 0}${unit}`;
  };

  const resolvedDisplay = (rs.display || style.display) as string | undefined;
  const resolvedFlexDirection = (rs.flexDirection || style.flexDirection) as
    | string
    | undefined;

  const effectiveDirection =
    resolvedDisplay === "flex"
      ? resolvedFlexDirection || "row"
      : resolvedFlexDirection;

  const isFlexOrGrid = resolvedDisplay === "flex" || resolvedDisplay === "grid";

  const normalizeGap = (val: unknown): string | undefined => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "number") return `${val}px`;
    const str = String(val).trim();
    if (!str) return undefined;
    if (/^-?\d*\.?\d+(px|em|rem|%|vh|vw)$/i.test(str)) return str;
    if (/^-?\d*\.?\d+$/.test(str)) return `${str}px`;
    return str;
  };

  const computeGap = (): string | undefined => {
    const rg = normalizeGap(rs.gap);
    if (rg) return rg;
    const g = normalizeGap(style.gap);
    if (g) return g;
    if (isFlexOrGrid) return "20px";
    return undefined;
  };

  const responsiveStyle: React.CSSProperties = {
    display: resolvedDisplay as any,
    flexDirection: effectiveDirection as any,
    flexWrap: (rs.flexWrap || style.flexWrap) as any,
    flexGrow: rs.flexGrow ?? style.flexGrow,
    flexShrink: rs.flexShrink ?? style.flexShrink,
    flexBasis: rs.flexBasis || style.flexBasis,
    order: rs.order ?? style.order,
    alignSelf: (rs.alignSelf || style.alignSelf) as any,
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
    backgroundImage: (rs.backgroundType ?? style.backgroundType) === "slideshow" ? undefined : ([
      rs.overlayGradient || style.overlayGradient || ((rs.overlayColor ?? style.overlayColor)
        ? `linear-gradient(color-mix(in srgb, ${rs.overlayColor ?? style.overlayColor} ${(Number(rs.overlayOpacity ?? style.overlayOpacity ?? 0.35) * 100)}%, transparent), color-mix(in srgb, ${rs.overlayColor ?? style.overlayColor} ${(Number(rs.overlayOpacity ?? style.overlayOpacity ?? 0.35) * 100)}%, transparent))`
        : ""),
      (rs.overlayImage ?? style.overlayImage) ? `url("${rs.overlayImage ?? style.overlayImage}")` : "",
      rs.backgroundGradient || style.backgroundGradient || ((rs.backgroundImage ?? style.backgroundImage) ? `url(${rs.backgroundImage ?? style.backgroundImage})` : ""),
    ].filter(Boolean).join(", ") || undefined),
    backgroundSize: style.backgroundSize || "cover",
    backgroundPosition: style.backgroundPosition || "center",
    backgroundRepeat: style.backgroundRepeat || "no-repeat",
    color: rs.color || style.color || undefined,
    fontSize: rs.fontSize ? `${rs.fontSize}px` : style.fontSize ? `${style.fontSize}px` : undefined,
    fontFamily: rs.fontFamily || style.fontFamily || undefined,
    fontWeight: rs.fontWeight || style.fontWeight || undefined,
    fontStyle: rs.fontStyle || style.fontStyle || undefined,
    lineHeight: rs.lineHeight || style.lineHeight || undefined,
    letterSpacing: (rs.letterSpacing ?? style.letterSpacing) !== undefined ? `${rs.letterSpacing ?? style.letterSpacing}px` : undefined,
    textAlign: (rs.textAlign || style.textAlign) as any,
    textTransform: style.textTransform || undefined,
    textDecoration: style.textDecoration || undefined,
    textShadow: style.textShadow || undefined,
    width: toCssDimension(rs.width ?? style.width),
    height: toCssDimension(rs.height ?? style.height),
    minWidth: toCssDimension(rs.minWidth ?? style.minWidth),
    maxWidth: toCssDimension(rs.maxWidth ?? style.maxWidth) || "100%",
    minHeight: toCssDimension(rs.minHeight ?? style.minHeight),
    maxHeight: toCssDimension(rs.maxHeight ?? style.maxHeight),
    padding: getPadding(),
    margin: getMargin(),
    borderColor: rs.borderColor || style.borderColor || undefined,
    borderWidth: (rs.borderWidth ?? style.borderWidth) ? `${rs.borderWidth ?? style.borderWidth}px` : undefined,
    borderStyle: rs.borderStyle || style.borderStyle || undefined,
    borderRadius: (rs.borderRadius ?? style.borderRadius) ? `${rs.borderRadius ?? style.borderRadius}px` : undefined,
    borderTopWidth: (rs.borderTopWidth ?? style.borderTopWidth) !== undefined ? `${rs.borderTopWidth ?? style.borderTopWidth}px` : undefined,
    borderRightWidth: (rs.borderRightWidth ?? style.borderRightWidth) !== undefined ? `${rs.borderRightWidth ?? style.borderRightWidth}px` : undefined,
    borderBottomWidth: (rs.borderBottomWidth ?? style.borderBottomWidth) !== undefined ? `${rs.borderBottomWidth ?? style.borderBottomWidth}px` : undefined,
    borderLeftWidth: (rs.borderLeftWidth ?? style.borderLeftWidth) !== undefined ? `${rs.borderLeftWidth ?? style.borderLeftWidth}px` : undefined,
    borderTopColor: rs.borderTopColor || style.borderTopColor || undefined,
    borderRightColor: rs.borderRightColor || style.borderRightColor || undefined,
    borderBottomColor: rs.borderBottomColor || style.borderBottomColor || undefined,
    borderLeftColor: rs.borderLeftColor || style.borderLeftColor || undefined,
    borderTopLeftRadius: (rs.borderTopLeftRadius ?? style.borderTopLeftRadius) !== undefined ? `${rs.borderTopLeftRadius ?? style.borderTopLeftRadius}px` : undefined,
    borderTopRightRadius: (rs.borderTopRightRadius ?? style.borderTopRightRadius) !== undefined ? `${rs.borderTopRightRadius ?? style.borderTopRightRadius}px` : undefined,
    borderBottomLeftRadius: (rs.borderBottomLeftRadius ?? style.borderBottomLeftRadius) !== undefined ? `${rs.borderBottomLeftRadius ?? style.borderBottomLeftRadius}px` : undefined,
    borderBottomRightRadius: (rs.borderBottomRightRadius ?? style.borderBottomRightRadius) !== undefined ? `${rs.borderBottomRightRadius ?? style.borderBottomRightRadius}px` : undefined,
    boxShadow: rs.boxShadow || style.boxShadow || undefined,
    boxSizing: "border-box",
    transform: [
      style.rotate ? `rotate(${style.rotate}deg)` : "",
      style.scale !== undefined && style.scale !== 1 ? `scale(${style.scale})` : "",
      style.translateX ? `translateX(${style.translateX})` : "",
      style.translateY ? `translateY(${style.translateY})` : "",
    ].filter(Boolean).join(" ") || undefined,
    filter: style.cssFilters || undefined,
    opacity: rs.opacity ?? style.opacity ?? undefined,
    position: rs.position || style.position || ((rs.sticky || style.sticky) && (rs.sticky || style.sticky) !== "none" ? "sticky" : style.backgroundType === "video" ? "relative" : undefined),
    top: (rs.sticky || style.sticky) === "top" ? ((rs.stickyOffset ?? style.stickyOffset) ? `${rs.stickyOffset ?? style.stickyOffset}px` : "0px") : rs.top || style.top || undefined,
    right: rs.right || style.right || undefined,
    bottom: (rs.sticky || style.sticky) === "bottom" ? ((rs.stickyOffset ?? style.stickyOffset) ? `${rs.stickyOffset ?? style.stickyOffset}px` : "0px") : rs.bottom || style.bottom || undefined,
    left: rs.left || style.left || undefined,
    zIndex: rs.zIndex ?? style.zIndex ?? undefined,
    overflow: (rs.overflow || style.overflow) as React.CSSProperties["overflow"] || undefined,
    clipPath: style.maskShape === "circle" ? "circle(50% at 50% 50%)" : style.maskShape === "triangle" ? "polygon(50% 0%, 0% 100%, 100% 100%)" : style.maskShape === "diamond" ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" : style.maskShape === "hexagon" ? "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)" : undefined,
    cursor: style.cursor || undefined,
    ...responsiveStyle,
  };
};

// ============ MOBILE MENU WIDGET (Canvas Preview) ============
const CanvasMenuWidget = ({
  widget,
  device,
  color,
  fontSize,
  s,
  rs,
  isEditMode,
  onOpenMedia,
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
  color: string;
  fontSize: number;
  s: any;
  rs: any;
  isEditMode: boolean;
  onOpenMedia: (multiple: boolean, target?: string) => void;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [openSubmenus, setOpenSubmenus] = useState<Record<string, boolean>>({});

  void fontSize;
  void isEditMode;
  void onOpenMedia;

  useEffect(() => {
    setMenuOpen(false);
    setOpenSubmenus({});
  }, [device]);

  const items =
    widget.items && widget.items.length > 0
      ? widget.items
      : [
          { id: "1", title: "Home", link: { url: "#" } },
          { id: "2", title: "About", link: { url: "#" } },
          { id: "3", title: "Services", link: { url: "#" } },
          { id: "4", title: "Contact", link: { url: "#" } },
        ];

  const menuGap = s.gap ?? 24;
  const menuJustify = (rs.justifyContent ||
    s.justifyContent ||
    "center") as any;
  const hamburgerColor = s.hamburgerColor || color || "#0c2f55";
  const mobileMenuBg = s.mobileMenuBgColor || "#ffffff";
  const breakpoint = s.mobileBreakpoint === "tablet" ? 1024 : 768;
  const uid = `canvas-nav-${widget.id.replace(/[^a-z0-9]/gi, "")}`;

  const isMobileView = device === "mobile";
  const isTabletView = device === "tablet";
  const forceShowHamburger = isMobileView || isTabletView;

  const menuFontSize = fontSize || s.fontSize || 14;
  const menuFontWeight = s.fontWeight || 500;
  const hoverColor = s.hoverColor || "#f0b429";

  const cssText = `
    .${uid}-wrapper { width: 100%; position: relative; display: flex; align-items: center; justify-content: space-between; }
    .${uid}-toggle { display: ${forceShowHamburger ? "flex" : "none"}; align-items: center; justify-content: center; width: 44px; height: 44px; background: transparent; border: none; cursor: pointer; padding: 0; margin-left: auto; }
    .${uid}-toggle .${uid}-bar { position: absolute; left: 0; display: block; width: 24px; height: 2px; background: ${hamburgerColor}; transition: transform 0.2s ease, opacity 0.2s ease; }
    .${uid}-toggle .${uid}-bar-top { transform: translateY(-8px); }
    .${uid}-toggle .${uid}-bar-bottom { transform: translateY(8px); }
    .${uid}-toggle.open .${uid}-bar-middle { opacity: 0; }
    .${uid}-toggle.open .${uid}-bar-top { transform: rotate(45deg); }
    .${uid}-toggle.open .${uid}-bar-bottom { transform: rotate(-45deg); }
    .${uid}-list { display: flex; gap: ${menuGap}px; justify-content: ${menuJustify}; align-items: center; flex-wrap: wrap; margin: 0; padding: 12px 0; list-style: none; width: 100%; }
    .${uid}-list > li { position: relative; }
    .${uid}-list > li > a {
      color: ${color || "#1a1a2e"};
      text-decoration: none;
      font-weight: ${menuFontWeight};
      font-size: ${menuFontSize}px;
      transition: all 0.2s;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 0;
    }
    .${uid}-list > li > a:hover { color: ${hoverColor}; }

    .${uid}-submenu {
      position: absolute;
      top: 100%;
      left: 0;
      min-width: 180px;
      background: ${mobileMenuBg};
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      border-radius: 6px;
      padding: 8px 0;
      margin: 0;
      list-style: none;
      opacity: 0;
      visibility: hidden;
      transform: translateY(8px);
      transition: all 0.2s ease;
      z-index: 100;
    }
    .${uid}-list > li:hover > .${uid}-submenu {
      opacity: 1;
      visibility: visible;
      transform: translateY(0);
    }
    .${uid}-submenu li { position: relative; }
    .${uid}-submenu a {
      display: block;
      padding: 8px 16px;
      color: ${color || "#1a1a2e"};
      text-decoration: none;
      font-size: ${Math.max(menuFontSize - 1, 12)}px;
      white-space: nowrap;
    }
    .${uid}-submenu a:hover {
      background: rgba(12, 47, 85, 0.08);
      color: ${hoverColor};
    }
    .${uid}-submenu .${uid}-submenu { top: 0; left: 100%; }

    @media (max-width: ${breakpoint}px) {
      .${uid}-list {
        display: ${menuOpen ? "flex" : "none"};
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        flex-direction: column;
        align-items: stretch;
        gap: 0;
        padding: 12px;
        background: ${mobileMenuBg};
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        border-radius: 8px;
        z-index: 1000;
        width: 100%;
      }
      .${uid}-list > li { width: 100%; }
      .${uid}-list > li > a {
        width: 100%;
        padding: 12px 0;
        border-bottom: 1px solid rgba(0,0,0,0.08);
        font-size: 15px;
        justify-content: space-between;
      }
      .${uid}-submenu {
        position: static;
        opacity: 1;
        visibility: visible;
        transform: none;
        box-shadow: none;
        padding: 0 0 0 16px;
        display: none;
        background: transparent;
      }
      .${uid}-submenu.open { display: block; }
      .${uid}-submenu a { padding: 10px 0; font-size: 14px; }
    }
  `;

  const renderMenuItem = (item: any, depth: number = 0): React.ReactNode => {
    const hasChildren =
      item.children && Array.isArray(item.children) && item.children.length > 0;
    const itemKey = item.id || `${depth}-${item.title}`;

    return (
      <li key={itemKey}>
        <a
          href={item.link?.url || item.url || "#"}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (hasChildren && (isMobileView || isTabletView)) {
              const submenuKey = `${widget.id}-${item.id || itemKey}`;
              setOpenSubmenus((prev) => ({
                ...prev,
                [submenuKey]: !prev[submenuKey],
              }));
            }
          }}
        >
          {item.title}
          {hasChildren && (
            <span style={{ marginLeft: 6, fontSize: "0.75em", opacity: 0.7 }}>
              ▾
            </span>
          )}
        </a>
        {hasChildren && (
          <ul
            className={`${uid}-submenu ${
              openSubmenus[`${widget.id}-${item.id || itemKey}`] ? "open" : ""
            }`}
          >
            {item.children.map((child: any) =>
              renderMenuItem(child, depth + 1),
            )}
          </ul>
        )}
      </li>
    );
  };

  return (
    <>
      <StyleInjector css={cssText} />
      <div className={`${uid}-wrapper`}>
        <button
          type="button"
          className={`${uid}-toggle${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls={`${uid}-list`}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen((v) => !v);
          }}
          style={{
            display: forceShowHamburger ? "flex" : "none",
            alignItems: "center",
            justifyContent: "center",
            width: 44,
            height: 44,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: 0,
            marginLeft: "auto",
            position: "relative",
          }}
        >
          <span aria-hidden="true" className={`${uid}-bar ${uid}-bar-top`} />
          <span aria-hidden="true" className={`${uid}-bar ${uid}-bar-middle`} />
          <span aria-hidden="true" className={`${uid}-bar ${uid}-bar-bottom`} />
        </button>

        <ul
          id={`${uid}-list`}
          className={`${uid}-list`}
          style={{
            display: menuOpen || !forceShowHamburger ? "flex" : "none",
          }}
        >
          {items.map((item) => renderMenuItem(item, 0))}
        </ul>
      </div>
    </>
  );
};

// ============ INLINE DROP ZONE ============
const InlineDropZone = ({
  parentId,
  index,
  activeDragType,
}: {
  parentId: string | null;
  index: number;
  activeDragType: string | null;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `inline-${parentId || "root"}-${index}`,
    data: { type: "inline-drop", parentId, index },
  });

  const isDraggingNew = activeDragType?.startsWith("library-");
  const isDraggingExisting =
    activeDragType && !activeDragType.startsWith("library-");
  const visible = isDraggingNew || isDraggingExisting;

  return (
    <div
      ref={setNodeRef}
      className={`inline-drop-zone ${isOver ? "active" : ""} ${
        visible ? "visible" : ""
      }`}
      style={{
        height: isOver ? 36 : visible ? 8 : 0,
        margin: isOver ? "4px 0" : 0,
        border: isOver ? "2px dashed #93003c" : "2px dashed transparent",
        borderRadius: 4,
        transition: "height 0.15s, margin 0.15s, border 0.15s",
        background: isOver ? "rgba(147, 0, 60, 0.06)" : "transparent",
        pointerEvents: visible ? "auto" : "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#93003c",
        fontSize: 11,
        fontWeight: 600,
      }}
    >
      {isOver ? "⬇ Drop here" : ""}
    </div>
  );
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

const ItemDropZone = ({
  widgetId,
  itemId,
  isEditMode,
}: {
  widgetId: string;
  itemId: string;
  isEditMode: boolean;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `item-drop-${widgetId}-${itemId}`,
    data: { type: "item-drop", widgetId, itemId },
    disabled: !isEditMode,
  });
  if (!isEditMode) return null;

  return (
    <div
      ref={setNodeRef}
      style={{
        minHeight: 72,
        marginTop: 12,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: `1px dashed ${isOver ? "#93003c" : "#b8bec9"}`,
        borderRadius: 4,
        color: isOver ? "#93003c" : "#68707d",
        background: isOver ? "rgba(147, 0, 60, 0.06)" : "rgba(0, 0, 0, 0.02)",
        fontSize: 13,
      }}
    >
      {isOver ? "Drop widget here" : "＋ Drag widget here"}
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
  linkUrl,
}: {
  widget: PageWidget;
  children: React.ReactNode;
  linkUrl?: string | null;
}) => {
  const resolvedUrl =
    linkUrl !== undefined ? linkUrl : widget.link?.url || widget.url;

  if (!resolvedUrl || resolvedUrl === "#") {
    return <>{children}</>;
  }

  return (
    <a
      href={resolvedUrl}
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

// ============ NESTED CHILDREN RENDERER ============
const RenderNestedChildren = ({
  children,
  device,
  isEditMode,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onResize,
  onUpdateWidget,
  onContextMenu,
}: {
  children: PageWidget[];
  device: ResponsiveDevice;
  isEditMode: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onResize?: (id: string, changes: Partial<WidgetStyle>) => void;
  onUpdateWidget?: (id: string, changes: Partial<PageWidget>) => void;
  onContextMenu?: (e: React.MouseEvent, widgetId: string) => void;
}) => {
  if (!children || children.length === 0) return null;

  return (
    <SortableContext
      items={children.map((child) => child.id)}
      strategy={verticalListSortingStrategy}
    >
      {children.map((child, index) => (
        <CanvasRenderer
          key={child.id}
          widget={child}
          parentId={null}
          index={index}
          selectedId={selectedId}
          onSelect={onSelect}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          onAddInside={() => undefined}
          onResize={onResize}
          onUpdateWidget={onUpdateWidget}
          device={device}
          isPreview={!isEditMode}
          onContextMenu={onContextMenu}
          disableDrag
        />
      ))}
    </SortableContext>
  );
};

// ============ WIDGET CONTENT ============
const WidgetContent = ({
  widget,
  device,
  isEditMode,
  onOpenMedia,
  onChangeContent,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onResize,
  onUpdateWidget,
  onContextMenu,
}: {
  widget: PageWidget;
  device: ResponsiveDevice;
  isEditMode: boolean;
  onOpenMedia: (multiple: boolean, target?: string) => void;
  onChangeContent?: (content: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onResize?: (id: string, changes: Partial<WidgetStyle>) => void;
  onUpdateWidget?: (id: string, changes: Partial<PageWidget>) => void;
  onContextMenu?: (e: React.MouseEvent, widgetId: string) => void;
}) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
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

  switch (widget.type) {
    case "heading": {
      const tag = (s.htmlTag || "h2").toLowerCase();
      const validTags = [
        "h1", "h2", "h3", "h4", "h5", "h6", "p", "div", "span",
      ];
      const HeadingTag = (validTags.includes(tag) ? tag : "h2") as any;
      const headingAlign = (rs.textAlign ?? s.textAlign ?? "left") as any;
      const hover = getHoverAndAnimation(s, widget.id);

      return (
        <>
          <StyleInjector css={hover.cssText} />
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
                className={hover.className}
                style={{
                  ...baseStyle,
                  textAlign: headingAlign,
                  margin: 0,
                  padding: 0,
                  fontWeight: s.fontWeight || 700,
                  display: "block",
                  width: s.width || undefined,
                  maxWidth: s.maxWidth || undefined,
                }}
                contentEditable={isEditMode}
                suppressContentEditableWarning
                onBlur={(e: React.FocusEvent<HTMLElement>) => {
                  if (isEditMode && onChangeContent) {
                    onChangeContent(e.currentTarget.innerHTML);
                  }
                }}
                onKeyDown={(e: React.KeyboardEvent<HTMLElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    (e.currentTarget as HTMLElement).blur();
                  }
                }}
                dangerouslySetInnerHTML={{
                  __html: widget.content || "Heading",
                }}
              />
            </div>
          </MaybeLink>
        </>
      );
    }

    case "text": {
      const textAlignVal = (rs.textAlign ?? s.textAlign ?? "left") as any;
      const hover = getHoverAndAnimation(s, widget.id);

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <MaybeLink widget={widget}>
            <div
              className={hover.className}
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
              contentEditable={isEditMode}
              suppressContentEditableWarning
              onBlur={(e) => {
                if (isEditMode && onChangeContent) {
                  onChangeContent(e.currentTarget.innerHTML);
                }
              }}
              dangerouslySetInnerHTML={{
                __html: widget.content || "<p>Text content goes here...</p>",
              }}
            />
          </MaybeLink>
        </>
      );
    }

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
      const buttonHoverBackgroundColor =
        rs.buttonHoverBackgroundColor ??
        s.buttonHoverBackgroundColor ??
        s.hoverBackgroundColor;
      const hover = getHoverAndAnimation(
        {
          ...s,
          hoverBackgroundColor: buttonHoverBackgroundColor,
          hoverColor: s.hoverColor,
          ...(buttonHoverBackgroundColor
            ? { hoverBackgroundGradient: "none" }
            : {}),
        },
        widget.id,
      );
      const buttonPadding = rs.buttonPadding || s.buttonPadding || rs.padding || s.padding;
      const buttonPaddingUnit = buttonPadding?.unit || "px";
      const buttonBackgroundType =
        rs.buttonBackgroundType ?? s.buttonBackgroundType ?? "classic";
      const buttonBackgroundColor =
        rs.buttonBackgroundColor ??
        s.buttonBackgroundColor ??
        rs.backgroundColor ??
        s.backgroundColor ??
        "#0c2f55";

      const buttonStyle: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        boxSizing: "border-box",
        width: isJustified ? "100%" : undefined,
        maxWidth: "100%",
        minHeight: 44,
        padding: buttonPadding
          ? `${buttonPadding.top ?? 12}${buttonPaddingUnit} ${buttonPadding.right ?? 24}${buttonPaddingUnit} ${
              buttonPadding.bottom ?? 12
            }${buttonPaddingUnit} ${buttonPadding.left ?? 24}${buttonPaddingUnit}`
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
        backgroundColor:
          buttonBackgroundType === "gradient"
            ? rs.buttonBackgroundGradientColor1 ??
              s.buttonBackgroundGradientColor1 ??
              "#0c2f55"
            : buttonBackgroundColor,
        backgroundImage:
          buttonBackgroundType === "gradient"
            ? `linear-gradient(${rs.buttonBackgroundGradientAngle ?? s.buttonBackgroundGradientAngle ?? 135}deg, ${rs.buttonBackgroundGradientColor1 ?? s.buttonBackgroundGradientColor1 ?? "#0c2f55"}, ${rs.buttonBackgroundGradientColor2 ?? s.buttonBackgroundGradientColor2 ?? "#ffffff"})`
            : undefined,
        borderRadius:
          (rs.buttonBorderRadius ?? s.buttonBorderRadius ?? rs.borderRadius ?? s.borderRadius)
            ? `${rs.buttonBorderRadius ?? s.buttonBorderRadius ?? rs.borderRadius ?? s.borderRadius}px`
            : "6px",
        borderColor: rs.buttonBorderColor || s.buttonBorderColor || rs.borderColor || s.borderColor || undefined,
        borderWidth:
          (rs.buttonBorderWidth ?? s.buttonBorderWidth ?? rs.borderWidth ?? s.borderWidth)
            ? `${rs.buttonBorderWidth ?? s.buttonBorderWidth ?? rs.borderWidth ?? s.borderWidth}px`
            : undefined,
        borderStyle: rs.buttonBorderStyle || s.buttonBorderStyle || rs.borderStyle || s.borderStyle || undefined,
        borderTopWidth: rs.buttonBorderTopWidth ?? s.buttonBorderTopWidth ?? rs.borderTopWidth ?? s.borderTopWidth,
        borderRightWidth: rs.buttonBorderRightWidth ?? s.buttonBorderRightWidth ?? rs.borderRightWidth ?? s.borderRightWidth,
        borderBottomWidth: rs.buttonBorderBottomWidth ?? s.buttonBorderBottomWidth ?? rs.borderBottomWidth ?? s.borderBottomWidth,
        borderLeftWidth: rs.buttonBorderLeftWidth ?? s.buttonBorderLeftWidth ?? rs.borderLeftWidth ?? s.borderLeftWidth,
        borderTopLeftRadius: rs.buttonBorderTopLeftRadius ?? s.buttonBorderTopLeftRadius ?? rs.borderTopLeftRadius ?? s.borderTopLeftRadius,
        borderTopRightRadius: rs.buttonBorderTopRightRadius ?? s.buttonBorderTopRightRadius ?? rs.borderTopRightRadius ?? s.borderTopRightRadius,
        borderBottomLeftRadius: rs.buttonBorderBottomLeftRadius ?? s.buttonBorderBottomLeftRadius ?? rs.borderBottomLeftRadius ?? s.borderBottomLeftRadius,
        borderBottomRightRadius: rs.buttonBorderBottomRightRadius ?? s.buttonBorderBottomRightRadius ?? rs.borderBottomRightRadius ?? s.borderBottomRightRadius,
        boxShadow: s.boxShadow || undefined,
        opacity: s.opacity ?? 1,
        cursor: "pointer",
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        verticalAlign: "middle",
        transition: `all ${s.transitionDuration || 300}ms ease-in-out`,
      };

      return (
        <>
          <StyleInjector css={hover.cssText} />
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
              <span className={hover.className} style={buttonStyle}>
                {widget.content || "Click Here"}
              </span>
            </MaybeLink>
          </div>
        </>
      );
    }

    case "image": {
      const hover = getHoverAndAnimation(s, widget.id);

      return widget.url ? (
        <>
          <StyleInjector css={hover.cssText} />
          <div
            className="widget-image-wrapper"
            style={{
              ...baseStyle,
              display: "flex",
              justifyContent:
                (rs.elementAlign || s.elementAlign) === "center"
                  ? "center"
                  : (rs.elementAlign || s.elementAlign) === "right"
                    ? "flex-end"
                    : "flex-start",
              width: "100%",
              alignSelf: "stretch",
            }}
          >
            <MaybeLink
              widget={widget}
              linkUrl={
                widget.settings?.imageLinkType === "none"
                  ? null
                  : widget.settings?.imageLinkType === "media"
                    ? widget.url
                    : widget.link?.url || null
              }
            >
              <img
                src={widget.url}
                alt={widget.accessibility?.altText || widget.label}
                className={hover.className}
                style={{
                  width: toCssDimension(rs.width ?? s.width) || "100%",
                  height: toCssDimension(rs.height ?? s.height) || "auto",
                  maxWidth:
                    toCssDimension(rs.maxWidth ?? s.maxWidth) || "100%",
                  maxHeight: toCssDimension(rs.maxHeight ?? s.maxHeight),
                  display: "inline-block",
                  borderRadius: (rs.borderRadius ?? s.borderRadius)
                    ? `${rs.borderRadius ?? s.borderRadius}px`
                    : "8px",
                  borderColor: rs.borderColor || s.borderColor || undefined,
                  borderWidth:
                    (rs.borderWidth ?? s.borderWidth)
                      ? `${rs.borderWidth ?? s.borderWidth}px`
                      : undefined,
                  borderStyle: rs.borderStyle || s.borderStyle || undefined,
                  boxShadow: rs.boxShadow || s.boxShadow || undefined,
                  objectFit:
                    rs.objectFit ||
                    s.objectFit ||
                    (widget.settings?.imageFit as any) ||
                    "cover",
                  objectPosition: rs.objectPosition || s.objectPosition || "center",
                  opacity: rs.opacity ?? s.opacity ?? 1,
                  filter: rs.cssFilters || s.cssFilters || undefined,
                }}
              />
            </MaybeLink>
            {widget.settings?.captionType &&
              widget.settings.captionType !== "none" && (
                <div
                  className="widget-image-caption"
                  style={{
                    marginTop: 6,
                    textAlign: rs.textAlign || s.textAlign || "left",
                    color: s.color || "inherit",
                    fontSize: 13,
                  }}
                >
                  {widget.settings.captionType === "custom"
                    ? widget.settings.captionText || ""
                    : widget.label}
                </div>
              )}
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
        </>
      ) : (
        <WidgetEmptyState
          icon="🖼"
          title="Select an Image"
          subtitle="Choose from your Media Library"
          actionLabel="📁 Choose Image"
          onAction={() => onOpenMedia(false, "image")}
        />
      );
    }

    case "site_logo": {
      const hover = getHoverAndAnimation(s, widget.id);

      return (
        <>
          <StyleInjector css={hover.cssText} />
          <div
            className="widget-image-wrapper"
            style={{
              width: "100%",
              alignSelf: "stretch",
            }}
          >
            {widget.url ? (
              <MaybeLink
                widget={widget}
                linkUrl={
                  widget.settings?.imageLinkType === "none"
                    ? null
                    : widget.settings?.imageLinkType === "media"
                      ? widget.url
                      : widget.link?.url || null
                }
              >
                <img
                  src={widget.url}
                  alt={widget.accessibility?.altText || "Logo"}
                  className={hover.className}
                  style={{
                    width: s.width || "auto",
                    height: s.height || "auto",
                    maxHeight: s.maxHeight || "50px",
                    maxWidth: s.maxWidth || "none",
                    display: "inline-block",
                    objectFit: (s.objectFit as any) || "contain",
                    objectPosition: s.objectPosition || "center",
                  }}
                />
              </MaybeLink>
            ) : (
              <span
                style={{
                  fontSize: `${fontSize || 22}px`,
                  fontWeight: s.fontWeight || 700,
                  color: color || "#0c2f55",
                }}
              >
                {widget.content || "Site Logo"}
              </span>
            )}
            {isEditMode && (
              <button
                type="button"
                className="widget-image-change-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenMedia(false, "logo");
                }}
              >
                🔄 Change Logo
              </button>
            )}
          </div>
        </>
      );
    }

    case "site_title": {
      const titleAlign = (rs.textAlign ?? s.textAlign ?? "left") as any;
      return (
        <h1
          style={{
            ...baseStyle,
            margin: 0,
            padding: 0,
            fontSize: `${fontSize || 24}px`,
            fontWeight: s.fontWeight || 700,
            textAlign: titleAlign,
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          {widget.content || "Site Title"}
        </h1>
      );
    }

    case "site_tagline": {
      const taglineAlign = (rs.textAlign ?? s.textAlign ?? "left") as any;
      return (
        <p
          style={{
            ...baseStyle,
            margin: 0,
            fontSize: `${fontSize || 14}px`,
            opacity: 0.75,
            textAlign: taglineAlign,
            width: "100%",
            alignSelf: "stretch",
          }}
        >
          {widget.content || "Your site tagline here"}
        </p>
      );
    }

    case "copyright": {
      const copyrightAlign = (rs.textAlign ?? s.textAlign ?? "center") as any;
      return (
        <div
          style={{
            ...baseStyle,
            fontSize: `${fontSize || 14}px`,
            textAlign: copyrightAlign,
            padding: "8px 0",
            width: "100%",
            alignSelf: "stretch",
            opacity: s.opacity ?? 0.9,
          }}
        >
          {widget.content ||
            `© ${new Date().getFullYear()} All rights reserved.`}
        </div>
      );
    }

    case "menu":
    case "nav_menu":
    case "footer_menu":
      return (
        <CanvasMenuWidget
          widget={widget}
          device={device}
          color={color}
          fontSize={fontSize}
          s={s}
          rs={rs}
          isEditMode={isEditMode}
          onOpenMedia={onOpenMedia}
        />
      );

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

    case "icon_list":
      return (
        <ul
          className="builder-icon-list"
          style={{
            ...renderWidgetStyles(widget.style, device),
            listStyle: "none",
            display: "flex",
            flexDirection:
              widget.settings?.iconListLayout === "inline"
                ? "row"
                : (s.flexDirection as "row" | "column") || "column",
            flexWrap: "wrap",
            gap: `${s.gap ?? 12}px`,
            padding: 0,
            margin: 0,
          }}
        >
          {(widget.items || []).map((item) => {
            const content = (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  color: s.color || color || "inherit",
                  width:
                    widget.settings?.iconListLinkFullWidth && item.link?.url
                      ? "100%"
                      : undefined,
                }}
              >
                {item.iconType === "text" ? null : item.iconType === "image" || item.image ? (
                  <img
                    src={item.image}
                    alt=""
                    aria-hidden="true"
                    style={{
                      width: `${s.iconSize || 20}px`,
                      height: `${s.iconSize || 20}px`,
                      objectFit: "contain",
                      flex: "0 0 auto",
                    }}
                  />
                ) : (
                  <BuilderIcon
                    name={item.icon}
                    style={{
                      color: s.iconColor || color || "#0c2f55",
                      fontSize: `${s.iconSize || 20}px`,
                      lineHeight: 1,
                    }}
                  />
                )}
                <span>{item.title || item.content}</span>
              </span>
            );
            return (
              <li
                key={item.id}
                style={{
                  width:
                    widget.settings?.iconListLinkFullWidth && item.link?.url
                      ? "100%"
                      : undefined,
                }}
              >
                {item.link?.url ? (
                  <a
                    href={item.link.url}
                    target={item.link.target || "_self"}
                    rel={item.link.noFollow ? "nofollow noopener" : undefined}
                    style={{
                      display: widget.settings?.iconListLinkFullWidth
                        ? "flex"
                        : "inline-flex",
                      width: widget.settings?.iconListLinkFullWidth
                        ? "100%"
                        : undefined,
                      textDecoration: "none",
                    }}
                  >
                    {content}
                  </a>
                ) : content}
              </li>
            );
          })}
        </ul>
      );

    case "icon": {
      const CustomIconComponent = widget.settings?.customIcon
        ? ICON_LIBRARY.find(
            (i: any) => i.name === widget.settings?.customIcon,
          )?.Icon
        : null;

      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              fontSize: `${fontSize || 48}px`,
              textAlign: "center",
              color: color || "#0c2f55",
              lineHeight: 1,
              padding: 16,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {widget.url ? (
              <img
                src={
                  widget.url.startsWith("http")
                    ? widget.url
                    : `${getImageUrl(widget.url)}`
                }
                alt="Icon"
                style={{
                  width: `${fontSize || 48}px`,
                  height: `${fontSize || 48}px`,
                  objectFit: "contain",
                }}
              />
            ) : CustomIconComponent ? (
              <CustomIconComponent size={fontSize || 48} />
            ) : (
              widget.content || "★"
            )}
          </div>
        </MaybeLink>
      );
    }

    case "icon_box": {
      const iconPosition = widget.settings?.iconPosition || "top";
      return (
        <MaybeLink widget={widget}>
          <div
            style={{
              display: "flex",
              flexDirection: iconPosition === "left" || iconPosition === "right" ? "row" : "column",
              alignItems: "center",
              textAlign: iconPosition === "left" ? "left" : "center",
              gap: 16,
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
                marginBottom: iconPosition === "top" ? 16 : 0,
                order: iconPosition === "right" ? 1 : 0,
                flex: "0 0 auto",
                color: color || "#0c2f55",
              }}
            >
              {widget.url ? (
                <img src={widget.url} alt="" style={{ width: 48, height: 48, objectFit: "contain" }} />
              ) : (
                <BuilderIcon name={widget.content || "FaStar"} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: "0 0 8px", fontSize: 20, color }}>
                {widget.items?.[0]?.title ||
                  widget.settings?.items?.[0]?.title ||
                  "Feature Title"}
              </h3>
              <p style={{ margin: 0, color, fontSize: 14, opacity: 0.75 }}>
                {widget.items?.[0]?.content ||
                  widget.settings?.items?.[0]?.content ||
                  "Add feature description here."}
              </p>
            </div>
          </div>
        </MaybeLink>
      );
    }

    case "image_box":
      return (
        <div
          style={{
            overflow: "hidden",
            background: bgColor || "transparent",
            borderRadius: s.borderRadius ? `${s.borderRadius}px` : 8,
            textAlign: textAlign as React.CSSProperties["textAlign"],
          }}
        >
          {widget.url ? (
            <img
              src={widget.url}
              alt={widget.accessibility?.altText || ""}
              style={{
                display: "block",
                width: "100%",
                maxHeight: s.maxHeight || "320px",
                objectFit: s.objectFit || "cover",
              }}
            />
          ) : (
            <WidgetEmptyState
              icon="▧"
              title="Choose an Image"
              subtitle="Select or upload an image in the Content tab"
            />
          )}
          <div style={{ padding: 20 }}>
            <h3 style={{ margin: "0 0 8px", color }}>
              {widget.settings?.title || "Image Box Title"}
            </h3>
            <p style={{ margin: 0, color }}>{widget.content}</p>
          </div>
        </div>
      );

    case "link_bio_minimalist":
    case "link_bio_classic":
    case "link_bio_showcase":
    case "link_bio_links":
    case "link_bio_services":
    case "link_bio_portfolio":
    case "link_bio_business_card": {
      const bioLayout = widget.type.replace("link_bio_", "");
      return (
        <section
          className={`builder-link-bio builder-link-bio-${bioLayout}`}
          style={{
            maxWidth: 480,
            width: "100%",
            margin: "0 auto",
            padding: 24,
            borderRadius: s.borderRadius ?? 16,
            background:
              bgColor ||
              (bioLayout === "minimalist"
                ? "transparent"
                : bioLayout === "portfolio"
                  ? "#f8f4ef"
                  : bioLayout === "services"
                    ? "#eff8f5"
                    : bioLayout === "showcase"
                      ? "#eef4ff"
                      : "#f7f8fa"),
            border:
              bioLayout === "business_card" ? "1px solid #dce2e8" : undefined,
            boxShadow:
              bioLayout === "showcase"
                ? "0 12px 30px rgba(12, 47, 85, 0.12)"
                : undefined,
            color: color || "#17202a",
            textAlign: "center",
            boxSizing: "border-box",
          }}
        >
          {widget.url && (
            <img
              src={widget.url}
              alt=""
              style={{
                width: 96,
                height: 96,
                borderRadius: bioLayout === "business_card" ? 12 : "50%",
                objectFit: "cover",
                margin: "0 auto 14px",
              }}
            />
          )}
          <h2 style={{ margin: "0 0 8px", fontSize: 24 }}>
            {widget.settings?.profileName || "Your Name"}
          </h2>
          {widget.content && (
            <p style={{ margin: "0 0 20px" }}>{widget.content}</p>
          )}
          <div style={{ display: "grid", gap: 10 }}>
            {(widget.items || []).map((item) => (
              <a
                key={item.id}
                href={item.link?.url || "#"}
                target={item.link?.target || "_self"}
                rel={
                  item.link?.target === "_blank"
                    ? "noopener noreferrer"
                    : undefined
                }
                style={{
                  display: "block",
                  padding: "12px 16px",
                  borderRadius:
                    bioLayout === "links" ? 999 : (s.borderRadius ?? 8),
                  background:
                    bioLayout === "minimalist" ? "transparent" : "#ffffff",
                  border:
                    bioLayout === "minimalist" ? "none" : "1px solid #dce2e8",
                  color: color || "#17202a",
                  textDecoration: "none",
                  fontWeight: 600,
                }}
              >
                {item.title}
              </a>
            ))}
          </div>
        </section>
      );
    }

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

    case "carousel":
    case "slider": {
      const images = widget.settings?.images || [];
      const items = widget.items || [];
      const totalSlides = Math.max(images.length, items.length);

      if (totalSlides === 0) {
        return (
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
      );
    }

    case "spacer":
      return (
        <div
          style={{
            height: toCssDimension(s.spacerHeight !== undefined
              ? { value: s.spacerHeight, unit: s.spacerUnit || "px" }
              : { value: s.padding?.top || 50, unit: "px" }) || "50px",
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

    case "divider":
      return (
        <hr
          style={{
            border: 0,
            borderTop: `${s.borderWidth || 1}px ${s.borderStyle || "solid"} ${s.borderColor || "#e0e0e0"}`,
            margin: "16px 0",
            width: toCssDimension(rs.width ?? s.width) || "100%",
            alignSelf: "auto",
            marginLeft: (rs.elementAlign || s.elementAlign) === "center" ? "auto" : undefined,
            marginRight: (rs.elementAlign || s.elementAlign) === "center" ? "auto" : undefined,
          }}
        />
      );

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
              id={item.cssId || undefined}
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
                {/* ✅ Render nested children here */}
                {item.children && item.children.length > 0 ? (
                  <RenderNestedChildren
                    children={item.children}
                    device={device}
                    isEditMode={isEditMode}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onResize={onResize}
                    onUpdateWidget={onUpdateWidget}
                    onContextMenu={onContextMenu}
                  />
                ) : (
                  item.content
                )}
                <ItemDropZone
                  widgetId={widget.id}
                  itemId={item.id}
                  isEditMode={isEditMode}
                />
              </div>
            </details>
          ))}
        </div>
      ) : (
        <WidgetEmptyState
          icon="☰"
          title="Add Accordion Items"
          subtitle="Configure from Content tab"
        />
      );

    case "tabs":
      return (widget.items || []).length > 0 ? (
        <div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              borderBottom: "1px solid #e0e0e0",
            }}
          >
            {widget.items?.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === activeTabIndex}
                onClick={() => setActiveTabIndex(i)}
                style={{
                  padding: "10px 20px",
                  fontWeight: i === activeTabIndex ? 700 : 500,
                  color: i === activeTabIndex ? color || "#0c2f55" : "#666",
                  border: 0,
                  borderBottom: i === activeTabIndex ? `2px solid ${color || "#0c2f55"}` : "2px solid transparent",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                {item.title}
              </button>
            ))}
          </div>
          <div
            id={widget.items?.[activeTabIndex]?.cssId || undefined}
            style={{ padding: 12, color: "#666" }}
            role="tabpanel"
          >
            {widget.items?.[activeTabIndex]?.children &&
            widget.items[activeTabIndex].children!.length > 0 ? (
              <RenderNestedChildren
                children={widget.items[activeTabIndex].children!}
                device={device}
                isEditMode={isEditMode}
                selectedId={selectedId}
                onSelect={onSelect}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onResize={onResize}
                onUpdateWidget={onUpdateWidget}
                onContextMenu={onContextMenu}
              />
            ) : (
              widget.items?.[activeTabIndex]?.content
            )}
            {widget.items?.[activeTabIndex] && (
              <ItemDropZone
                widgetId={widget.id}
                itemId={widget.items[activeTabIndex].id}
                isEditMode={isEditMode}
              />
            )}
          </div>
        </div>
      ) : (
        <WidgetEmptyState
          icon="▭"
          title="Add Tab Items"
          subtitle="Configure from Content tab"
        />
      );

    case "testimonial":
      {
      const slides = widget.items || [];
      const slide = slides.length
        ? slides[activeTabIndex % slides.length]
        : undefined;
      const alignment = widget.settings?.testimonialAlignment || "center";
      const testimonialLayout = widget.settings?.testimonialLayout || "image-inline";
      return (
        <div
          style={{
            background: bgColor || "#f8f9fc",
            padding: 32,
            borderRadius:
              widget.settings?.testimonialSkin === "bubble" ? 24 : 12,
            textAlign: alignment,
            width: "100%",
            alignSelf: "stretch",
            boxSizing: "border-box",
          }}
        >
          {slide?.image && (
            <img
              src={slide.image}
              alt={slide.title || "Testimonial author"}
              style={{
                width: 64,
                height: 64,
                borderRadius: "50%",
                objectFit: "cover",
                display: "block",
                margin:
                  testimonialLayout === "image-above"
                    ? "0 auto 16px"
                    : "0 0 16px",
              }}
            />
          )}
          <div style={{ fontSize: 24, color: "#f0b429", marginBottom: 12 }}>
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
            "{slide?.content || "Add a testimonial quote."}"
          </p>
          <div style={{ fontWeight: 700 }}>{slide?.title}</div>
          {slide?.label && (
            <div style={{ marginTop: 4, color: "#667085", fontSize: 13 }}>
              {slide.label}
            </div>
          )}
          {slides.length > 1 && (
            <div
              className="testimonial-preview-controls"
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                gap: 12,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                aria-label="Previous testimonial"
                onClick={() =>
                  setActiveTabIndex((index) => (index - 1 + slides.length) % slides.length)
                }
              >
                ‹
              </button>
              <span>{(activeTabIndex % slides.length) + 1} / {slides.length}</span>
              <button
                type="button"
                aria-label="Next testimonial"
                onClick={() =>
                  setActiveTabIndex((index) => (index + 1) % slides.length)
                }
              >
                ›
              </button>
            </div>
          )}
        </div>
      );
      }

    case "counter":
      {
      const rawEnd =
        widget.settings?.counterEnd ??
        Number(widget.items?.[0]?.content || widget.settings?.items?.[0]?.content || widget.content || 1000);
      const number = widget.settings?.counterThousandsSeparator === false
        ? String(rawEnd)
        : String(rawEnd).replace(/\B(?=(\d{3})+(?!\d))/g, widget.settings?.counterSeparator || ",");
      const CounterTitle = (["div", "p", "span", "h1", "h2", "h3", "h4", "h5", "h6"].includes(
        widget.settings?.counterTitleTag || "div",
      ) ? widget.settings?.counterTitleTag || "div" : "div") as ElementType;
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
            {widget.settings?.counterPrefix || ""}
            {number}
            {widget.settings?.counterSuffix || ""}
          </div>
          <CounterTitle style={{ color, marginTop: 12, fontSize: 15, opacity: 0.75 }}>
            {widget.items?.[0]?.title ||
              widget.settings?.items?.[0]?.title ||
              "Happy Clients"}
          </CounterTitle>
        </div>
      );
      }

    case "progress_bar":
      {
      const percentage = Math.max(
        0,
        Math.min(
          100,
          Number(widget.settings?.progressPercent ?? widget.items?.[0]?.content ?? 50),
        ),
      );
      const titleTag = widget.settings?.progressTitleTag || "span";
      const ProgressTitle = (["span", "div", "p", "h1", "h2", "h3", "h4", "h5", "h6"].includes(titleTag)
        ? titleTag
        : "span") as ElementType;
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
            {widget.settings?.showProgressTitle !== false && (
              <ProgressTitle style={{ fontWeight: 600, margin: 0 }}>
                {widget.settings?.progressTitle || widget.items?.[0]?.title || "My Skill"}
              </ProgressTitle>
            )}
            {widget.settings?.showProgressPercent !== false && (
              <span>{percentage}%</span>
            )}
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
                width: `${percentage}%`,
                height: "100%",
                background: color || "#0c2f55",
                borderRadius: 6,
              }}
            >
              {widget.settings?.progressInnerText && (
                <span
                  style={{
                    display: "block",
                    overflow: "hidden",
                    padding: "0 10px",
                    color: "#fff",
                    fontSize: 12,
                    lineHeight: "12px",
                    whiteSpace: "nowrap",
                  }}
                >
                  {widget.settings.progressInnerText}
                </span>
              )}
            </div>
          </div>
        </div>
      );
      }

    case "form":
      {
      const configuredFields = Array.isArray(widget.settings?.formFields)
        ? widget.settings.formFields.filter(
            (field): field is WidgetItem =>
              Boolean(field) && typeof field === "object",
          )
        : null;
      const formFields: WidgetItem[] = configuredFields ?? [
        { id: "name", title: "Name", fieldType: "text" },
        { id: "email", title: "Email", fieldType: "email" },
        { id: "message", title: "Message", fieldType: "textarea" },
      ];
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
          {formFields.map((field) => (
            <label key={field.id} style={{ display: "block", marginBottom: 12 }}>
              <span>{field.title}</span>
              {field.fieldType === "textarea" ? (
                <textarea placeholder={field.placeholder || ""} rows={3} readOnly style={{ width: "100%", padding: 12, marginTop: 4, border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }} />
              ) : field.fieldType === "select" ? (
                <select disabled style={{ width: "100%", padding: 12, marginTop: 4, border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }}>
                  {(Array.isArray(field.options)
                    ? field.options.filter(
                        (option): option is string =>
                          typeof option === "string",
                      )
                    : []
                  ).map((option) => <option key={option}>{option}</option>)}
                </select>
              ) : field.fieldType === "checkbox" ? (
                <input type="checkbox" disabled />
              ) : (
                <input type={field.fieldType || "text"} placeholder={field.placeholder || ""} readOnly style={{ width: "100%", padding: 12, marginTop: 4, border: "1px solid #ddd", borderRadius: 6, boxSizing: "border-box" }} />
              )}
            </label>
          ))}
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
      }

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
                overflow: "hidden",
              }}
            >
              {item.image || item.iconType === "image" ? (
                <img
                  src={item.image}
                  alt=""
                  style={{
                    width: 24,
                    height: 24,
                    objectFit: "contain",
                  }}
                />
              ) : ICON_LIBRARY.some((entry) => entry.name === item.icon) ? (
                <BuilderIcon
                  name={item.icon}
                  style={{ fontSize: s.iconSize || 20, color: s.iconColor || color || "#fff" }}
                />
              ) : (
                (item.icon || item.title || "•").slice(0, 2)
              )}
            </a>
          ))}
        </div>
      );

    case "post_grid":
    case "loop_grid":
    case "loop_carousel": {
      const isLoopCarousel = widget.type === "loop_carousel";
      return (
        <div
          style={{
            display: isLoopCarousel ? "flex" : "grid",
            gridTemplateColumns: isLoopCarousel ? undefined : `repeat(${widget.settings?.columns || 3}, minmax(0, 1fr))`,
            gap: 20,
            overflowX: isLoopCarousel ? "auto" : undefined,
            scrollSnapType: isLoopCarousel ? "x mandatory" : undefined,
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
                flex: isLoopCarousel ? "0 0 min(82vw, 360px)" : undefined,
                scrollSnapAlign: isLoopCarousel ? "start" : undefined,
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
    }

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

    case "cart":
    case "checkout":
    case "my_account":
    case "order_summary":
      return (
        <div
          style={{
            background: "#fff",
            border: "1px dashed #cfd8e3",
            borderRadius: 8,
            padding: 16,
            minHeight: 240,
            pointerEvents: isEditMode ? "none" : "auto",
            width: "100%",
            alignSelf: "stretch",
            boxSizing: "border-box",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "#93003c",
              fontWeight: 700,
              marginBottom: 10,
              textTransform: "uppercase",
              letterSpacing: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "#93003c",
                display: "inline-block",
              }}
            />
            Live Preview — {widget.label}
          </div>

          <Suspense
            fallback={
              <div style={{ padding: 20, color: "#888", fontSize: 13 }}>
                Loading store section…
              </div>
            }
          >
            <StorefrontWidget
              page={
                widget.type === "my_account"
                  ? "account"
                  : widget.type === "order_summary"
                    ? "received"
                    : widget.type
              }
              embedded
              previewMode
              settings={widget.settings}
            />
          </Suspense>
        </div>
      );

    case "product_title":
      return (
        <div style={{ ...baseStyle, fontWeight: 600 }}>
          {productPreview?.title || "Choose a product preview"}
        </div>
      );

    case "product_price":
      return (
        <div style={{ ...baseStyle, fontWeight: 700 }}>
          {productPreview ? (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              {Number(productPreview.regular_price || 0) > Number(productPreview.price || 0) && (
                <del style={{ color: "#6b7280", fontSize: "0.9em", fontWeight: 400 }}>
                  ₹{Number(productPreview.regular_price).toFixed(2)}
                </del>
              )}
              <strong>₹{Number(productPreview.price || 0).toFixed(2)}</strong>
              {Number(productPreview.regular_price || 0) > Number(productPreview.price || 0) && (
                <small style={{ color: "#b42318" }}>
                  {Math.round(((Number(productPreview.regular_price) - Number(productPreview.price)) / Number(productPreview.regular_price)) * 100)}% off
                </small>
              )}
            </span>
          ) : "Product Price"}
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
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
            minHeight: 160,
            display: "grid",
            placeItems: "center",
            padding: 16,
            textAlign: "center",
            overflowWrap: "anywhere",
            background: "#f3f4f6",
          }}
        >
          Choose a product preview in Content settings to show its image
        </div>
      );

    case "product_gallery":
      return Array.isArray(productPreview?.gallery) &&
        productPreview.gallery.some(
          (image) => image && typeof image.url === "string",
        ) ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
            gap: 8,
          }}
        >
          {productPreview.gallery
            .filter((image) => image && typeof image.url === "string")
            .map((image, index) => (
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
          {Array.isArray(productPreview?.tags)
            ? productPreview.tags.join(", ") || "Product Tags"
            : "Product Tags"}
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
      return Array.isArray(productPreview?.attributes) &&
        productPreview.attributes.some(
          (attr) => attr && typeof attr === "object",
        ) ? (
        <table
          style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
        >
          <tbody>
            {productPreview.attributes
              .filter((attr) => attr && typeof attr === "object")
              .map((attr, i) => (
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
                  {Array.isArray(attr.options) ? attr.options.join(", ") : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div style={baseStyle}>Product Attributes</div>
      );

    case "product_variations":
      return Array.isArray(productPreview?.variations) &&
        productPreview.variations.some(
          (variation) => variation && typeof variation === "object",
        ) ? (
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
            {productPreview.variations
              .filter((variation) => variation && typeof variation === "object")
              .map((v, i) => (
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
          <span
            style={{
              width: 32,
              height: 32,
              textAlign: "center",
              lineHeight: "32px",
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          >
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
          <span
            style={{
              width: 32,
              height: 32,
              textAlign: "center",
              lineHeight: "32px",
              border: "1px solid #ddd",
              borderRadius: 4,
            }}
          >
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
                <h4 style={{ margin: "0 0 6px", fontSize: 13 }}>Product {i}</h4>
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

    case "html":
      return (
        <div
          style={{ width: "100%", alignSelf: "stretch" }}
          dangerouslySetInnerHTML={{
            __html: widget.content || "<p>Custom HTML content</p>",
          }}
        />
      );

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
        <WidgetEmptyState
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
        <WidgetEmptyState
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
            <path
              id={`text-path-${widget.id}`}
              d="M 20,145 Q 160,-20 300,145"
            />
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
      const headers = Array.isArray(widget.settings?.tableHeaders)
        ? widget.settings.tableHeaders
        : ["Name", "Role"];
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

    case "audio":
      return widget.url ? (
        <audio
          src={widget.url}
          controls={widget.settings?.controls !== false}
          style={{ width: "100%" }}
        />
      ) : (
        <WidgetEmptyState icon="♫" title="Audio" subtitle="Choose an audio file in Content settings" />
      );

    case "blockquote":
      return (
        <blockquote style={{ ...baseStyle, borderLeft: "3px solid #2563eb", paddingLeft: 20, marginLeft: 0 }}>
          <p>{widget.content}</p>
          {widget.settings?.author && <footer>— {widget.settings.author}</footer>}
        </blockquote>
      );

    case "breadcrumbs":
      return (
        <nav aria-label="Breadcrumb">
          {(widget.items || []).map((item, index) => (
            <span key={item.id}>
              {index > 0 && " / "}
              {item.title}
            </span>
          ))}
        </nav>
      );

    case "call_to_action":
      return (
        <section style={{ ...baseStyle, padding: 24, textAlign: "center", background: bgColor || "#f3f6fb" }}>
          <h2>{widget.settings?.title || "Take the next step"}</h2>
          <p>{widget.settings?.description}</p>
          <button type="button" className="canvas-widget-action">{widget.content || "Get Started"}</button>
        </section>
      );

    case "flip_box": {
      const front = widget.items?.[0];
      const back = widget.items?.[1];
      return (
        <details style={{ ...baseStyle, minHeight: 140, padding: 20, border: "1px solid #e5e7eb" }}>
          <summary style={{ cursor: "pointer" }}>
            <strong>{front?.title || "Front"}</strong>
            <p>{front?.content}</p>
          </summary>
          <div>
            <strong>{back?.title || "Back"}</strong>
            <p>{back?.content}</p>
          </div>
        </details>
      );
    }

    case "price_list":
      return (
        <div style={{ ...baseStyle, display: "grid", gap: 12 }}>
          {(widget.items || []).map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px dotted #cbd5e1", paddingBottom: 8 }}>
              <span><strong>{item.title}</strong><br />{item.content}</span>
              <strong>{item.label}</strong>
            </div>
          ))}
        </div>
      );

    case "price_table":
      return (
        <section style={{ ...baseStyle, padding: 24, textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 8 }}>
          <h2>{widget.settings?.title || "Plan"}</h2>
          <strong>{widget.settings?.author}</strong>
          <p>{widget.content}</p>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {(widget.items || []).map((item) => <li key={item.id}>✓ {item.title}</li>)}
          </ul>
          <button type="button" className="canvas-widget-action">Choose Plan</button>
        </section>
      );

    case "share_buttons":
      return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {(widget.items || []).map((item) => (
            <button type="button" key={item.id} className="canvas-widget-action">{item.title || "Share"}</button>
          ))}
        </div>
      );

    case "slides":
      return (
        <div style={{ display: "flex", gap: 12, overflowX: "auto" }}>
          {(widget.items || []).map((item) => (
            <article key={item.id} style={{ flex: "0 0 100%", minHeight: 180, padding: 20, background: item.image ? `linear-gradient(#0005,#0005),url("${item.image}") center/cover` : "#f1f5f9", color: item.image ? "#fff" : color }}>
              <h2>{item.title}</h2>
              <p>{item.content}</p>
            </article>
          ))}
        </div>
      );

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
  parentId?: string | null;
  index?: number;
  onContextMenu?: (e: React.MouseEvent, widgetId: string) => void;
  disableDrag?: boolean;
  isRoot?: boolean;
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
  parentId = null,
  index = 0,
  onContextMenu,
  disableDrag = false,
  isRoot = false,
}: CanvasRendererProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: isPreview || disableDrag });

  const [resizing, setResizing] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [mediaPickerOpen, setMediaPickerOpen] = useState(false);
  const [mediaPickerMultiple, setMediaPickerMultiple] = useState(false);
  const fontFamily =
    widget.style.responsive?.[device]?.fontFamily ?? widget.style.fontFamily;

  useEffect(() => {
    loadGoogleFont(fontFamily);
  }, [fontFamily]);

  const isSelected = selectedId === widget.id;
  const isContainer = [
    "container", "section", "column", "grid",
    "box", "col", "flex", "flexbox", "fbox", "loop_grid", "loop_carousel",
  ].includes(widget.type);
  const isLoopWidget = widget.type === "loop_grid" || widget.type === "loop_carousel";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const responsiveWidgetStyle = widget.style.responsive?.[device] || {};
  const explicitWidth = toCssDimension(
    responsiveWidgetStyle.width ?? widget.style.width,
  );
  const hasConstrainedWidth =
    Boolean(explicitWidth) &&
    explicitWidth !== "auto" &&
    !(explicitWidth!.endsWith("%") && Number.parseFloat(explicitWidth!) >= 100);
  const itemFlexGrow =
    responsiveWidgetStyle.flexGrow ?? widget.style.flexGrow;
  const itemFlexShrink =
    responsiveWidgetStyle.flexShrink ?? widget.style.flexShrink;
  const itemFlexBasis =
    responsiveWidgetStyle.flexBasis ?? widget.style.flexBasis;
  const configuredMinWidth = toCssDimension(
    responsiveWidgetStyle.minWidth ?? widget.style.minWidth,
  );
  const configuredMaxWidth = toCssDimension(
    responsiveWidgetStyle.maxWidth ?? widget.style.maxWidth,
  );
  const configuredElementAlign = String(
    responsiveWidgetStyle.elementAlign ??
      widget.style.elementAlign ??
      (hasConstrainedWidth ? "center" : ""),
  ).toLowerCase();
  const itemStyle: React.CSSProperties = {
    ...style,
    boxSizing: "border-box",
    width: explicitWidth,
    maxWidth: configuredMaxWidth
      ? `min(100%, ${configuredMaxWidth})`
      : "100%",
    minWidth: configuredMinWidth
      ? `min(100%, ${configuredMinWidth})`
      : 0,
    flex:
      hasConstrainedWidth || itemFlexGrow !== undefined || itemFlexBasis
        ? `${itemFlexGrow ?? 0} ${itemFlexShrink ?? 1} ${itemFlexBasis ? toCssDimension(itemFlexBasis) : "auto"}`
        : undefined,
    alignSelf:
      responsiveWidgetStyle.alignSelf ?? widget.style.alignSelf,
    order: responsiveWidgetStyle.order ?? widget.style.order,
    marginLeft:
      isRoot && hasConstrainedWidth
        ? configuredElementAlign === "right" ||
          configuredElementAlign === "end" ||
          configuredElementAlign === "center" ||
          configuredElementAlign === "middle"
          ? "auto"
          : undefined
        : undefined,
    marginRight:
      isRoot && hasConstrainedWidth
        ? configuredElementAlign === "left" ||
          configuredElementAlign === "start" ||
          configuredElementAlign === "center" ||
          configuredElementAlign === "middle"
          ? "auto"
          : undefined
        : undefined,
  };

  const rawWidgetStyle = renderWidgetStyles(widget.style, device);
  let customAttributes: Record<string, any> = {};
  try {
    const parsed = JSON.parse(String((widget.style as any).customAttributes || "{}"));
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) customAttributes = parsed;
  } catch { /* Invalid attribute JSON should not break the editor canvas. */ }

  const widgetStyle: React.CSSProperties =
    isLoopWidget
      ? {
          ...rawWidgetStyle,
          display: "block",
          width: "100%",
          minWidth: 0,
          boxSizing: "border-box",
        }
      : widget.type === "button"
      ? {
          ...rawWidgetStyle,
          display: "block",
          width: "100%",
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
      let currentWidth =
        parseInt(widget.style.width || `${rect.width}px`, 10) || rect.width;
      let currentHeight =
        parseInt(widget.style.height || `${rect.height}px`, 10) || rect.height;

      let newWidth = currentWidth;
      let newHeight = currentHeight;

      if (direction.includes("e")) newWidth = currentWidth + deltaX;
      if (direction.includes("w")) newWidth = currentWidth - deltaX;
      if (direction.includes("s")) newHeight = currentHeight + deltaY;
      if (direction.includes("n")) newHeight = currentHeight - deltaY;

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
    [widget.id, widget.style.width, widget.style.height, onResize],
  );

  const handleResizeEnd = useCallback(() => setResizing(null), []);

  const handleOpenMedia = (multiple: boolean, _target?: string) => {
    setMediaPickerMultiple(multiple);
    setMediaPickerOpen(true);
  };

  const handleMediaSelect = (media: PickedMedia | PickedMedia[]) => {
    if (!onUpdateWidget) return;
    const pickedArray = Array.isArray(media) ? media : [media];

    if (
      widget.type === "image" ||
      widget.type === "video" ||
      widget.type === "site_logo" ||
      widget.type === "icon"
    ) {
      const picked = pickedArray[0];
      onUpdateWidget(widget.id, {
        url: picked.url,
        content: "",
        settings: {
          ...widget.settings,
          customIcon: null,
        },
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

  const handleRightClick = (e: React.MouseEvent) => {
    if (isPreview) return;
    e.stopPropagation();
    onSelect(widget.id);
    onContextMenu?.(e, widget.id);
  };

  return (
    <>
      <div
        ref={setNodeRef}
        data-widget-id={widget.id}
        style={itemStyle}
        className={`canvas-element ${
          isSelected ? "active" : ""
        } ${isPreview ? "preview-mode" : ""} ${
          isContainer ? "is-container" : ""
        } ${hasConstrainedWidth ? "has-explicit-width" : ""} ${
          isRoot ? "is-root-element" : ""
        } ${
          widget.children?.length ? "has-children" : "no-children"
        }`}
        onClick={handleClick}
        onContextMenu={handleRightClick}
      >
        {!isPreview && activeDragType && (
          <InlineDropZone
            parentId={parentId}
            index={index}
            activeDragType={activeDragType}
          />
        )}

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

        <StyleInjector css={getHoverAndAnimation({ ...widget.style, ...(widget.style.responsive?.[device] || {}) }, widget.id).cssText} />
        <div
          {...customAttributes}
          id={(widget.style as any).cssId || undefined}
          style={widgetStyle}
          className={`canvas-element-inner ${getHoverAndAnimation({ ...widget.style, ...(widget.style.responsive?.[device] || {}) }, widget.id).className} ${(widget.style as any).customClasses || ""}`.trim()}
          data-widget-type={widget.type}
          data-widget-id={widget.id}
        >
          {isContainer ? (
            <>
              {(widget.style as any).backgroundType === "video" && (widget.style as any).backgroundVideo ? (
                <video aria-hidden="true" autoPlay muted loop playsInline src={(widget.style as any).backgroundVideo} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", zIndex: 0, pointerEvents: "none" }} />
              ) : null}
              {isLoopWidget ? (
                <div
                  className="loop-canvas-preview"
                  style={{
                    display: widget.type === "loop_carousel" ? "flex" : "grid",
                    gridTemplateColumns: widget.type === "loop_carousel"
                      ? undefined
                      : `repeat(${Math.max(1, Math.min(6, widget.settings?.columns || 3))}, minmax(0, 1fr))`,
                    gap: 12,
                    overflowX: widget.type === "loop_carousel" ? "auto" : undefined,
                    width: "100%",
                    minWidth: 0,
                    boxSizing: "border-box",
                  }}
                >
                  <div className="loop-template-card" style={{ minWidth: 0, width: "100%", boxSizing: "border-box", padding: 12, border: "1px dashed #7c83ff", background: "#f8f9ff", borderRadius: 6 }}>
                    <strong style={{ display: "block", marginBottom: 8, fontSize: 11, color: "#596273" }}>
                      {widget.settings?.loopSource === "products" ? "PRODUCT ITEM TEMPLATE" : "LOOP ITEM TEMPLATE"}
                    </strong>
                    <SortableContext
                      items={(widget.children || []).map((child) => child.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      {widget.children?.map((child, childIndex) => (
                        <CanvasRenderer
                          key={child.id}
                          widget={child}
                          parentId={widget.id}
                          index={childIndex}
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
                          onContextMenu={onContextMenu}
                          disableDrag={disableDrag}
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
                  </div>
                  {[1, 2].map((previewIndex) => (
                    <div
                      key={previewIndex}
                      aria-hidden="true"
                      style={{
                        minHeight: 140,
                        border: "1px dashed #cbd5e1",
                        borderRadius: 6,
                        background: "rgba(255,255,255,.25)",
                      }}
                    />
                  ))}
                </div>
              ) : (
                <>
                  <SortableContext
                    items={(widget.children || []).map((c) => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {widget.children?.map((child, childIndex) => (
                      <CanvasRenderer
                        key={child.id}
                        widget={child}
                        parentId={widget.id}
                        index={childIndex}
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
                        onContextMenu={onContextMenu}
                        disableDrag={disableDrag}
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
              )}
            </>
          ) : (
            <WidgetContent
              widget={widget}
              device={device}
              isEditMode={!isPreview}
              onOpenMedia={handleOpenMedia}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onResize={onResize}
              onUpdateWidget={onUpdateWidget}
              onContextMenu={onContextMenu}
              onChangeContent={(content) => {
                if (onUpdateWidget) {
                  onUpdateWidget(widget.id, { content });
                }
              }}
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
