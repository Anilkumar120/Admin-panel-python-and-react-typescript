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

// ============ Widget Type ============
export type WidgetType =
  | "container"
  | "grid"
  | "section"
  | "column"
  | "heading"
  | "text"
  | "image"
  | "button"
  | "spacer"
  | "icon"
  | "icon_box"
  | "icon_list"
  | "image_box"
  | "divider"
  | "alert"
  | "gallery"
  | "carousel"
  | "slider"
  | "video"
  | "map"
  | "accordion"
  | "tabs"
  | "toggle"
  | "testimonial"
  | "progress_bar"
  | "counter"
  | "countdown"
  | "rating"
  | "audio"
  | "blockquote"
  | "breadcrumbs"
  | "call_to_action"
  | "flip_box"
  | "price_list"
  | "price_table"
  | "share_buttons"
  | "slides"
  | "form"
  | "search"
  | "menu"
  | "social_icons"
  | "posts"
  | "post_grid"
  | "loop_grid"
  | "post_list"
  | "post_carousel"
  | "loop_carousel"
  | "post_title"
  | "post_content"
  | "post_excerpt"
  | "post_meta"
  | "post_image"
  | "author_box"
  | "products"
  | "product_grid"
  | "product_list"
  | "product_title"
  | "product_price"
  | "product_image"
  | "product_gallery"
  | "product_description"
  | "product_short_description"
  | "product_categories"
  | "product_tags"
  | "add_to_cart"
  | "product_rating"
  | "product_stock"
  | "related_products"
  | "cart"
  | "checkout"
  | "my_account"
  | "order_summary"
  | "product_sku"
  | "product_attributes"
  | "product_variations"
  | "quantity"
  | "recent_products"
  | "html"
  | "shortcode"
  | "table"
  | "tablepress"
  | "text_path"
  | "menu_anchor"
  | "sidebar"
  | "read_more"
  | "soundcloud"
  | "link_bio_minimalist"
  | "link_bio_classic"
  | "link_bio_showcase"
  | "link_bio_links"
  | "link_bio_services"
  | "link_bio_portfolio"
  | "link_bio_business_card"
  | "pagination"
  | "site_logo"
  | "site_title"
  | "site_tagline"
  | "archive_title"
  | "archive_description"
  | "featured_image"
  | "nav_menu"
  | "footer_menu"
  | "copyright";

export type PageStatus = "draft" | "published";
export type CSSUnit = "px" | "%" | "vh" | "vw" | "em" | "rem" | "auto";
export type ResponsiveDevice = "desktop" | "tablet" | "mobile";
export type CSSDisplay =
  | "block"
  | "inline"
  | "inline-block"
  | "flex"
  | "inline-flex"
  | "grid"
  | "inline-grid"
  | "none";
export type TextAlignment = "left" | "center" | "right" | "justify";
export type FlexDirection = "row" | "column" | "row-reverse" | "column-reverse";
export type FlexWrap = "nowrap" | "wrap" | "wrap-reverse";
export type BorderStyle =
  | "none"
  | "solid"
  | "dashed"
  | "dotted"
  | "double"
  | "groove"
  | "ridge"
  | "inset"
  | "outset";
