import {
  Component,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import axios from "axios";
import {
  createContent,
  getPostTypeBySlug,
} from "../../api/content";
import {
  createPage,
  getPage,
  updatePage,
  autosavePage,
  getGlobalStyles,
  updateGlobalStyles,
  convertContentToBuilder,
} from "../../api/pageBuilder";
import { API_URL } from "../../api/config";
import type { TemplateType } from "../../api/templates";
import type {
  PageWidget,
  WidgetType,
  WidgetStyle,
  PageStatus,
  ResponsiveDevice,
  BuilderGlobals,
} from "../../types/pageBuilder";
import WidgetLibrary from "./WidgetLibrary";
import SettingsPanel from "./SettingsPanel";
import CanvasRenderer from "./CanvasRenderer";
import GlobalSettings from "./GlobalSettings";
import "./PageBuilder.css";
import "./MediaPicker.css";

export class PageBuilderErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; errorMessage: string }
> {
  state = { hasError: false, errorMessage: "" };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Page Builder render error:", error, errorInfo);
    this.setState({ errorMessage: error.message });
  }

  render() {
    if (this.state.hasError) {
      return (
        <main
          role="alert"
          style={{
            minHeight: "60vh",
            display: "grid",
            alignContent: "center",
            justifyItems: "center",
            gap: 12,
            padding: 24,
            textAlign: "center",
          }}
        >
          <h1>Page Builder hit an error</h1>
          <p>Reload the builder or return to the admin page and try again.</p>
          {this.state.errorMessage && (
            <p role="status">{this.state.errorMessage}</p>
          )}
          <button type="button" onClick={() => window.location.reload()}>
            Reload Builder
          </button>
        </main>
      );
    }

    return this.props.children;
  }
}

// ============ PROPS INTERFACE ============
interface PageBuilderProps {
  mode?: "page" | "template";
  templateType?: TemplateType;
  templateId?: string | null;
  conditions?: any;
  isDefault?: boolean;
  onConditionsChange?: (c: any) => void;
  onDefaultChange?: (v: boolean) => void;
  renderExtraPanel?: () => React.ReactNode;
  loadHandler?: () => Promise<any | null>;
  saveHandler?: (data: any) => Promise<any>;
}

// ============ HELPERS ============
const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeWidgetLayout = (value: unknown): PageWidget[] => {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (widget): widget is Record<string, unknown> =>
        Boolean(widget) && typeof widget === "object" && !Array.isArray(widget),
    )
    .map((widget) => ({
      ...widget,
      id: typeof widget.id === "string" ? widget.id : createId(),
      type: typeof widget.type === "string" ? widget.type : "text",
      label: typeof widget.label === "string" ? widget.label : "Widget",
      content: typeof widget.content === "string" ? widget.content : "",
      style:
        widget.style && typeof widget.style === "object" && !Array.isArray(widget.style)
          ? widget.style
          : {},
      children: normalizeWidgetLayout(widget.children),
      items: Array.isArray(widget.items)
        ? widget.items.map((item) => {
            if (!item || typeof item !== "object" || Array.isArray(item)) {
              return { id: createId(), title: "Item", content: "" };
            }
            const normalizedItem = item as Record<string, unknown>;
            return {
              ...normalizedItem,
              id: typeof normalizedItem.id === "string" ? normalizedItem.id : createId(),
              title: typeof normalizedItem.title === "string" ? normalizedItem.title : "",
              children: normalizeWidgetLayout(normalizedItem.children),
            };
          })
        : [],
    })) as PageWidget[];
};

const getLayerIcon = (type: WidgetType): string => {
  const icons: Record<string, string> = {
    container: "▦", section: "▭", column: "▯", grid: "⊞",
    heading: "H", text: "T", image: "▧", button: "▣",
    spacer: "↕", divider: "─", icon: "★", icon_box: "▢",
    image_box: "▧", icon_list: "☷", map: "⌖", soundcloud: "♫",
    video: "▶", gallery: "▦", carousel: "◫", slider: "▤",
    accordion: "☰", tabs: "▭", toggle: "☰", testimonial: "❝",
    counter: "#", progress_bar: "▰", alert: "!", form: "▤",
    audio: "♫", blockquote: "❝", breadcrumbs: "›",
    call_to_action: "▣", flip_box: "▰", price_list: "☷",
    price_table: "▦", share_buttons: "↗", slides: "▤",
    posts: "▤", post_grid: "⊞", loop_grid: "▦", post_list: "☰", products: "▦",
    loop_carousel: "↻",
    product_grid: "⊞", product_title: "T", product_price: "$",
    product_image: "▧", product_gallery: "▦",
    product_description: "¶", product_short_description: "≡",
    product_stock: "✓", add_to_cart: "+",
    cart: "🛒", checkout: "💳", my_account: "👤", order_summary: "✓",
    product_sku: "⌗",
    product_categories: "▤",
    product_tags: "#",
    product_attributes: "▥",
    product_variations: "⊟",
    quantity: "#",
    related_products: "↻",
    recent_products: "⏱",
    html: "<>", search: "⌕", menu: "☰", social_icons: "◉",
    site_logo: "🖼", site_title: "T", site_tagline: "t",
    nav_menu: "☰", footer_menu: "☰", copyright: "©",
    link_bio_minimalist: "↗", link_bio_classic: "↗",
    link_bio_showcase: "↗", link_bio_links: "↗", link_bio_services: "↗",
    link_bio_portfolio: "↗", link_bio_business_card: "↗",
  };
  return icons[type] || "◆";
};

const getWidgetLabel = (type: WidgetType): string => {
  const labels: Record<string, string> = {
    container: "Container", section: "Section", column: "Column", grid: "Grid",
    heading: "Heading", text: "Text Editor", image: "Image", button: "Button",
    spacer: "Spacer", divider: "Divider", icon: "Icon", icon_box: "Icon Box",
    image_box: "Image Box", icon_list: "Icon List", map: "Google Maps",
    soundcloud: "SoundCloud", shortcode: "Shortcode", menu_anchor: "Menu Anchor",
    sidebar: "Sidebar", read_more: "Read More", rating: "Rating",
    text_path: "Text Path", tablepress: "TablePress Table",
    link_bio_minimalist: "Minimalist", link_bio_classic: "Classic",
    link_bio_showcase: "Showcase", link_bio_links: "Links",
    link_bio_services: "Services", link_bio_portfolio: "Portfolio Bio",
    link_bio_business_card: "Business Card",
    video: "Video", gallery: "Gallery", carousel: "Image Carousel",
    slider: "Banner Slider", accordion: "Accordion", tabs: "Tabs",
    toggle: "Toggle", testimonial: "Testimonial Carousel", counter: "Counter",
    progress_bar: "Progress Bar", alert: "Alert", form: "Form", posts: "Posts",
    audio: "Audio", blockquote: "Blockquote", breadcrumbs: "Breadcrumbs",
    call_to_action: "Call to Action", flip_box: "Flip Box",
    price_list: "Price List", price_table: "Price Table",
    share_buttons: "Share Buttons", slides: "Slides",
    post_grid: "Post Grid", loop_grid: "Loop Grid", post_list: "Post List",
    post_carousel: "Post Carousel", loop_carousel: "Loop Carousel",
    products: "Products", product_grid: "Product Grid", html: "HTML",
    product_title: "Product Title", product_price: "Product Price",
    product_image: "Product Image", product_gallery: "Product Gallery",
    product_description: "Product Description", product_stock: "Product Stock",
    add_to_cart: "Add to Cart",
    cart: "Cart", checkout: "Checkout", my_account: "My Account",
    order_summary: "Order Summary",
    product_short_description: "Product Short Description",
    product_sku: "Product SKU",
    product_categories: "Product Categories",
    product_tags: "Product Tags",
    product_attributes: "Product Attributes",
    product_variations: "Product Variations",
    quantity: "Quantity",
    related_products: "Related Products",
    recent_products: "Recent Products",
    search: "Search", menu: "Menu", social_icons: "Social Icons",
    site_logo: "Site Logo", site_title: "Site Title",
    site_tagline: "Site Tagline", nav_menu: "Nav Menu",
    footer_menu: "Footer Menu", copyright: "Copyright",
  };
  return labels[type] || type;
};

