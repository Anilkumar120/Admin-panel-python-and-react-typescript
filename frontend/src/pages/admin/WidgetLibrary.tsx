import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { WidgetType } from "../../types/pageBuilder";

interface WidgetLibraryProps {
  onAdd: (type: WidgetType) => void;
}

interface WidgetCategory {
  name: string;
  icon: string;
  widgets: { type: WidgetType; label: string; icon: string }[];
}

const CATEGORIES: WidgetCategory[] = [
  {
    name: "Layout",
    icon: "▦",
    widgets: [
      { type: "section", label: "Section", icon: "▭" },
      { type: "container", label: "Container", icon: "▦" },
      { type: "column", label: "Column", icon: "▯" },
      { type: "grid", label: "Grid", icon: "⊞" },
    ],
  },
  {
    name: "Basic",
    icon: "H",
    widgets: [
      { type: "heading", label: "Heading", icon: "H" },
      { type: "text", label: "Text Editor", icon: "T" },
      { type: "image", label: "Image", icon: "▧" },
      { type: "button", label: "Button", icon: "▣" },
      { type: "divider", label: "Divider", icon: "─" },
      { type: "spacer", label: "Spacer", icon: "↕" },
      { type: "map", label: "Google Maps", icon: "⌖" },
      { type: "form", label: "Form", icon: "▤" },
      { type: "blockquote", label: "Blockquote", icon: "❝" },
      { type: "call_to_action", label: "Call to Action", icon: "▣" },
      { type: "breadcrumbs", label: "Breadcrumbs", icon: "›" },
    ],
  },
  {
    name: "Media",
    icon: "▶",
    widgets: [
      { type: "video", label: "Video", icon: "▶" },
      { type: "audio", label: "Audio", icon: "♫" },
      { type: "slider", label: "Banner Slider", icon: "▤" },
      { type: "slides", label: "Slides", icon: "▤" },
      { type: "icon", label: "Icon", icon: "★" },
    ],
  },
  {
    name: "General",
    icon: "☰",
    widgets: [
      { type: "icon_box", label: "Icon Box", icon: "▢" },
      { type: "image_box", label: "Image Box", icon: "▧" },
      { type: "flip_box", label: "Flip Box", icon: "▰" },
      { type: "price_list", label: "Price List", icon: "☷" },
      { type: "price_table", label: "Price Table", icon: "▦" },
      { type: "share_buttons", label: "Share Buttons", icon: "↗" },
      { type: "carousel", label: "Image Carousel", icon: "◫" },
      { type: "gallery", label: "Basic Gallery", icon: "▦" },
      { type: "icon_list", label: "Icon List", icon: "☷" },
      { type: "accordion", label: "Accordion", icon: "☰" },
      { type: "tabs", label: "Tabs", icon: "▭" },
      { type: "testimonial", label: "Testimonial Carousel", icon: "❝" },
      { type: "counter", label: "Counter", icon: "#" },
      { type: "progress_bar", label: "Progress Bar", icon: "▰" },
      { type: "alert", label: "Alert", icon: "!" },
      { type: "soundcloud", label: "SoundCloud", icon: "♫" },
      { type: "shortcode", label: "Shortcode", icon: "[...]" },
      { type: "html", label: "HTML", icon: "<>" },
      { type: "menu_anchor", label: "Menu Anchor", icon: "⚓" },
      { type: "sidebar", label: "Sidebar", icon: "▤" },
      { type: "read_more", label: "Read More", icon: "↗" },
      { type: "rating", label: "Rating", icon: "☆" },
      { type: "text_path", label: "Text Path", icon: "⌒" },
      { type: "tablepress", label: "TablePress Table", icon: "▦" },
    ],
  },
  {
    name: "Link In Bio",
    icon: "↗",
    widgets: [
      { type: "link_bio_minimalist", label: "Minimalist", icon: "▣" },
      { type: "link_bio_classic", label: "Classic", icon: "▣" },
      { type: "link_bio_showcase", label: "Showcase", icon: "▣" },
      { type: "link_bio_links", label: "Links", icon: "▣" },
      { type: "link_bio_services", label: "Services", icon: "▣" },
      { type: "link_bio_portfolio", label: "Portfolio Bio", icon: "▣" },
      { type: "link_bio_business_card", label: "Business Card", icon: "▣" },
    ],
  },
  {
    name: "Posts",
    icon: "▤",
    widgets: [
      { type: "posts", label: "Posts", icon: "▤" },
      { type: "post_grid", label: "Post Grid", icon: "⊞" },
      { type: "loop_grid", label: "Loop Grid", icon: "▦" },
      { type: "post_list", label: "Post List", icon: "☰" },
      { type: "post_carousel", label: "Post Carousel", icon: "◫" },
      { type: "loop_carousel", label: "Loop Carousel", icon: "↻" },
    ],
  },
  {
    name: "Products",
    icon: "🛍",
    widgets: [
      { type: "products", label: "Products", icon: "▦" },
      { type: "product_grid", label: "Product Grid", icon: "⊞" },
      { type: "product_title", label: "Product Title", icon: "T" },
      { type: "product_price", label: "Product Price", icon: "₹" },
      { type: "product_image", label: "Product Image", icon: "▧" },
      { type: "product_gallery", label: "Product Gallery", icon: "▦" },
      { type: "product_description", label: "Product Description", icon: "¶" },
      { type: "product_short_description", label: "Product Short Description", icon: "≡" },
      { type: "product_sku", label: "Product SKU", icon: "⌗" },
      { type: "product_categories", label: "Product Categories", icon: "▤" },
      { type: "product_tags", label: "Product Tags", icon: "#" },
      { type: "product_attributes", label: "Product Attributes", icon: "▥" },
      { type: "product_variations", label: "Product Variations", icon: "⊟" },
      { type: "product_stock", label: "Product Stock", icon: "✓" },
      { type: "quantity", label: "Quantity", icon: "#" },
      { type: "add_to_cart", label: "Add to Cart", icon: "🛒" },
      { type: "related_products", label: "Related Products", icon: "↻" },
      { type: "recent_products", label: "Recent Products", icon: "⏱" },
      { type: "cart", label: "Cart", icon: "🛒" },
      { type: "checkout", label: "Checkout", icon: "💳" },
      { type: "my_account", label: "My Account", icon: "👤" },
      { type: "order_summary", label: "Order Summary", icon: "✓" },
    ],
  },
  {
    name: "Site",
    icon: "◉",
    widgets: [
      { type: "search", label: "Search", icon: "⌕" },
      { type: "menu", label: "Menu", icon: "☰" },
      { type: "social_icons", label: "Social Icons", icon: "◉" },
    ],
  },
];