export type PositionType =
  | "static"
  | "relative"
  | "absolute"
  | "fixed"
  | "sticky";
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
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
  padding?: BoxSpacing;
  margin?: BoxSpacing;
  gap?: number;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic" | "oblique";
  lineHeight?: number;
  letterSpacing?: number;
  display?: CSSDisplay;
  hide?: boolean;
  flexDirection?: FlexDirection;
  flexWrap?: FlexWrap;
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: string;
  order?: number;
  alignSelf?: string;
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
  elementAlign?: string;
  hoverColor?: string;
  hamburgerColor?: string;
  closeIconColor?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  overlayImageSize?: string;
  overlayImagePosition?: string;
  mobileMenuBgColor?: string;
  mobileMenuPadding?: BoxSpacing;
  mobileMenuMargin?: BoxSpacing;
  mobileMenuHoverColor?: string;
  mobileMenuHoverBgColor?: string;
  mobileMenuIcon?: string;
  mobileMenuIconImage?: string;
  mobileCloseIcon?: string;
  mobileCloseIconImage?: string;
  mobileCloseIconPosition?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  mobileCloseIconOffsetX?: number;
  mobileCloseIconOffsetY?: number;
  backgroundColor?: string;
  backgroundType?: "classic" | "gradient" | "video" | "slideshow";
  backgroundGradient?: string;
  backgroundImage?: string;
  overlayImage?: string;
  hoverOverlayImage?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  overlayGradient?: string;
  color?: string;
  borderColor?: string;
  borderWidth?: number;
  borderStyle?: BorderStyle;
  borderRadius?: number;
  buttonBackgroundColor?: string;
  buttonBackgroundType?: "classic" | "gradient";
  buttonBackgroundGradientColor1?: string;
  buttonBackgroundGradientColor2?: string;
  buttonBackgroundGradientAngle?: number;
  buttonHoverBackgroundColor?: string;
  buttonPadding?: BoxSpacing;
  buttonBorderColor?: string;
  buttonBorderWidth?: number;
  buttonBorderStyle?: BorderStyle;
  buttonBorderRadius?: number;
  buttonBorderTopWidth?: number;
  buttonBorderRightWidth?: number;
  buttonBorderBottomWidth?: number;
  buttonBorderLeftWidth?: number;
  buttonBorderTopLeftRadius?: number;
  buttonBorderTopRightRadius?: number;
  buttonBorderBottomLeftRadius?: number;
  buttonBorderBottomRightRadius?: number;
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
  borderBottomRightRadius?: number;
  borderBottomLeftRadius?: number;
  objectFit?: "cover" | "contain" | "fill" | "none" | "scale-down";
  objectPosition?: string;
  boxShadow?: string;
  opacity?: number;
  cssFilters?: string;
  position?: PositionType;
  sticky?: "none" | "top" | "bottom";
  stickyOffset?: number;
  zIndex?: number;
  overflow?: OverflowType;
}

export interface WidgetStyle {
  backgroundColor?: string;
  backgroundType?: "classic" | "gradient" | "video" | "slideshow";
  backgroundImage?: string;
  overlayImage?: string;
  hoverOverlayImage?: string;
  backgroundSize?: string;
  backgroundPosition?: string;
  overlayImageSize?: string;
  overlayImagePosition?: string;
  iconSize?: number;
  iconColor?: string;
  backgroundRepeat?: string;
  backgroundAttachment?: "scroll" | "fixed" | "local";
  backgroundGradient?: string;
  backgroundGradientType?: "linear" | "radial";
  backgroundGradientColor1?: string;
  backgroundGradientColor2?: string;
  backgroundGradientLocation1?: number;
  backgroundGradientLocation2?: number;
  backgroundGradientAngle?: number;
  spacerHeight?: number;
  spacerUnit?: CSSUnit;
  backgroundVideo?: string;
  backgroundSlideshow?: string[];
  backgroundClip?: string;
  overlayColor?: string;
  overlayOpacity?: number;
  overlayGradient?: string;
  color?: string;
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number;
  fontStyle?: "normal" | "italic" | "oblique";
  lineHeight?: number;
  letterSpacing?: number;
  wordSpacing?: number;
  textAlign?: TextAlignment;
  elementAlign?: string;
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
  buttonBackgroundColor?: string;
  buttonBackgroundType?: "classic" | "gradient";
  buttonBackgroundGradientColor1?: string;
  buttonBackgroundGradientColor2?: string;
  buttonBackgroundGradientAngle?: number;
  buttonHoverBackgroundColor?: string;
  buttonPadding?: BoxSpacing;
  buttonBorderColor?: string;
  buttonBorderWidth?: number;
  buttonBorderStyle?: BorderStyle;
  buttonBorderRadius?: number;
  buttonBorderTopWidth?: number;
  buttonBorderRightWidth?: number;
  buttonBorderBottomWidth?: number;
  buttonBorderLeftWidth?: number;
  buttonBorderTopLeftRadius?: number;
  buttonBorderTopRightRadius?: number;
  buttonBorderBottomLeftRadius?: number;
  buttonBorderBottomRightRadius?: number;
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
  hoverCssFilters?: string;
  hoverBoxShadow?: string;
  hoverScale?: number;
  hoverOpacity?: number;
  hoverRotate?: number;
  rotate?: number;
  scale?: number;
  translateX?: number | string;
  translateY?: number | string;
  cssFilters?: string;
  maskShape?: "none" | "circle" | "triangle" | "diamond" | "hexagon";
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
  mobileMenuPadding?: BoxSpacing;
  mobileMenuMargin?: BoxSpacing;
  hamburgerColor?: string;
  closeIconColor?: string;
  mobileMenuHoverColor?: string;
  mobileMenuHoverBgColor?: string;
  mobileMenuIcon?: string;
  mobileMenuIconImage?: string;
  mobileCloseIcon?: string;
  mobileCloseIconImage?: string;
  mobileCloseIconPosition?:
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right";
  mobileCloseIconOffsetX?: number;
  mobileCloseIconOffsetY?: number;
  menuAnimation?: "slide" | "fade" | "scale";
  activeColor?: string;
  hoverUnderline?: boolean;

