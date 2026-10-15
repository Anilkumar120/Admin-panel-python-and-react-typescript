import axios from "axios";
import { API_URL } from "./config";

const PAGE_BUILDER_URL = `${API_URL}/api/page-builder`;

const getHeaders = () => {
  const token =
    typeof window !== "undefined"
      ? window.localStorage.getItem("access_token")
      : null;

  return {
    Authorization: token ? `Bearer ${token}` : "",
    "Content-Type": "application/json",
  };
};

// ============ TYPES ============
export type WidgetType =
  | "container" | "grid" | "section" | "column"
  | "heading" | "text" | "image" | "button" | "spacer"
  | "icon" | "icon_box" | "icon_list" | "image_box" | "divider" | "alert"
  | "gallery" | "carousel" | "slider" | "video" | "map"
  | "accordion" | "tabs" | "toggle" | "testimonial"
  | "progress_bar" | "counter" | "countdown" | "rating"
  | "form" | "search" | "menu" | "social_icons"
  | "posts" | "post_grid" | "post_list" | "post_carousel"
  | "post_title" | "post_content" | "post_excerpt"
  | "post_meta" | "post_image" | "author_box"
  | "products" | "product_grid" | "product_list"
  | "product_title" | "product_price" | "product_image"
  | "product_gallery" | "product_description" | "product_short_description"
  | "product_categories" | "product_tags"
  | "add_to_cart" | "product_rating" | "product_stock"
  | "related_products" | "cart" | "checkout" | "my_account"
  | "html" | "shortcode" | "table" | "tablepress" | "text_path" | "menu_anchor" | "sidebar" | "read_more" | "soundcloud" | "map" | "breadcrumbs"
  | "link_bio_minimalist" | "link_bio_classic" | "link_bio_showcase"
  | "link_bio_links" | "link_bio_services" | "link_bio_portfolio" | "link_bio_business_card"
  | "pagination" | "site_logo" | "site_title"
  | "site_tagline" | "archive_title" | "archive_description"
  | "featured_image"
  | "nav_menu"
  | "footer_menu"
  | "copyright";

export type PageStatus = "draft" | "published";
export type CSSUnit = "px" | "%" | "vh" | "vw" | "em" | "rem" | "auto";
export type ResponsiveDevice = "desktop" | "tablet" | "mobile";
export type CSSDisplay =
  | "block" | "inline" | "inline-block"
  | "flex" | "inline-flex" | "grid" | "inline-grid" | "none";
export type TextAlignment = "left" | "center" | "right" | "justify";
export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
export type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
export type BorderStyle =
  | "none" | "solid" | "dashed" | "dotted"
  | "double" | "groove" | "ridge" | "inset" | "outset";
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
  unit?: string;
  linked?: boolean;
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
  width?: DimensionValue | string;
  height?: DimensionValue | string;
  minWidth?: DimensionValue | string;
  maxWidth?: DimensionValue | string;
  minHeight?: DimensionValue | string;
  maxHeight?: DimensionValue | string;
  padding?: BoxSpacing;
  margin?: BoxSpacing;
  gap?: number;
  fontSize?: number;
  display?: CSSDisplay;
  hide?: boolean;
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
  iconSize?: number;
  iconColor?: string;
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
  padding?: BoxSpacing;
  margin?: BoxSpacing;
  gap?: number;
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
  customClasses?: string;
  hoverTranslateY?: number;
  hoverTextDecoration?: string;
  animationDelay?: number;
  animationEasing?: "ease" | "ease-in" | "ease-out" | "ease-in-out" | "linear";
  transitionProperty?: string;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  objectPosition?: string;
  mobileBreakpoint?: "tablet" | "mobile";
  mobileMenuStyle?: "dropdown" | "slide" | "fullscreen";
  mobileMenuBgColor?: string;
  hamburgerColor?: string;
  menuAnimation?: "slide" | "fade" | "scale";
  // 🆕 Additional fields used by menu/header-footer widgets
  activeColor?: string;
  hoverUnderline?: boolean;
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

// ============ 🆕 WIDGET ITEM (with submenu support) ============
export interface WidgetItem {
  id: string;
  title: string;
  content?: string;
  image?: string;
  imageAlt?: string;
  icon?: string;
  link?: LinkSettings;
  button1Text?: string;
  button1Link?: string;
  button2Text?: string;
  button2Link?: string;
  contentPosition?: string;
  contentTextAlign?: string;
  contentColor?: string;
  customStyle?: boolean;

  // 🆕 For menu submenus (nested items)
  children?: WidgetItem[];

