import axios from "axios";

import { API_URL } from "./config";

const PAGE_BUILDER_URL = `${API_URL}/api/page-builder`;

const getHeaders = () => {
  const token = typeof window !== "undefined" ? window.localStorage.getItem("access_token") : null;

  return {
    Authorization: token ? `Bearer ${token}` : "",
  };
};

export type WidgetType =
  | "container"
  | "grid"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "spacer"
  | "icon"
  | "gallery"
  | "carousel"
  | "video"
  | "icon_box"
  | "divider"
  | "accordion"
  | "tabs"
  | "form"
  | "posts"
  | "post_grid"
  | "post_list"
  | "products"
  | "product_grid"
  | "html"
  | "shortcode"
  | "menu"
  | "search"
  | "social_icons"
  | "testimonial"
  | "progress_bar"
  | "counter"
  | "countdown"
  | "map"
  | "table"
  | "alert"
  | "rating"
  | "author_box"
  | "breadcrumbs"
  | "pagination"
  | "post_title"
  | "post_content"
  | "featured_image"
  | "post_excerpt"
  | "post_meta"
  | "site_logo"
  | "site_title"
  | "site_tagline"
  | "archive_title"
  | "archive_description"
  | "product_title"
  | "product_price"
  | "product_image"
  | "product_gallery"
  | "product_description"
  | "add_to_cart"
  | "product_rating"
  | "product_stock"
  | "related_products"
  | "cart"
  | "checkout"
  | "my_account";

export type PageStatus = "draft" | "published";

export type CSSUnit = "px" | "%" | "vh" | "vw" | "em" | "rem" | "auto";
export type ResponsiveDevice = "desktop" | "tablet" | "mobile";
export type CSSDisplay = "block" | "inline" | "inline-block" | "flex" | "inline-flex" | "grid" | "inline-grid" | "none";
export type TextAlignment = "left" | "center" | "right" | "justify";
export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
export type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
export type BorderStyle = "none" | "solid" | "dashed" | "dotted" | "double" | "groove" | "ridge" | "inset" | "outset";
export type PositionType = "static" | "relative" | "absolute" | "fixed" | "sticky";
export type OverflowType = "visible" | "hidden" | "auto" | "scroll";

export interface DimensionValue {
  value: number | "auto";
  unit: CSSUnit;
}

export interface BoxSpacing {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}

export interface ShadowSettings {
  horizontal?: number;
  vertical?: number;
  blur?: number;
  spread?: number;
  color?: string;
  inset?: boolean;
}

export interface TransformSettings {
  translateX?: number;
  translateY?: number;
  rotate?: number;
  scale?: number;
  skewX?: number;
  skewY?: number;
}

export interface ResponsiveStyle {
  width?: DimensionValue;
  height?: DimensionValue;
  minWidth?: DimensionValue;
  maxWidth?: DimensionValue;
  minHeight?: DimensionValue;
  maxHeight?: DimensionValue;

  padding?: number;
  margin?: number;
  gap?: number;
  fontSize?: number;
  display?: CSSDisplay;
  hide?: boolean;
  paddingBox?: BoxSpacing;
  marginBox?: BoxSpacing;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  justifyContent?: string;
  alignItems?: string;
  alignContent?: string;
  gridColumns?: number;
  gridRows?: number;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridColumnGap?: number;
  gridRowGap?: number;
  textAlign?: TextAlignment;
  backgroundColor?: string;
  color?: string;
  borderRadius?: number;
}

export interface WidgetStyle {
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  backgroundRepeat?: string;
  backgroundAttachment?: "scroll" | "fixed" | "local";
  backgroundGradient?: string;
  backgroundClip?: string;
  overlayColor?: string;
  overlayOpacity?: number;

  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic" | "oblique";
  lineHeight?: number;
  letterSpacing?: number;
  wordSpacing?: number;
  textAlign?: TextAlignment;
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
  textDecoration?: "none" | "underline" | "overline" | "line-through";
  textShadow?: string;

  width?: string;
  height?: string;
  minWidth?: string;
  maxWidth?: string;
  minHeight?: string;
  maxHeight?: string;
  aspectRatio?: string;

  padding?: number;
  margin?: number;
  gap?: number;
  paddingBox?: BoxSpacing;
  marginBox?: BoxSpacing;

  display?: CSSDisplay;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  alignSelf?: string;
  order?: number;
  justifyContent?: string;
  alignItems?: string;
  alignContent?: string;

  gridColumns?: number;
  gridRows?: number;
  gridColumnGap?: number;
  gridRowGap?: number;
  gridTemplateColumns?: string;
  gridTemplateRows?: string;
  gridAutoFlow?: string;
  gridColumn?: string;
  gridRow?: string;

  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  borderRadius?: number;
  borderTopWidth?: number;
  borderRightWidth?: number;
  borderBottomWidth?: number;
  borderLeftWidth?: number;
  borderTopColor?: string;
  borderRightColor?: string;
  borderBottomColor?: string;
  borderLeftColor?: string;
  borderTopLeftRadius?: number;
  borderTopRightRadius?: number;
  borderBottomLeftRadius?: number;
  borderBottomRightRadius?: number;

  boxShadow?: string;
  boxShadowSettings?: ShadowSettings;

  opacity?: number;
  zIndex?: number;
  position?: PositionType;
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  overflow?: OverflowType;
  cursor?: string;
  pointerEvents?: "auto" | "none";

  transitionDuration?: number;
  hoverBackgroundColor?: string;
  hoverColor?: string;
  hoverBorderColor?: string;
  hoverBorderRadius?: number;
  hoverBoxShadow?: string;
  hoverScale?: number;
  hoverOpacity?: number;

  transform?: TransformSettings;
  animation?: string;
  animationDuration?: number;

