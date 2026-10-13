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
    ],
  },
  {
    name: "Media",
    icon: "▶",
    widgets: [
      { type: "video", label: "Video", icon: "▶" },
      { type: "gallery", label: "Gallery", icon: "▦" },
      { type: "carousel", label: "Image Carousel", icon: "◫" },
      { type: "slider", label: "Banner Slider", icon: "▤" },
      { type: "icon", label: "Icon", icon: "★" },
    ],
  },
  {
    name: "Content",
    icon: "☰",
    widgets: [
      { type: "icon_box", label: "Icon Box", icon: "▢" },
      { type: "accordion", label: "Accordion", icon: "☰" },
      { type: "tabs", label: "Tabs", icon: "▭" },
      { type: "testimonial", label: "Testimonial", icon: "❝" },
      { type: "counter", label: "Counter", icon: "#" },
      { type: "progress_bar", label: "Progress Bar", icon: "▰" },
      { type: "alert", label: "Alert", icon: "!" },
    ],
  },
  {
    name: "Posts",
    icon: "▤",
    widgets: [
      { type: "posts", label: "Posts", icon: "▤" },
      { type: "post_grid", label: "Post Grid", icon: "⊞" },
      { type: "post_list", label: "Post List", icon: "☰" },
      { type: "post_carousel", label: "Post Carousel", icon: "◫" },
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
  {
    name: "Advanced",
    icon: "<>",
    widgets: [
      { type: "html", label: "HTML", icon: "<>" },
      { type: "form", label: "Form", icon: "▤" },
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
        w.type.toLowerCase().includes(search.toLowerCase())
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
              setOpenCategory(openCategory === category.name ? null : category.name)
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