const DEFAULT_STYLES: Record<string, WidgetStyle> = {
  container: {
    backgroundColor: "transparent",
    padding: { top: 20, right: 20, bottom: 20, left: 20 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  section: {
    backgroundColor: "#ffffff",
    padding: { top: 40, right: 20, bottom: 40, left: 20 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    width: "100%",
    minHeight: "100px",
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },
  column: {
    backgroundColor: "transparent",
    padding: { top: 10, right: 10, bottom: 10, left: 10 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  grid: {
    padding: { top: 10, right: 10, bottom: 10, left: 10 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    display: "grid",
    gridColumns: 2,
    gridColumnGap: 16,
    gridRowGap: 16,
  },
  heading: {
    color: "#1a1a2e",
    fontSize: 36,
    fontWeight: 700,
    textAlign: "left",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    lineHeight: 1.2,
  },
  text: {
    color: "#4a4a5a",
    fontSize: 16,
    textAlign: "left",
    lineHeight: 1.6,
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  image: {
    width: "100%",
    maxWidth: "100%",
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
  },
  button: {
    backgroundColor: "#0c2f55",
    color: "#ffffff",
    fontSize: 16,
    fontWeight: 600,
    textAlign: "center",
    padding: { top: 14, right: 28, bottom: 14, left: 28 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 6,
    display: "inline-block",
    cursor: "pointer",
  },
  spacer: {
    padding: { top: 30, right: 0, bottom: 30, left: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  divider: {
    margin: { top: 16, right: 0, bottom: 16, left: 0 },
    padding: { top: 0, right: 0, bottom: 0, left: 0 },
    borderColor: "#e0e0e0",
    borderWidth: 1,
    borderStyle: "solid",
  },
  icon: {
    color: "#0c2f55",
    fontSize: 40,
    textAlign: "center",
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  icon_box: {
    backgroundColor: "#ffffff",
    color: "#1a1a2e",
    fontSize: 16,
    textAlign: "center",
    padding: { top: 24, right: 20, bottom: 24, left: 20 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
  },
  video: {
    width: "100%",
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
  },
  gallery: {
    display: "grid",
    gridColumns: 3,
    gridColumnGap: 12,
    gridRowGap: 12,
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  carousel: {
    width: "100%",
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
  },
  slider: {
    width: "100%",
    minHeight: "300px",
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
  },
  accordion: {
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderColor: "#e0e0e0",
    borderWidth: 1,
    borderStyle: "solid",
    borderRadius: 8,
  },
  tabs: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  testimonial: {
    backgroundColor: "#f8f9fc",
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
  },
  counter: {
    color: "#0c2f55",
    fontSize: 48,
    fontWeight: 700,
    textAlign: "center",
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  progress_bar: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  alert: {
    padding: { top: 16, right: 16, bottom: 16, left: 16 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 6,
    backgroundColor: "#e8f4ff",
    color: "#0c2f55",
  },
  blockquote: {
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderColor: "#2563eb",
    borderWidth: 3,
    borderStyle: "solid",
  },
  call_to_action: {
    padding: { top: 32, right: 32, bottom: 32, left: 32 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
    backgroundColor: "#f3f6fb",
  },
  price_table: {
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  form: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  posts: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  post_grid: {
    display: "grid",
    gridColumns: 3,
    gridColumnGap: 20,
    gridRowGap: 20,
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  loop_grid: {
    display: "grid",
    gridColumns: 3,
    gridColumnGap: 20,
    gridRowGap: 20,
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  post_list: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  post_carousel: { width: "100%", margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  loop_carousel: { width: "100%", margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  products: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  product_grid: {
    display: "grid",
    gridColumns: 4,
    gridColumnGap: 16,
    gridRowGap: 16,
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  html: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  search: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  menu: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  social_icons: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  site_logo: { margin: { top: 0, right: 0, bottom: 0, left: 0 } },
  site_title: {
    color: "#0c2f55",
    fontSize: 24,
    fontWeight: 700,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  site_tagline: {
    color: "#666",
    fontSize: 14,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  nav_menu: {
    display: "flex",
    gap: 24,
    justifyContent: "center",
    alignItems: "center",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  footer_menu: {
    display: "flex",
    gap: 24,
    justifyContent: "center",
    alignItems: "center",
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
    padding: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  copyright: {
    fontSize: 14,
    textAlign: "center",
    padding: { top: 8, right: 0, bottom: 8, left: 0 },
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  product_sku: {
    color: "#4a4a5a", fontSize: 14, textAlign: "left",
    margin: { top: 4, right: 0, bottom: 4, left: 0 },
  },
  product_categories: {
    color: "#4a4a5a", fontSize: 14, textAlign: "left",
    margin: { top: 4, right: 0, bottom: 4, left: 0 },
  },
  product_tags: {
    color: "#4a4a5a", fontSize: 14, textAlign: "left",
    margin: { top: 4, right: 0, bottom: 4, left: 0 },
  },
  product_attributes: {
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  product_variations: {
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  quantity: {
    margin: { top: 8, right: 0, bottom: 8, left: 0 },
  },
  related_products: {
    margin: { top: 16, right: 0, bottom: 16, left: 0 },
  },
  recent_products: {
    margin: { top: 16, right: 0, bottom: 16, left: 0 },
  },
};

const createWidget = (type: WidgetType): PageWidget => {
  const id = createId();
  const style = { ...(DEFAULT_STYLES[type] || {}) };

  const defaults: Record<string, Partial<PageWidget>> = {
    container: { content: "Container", children: [] },
    section: { content: "Section", children: [] },
    column: { content: "Column", children: [] },
    grid: { content: "Grid", children: [] },
    heading: { content: "Add Your Heading Text Here" },
    text: {
      content:
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut elit tellus, luctus nec ullamcorper mattis, pulvinar dapibus leo.",
    },
    image: { url: "", content: "Image" },
    button: { content: "Click Here", url: "#" },
    spacer: {},
    divider: {},
    icon: { content: "★" },
    icon_box: {
      content: "★",
      items: [{ id: createId(), title: "Feature Title", content: "Description text here." }],
    },
    icon_list: {
      items: [
        { id: createId(), title: "Quality checked", icon: "FaCheckCircle" },
        { id: createId(), title: "Fast delivery", icon: "FaArrowRight" },
        { id: createId(), title: "Customer support", icon: "FaHeart" },
      ],
    },
    image_box: {
      content: "Add your image box description.",
      url: "",
      settings: { title: "Image Box Title" },
    },
    video: { url: "", content: "Video" },
    gallery: { settings: { images: [] } },
    carousel: {
      settings: { images: [], autoplay: true, showDots: true, showArrows: true },
    },
    slider: {
      settings: { images: [], autoplay: true, autoplaySpeed: 5000, showDots: true, showArrows: true },
    },
    accordion: {
      items: [
        { id: createId(), title: "Accordion Item 1", content: "Content for item 1." },
        { id: createId(), title: "Accordion Item 2", content: "Content for item 2." },
      ],
    },
    tabs: {
      items: [
        { id: createId(), title: "Tab 1", content: "Tab 1 content." },
        { id: createId(), title: "Tab 2", content: "Tab 2 content." },
      ],
    },
    testimonial: {
      settings: { testimonialSlidesName: "Slides" },
      items: [
        { id: createId(), title: "John Doe", content: "This is an amazing product!", image: "" },
        { id: createId(), title: "Jane Smith", content: "Excellent service and a wonderful experience.", image: "" },
        { id: createId(), title: "Alex Johnson", content: "I would highly recommend this to everyone.", image: "" },
      ],
    },
    counter: {
      content: "1000",
      items: [{ id: createId(), title: "Happy Clients", content: "1000" }],
    },
    progress_bar: {
      settings: {
        progressTitle: "My Skill",
        progressTitleTag: "span",
        progressPercent: 50,
        progressInnerText: "Web Designer",
        showProgressTitle: true,
        showProgressPercent: true,
      },
      items: [{ id: createId(), title: "My Skill", content: "50" }],
    },
    alert: { content: "This is an important alert message." },
    audio: { url: "", content: "Audio", settings: { controls: true } },
    blockquote: {
      content: "The best way to predict the future is to create it.",
      settings: { author: "Peter Drucker" },
    },
    breadcrumbs: {
      items: [
        { id: createId(), title: "Home", link: { url: "/" } },
        { id: createId(), title: "Current page" },
      ],
    },
    call_to_action: {
      content: "Get Started",
      url: "#",
      settings: {
        title: "Take the next step",
        description: "Tell visitors why they should take action today.",
      },
    },
    flip_box: {
      items: [
        { id: createId(), title: "Front Title", content: "Front side content" },
        { id: createId(), title: "Back Title", content: "Back side content" },
      ],
    },
    price_list: {
      items: [
        { id: createId(), title: "Product One", content: "Short description", label: "$19" },
        { id: createId(), title: "Product Two", content: "Short description", label: "$29" },
      ],
    },
    price_table: {
      content: "Choose the plan that fits your needs.",
      settings: { title: "Starter", description: "Perfect for getting started" },
      items: [
        { id: createId(), title: "Feature one" },
        { id: createId(), title: "Feature two" },
        { id: createId(), title: "Feature three" },
      ],
    },
    share_buttons: {
      items: [
        { id: createId(), title: "Facebook", icon: "facebook", link: { url: "#" } },
        { id: createId(), title: "X", icon: "twitter", link: { url: "#" } },
        { id: createId(), title: "LinkedIn", icon: "linkedin", link: { url: "#" } },
      ],
    },
    slides: {
      settings: { autoplay: true, autoplaySpeed: 5000, showDots: true, showArrows: true },
      items: [
        { id: createId(), title: "Slide One", content: "Describe your offer or announcement.", image: "" },
        { id: createId(), title: "Slide Two", content: "Add another message for visitors.", image: "" },
      ],
    },
    map: { content: "New York, NY", settings: { mapAddress: "New York, NY" } },
    soundcloud: { url: "", content: "SoundCloud track" },
    shortcode: { content: "[your-shortcode]" },
    menu_anchor: { content: "section-name" },
    sidebar: {
      content: "Sidebar",
      items: [{ id: createId(), title: "Useful link", link: { url: "#" } }],
    },
    read_more: { content: "Read More", url: "#" },
    rating: { content: "Rating", settings: { rating: 4 } },
    text_path: { content: "YOUR TEXT ON A PATH" },
    tablepress: {
      content: "Name,Role",
      items: [
        { id: createId(), title: "Jane Doe", content: "Designer" },
        { id: createId(), title: "John Smith", content: "Developer" },
      ],
      settings: { tableHeaders: ["Name", "Role"] },
    },
    ...Object.fromEntries(
      [
        "link_bio_minimalist",
        "link_bio_classic",
        "link_bio_showcase",
        "link_bio_links",
        "link_bio_services",
        "link_bio_portfolio",
        "link_bio_business_card",
      ].map((bioType) => [
        bioType,
        {
          content: "A short introduction about you.",
          url: "",
          settings: { profileName: "Your Name", profileDescription: "A short introduction about you." },
          items: [
            { id: createId(), title: "My Website", link: { url: "https://" } },
            { id: createId(), title: "Contact Me", link: { url: "mailto:hello@example.com" } },
          ],
        },
      ]),
    ),
    form: {
      settings: {
        submitText: "Submit",
        successMessage: "Thank you!",
        formFields: [
          { id: "name", title: "Name", fieldType: "text", required: true, placeholder: "Your name" },
          { id: "email", title: "Email", fieldType: "email", required: true, placeholder: "you@example.com" },
          { id: "message", title: "Message", fieldType: "textarea", required: true, placeholder: "Your message" },
        ],
        emailSubject: "New form submission",
        emailTemplate: "New submission from {{page_title}}\n\n{{fields}}",
      },
    },
    posts: { settings: { postsPerPage: 6, queryType: "latest" } },
    post_grid: { settings: { postsPerPage: 6, queryType: "latest", columns: 3 } },
    loop_grid: { settings: { postsPerPage: 6, queryType: "latest", columns: 3 } },
    post_list: { settings: { postsPerPage: 5, queryType: "latest" } },
    post_carousel: { settings: { postsPerPage: 6, queryType: "latest" } },
    loop_carousel: { settings: { postsPerPage: 6, queryType: "latest", columns: 3 } },
    products: { settings: { postsPerPage: 8, columns: 4 } },
    product_grid: { settings: { postsPerPage: 8, columns: 4 } },
    product_title: { content: "Product Title" },
    product_price: { content: "Product Price" },
    product_image: { content: "Product Image" },
    product_gallery: { content: "Product Gallery" },
    product_description: { content: "Product Description" },
    product_short_description: { content: "Product Short Description" },
    product_sku: { content: "Product SKU" },
    product_categories: { content: "Product Categories" },
    product_tags: { content: "Product Tags" },
    product_attributes: { content: "Product Attributes" },
    product_variations: { content: "Product Variations" },
    quantity: { content: "1" },
    related_products: { settings: { postsPerPage: 4, columns: 4 } },
    recent_products: { settings: { postsPerPage: 4, columns: 4 } },
    product_stock: { content: "Product Stock" },
    add_to_cart: { content: "Add to Cart" },
    cart: { content: "Cart" },
    checkout: { content: "Checkout" },
    my_account: { content: "My Account" },
    order_summary: { content: "Order Summary" },
    html: { content: "<p>Custom HTML content</p>" },
    search: { content: "Search" },
    menu: { content: "Menu" },
    social_icons: {
      items: [
        { id: createId(), title: "Facebook", icon: "facebook", link: { url: "#" } },
        { id: createId(), title: "Twitter", icon: "twitter", link: { url: "#" } },
        { id: createId(), title: "Instagram", icon: "instagram", link: { url: "#" } },
      ],
    },
    site_logo: { url: "", content: "Site Logo" },
    site_title: { content: "Site Title" },
    site_tagline: { content: "Your site tagline here" },
    nav_menu: {
      content: "Nav Menu",
      items: [
        { id: createId(), title: "Home", link: { url: "/" } },
        { id: createId(), title: "About", link: { url: "/about" } },
        { id: createId(), title: "Services", link: { url: "/services" } },
        { id: createId(), title: "Contact", link: { url: "/contact" } },
      ],
    },
    footer_menu: {
      content: "Footer Menu",
      items: [
        { id: createId(), title: "Privacy Policy", link: { url: "/privacy" } },
        { id: createId(), title: "Terms", link: { url: "/terms" } },
        { id: createId(), title: "Contact", link: { url: "/contact" } },
      ],
    },
    copyright: {
      content: `© ${new Date().getFullYear()} Your Company. All rights reserved.`,
    },
  };

  const d = defaults[type] || {};
  if (type === "loop_grid" || type === "loop_carousel") {
    d.children = [
      createWidget("product_image"),
      createWidget("product_title"),
      createWidget("product_price"),
    ];
  }

  return {
    id,
    type,
    label: getWidgetLabel(type),
    content: d.content,
    url: d.url,
    children: d.children,
    style,
    settings: d.settings,
    items: d.items,
  };
};

// ============ CANVAS DROP ZONE ============
const CanvasDropZone = ({
  isEmpty,
  isDraggingNew,
  onAddSection,
}: {
  isEmpty: boolean;
  isDraggingNew: boolean;
  onAddSection: () => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: "canvas-root-drop",
    data: { type: "canvas-root" },
  });

  const showHighlight = isOver || (isEmpty && isDraggingNew);

  return (
    <div
      ref={setNodeRef}
      className={`canvas-drop-zone ${showHighlight ? "active" : ""} ${isEmpty ? "empty" : "has-content"}`}
    >
      {isEmpty && (
        <div className="canvas-empty-state">
          <div className="empty-state-icon">+</div>
          <h2>{isDraggingNew ? "Drop widget here" : "Build Your Page"}</h2>
          <p>
            {isDraggingNew
              ? "Release to add this widget to your page"
              : "Drag widgets from the left panel or click to add your first element."}
          </p>
          {!isDraggingNew && (
            <button type="button" onClick={onAddSection}>
              + Add Section
            </button>
          )}
        </div>
      )}
    </div>
  );
};

// ============ SORTABLE LAYER (for Structure popup) ============
const SortableLayerItem = ({
  widget,
  depth,
  selectedId,
  onSelect,
  onDelete,
  onDuplicate,
  onRename,
}: {
  widget: PageWidget;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onRename: (id: string, label: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `layer-${widget.id}` });

  const [collapsed, setCollapsed] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftLabel, setDraftLabel] = useState(widget.label);
  const hasChildren =
    (widget.children?.length || 0) > 0 ||
    Boolean(widget.items?.some((item) => item.children?.length));

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const finishRename = () => {
    const nextLabel = draftLabel.trim();
    if (nextLabel && nextLabel !== widget.label) {
      onRename(widget.id, nextLabel);
    } else {
      setDraftLabel(widget.label);
    }
    setIsRenaming(false);
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={`structure-item ${selectedId === widget.id ? "active" : ""}`}
        style={{ paddingLeft: 8 + depth * 16 }}
      >
        <span
          className="structure-drag-handle"
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          style={{ touchAction: "none" }}
        >
          ⠿
        </span>

        {hasChildren ? (
          <button
            type="button"
            className="structure-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setCollapsed((v) => !v);
            }}
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? "▸" : "▾"}
          </button>
        ) : (
          <span className="structure-toggle-placeholder" />
        )}

        {isRenaming ? (
          <input
            type="text"
            className="structure-rename-input"
            value={draftLabel}
            autoFocus
            aria-label={`Rename ${widget.label}`}
            onChange={(event) => setDraftLabel(event.target.value)}
            onBlur={finishRename}
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.preventDefault();
                finishRename();
              } else if (event.key === "Escape") {
                setDraftLabel(widget.label);
                setIsRenaming(false);
              }
            }}
          />
        ) : (
          <button
            type="button"
            className="structure-item-btn"
            onClick={(e) => {
              e.stopPropagation();
              onSelect(widget.id);
            }}
          >
            <span className="structure-icon">{getLayerIcon(widget.type)}</span>
            <span className="structure-label">{widget.label}</span>
          </button>
        )}

        {!isRenaming && (
          <button
            type="button"
            className="structure-rename"
            aria-label={`Rename ${widget.label}`}
            title="Rename"
            onClick={(event) => {
              event.stopPropagation();
              setDraftLabel(widget.label);
              setIsRenaming(true);
            }}
          >
            ✎
          </button>
        )}

        <button
          type="button"
          className="structure-duplicate"
          aria-label={`Duplicate ${widget.label}`}
          title="Duplicate"
          onClick={(e) => {
            e.stopPropagation();
            onDuplicate(widget.id);
          }}
        >
          ⧉
        </button>

        <button
          type="button"
          className="structure-delete"
          aria-label={`Delete ${widget.label}`}
          title="Delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(widget.id);
          }}
        >
          ×
        </button>
      </div>

      {(widget.children?.length || 0) > 0 && !collapsed && (
        <SortableContext
          items={widget.children!.map((c) => `layer-${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {widget.children!.map((child) => (
            <SortableLayerItem
              key={child.id}
              widget={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
              onDuplicate={onDuplicate}
              onRename={onRename}
            />
          ))}
        </SortableContext>
      )}

      {hasChildren &&
        !collapsed &&
        widget.items?.map((item) =>
          item.children?.length ? (
            <div className="structure-item-group" key={item.id}>
              <div
                className="structure-group-label"
                style={{ paddingLeft: 26 + depth * 16 }}
              >
                {item.title || "Item"}
              </div>
              <SortableContext
                items={item.children.map((child) => `layer-${child.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {item.children.map((child) => (
                  <SortableLayerItem
                    key={child.id}
                    widget={child}
                    depth={depth + 1}
                    selectedId={selectedId}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onRename={onRename}
                  />
                ))}
              </SortableContext>
            </div>
          ) : null,
        )}
    </div>
  );
};

// ============ MAIN PAGE BUILDER ============
const PageBuilder = ({
  mode = "page",
  templateType,
  templateId,
  conditions,
  isDefault,
  onConditionsChange,
  onDefaultChange,
  renderExtraPanel,
  loadHandler,
  saveHandler,
}: PageBuilderProps = {}) => {
  void conditions;
  void isDefault;
  void onConditionsChange;
  void onDefaultChange;

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const pageId = searchParams.get("id");
  const contentId = searchParams.get("contentId");
  const urlPostType = searchParams.get("postType");
  const newContentType = searchParams.get("newContent");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [layout, setLayout] = useState<PageWidget[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<PageStatus>("draft");
  const [globals, setGlobals] = useState<BuilderGlobals>({
    colors: [
      { id: "primary", name: "Primary", value: "#0c2f55" },
      { id: "secondary", name: "Secondary", value: "#f0b429" },
      { id: "text", name: "Text", value: "#1a1a2e" },
      { id: "accent", name: "Accent", value: "#e63946" },
    ],
    fonts: [
      { id: "default", name: "Default", family: "Arial, sans-serif" },
      { id: "heading", name: "Heading", family: "Georgia, serif" },
    ],
    containerWidth: 1200,
  });
  const [device, setDevice] = useState<ResponsiveDevice>("desktop");

  const [leftPanelMode, setLeftPanelMode] = useState<
    "settings" | "widgets" | "globals" | "conditions"
  >("widgets");
  const [showLeftPanel, setShowLeftPanel] = useState(true);

  const [showStructurePopup, setShowStructurePopup] = useState(false);

  const [loading, setLoading] = useState(
    Boolean(pageId || contentId || newContentType),
  );
  const [loadError, setLoadError] = useState("");
  const [createdContentId, setCreatedContentId] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [history, setHistory] = useState<PageWidget[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return;

    const timeoutId = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [message]);

  // 🆕 CLIPBOARD STATE for copy/paste
  const [clipboard, setClipboard] = useState<PageWidget | null>(null);
  const [clipboardStyle, setClipboardStyle] = useState<WidgetStyle | null>(null);

  // 🆕 CONTEXT MENU STATE
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    widgetId: string;
  } | null>(null);

  // 🆕 SAVE AS TEMPLATE DIALOG
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const layoutRef = useRef<PageWidget[]>(layout);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  useEffect(() => {
    if (selectedId) {
      setLeftPanelMode("settings");
      setShowLeftPanel(true);
    }
  }, [selectedId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    const loadGlobals = async () => {
      try {
        const g = await getGlobalStyles();
        if (g) setGlobals((prev) => ({ ...prev, ...g }));
      } catch {
        // ignore
      }
    };
    void loadGlobals();
  }, []);

  useEffect(() => {
    if (mode !== "template" || !loadHandler) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const data = await loadHandler();
        if (!active || !data) return;
        setTitle(data.title || "");
        setSlug(data.slug || "");
        setSlugManuallyEdited(false);
        setLayout(data.layout || []);
        setStatus(data.status || "draft");
        if (data.globals) setGlobals((prev) => ({ ...prev, ...data.globals }));
        setHistory([data.layout || []]);
        setHistoryIndex(0);
      } catch (err) {
        console.error("Template load error:", err);
        if (active) setMessage("Unable to load template.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [mode, templateId, loadHandler]);

  useEffect(() => {
    if (mode === "template") return;
    if (pageId) {
      let active = true;
      const loadPage = async () => {
        setLoading(true);
        setLoadError("");
        try {
          let page;
          try {
            page = await getPage(pageId);
          } catch (error) {
            if (
              !contentId ||
              !axios.isAxiosError(error) ||
              error.response?.status !== 404
            ) {
              throw error;
            }
            const result = await convertContentToBuilder(contentId);
            if (!result.id) throw new Error("Content could not be opened in the builder.");
            page = await getPage(result.id);
            navigate(
              `/admin/appearance/page-builder?id=${result.id}&contentId=${contentId}&postType=${urlPostType || ""}`,
              { replace: true },
            );
          }
          if (!active) return;
          setTitle(page.title || "");
          setSlug(page.slug || "");
          setSlugManuallyEdited(false);
          const safeLayout = normalizeWidgetLayout(page.layout);
          setLayout(safeLayout);
          setStatus(page.status || "draft");
          setShowTitle(page.show_title !== false);
          if (page.globals) setGlobals((prev) => ({ ...prev, ...page.globals }));
          setHistory([safeLayout]);
          setHistoryIndex(0);
        } catch (error) {
          console.error("Page builder load error:", error);
          if (active) {
            setLoadError(
              axios.isAxiosError(error)
                ? error.response?.data?.detail || "Unable to load this page in the builder."
                : error instanceof Error
                  ? error.message
                  : "Unable to load this page in the builder.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      };
      void loadPage();
      return () => {
        active = false;
      };
    }

    if (contentId) {
      let active = true;
      const loadFromContent = async () => {
        setLoading(true);
        setLoadError("");
        try {
          const result = await convertContentToBuilder(contentId);
          const newPageId = result.id;
          if (!newPageId) throw new Error("Content could not be opened in the builder.");

          const page = await getPage(newPageId);
          if (!active) return;

          setTitle(page.title || "");
          setSlug(page.slug || "");
          setSlugManuallyEdited(false);
          const safeLayout = normalizeWidgetLayout(page.layout);
          setLayout(safeLayout);
          setStatus(page.status || "draft");
          setShowTitle(page.show_title !== false);
          if (page.globals) setGlobals((prev) => ({ ...prev, ...page.globals }));
          setHistory([safeLayout]);
          setHistoryIndex(0);

          navigate(
            `/admin/appearance/page-builder?id=${newPageId}&contentId=${contentId}&postType=${
              urlPostType || ""
            }`,
            { replace: true },
          );

          setMessage(
            result.existing
              ? "Loaded existing builder page."
              : "Content converted to builder page. Start editing!",
          );
        } catch (error) {
          console.error("Content-to-builder load error:", error);
          if (active) {
            setLoadError(
              axios.isAxiosError(error)
                ? error.response?.data?.detail || "Unable to load this content in the builder."
                : error instanceof Error
                  ? error.message
                  : "Unable to load this content in the builder.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      };
      void loadFromContent();
      return () => {
        active = false;
      };
    }

    if (newContentType) {
      let active = true;
      const prepareNewContent = async () => {
        setLoading(true);
        setLoadError("");
        try {
          const postType = await getPostTypeBySlug(newContentType);
          if (!active) return;
          const initialTitle = `New ${postType.name}`;
          setTitle(initialTitle);
          setSlug(
            initialTitle
              .toLowerCase()
              .trim()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, ""),
          );
          setSlugManuallyEdited(false);
          setLayout([]);
          setStatus("draft");
          setHistory([[]]);
          setHistoryIndex(0);
        } catch (error) {
          console.error("New content builder initialization error:", error);
          if (active) {
            setLoadError(
              axios.isAxiosError(error)
                ? error.response?.data?.detail || "Unable to open the builder for this content type."
                : "Unable to open the builder for this content type.",
            );
          }
        } finally {
          if (active) setLoading(false);
        }
      };
      void prepareNewContent();
      return () => {
        active = false;
      };
    }

    setLoading(false);
    setLoadError("");
  }, [pageId, contentId, urlPostType, newContentType, navigate, mode]);

  const pushHistory = useCallback(
    (newLayout: PageWidget[]) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newLayout)));
        return newHistory.slice(-50);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setLayout(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setLayout(JSON.parse(JSON.stringify(history[newIndex])));
    }
  }, [historyIndex, history]);

  useEffect(() => {
    if (mode === "template") return;
    if (!pageId || loading) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void autosavePage(pageId, {
        layout: layoutRef.current,
        title,
        globals,
      }).catch(() => {});
    }, 3000);

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [layout, title, globals, pageId, loading, mode]);

  const findWidget = useCallback(
    (widgets: PageWidget[], id: string): PageWidget | undefined => {
      for (const widget of widgets) {
        if (widget.id === id) return widget;
        const found = findWidget(widget.children || [], id);
        if (found) return found;
        for (const item of widget.items || []) {
          const itemChild = findWidget(item.children || [], id);
          if (itemChild) return itemChild;
        }
      }
      return undefined;
    },
    [],
  );

  const updateWidget = useCallback(
    (widgets: PageWidget[], id: string, changes: Partial<PageWidget>): PageWidget[] => {
      return widgets.map((widget) => {
        if (widget.id === id) return { ...widget, ...changes };
        return {
          ...widget,
          children: widget.children
            ? updateWidget(widget.children, id, changes)
            : undefined,
          items: widget.items?.map((item) => ({
            ...item,
            children: item.children
              ? updateWidget(item.children, id, changes)
              : undefined,
          })),
        };
      });
    },
    [],
  );

  const deleteWidgetById = useCallback(
    (widgets: PageWidget[], id: string): PageWidget[] => {
      return widgets
        .filter((w) => w.id !== id)
        .map((w) => ({
          ...w,
          children: w.children ? deleteWidgetById(w.children, id) : undefined,
          items: w.items?.map((item) => ({
            ...item,
            children: item.children
              ? deleteWidgetById(item.children, id)
              : undefined,
          })),
        }));
    },
    [],
  );

  const duplicateWidgetById = useCallback(
    (widgets: PageWidget[], id: string): PageWidget[] => {
      const result: PageWidget[] = [];
      for (const w of widgets) {
        if (w.id === id) {
          const cloneTree = (widget: PageWidget): PageWidget => ({
            ...JSON.parse(JSON.stringify(widget)),
            id: createId(),
            children: widget.children?.map(cloneTree),
            items: widget.items?.map((item) => ({
              ...item,
              children: item.children?.map(cloneTree),
            })),
          });
          const clone = cloneTree(w);
          result.push(w, clone);
        } else if (w.children || w.items?.some((item) => item.children?.length)) {
          result.push({
            ...w,
            children: w.children ? duplicateWidgetById(w.children, id) : undefined,
            items: w.items?.map((item) => ({
              ...item,
              children: item.children
                ? duplicateWidgetById(item.children, id)
                : undefined,
            })),
          });
        } else {
          result.push(w);
        }
      }
      return result;
    },
    [],
  );

  const addWidget = useCallback(
    (type: WidgetType, parentId?: string) => {
      const widget = createWidget(type);
      if (parentId) {
        const parent = findWidget(layout, parentId);
        if (parent) {
          const newLayout = updateWidget(layout, parentId, {
            children: [...(parent.children || []), widget],
          });
          setLayout(newLayout);
          pushHistory(newLayout);
        }
      } else {
        const newLayout = [...layout, widget];
        setLayout(newLayout);
        pushHistory(newLayout);
      }
      setSelectedId(widget.id);
      setMessage("");
    },
    [layout, findWidget, updateWidget, pushHistory],
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      const { parentId, type } = detail as {
        parentId: string;
        type: WidgetType;
      };
      addWidget(type, parentId);
    };

    window.addEventListener("pb-add-inside", handler);
    return () => window.removeEventListener("pb-add-inside", handler);
  }, [addWidget]);

  const addWidgetAtPosition = useCallback(
    (type: WidgetType, parentId: string | null, index: number) => {
      const widget = createWidget(type);

      if (parentId) {
        const parent = findWidget(layout, parentId);
        if (!parent) return;
        const children = [...(parent.children || [])];
        const safeIndex = Math.max(0, Math.min(index, children.length));
        children.splice(safeIndex, 0, widget);
        const newLayout = updateWidget(layout, parentId, { children });
        setLayout(newLayout);
        pushHistory(newLayout);
      } else {
        const newLayout = [...layout];
        const safeIndex = Math.max(0, Math.min(index, newLayout.length));
        newLayout.splice(safeIndex, 0, widget);
        setLayout(newLayout);
        pushHistory(newLayout);
      }

      setSelectedId(widget.id);
      setMessage("");
    },
    [layout, findWidget, updateWidget, pushHistory],
  );

  const findParentAndIndex = useCallback(
    (
      widgets: PageWidget[],
      targetId: string,
      parentId: string | null = null,
    ): { parentId: string | null; index: number } | null => {
      for (let i = 0; i < widgets.length; i++) {
        const w = widgets[i];
        if (w.id === targetId) {
          return { parentId, index: i };
        }
        if (w.children?.length) {
          const found = findParentAndIndex(w.children, targetId, w.id);
          if (found) return found;
        }
      }
      return null;
    },
    [],
  );

  const handleDelete = useCallback(
    (id: string) => {
      const target = findWidget(layout, id);
      const newLayout = deleteWidgetById(layout, id);
      setLayout(newLayout);
      pushHistory(newLayout);
      if (target && selectedId && findWidget([target], selectedId)) {
        setSelectedId(null);
      }
    },
    [layout, deleteWidgetById, findWidget, selectedId, pushHistory],
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const newLayout = duplicateWidgetById(layout, id);
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [layout, duplicateWidgetById, pushHistory],
  );

  const handleResize = useCallback(
    (id: string, changes: Partial<WidgetStyle>) => {
      const current = findWidget(layout, id);
      if (!current) return;
      const newStyle = { ...current.style, ...changes };
      const newLayout = updateWidget(layout, id, { style: newStyle });
      setLayout(newLayout);
    },
    [layout, findWidget, updateWidget],
  );

  const handleUpdateWidget = useCallback(
    (id: string, changes: Partial<PageWidget>) => {
      const current = findWidget(layout, id);
      if (!current) return;
      const newLayout = updateWidget(layout, id, changes);
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [layout, findWidget, updateWidget, pushHistory],
  );

  // 🆕 ELEMENT ACTIONS - Copy widget
  const handleCopy = useCallback(() => {
    if (!selectedId) return;
    const widget = findWidget(layout, selectedId);
    if (widget) {
      setClipboard(JSON.parse(JSON.stringify(widget)));
      setMessage("✅ Element copied. Press Ctrl+V to paste.");
    }
  }, [selectedId, layout, findWidget]);

  // 🆕 ELEMENT ACTIONS - Paste widget
  const handlePaste = useCallback(() => {
    if (!clipboard) {
      setMessage("Nothing to paste.");
      return;
    }
    const clone = JSON.parse(JSON.stringify(clipboard)) as PageWidget;
    clone.id = createId();
    if (clone.children) {
      clone.children = clone.children.map((c) => ({ ...c, id: createId() }));
    }
    const newLayout = [...layout, clone];
    setLayout(newLayout);
    pushHistory(newLayout);
    setSelectedId(clone.id);
    setMessage("✅ Element pasted.");
  }, [clipboard, layout, pushHistory]);

  // 🆕 ELEMENT ACTIONS - Copy style only
  const handleCopyStyle = useCallback(() => {
    if (!selectedId) return;
    const widget = findWidget(layout, selectedId);
    if (widget) {
      setClipboardStyle(JSON.parse(JSON.stringify(widget.style)));
      setMessage("✅ Style copied. Select another element and paste style.");
    }
  }, [selectedId, layout, findWidget]);

  // 🆕 ELEMENT ACTIONS - Paste style to selected
  const handlePasteStyle = useCallback(() => {
    if (!selectedId || !clipboardStyle) return;
    const current = findWidget(layout, selectedId);
    if (!current) return;
    const newLayout = updateWidget(layout, selectedId, {
      style: { ...clipboardStyle },
    });
    setLayout(newLayout);
    pushHistory(newLayout);
    setMessage("✅ Style pasted.");
  }, [selectedId, clipboardStyle, layout, findWidget, updateWidget, pushHistory]);

  // 🆕 Right-click handler
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, widgetId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(widgetId);
      setContextMenu({ x: e.clientX, y: e.clientY, widgetId });
    },
    [],
  );

  // 🆕 Close context menu on click
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  // 🆕 SAVE SELECTED AS TEMPLATE
  const handleSaveAsTemplate = useCallback(async () => {
    if (!selectedId || !templateName.trim()) return;
    const widget = findWidget(layout, selectedId);
    if (!widget) return;
    try {
      const token = localStorage.getItem("access_token");
      await axios.post(
        `${API_URL}/api/templates/save`,
        {
          name: templateName.trim(),
          type: "section",
          widget: JSON.parse(JSON.stringify(widget)),
          page_id: pageId || "",
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessage("✅ Template saved to library!");
      setShowSaveTemplate(false);
      setTemplateName("");
    } catch (err) {
      console.error(err);
      setMessage("⚠️ Unable to save as template. (Endpoint may not exist yet)");
      setShowSaveTemplate(false);
    }
  }, [selectedId, templateName, layout, findWidget, pageId]);

  const handleCanvasDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setActiveDragType(null);

      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      const activeData = active.data.current;
      const overData = over.data.current;

      if (overData?.type === "item-drop") {
        const targetId = String(overData.widgetId || "");
        const itemId = String(overData.itemId || "");
        const targetWidget = findWidget(layout, targetId);
        const targetItem = targetWidget?.items?.find((item) => item.id === itemId);
        if (!targetWidget || !targetItem) return;

        if (activeData?.type === "new-widget") {
          const nestedWidget = createWidget(activeData.widgetType as WidgetType);
          const items = (targetWidget.items || []).map((item) =>
            item.id === itemId
              ? { ...item, children: [...(item.children || []), nestedWidget] }
              : item,
          );
          const newLayout = updateWidget(layout, targetId, { items });
          setLayout(newLayout);
          pushHistory(newLayout);
          setSelectedId(nestedWidget.id);
          return;
        }

        const draggedWidget = findWidget(layout, activeId);
        if (
          !draggedWidget ||
          draggedWidget.id === targetId ||
          findWidget([draggedWidget], targetId)
        ) return;
        const removed = deleteWidgetById(layout, activeId);
        const updatedTarget = findWidget(removed, targetId);
        if (!updatedTarget) return;
        const items = (updatedTarget.items || []).map((item) =>
          item.id === itemId
            ? { ...item, children: [...(item.children || []), draggedWidget] }
            : item,
        );
        const newLayout = updateWidget(removed, targetId, { items });
        setLayout(newLayout);
        pushHistory(newLayout);
        setSelectedId(draggedWidget.id);
        return;
      }

      if (activeId.startsWith("layer-")) {
        const realActiveId = activeId.replace("layer-", "");
        const realOverId = overId.replace("layer-", "");

        if (realActiveId === realOverId) return;

        const reorderInTree = (widgets: PageWidget[]): PageWidget[] => {
          const oldIndex = widgets.findIndex((w) => w.id === realActiveId);
          const newIndex = widgets.findIndex((w) => w.id === realOverId);
          if (oldIndex !== -1 && newIndex !== -1) {
            return arrayMove(widgets, oldIndex, newIndex);
          }
          return widgets.map((w) => ({
            ...w,
            children: w.children ? reorderInTree(w.children) : undefined,
            items: w.items?.map((item) => ({
              ...item,
              children: item.children ? reorderInTree(item.children) : undefined,
            })),
          }));
        };

        const newLayout = reorderInTree(layout);
        if (JSON.stringify(newLayout) !== JSON.stringify(layout)) {
          setLayout(newLayout);
          pushHistory(newLayout);
        }
        return;
      }

      if (overId.startsWith("inline-")) {
        const overData = over.data.current;

        if (activeData?.type === "new-widget") {
          const widgetType = activeData.widgetType as WidgetType;
          const pId = overData?.parentId ?? null;
          const insertIndex = overData?.index ?? 0;
          addWidgetAtPosition(widgetType, pId, insertIndex);
          return;
        }

        if (activeId && !activeId.startsWith("library-")) {
          const pId = overData?.parentId ?? null;
          const insertIndex = overData?.index ?? 0;

          const draggedWidget = findWidget(layout, activeId);
          if (!draggedWidget) return;

          const removed = deleteWidgetById(layout, activeId);

          if (pId) {
            const parent = findWidget(removed, pId);
            if (!parent) return;
            const children = [...(parent.children || [])];
            const safeIndex = Math.max(0, Math.min(insertIndex, children.length));
            children.splice(safeIndex, 0, draggedWidget);
            const newLayout = updateWidget(removed, pId, { children });
            setLayout(newLayout);
            pushHistory(newLayout);
            setSelectedId(draggedWidget.id);
          } else {
            const newLayout = [...removed];
            const safeIndex = Math.max(0, Math.min(insertIndex, newLayout.length));
            newLayout.splice(safeIndex, 0, draggedWidget);
            setLayout(newLayout);
            pushHistory(newLayout);
            setSelectedId(draggedWidget.id);
          }
          return;
        }
      }

      if (overId === "canvas-root-drop") {
        if (activeData?.type === "new-widget") {
          const widgetType = activeData.widgetType as WidgetType;
          addWidget(widgetType);
          return;
        }

        if (layout.length === 0) {
          const draggedWidget = findWidget(layout, activeId);
          if (draggedWidget) {
            setLayout([draggedWidget]);
            pushHistory([draggedWidget]);
            setSelectedId(draggedWidget.id);
          }
        }
        return;
      }

      if (activeData?.type === "new-widget") {
        const widgetType = activeData.widgetType as WidgetType;

        if (overId.startsWith("drop-")) {
          const containerId = overId.replace("drop-", "");
          addWidget(widgetType, containerId);
          return;
        }

        const targetWidget = findWidget(layout, overId);
        if (targetWidget) {
          const isContainerType = [
            "container", "section", "column", "grid", "loop_grid", "loop_carousel",
          ].includes(targetWidget.type);

          if (isContainerType) {
            addWidget(widgetType, targetWidget.id);
            return;
          }

          const parentInfo = findParentAndIndex(layout, overId);
          if (parentInfo) {
            addWidgetAtPosition(widgetType, parentInfo.parentId, parentInfo.index);
            return;
          }
        }

        addWidget(widgetType);
        return;
      }

      if (overId.startsWith("drop-")) {
        const containerId = overId.replace("drop-", "");
        if (containerId === activeId) return;

        const draggedWidget = findWidget(layout, activeId);
        if (!draggedWidget) return;

        const container = findWidget(layout, containerId);
        if (!container) return;

        const isDescendant = (parent: PageWidget, childId: string): boolean => {
          if (!parent.children) return false;
          for (const c of parent.children) {
            if (c.id === childId) return true;
            if (isDescendant(c, childId)) return true;
          }
          return false;
        };

        if (isDescendant(draggedWidget, containerId)) return;

        const removed = JSON.parse(
          JSON.stringify(deleteWidgetById(layout, activeId)),
        ) as PageWidget[];

        const updatedContainer = findWidget(removed, containerId);
        if (!updatedContainer) return;

        const newLayout = updateWidget(removed, containerId, {
          children: [...(updatedContainer.children || []), draggedWidget],
        });

        setLayout(newLayout);
        pushHistory(newLayout);
        setSelectedId(draggedWidget.id);
        return;
      }

      if (activeId === overId) return;

      const reorderInTree = (widgets: PageWidget[]): PageWidget[] => {
        const oldIndex = widgets.findIndex((w) => w.id === activeId);
        const newIndex = widgets.findIndex((w) => w.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          return arrayMove(widgets, oldIndex, newIndex);
        }
        return widgets.map((w) => ({
          ...w,
          children: w.children ? reorderInTree(w.children) : undefined,
        }));
      };

      const newLayout = reorderInTree(layout);
      if (JSON.stringify(newLayout) !== JSON.stringify(layout)) {
        setLayout(newLayout);
        pushHistory(newLayout);
      }
    },
    [
      layout, findWidget, updateWidget, deleteWidgetById, pushHistory,
      addWidget, addWidgetAtPosition, findParentAndIndex,
    ],
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = String(event.active.id);
    setActiveDragId(id);
    setActiveDragType(id);
  }, []);

  const selectedWidget = selectedId ? findWidget(layout, selectedId) : undefined;

  const updateSelectedStyle = useCallback(
    (changes: Partial<WidgetStyle>, forDevice?: ResponsiveDevice) => {
      if (!selectedId) return;
      const current = findWidget(layout, selectedId);
      if (!current) return;

      let newStyle: WidgetStyle;

      if ("responsive" in changes) {
        newStyle = {
          ...current.style,
          responsive: {
            ...(current.style.responsive || {}),
            ...((changes as any).responsive || {}),
          },
        };
      } else if (forDevice && forDevice !== "desktop") {
        const responsive: any = { ...(current.style.responsive || {}) };
        responsive[forDevice] = {
          ...(responsive[forDevice] || {}),
          ...changes,
        };
        newStyle = { ...current.style, responsive };
      } else {
        newStyle = { ...current.style, ...changes };
      }

      const newLayout = updateWidget(layout, selectedId, { style: newStyle });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, findWidget, updateWidget, pushHistory],
  );

  const updateSelectedContent = useCallback(
    (content: string) => {
      if (!selectedId) return;
      const newLayout = updateWidget(layout, selectedId, { content });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, updateWidget, pushHistory],
  );

  const updateSelectedUrl = useCallback(
    (url: string) => {
      if (!selectedId) return;
      const newLayout = updateWidget(layout, selectedId, { url });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, updateWidget, pushHistory],
  );

  const updateSelectedSettings = useCallback(
    (settings: any) => {
      if (!selectedId) return;
      const current = findWidget(layout, selectedId);
      if (!current) return;
      const {
        link,
        accessibility,
        advanced,
        query,
        items: widgetItems,
        ...settingsChanges
      } = settings;
      const newLayout = updateWidget(layout, selectedId, {
        ...(widgetItems !== undefined ? { items: widgetItems } : {}),
        settings: { ...(current.settings || {}), ...settingsChanges },
        ...(link !== undefined
          ? { link: { ...(current.link || {}), ...link } }
          : {}),
        ...(accessibility !== undefined
          ? {
              accessibility: {
                ...(current.accessibility || {}),
                ...accessibility,
              },
            }
          : {}),
        ...(advanced !== undefined
          ? { advanced: { ...(current.advanced || {}), ...advanced } }
          : {}),
        ...(query !== undefined
          ? { query: { ...(current.query || {}), ...query } }
          : {}),
      });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, findWidget, updateWidget, pushHistory],
  );

  const updateSelectedItems = useCallback(
    (items: any[]) => {
      if (!selectedId) return;
      const newLayout = updateWidget(layout, selectedId, { items });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, updateWidget, pushHistory],
  );

  const handleTitleChange = (value: string) => {
    setTitle(value);
    if (!slugManuallyEdited) {
      setSlug(
        value
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, ""),
      );
    }
  };

  const handleSave = useCallback(
    async (publish: boolean) => {
      if (!title.trim() || !slug.trim()) {
        setMessage("Please enter both title and slug.");
        return;
      }

      if (!layoutRef.current.length) {
        setMessage("Please add at least one element.");
        return;
      }

      setSaving(true);
      setMessage("");

      if (saveHandler) {
        try {
          await saveHandler({
            title: title.trim(),
            slug: slug.trim().toLowerCase(),
            layout: layoutRef.current,
            status: (publish ? "published" : status) as PageStatus,
            globals,
          });
          setStatus(publish ? "published" : status);
          setMessage(publish ? "✅ Published." : "✅ Saved.");
        } catch (error: any) {
          console.error("TEMPLATE SAVE ERROR:", error?.response?.data);
          setMessage(error?.response?.data?.detail || "Unable to save.");
        } finally {
          setSaving(false);
        }
        return;
      }

      const pageData: {
        title: string;
        slug: string;
        layout: PageWidget[];
        status: PageStatus;
        globals: BuilderGlobals;
        show_title: boolean;
      } = {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        layout: layoutRef.current,
        status: (publish ? "published" : status) as PageStatus,
        globals,
        show_title: showTitle,
      };

      try {
        if (pageId) {
          const result = await updatePage(pageId, pageData);
          if (result.id && result.id !== pageId && mode === "page") {
            navigate(
              `/admin/appearance/page-builder?id=${result.id}${
                contentId ? `&contentId=${contentId}` : ""
              }${urlPostType ? `&postType=${urlPostType}` : ""}`,
              { replace: true },
            );
          }
        } else {
          let linkedContentId = createdContentId || contentId || "";
          if (newContentType && !linkedContentId) {
            const contentResult = await createContent(newContentType, {
              title: title.trim(),
              slug: slug.trim().toLowerCase(),
              content: "",
              description: "",
              status: pageData.status,
              featured_image: "",
              featured_image_id: "",
              parent_id: "",
              categories: "",
              tags: "",
            });
            linkedContentId = contentResult.id;
            if (!linkedContentId) {
              throw new Error("Content record was not created.");
            }
            setCreatedContentId(linkedContentId);
          }

          const result = await createPage({
            ...pageData,
            content_id: linkedContentId,
            post_type: newContentType || urlPostType || "",
          });
          if (newContentType && linkedContentId && result.id) {
            await updatePage(result.id, pageData);
          }
          if (result.id && mode === "page") {
            navigate(
              `/admin/appearance/page-builder?id=${result.id}${
                linkedContentId ? `&contentId=${linkedContentId}` : ""
              }${newContentType || urlPostType ? `&postType=${newContentType || urlPostType}` : ""}`,
              { replace: true },
            );
          }
        }
        setStatus(pageData.status);
        setMessage(
          publish
            ? "✅ Page published successfully."
            : "✅ Page saved successfully.",
        );
      } catch (error: any) {
        console.error("SAVE ERROR:", error?.response?.data);
        setMessage(error?.response?.data?.detail || "Unable to save page.");
      } finally {
        setSaving(false);
      }
    },
    [
      title, slug, status, globals, showTitle, pageId, contentId,
      urlPostType, newContentType, createdContentId, navigate, saveHandler, mode,
    ],
  );

  // 🆕 EXTENDED KEYBOARD SHORTCUTS
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave(false);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        if (isInput) return;
        e.preventDefault();
        undo();
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        if (isInput) return;
        e.preventDefault();
        redo();
        return;
      }
      if (e.key === "Delete" && selectedId && !isPreview && !isInput) {
        handleDelete(selectedId);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && !isInput) {
        e.preventDefault();
        handleCopy();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "v" && !isInput) {
        e.preventDefault();
        handlePaste();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "c" && !isInput) {
        e.preventDefault();
        handleCopyStyle();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.altKey && e.key === "v" && !isInput) {
        e.preventDefault();
        handlePasteStyle();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "d" && !isInput) {
        e.preventDefault();
        if (selectedId) handleDuplicate(selectedId);
        return;
      }
      if (e.key === "Escape") {
        setSelectedId(null);
        setContextMenu(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "p" && !isInput) {
        e.preventDefault();
        setIsPreview((v) => !v);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleSave, undo, redo, selectedId, isPreview, handleDelete,
    handleCopy, handlePaste, handleCopyStyle, handlePasteStyle,
    handleDuplicate,
  ]);

  if (loading) {
    return (
      <div className="page-builder-loading">
        {contentId ? "Loading content into builder..." : "Loading page builder..."}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="page-builder">
        <header className="builder-topbar">
          <button
            type="button"
            className="builder-back"
            onClick={() => navigate(-1)}
            title="Back"
          >
            ← Back
          </button>
          <span className="builder-load-error-title">Page Builder</span>
        </header>
        <main className="builder-load-error" role="alert">
          <h1>Page Builder could not open this content</h1>
          <p>{loadError}</p>
          <button type="button" onClick={() => navigate(-1)}>
            Return to content
          </button>
        </main>
      </div>
    );
  }

  return (
    <div className="page-builder">
      <header className="builder-topbar">
        <button
          type="button"
          className="builder-back"
          onClick={() => navigate(-1)}
          title="Back"
        >
          ← Back
        </button>

        {mode === "template" && templateType && (
          <div className="template-type-badge">
            {{
              header: "🔝 Header",
              footer: "🔻 Footer",
              single_product: "🛍 Single Product",
              single_post: "📝 Single Post",
              single_page: "📄 Single Page",
              archive: "🗂 Archive",
              search_results: "🔎 Search Results",
              loop_item: "▤ Loop Item",
              error_404: "⚠ Error 404",
              shop: "🛍 Shop",
              cart: "🛒 Cart",
              checkout: "💳 Checkout",
              my_account: "👤 My Account",
              order_received: "✓ Order Received",
            }[templateType] || "Site Template"}
          </div>
        )}

        <div className="builder-page-details">
          <input
            type="text"
            value={title}
            placeholder={mode === "template" ? "Template Title" : "Page Title"}
            onChange={(e) => handleTitleChange(e.target.value)}
          />
          <input
            type="text"
            value={slug}
            placeholder="template-slug"
            onChange={(e) => {
              const value = e.target.value.toLowerCase().replace(/\s+/g, "-");
              setSlug(value);
              setSlugManuallyEdited(Boolean(value));
            }}
          />
          {mode === "page" && slug && (
            <small className="builder-permalink-preview">
              {window.location.origin}/{slug}
            </small>
          )}
        </div>

        <div className="builder-actions">
          <button
            type="button"
            className={`panel-toggle-btn ${showLeftPanel && leftPanelMode === "widgets" ? "active" : ""}`}
            onClick={() => {
              if (showLeftPanel && leftPanelMode === "widgets") {
                setShowLeftPanel(false);
              } else {
                setLeftPanelMode("widgets");
                setShowLeftPanel(true);
              }
            }}
            title="Widgets Panel"
          >
            ⊕
          </button>

          <button
            type="button"
            className={`panel-toggle-btn ${showStructurePopup ? "active" : ""}`}
            onClick={() => setShowStructurePopup((v) => !v)}
            title="Structure (Navigator)"
          >
            ⊞
          </button>

          <button
            type="button"
            className={`panel-toggle-btn ${showLeftPanel && leftPanelMode === "settings" ? "active" : ""}`}
            onClick={() => {
              if (showLeftPanel && leftPanelMode === "settings") {
                setShowLeftPanel(false);
              } else {
                setLeftPanelMode("settings");
                setShowLeftPanel(true);
              }
            }}
            title="Settings Panel"
          >
            ⚙
          </button>

          {renderExtraPanel && (
            <button
              type="button"
              className={`panel-toggle-btn ${showLeftPanel && leftPanelMode === "conditions" ? "active" : ""}`}
              onClick={() => {
                if (showLeftPanel && leftPanelMode === "conditions") {
                  setShowLeftPanel(false);
                } else {
                  setLeftPanelMode("conditions");
                  setShowLeftPanel(true);
                }
              }}
              title="Conditions"
            >
              📍
            </button>
          )}

          <div className="builder-actions-divider" />

          <button
            type="button"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Undo (Ctrl+Z)"
          >
            ↶
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Redo (Ctrl+Y)"
          >
            ↷
          </button>

          <div className="builder-device-switcher">
            <button
              type="button"
              className={`device-icon-btn ${device === "desktop" ? "active" : ""}`}
              onClick={() => setDevice("desktop")}
              title="Desktop"
            >
              🖥
            </button>
            <button
              type="button"
              className={`device-icon-btn ${device === "tablet" ? "active" : ""}`}
              onClick={() => setDevice("tablet")}
              title="Tablet"
            >
              ▭
            </button>
            <button
              type="button"
              className={`device-icon-btn ${device === "mobile" ? "active" : ""}`}
              onClick={() => setDevice("mobile")}
              title="Mobile"
            >
              ▯
            </button>
          </div>

          <button
            type="button"
            className={isPreview ? "active" : ""}
            onClick={() => setIsPreview(!isPreview)}
            title="Toggle Preview (Ctrl+P)"
          >
            {isPreview ? "✎" : "👁"}
          </button>

          {mode === "page" && (
            <button
              type="button"
              className={showTitle ? "active" : ""}
              onClick={() => setShowTitle(!showTitle)}
              title={showTitle ? "Hide title" : "Show title"}
            >
              📄
            </button>
          )}

          <span className={`builder-status ${status}`}>{status}</span>

          <button
            type="button"
            className="builder-save-draft"
            onClick={() => void handleSave(false)}
            disabled={saving}
          >
            {saving ? "..." : "Save Draft"}
          </button>
          <button
            type="button"
            className="publish-button"
            onClick={() => void handleSave(true)}
            disabled={saving}
          >
            {saving ? "..." : "Publish"}
          </button>
        </div>
      </header>

      {message && <div className="builder-message">{message}</div>}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleCanvasDragEnd}
        onDragStart={handleDragStart}
      >
        <div className="builder-workspace">
          {showLeftPanel && (
            <aside className="builder-left-panel">
              <div className="left-panel-header">
                <button
                  type="button"
                  className={`left-panel-tab ${leftPanelMode === "widgets" ? "active" : ""}`}
                  onClick={() => setLeftPanelMode("widgets")}
                >
                  ⊕ Widgets
                </button>
                <button
                  type="button"
                  className={`left-panel-tab ${leftPanelMode === "settings" ? "active" : ""}`}
                  onClick={() => setLeftPanelMode("settings")}
                >
                  ⚙ Settings
                </button>
                <button
                  type="button"
                  className={`left-panel-tab ${leftPanelMode === "globals" ? "active" : ""}`}
                  onClick={() => setLeftPanelMode("globals")}
                >
                  🌐 Global
                </button>
                {renderExtraPanel && (
                  <button
                    type="button"
                    className={`left-panel-tab ${leftPanelMode === "conditions" ? "active" : ""}`}
                    onClick={() => setLeftPanelMode("conditions")}
                  >
                    📍 Conditions
                  </button>
                )}
                <button
                  type="button"
                  className="left-panel-close"
                  onClick={() => setShowLeftPanel(false)}
                  title="Close"
                >
                  ×
                </button>
              </div>

              {leftPanelMode === "widgets" && (
                <WidgetLibrary onAdd={(type: WidgetType) => addWidget(type)} />
              )}

              {leftPanelMode === "settings" && (
                <>
                  {selectedWidget ? (
                    <SettingsPanel
                      widget={selectedWidget}
                      device={device}
                      globals={globals}
                      onChangeContent={updateSelectedContent}
                      onChangeUrl={updateSelectedUrl}
                      onChangeStyle={updateSelectedStyle}
                      onChangeSettings={updateSelectedSettings}
                      onChangeItems={updateSelectedItems}
                      onDelete={() => handleDelete(selectedWidget.id)}
                      onDuplicate={() => handleDuplicate(selectedWidget.id)}
                    />
                  ) : (
                    <div className="right-panel-heading">
                      <h3>Element Settings</h3>
                      <p className="no-selection">
                        Select an element on the canvas or in the Structure panel to edit its settings.
                      </p>
                      <div className="right-panel-hint">
                        <div className="hint-icon">💡</div>
                        <p>
                          Tip: Click <strong>⊕ Widgets</strong> at the top to open the widget library.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {leftPanelMode === "globals" && (
                <GlobalSettings
                  globals={globals}
                  onChange={(g: BuilderGlobals) => {
                    setGlobals(g);
                    void updateGlobalStyles(g);
                  }}
                />
              )}

              {leftPanelMode === "conditions" && renderExtraPanel && renderExtraPanel()}
            </aside>
          )}

          <main
            className="builder-canvas-area"
            onClick={() => setSelectedId(null)}
          >
            <div className="canvas-toolbar">
              <span>{mode === "template" ? "Template Canvas" : "Page Canvas"}</span>
              <span>
                {device === "desktop" ? "Desktop" : device === "tablet" ? "Tablet" : "Mobile"}{" "}
                • {layout.length} elements
              </span>
            </div>

            <div
              className="builder-canvas"
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth:
                  device === "tablet"
                    ? "768px"
                    : device === "mobile"
                    ? "375px"
                    : "100%",
                margin: "0 auto",
                transition: "max-width 0.3s ease",
              }}
            >
              {!layout.length && (
                <CanvasDropZone
                  isEmpty={true}
                  isDraggingNew={activeDragType?.startsWith("library-") ?? false}
                  onAddSection={() => addWidget("section")}
                />
              )}

              {layout.length > 0 && (
                <>
                  <SortableContext
                    items={layout.map((w) => w.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {layout.map((widget, index) => (
                      <CanvasRenderer
                        key={widget.id}
                        widget={widget}
                        isRoot
                        parentId={null}
                        index={index}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onAddInside={(parentId: string, type: WidgetType) =>
                          addWidget(type, parentId)
                        }
                        onResize={handleResize}
                        onUpdateWidget={handleUpdateWidget}
                        device={device}
                        isPreview={isPreview}
                        activeDragType={activeDragType}
                        onContextMenu={handleContextMenu}
                      />
                    ))}
                  </SortableContext>

                  {!isPreview && (
                    <button
                      type="button"
                      className="add-element-button"
                      onClick={() => addWidget("section")}
                    >
                      + Add Section
                    </button>
                  )}
                </>
              )}
            </div>
          </main>
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDragId ? (
            <div className="drag-overlay">
              {activeDragId.startsWith("library-")
                ? `+ Add ${activeDragId
                    .replace("library-", "")
                    .replace(/^\w/, (c) => c.toUpperCase())}`
                : findWidget(layout, activeDragId)?.label || "Widget"}
            </div>
          ) : null}
        </DragOverlay>

        {showStructurePopup && (
          <div
            className="structure-popup-overlay"
            onClick={() => setShowStructurePopup(false)}
          >
            <div
              className="structure-popup"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="structure-popup-header">
                <h3>Structure</h3>
                <button
                  type="button"
                  className="structure-popup-close"
                  onClick={() => setShowStructurePopup(false)}
                >
                  ×
                </button>
              </div>

              <div className="structure-popup-body">
                {layout.length ? (
                  <SortableContext
                    items={layout.map((w) => `layer-${w.id}`)}
                    strategy={verticalListSortingStrategy}
                  >
                    {layout.map((widget) => (
                      <SortableLayerItem
                        key={widget.id}
                        widget={widget}
                        depth={0}
                        selectedId={selectedId}
                        onSelect={(id) => {
                          setSelectedId(id);
                          setLeftPanelMode("settings");
                          setShowLeftPanel(true);
                          setShowStructurePopup(false);
                        }}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onRename={(id, label) =>
                          handleUpdateWidget(id, { label })
                        }
                      />
                    ))}
                  </SortableContext>
                ) : (
                  <p className="empty-layers">No elements added yet.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </DndContext>

      {/* 🆕 CONTEXT MENU */}
      {contextMenu && (
        <div
          className="builder-context-menu"
          style={{
            position: "fixed",
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 100000,
            background: "#fff",
            border: "1px solid #d9dee7",
            borderRadius: 6,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            minWidth: 220,
            padding: "6px 0",
            fontSize: 13,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="ctx-menu-header">
            <span>Widget Actions</span>
            <button
              type="button"
              aria-label="Close widget actions"
              title="Close"
              onClick={() => setContextMenu(null)}
            >
              ×
            </button>
          </div>
          <button
            type="button"
            className="ctx-menu-item"
            onClick={() => {
              handleCopy();
              setContextMenu(null);
            }}
          >
            <span>📋 Copy</span>
            <kbd>Ctrl+C</kbd>
          </button>
          <button
            type="button"
            className="ctx-menu-item"
            onClick={() => {
              handlePaste();
              setContextMenu(null);
            }}
            disabled={!clipboard}
          >
            <span>📌 Paste</span>
            <kbd>Ctrl+V</kbd>
          </button>
          <button
            type="button"
            className="ctx-menu-item"
            onClick={() => {
              handleDuplicate(contextMenu.widgetId);
              setContextMenu(null);
            }}
          >
            <span>⧉ Duplicate</span>
            <kbd>Ctrl+D</kbd>
          </button>
          <div className="ctx-menu-divider" />
          <button
            type="button"
            className="ctx-menu-item"
            onClick={() => {
              handleCopyStyle();
              setContextMenu(null);
            }}
          >
            <span>🎨 Copy Style</span>
            <kbd>Ctrl+Alt+C</kbd>
          </button>
          <button
            type="button"
            className="ctx-menu-item"
            onClick={() => {
              handlePasteStyle();
              setContextMenu(null);
            }}
            disabled={!clipboardStyle}
          >
            <span>🖌️ Paste Style</span>
            <kbd>Ctrl+Alt+V</kbd>
          </button>
          <div className="ctx-menu-divider" />
          <button
            type="button"
            className="ctx-menu-item"
            onClick={() => {
              setShowSaveTemplate(true);
              setTemplateName("");
              setContextMenu(null);
            }}
          >
            <span>💾 Save as Template</span>
          </button>
          <div className="ctx-menu-divider" />
          <button
            type="button"
            className="ctx-menu-item danger"
            onClick={() => {
              handleDelete(contextMenu.widgetId);
              setContextMenu(null);
            }}
          >
            <span>🗑️ Delete</span>
            <kbd>Del</kbd>
          </button>
        </div>
      )}

      {/* 🆕 SAVE AS TEMPLATE MODAL */}
      {showSaveTemplate && (
        <div
          className="structure-popup-overlay"
          onClick={() => setShowSaveTemplate(false)}
        >
          <div
            className="structure-popup"
            style={{ maxWidth: 380 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="structure-popup-header">
              <h3>Save as Template</h3>
              <button
                type="button"
                className="structure-popup-close"
                onClick={() => setShowSaveTemplate(false)}
              >
                ×
              </button>
            </div>
            <div style={{ padding: 20 }}>
              <label className="setting-field">
                <span>Template Name</span>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Hero Section"
                  autoFocus
                />
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  justifyContent: "flex-end",
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowSaveTemplate(false)}
                  style={{
                    padding: "8px 16px",
                    border: "1px solid #d9dee7",
                    borderRadius: 5,
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveAsTemplate()}
                  disabled={!templateName.trim()}
                  style={{
                    padding: "8px 16px",
                    border: "none",
                    borderRadius: 5,
                    background: "#93003c",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 600,
                  }}
                >
                  Save Template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PageBuilder;