  // ============================================================
  // 🆕 ELEMENTOR-STYLE ADDITIONS
  // ============================================================
  /** Per-widget Custom CSS. Use `selector` to target this widget. */
  customCSS?: string;
  /** Sticky positioning */
  sticky?: "none" | "top" | "bottom";
  /** Sticky offset in px */
  stickyOffset?: number;
  /** Scroll-triggered animation */
  scrollAnimation?: string;
  /** Entrance animation (on page load) */
  entranceAnimation?: string;
  /** Entrance animation duration (ms) */
  entranceAnimationDuration?: number;
  /** Entrance animation delay (ms) */
  entranceAnimationDelay?: number;
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
  cssId?: string;
  content?: string;
  image?: string;
  imageAlt?: string;
  icon?: string;
  iconType?: "icon" | "text" | "image";
  link?: LinkSettings;
  button1Text?: string;
  button1Link?: string;
  button2Text?: string;
  button2Link?: string;
  contentPosition?: string;
  contentTextAlign?: string;
  contentColor?: string;
  customStyle?: boolean;
  children?: PageWidget[];
  url?: string;
  label?: string;
  target?: string;
  parent_id?: string;
  options?: string[];
  fieldType?: "text" | "email" | "tel" | "number" | "textarea" | "select" | "checkbox";
  required?: boolean;
  placeholder?: string;
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
  author?: string;
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
  imageLinkType?: "none" | "media" | "custom";
  captionType?: "none" | "title" | "custom";
  captionText?: string;
  queryType?: "latest" | "category" | "tag" | "manual";
  loopSource?: "posts" | "products" | "custom";
  loopPostType?: string;
  includeExclude?: "include" | "exclude";
  loopCategories?: string[];
  loopTags?: string[];
  loopOrderBy?: "date" | "title" | "price" | "menu_order";
  loopOrder?: "ASC" | "DESC";
  loopDate?: "all" | "day" | "week" | "month" | "year";
  loopPagination?: "none" | "numbers" | "load_more";
  loopTemplate?: string;
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
  formFields?: WidgetItem[];
  emailSubject?: string;
  emailTemplate?: string;
  redirectUrl?: string;
  imageSize?: string;
  imageFit?: "cover" | "contain" | "fill" | "none";
  imagePosition?: string;
  contentPosition?: string;
  dynamicSource?: string;
  dynamicField?: string;
  altText?: string;

  customIcon?: string | null;