// ============ DRAGGABLE WIDGET ============
const DraggableWidget = ({
  type,
  label,
  icon,
  onAdd,
}: {
  type: WidgetType;
  label: string;
  icon: string;
  onAdd: (type: WidgetType) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: `library-${type}`,
      data: {
        type: "new-widget",
        widgetType: type,
      },
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.5 : 1,
    cursor: isDragging ? "grabbing" : "grab",
    touchAction: "none" as const,
  };

  const handleClick = () => {
    if (!isDragging) {
      onAdd(type);
    }
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      type="button"
      className="widget-library-item"
      onClick={handleClick}
      title={`Click or drag to add ${label}`}
    >
      <span className="widget-icon">{icon}</span>
      <span className="widget-label">{label}</span>
    </button>
  );
};

// ============ MAIN LIBRARY ============
const WidgetLibrary = ({ onAdd }: WidgetLibraryProps) => {
  const [search, setSearch] = useState("");
  const [openCategory, setOpenCategory] = useState<string | null>("Basic");

  const filtered = CATEGORIES.map((cat) => ({
    ...cat,
    widgets: cat.widgets.filter(
      (w) =>
        w.label.toLowerCase().includes(search.toLowerCase()) ||
        w.type.toLowerCase().includes(search.toLowerCase()),
    ),
  })).filter((cat) => cat.widgets.length > 0);

  return (
    <div className="widget-library">
      <div className="widget-search">
        <input
          type="text"
          placeholder="Search Widget..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.map((category) => (
        <div key={category.name} className="widget-category">
          <button
            type="button"
            className="category-header"
            onClick={() =>
              setOpenCategory(
                openCategory === category.name ? null : category.name,
              )
            }
          >
            <span>
              {openCategory === category.name ? "▾" : "▸"} {category.name}
            </span>
          </button>

          {openCategory === category.name && (
            <div className="widget-grid">
              {category.widgets.map((w) => (
                <DraggableWidget
                  key={w.type}
                  type={w.type}
                  label={w.label}
                  icon={w.icon}
                  onAdd={onAdd}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default WidgetLibrary;