  // 🆕 Alternate fields from menu API
  url?: string;
  label?: string;
  target?: string;
  parent_id?: string;
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
  title?: string;
  description?: string;
  customClasses?: string;
  htmlTag?: string;
  autoplay?: boolean;
  autoplaySpeed?: number;
  showArrows?: boolean;
  showDots?: boolean;
  infiniteLoop?: boolean;
  pauseOnHover?: boolean;
  pauseOnInteraction?: boolean;
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
  rating?: number;
  mapAddress?: string;
  profileName?: string;
  profileDescription?: string;
  profileImage?: string;
  profileButtonText?: string;
  tableHeaders?: string[];
  shortcode?: string;
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
  altText?: string;
  previewProductId?: string;
  previewProduct?: {
    id: string;
    title: string;
    price: number;
    image?: string;
    description?: string;
    short_description?: string;
    quantity?: number;
    manage_stock?: boolean;
    category?: string;
    tags?: string[];
    gallery?: MediaItem[];
  };

  sliderName?: string;
  sliderHeight?: number;
  sliderHeightUnit?: string;
  navigation?: "none" | "arrows" | "dots" | "arrows-dots";
  transition?: "slide" | "fade" | "zoom";
  transitionSpeed?: number;
  contentAnimation?: "none" | "up" | "down" | "left" | "right" | "zoom";
  contentWidth?: number;
  contentWidthUnit?: string;
  contentPadding?: BoxSpacing;
  contentHorizontalPosition?: "left" | "center" | "right";
  contentVerticalPosition?: "top" | "middle" | "bottom";
  contentTextAlign?: "left" | "center" | "right";
  titleHtmlTag?: string;
  descriptionHtmlTag?: string;
  buttonStyle?: "solid" | "outline" | "text";

  // 🆕 Menu-specific
  selectedMenuId?: string;
  menuName?: string;
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
  containerWidth?: number;
  defaultFontFamily?: string;
  defaultFontSize?: number;
  defaultLineHeight?: number;
}

export interface BuilderPage {
  id: string;
  title: string;
  slug: string;
  layout: PageWidget[];
  status: PageStatus;
  globals?: BuilderGlobals;
  content_id?: string;
  post_type?: string;
  template_type?: string;
  conditions?: { include?: string[]; exclude?: string[] };
  show_title?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreatePageData {
  title: string;
  slug: string;
  layout: PageWidget[];
  status: PageStatus;
  globals?: BuilderGlobals;
  content_id?: string;
  post_type?: string;
  show_title?: boolean;
}

export type UpdatePageData = Partial<CreatePageData>;

// ============ API FUNCTIONS ============

export const getPages = async (params?: {
  status?: string;
  post_type?: string;
}): Promise<BuilderPage[]> => {
  const response = await axios.get(PAGE_BUILDER_URL, {
    headers: getHeaders(),
    params,
  });
  return response.data;
};

export const getPage = async (pageId: string): Promise<BuilderPage> => {
  const response = await axios.get(`${PAGE_BUILDER_URL}/${pageId}`, {
    headers: getHeaders(),
  });
  return response.data;
};

export const createPage = async (data: CreatePageData) => {
  const response = await axios.post(PAGE_BUILDER_URL, data, {
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

export const autosavePage = async (pageId: string, data: UpdatePageData) => {
  const response = await axios.patch(
    `${PAGE_BUILDER_URL}/${pageId}/autosave`,
    data,
    { headers: getHeaders() },
  );
  return response.data;
};

export const deletePage = async (pageId: string) => {
  const response = await axios.delete(`${PAGE_BUILDER_URL}/${pageId}`, {
    headers: getHeaders(),
  });
  return response.data;
};

export const duplicatePage = async (pageId: string) => {
  const response = await axios.post(
    `${PAGE_BUILDER_URL}/${pageId}/duplicate`,
    {},
    { headers: getHeaders() },
  );
  return response.data;
};

export const getGlobalStyles = async (): Promise<BuilderGlobals> => {
  const response = await axios.get(`${PAGE_BUILDER_URL}/globals/styles`, {
    headers: getHeaders(),
  });
  return response.data;
};

export const updateGlobalStyles = async (data: BuilderGlobals) => {
  const response = await axios.put(
    `${PAGE_BUILDER_URL}/globals/styles`,
    data,
    { headers: getHeaders() },
  );
  return response.data;
};

export const convertContentToBuilder = async (contentId: string) => {
  const response = await axios.post(
    `${PAGE_BUILDER_URL}/from-content/${contentId}`,
    {},
    { headers: getHeaders() },
  );
  return response.data as { id: string; existing: boolean; message: string };
};

export const linkBuilderToContent = async (
  pageId: string,
  contentId: string,
  postType: string,
) => {
  const response = await axios.post(
    `${PAGE_BUILDER_URL}/${pageId}/link-content`,
    { content_id: contentId, post_type: postType },
    { headers: getHeaders() },
  );
  return response.data;
};