  responsive?: Partial<Record<ResponsiveDevice, ResponsiveStyle>>;
  htmlTag?: string;
  ariaLabel?: string;
}

export interface LinkSettings {
  url?: string;
  target?: "_self" | "_blank";
  rel?: string;
  noFollow?: boolean;
}

export interface MediaItem {
  id: string;
  url: string;
  type: "image" | "video" | "audio";
  alt?: string;
  title?: string;
  caption?: string;
  mimeType?: string;
  width?: number;
  height?: number;
}

export interface WidgetItem {
  id: string;
  title: string;
  content?: string;
  image?: string;
  icon?: string;
  link?: LinkSettings;
}

export interface QuerySettings {
  source?: "latest" | "manual" | "category" | "tag";
  postType?: string;
  postIds?: string[];
  categoryIds?: string[];
  tagIds?: string[];
  orderBy?: "date" | "title" | "modified" | "menu_order";
  order?: "ASC" | "DESC";
  postsPerPage?: number;
  offset?: number;
  showPagination?: boolean;
  excludeIds?: string[];
}

export interface AccessibilitySettings {
  htmlTag?: string;
  ariaLabel?: string;
  role?: string;
  altText?: string;
  title?: string;
}

export interface AdvancedWidgetSettings {
  cssId?: string;
  customClasses?: string;
  customCSS?: string;
  visibility?: {
    desktop?: boolean;
    tablet?: boolean;
    mobile?: boolean;
  };
  htmlAttributes?: Record<string, string>;
}

export interface GlobalStyleReference {
  globalColorId?: string;
  globalFontId?: string;
  globalStyleId?: string;
}

export interface WidgetSettings {
  columns?: number;
  customClasses?: string;
  htmlTag?: string;
  autoplay?: boolean;
  autoplaySpeed?: number;
  showArrows?: boolean;
  showDots?: boolean;
  infiniteLoop?: boolean;
  pauseOnHover?: boolean;
  imageIds?: string[];
  images?: MediaItem[];
  queryType?: "latest" | "category" | "tag" | "manual";
  categoryIds?: string[];
  tagIds?: string[];
  postIds?: string[];
  postsPerPage?: number;
  orderBy?: "date" | "title" | "modified" | "menu_order";
  order?: "ASC" | "DESC";
  showImage?: boolean;
  showTitle?: boolean;
  showExcerpt?: boolean;
  showDate?: boolean;
  showAuthor?: boolean;
  showPrice?: boolean;
  showRating?: boolean;
  showPagination?: boolean;
  videoSource?: "youtube" | "vimeo" | "self_hosted" | "external";
  posterUrl?: string;
  controls?: boolean;
  muted?: boolean;
  loop?: boolean;
  iconName?: string;
  iconLibrary?: string;
  iconPosition?: "before" | "after" | "top" | "left" | "right";
  allowMultipleOpen?: boolean;
  defaultActiveItem?: number;
  items?: WidgetItem[];
  formId?: string;
  submitText?: string;
  successMessage?: string;
  redirectUrl?: string;
  imageSize?: string;
  imageFit?: "cover" | "contain" | "fill" | "none";
  imagePosition?: string;
  contentPosition?: string;
  dynamicSource?: string;
  dynamicField?: string;
}

export interface PageWidget {
  id: string;
  type: WidgetType;
  label: string;
  content?: string;
  url?: string;
  children?: PageWidget[];
  style: WidgetStyle;
  settings?: WidgetSettings;
  items?: WidgetItem[];
  media?: MediaItem[];
  link?: LinkSettings;
  query?: QuerySettings;
  accessibility?: AccessibilitySettings;
  advanced?: AdvancedWidgetSettings;
  globalStyle?: GlobalStyleReference;
}

export interface GlobalColor {
  id: string;
  name: string;
  value: string;
}

export interface GlobalFont {
  id: string;
  name: string;
  family: string;
  size?: number;
  weight?: number;
}

export interface BuilderGlobals {
  colors?: GlobalColor[];
  fonts?: GlobalFont[];
}

export interface TemplateConditions {
  include?: string[];
  exclude?: string[];
}

export type TemplateType = "header" | "footer" | "single" | "archive" | "page" | "product" | "product_archive" | "cart" | "checkout" | "my_account";

export interface BuilderTemplate {
  id: string;
  title: string;
  type: TemplateType;
  layout: PageWidget[];
  conditions?: TemplateConditions;
  status: PageStatus;
  created_at?: string;
  updated_at?: string;
}

export interface BuilderPage {
  id: string;
  title: string;
  slug: string;
  layout: PageWidget[];
  status: PageStatus;
  globals?: BuilderGlobals;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePageData {
  title: string;
  slug: string;
  layout: PageWidget[];
  status: PageStatus;
  globals?: BuilderGlobals;
}

export type UpdatePageData = CreatePageData;

export const getPages = async () => {
  const response = await axios.get(`${PAGE_BUILDER_URL}`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const getPage = async (pageId: string) => {
  const response = await axios.get(`${PAGE_BUILDER_URL}/${pageId}`, {
    headers: getHeaders(),
  });

  return response.data;
};

export const createPage = async (data: CreatePageData) => {
  const response = await axios.post(`${PAGE_BUILDER_URL}`, data, {
    headers: getHeaders(),
  });

  return response.data;
};

export const updatePage = async (pageId: string, data: UpdatePageData) => {
  const response = await axios.put(`${PAGE_BUILDER_URL}/${pageId}`, data, {
    headers: getHeaders(),
  });

  return response.data;
};

export const deletePage = async (pageId: string) => {
  const response = await axios.delete(`${PAGE_BUILDER_URL}/${pageId}`, {
    headers: getHeaders(),
  });

  return response.data;
};