  previewProductId?: string;
  previewProduct?: {
    id: string;
    title: string;
    price: number;
    regular_price?: number;
    sale_price?: number | null;
    image?: string;
    description?: string;
    short_description?: string;
    quantity?: number;
    manage_stock?: boolean;
    category?: string;
    tags?: string[];
    gallery?: MediaItem[];
    sku?: string;
    barcode?: string;
    brand?: string;
    weight?: number;
    dimensions?: { length?: number; width?: number; height?: number };
    attributes?: { name: string; options: string[] }[];
    variations?: {
      sku?: string;
      attributes?: Record<string, string>;
      price?: number;
      quantity?: number;
      image?: string;
      enabled?: boolean;
    }[];
    stock_status?: string;
    status?: string;
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

  selectedMenuId?: string;
  menuName?: string;

  // ================================================================
  // 🛒 CART WIDGET SETTINGS
  // ================================================================
  cartLayout?: "default" | "modern" | "minimal" | "sidebar";
  cartColumns?: string;
  showCartHeading?: boolean;
  cartHeading?: string;
  showCartItems?: boolean;
  showCoupon?: boolean;
  showCartTotal?: boolean;
  showContinueShopping?: boolean;
  continueShoppingText?: string;
  showUpdateCartButton?: boolean;
  showCheckoutButton?: boolean;
  checkoutButtonText?: string;
  emptyCartMessage?: string;
  showCrossSells?: boolean;
  crossSellsHeading?: string;

  // ================================================================
  // 💳 CHECKOUT WIDGET SETTINGS
  // ================================================================
  checkoutLayout?: "two-column" | "one-column" | "multi-step";
  orderSummaryPosition?: "right" | "left" | "top" | "bottom";
  showBillingForm?: boolean;
  showShippingForm?: boolean;
  showOrderNotes?: boolean;
  orderNotesPlaceholder?: string;
  showTerms?: boolean;
  termsText?: string;
  termsLink?: string;
  showReturnToCart?: boolean;
  returnToCartText?: string;
  placeOrderText?: string;
  showCod?: boolean;
  showBankTransfer?: boolean;
  showRazorpay?: boolean;
  cashOnDeliveryLabel?: string;
  bankTransferLabel?: string;
  bankTransferInstructions?: string;
  razorpayLabel?: string;

  // ================================================================
  // 👤 MY ACCOUNT WIDGET SETTINGS
  // ================================================================
  accountLayout?: "sidebar" | "tabs-top" | "tabs-left" | "minimal";
  accountNavPosition?: "left" | "right" | "top";
  showAccountNav?: boolean;
  showDashboardLink?: boolean;
  showOrdersLink?: boolean;
  showDownloadsLink?: boolean;
  showAddressesLink?: boolean;
  showAccountDetailsLink?: boolean;
  showLogoutLink?: boolean;
  logoutText?: string;
  showWelcomeMessage?: boolean;
  welcomeText?: string;
  defaultAccountTab?:
    | "dashboard"
    | "orders"
    | "downloads"
    | "addresses"
    | "account_details";
  showOrderLookupForm?: boolean;

  // ================================================================
  // 🧾 ORDER SUMMARY WIDGET SETTINGS
  // ================================================================
  orderSummaryLayout?: "card" | "plain" | "table";
  orderSummaryWidth?: "full" | "boxed";
  showOrderNumber?: boolean;
  showOrderDate?: boolean;
  showPaymentStatus?: boolean;
  showOrderItems?: boolean;
  showOrderTotals?: boolean;
  showShippingDetails?: boolean;
  showBillingDetails?: boolean;
  showThankYouMessage?: boolean;
  thankYouHeading?: string;
  thankYouDescription?: string;
  showContinueShoppingButton?: boolean;
  continueShoppingButtonText?: string;
  continueShoppingLink?: string;
  emptyOrderText?: string;


  // Search Widget Settings
  searchPlaceholder?: string;
  searchButtonText?: string;
  searchLabel?: string;

  // Google Maps Widget Settings
  mapZoom?: number;
  mapHeight?: number;

   // Pagination Widget Settings
  paginationShowPrev?: boolean;
  paginationShowNumbers?: boolean;
  paginationShowNext?: boolean;
  paginationPrevText?: string;
  paginationNextText?: string;
  paginationAlignment?: "left" | "center" | "right" | "space-between";
  paginationGap?: number;
  paginationActiveColor?: string;
  paginationBackgroundColor?: string;
  paginationTextColor?: string;
  iconListLayout?: "list" | "inline";
  iconListLinkFullWidth?: boolean;
  counterStart?: number;
  counterEnd?: number;
  counterPrefix?: string;
  counterSuffix?: string;
  counterDuration?: number;
  counterThousandsSeparator?: boolean;
  counterSeparator?: string;
  counterTitleTag?: string;
  progressTitle?: string;
  progressTitleTag?: string;
  progressPercent?: number;
  progressInnerText?: string;
  showProgressTitle?: boolean;
  showProgressPercent?: boolean;
  testimonialSlidesName?: string;
  testimonialSkin?: string;
  testimonialLayout?: string;
  testimonialAlignment?: TextAlignment;
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
  const response = await axios.put(`${PAGE_BUILDER_URL}/globals/styles`, data, {
    headers: getHeaders(),
  });
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