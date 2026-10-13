import { useEffect, useState, useCallback, useRef } from "react";
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
import {
  createPage,
  getPage,
  updatePage,
  autosavePage,
  getGlobalStyles,
  updateGlobalStyles,
  convertContentToBuilder,
} from "../../api/pageBuilder";
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

// ============ HELPERS ============
const createId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const getLayerIcon = (type: WidgetType): string => {
  const icons: Record<string, string> = {
    container: "▦", section: "▭", column: "▯", grid: "⊞",
    heading: "H", text: "T", image: "▧", button: "▣",
    spacer: "↕", divider: "─", icon: "★", icon_box: "▢",
    video: "▶", gallery: "▦", carousel: "◫", slider: "▤",
    accordion: "☰", tabs: "▭", toggle: "☰", testimonial: "❝",
    counter: "#", progress_bar: "▰", alert: "!", form: "▤",
    posts: "▤", post_grid: "⊞", post_list: "☰", products: "▦",
    html: "<>", search: "⌕", menu: "☰", social_icons: "◉",
  };
  return icons[type] || "◆";
};

const getWidgetLabel = (type: WidgetType): string => {
  const labels: Record<string, string> = {
    container: "Container", section: "Section", column: "Column", grid: "Grid",
    heading: "Heading", text: "Text Editor", image: "Image", button: "Button",
    spacer: "Spacer", divider: "Divider", icon: "Icon", icon_box: "Icon Box",
    video: "Video", gallery: "Gallery", carousel: "Image Carousel",
    slider: "Banner Slider", accordion: "Accordion", tabs: "Tabs",
    toggle: "Toggle", testimonial: "Testimonial", counter: "Counter",
    progress_bar: "Progress Bar", alert: "Alert", form: "Form", posts: "Posts",
    post_grid: "Post Grid", post_list: "Post List", post_carousel: "Post Carousel",
    products: "Products", product_grid: "Product Grid", html: "HTML",
    search: "Search", menu: "Menu", social_icons: "Social Icons",
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
  form: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  posts: { margin: { top: 8, right: 0, bottom: 8, left: 0 } },
  post_grid: {
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
      settings: {
        items: [{ id: createId(), title: "Feature Title", content: "Description text here." }],
      },
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
      items: [{ id: createId(), title: "John Doe", content: "This is an amazing product!", image: "" }],
    },
    counter: {
      content: "1000",
      settings: { items: [{ id: createId(), title: "Happy Clients", content: "1000" }] },
    },
    progress_bar: { items: [{ id: createId(), title: "Design", content: "80" }] },
    alert: { content: "This is an important alert message." },
    form: { settings: { submitText: "Submit", successMessage: "Thank you!" } },
    posts: { settings: { postsPerPage: 6, queryType: "latest" } },
    post_grid: { settings: { postsPerPage: 6, queryType: "latest", columns: 3 } },
    post_list: { settings: { postsPerPage: 5, queryType: "latest" } },
    post_carousel: { settings: { postsPerPage: 6, queryType: "latest" } },
    products: { settings: { postsPerPage: 8 } },
    product_grid: { settings: { postsPerPage: 8, columns: 4 } },
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
  };

  const d = defaults[type] || {};

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
      className={`canvas-drop-zone ${showHighlight ? "active" : ""} ${
        isEmpty ? "empty" : "has-content"
      }`}
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
}: {
  widget: PageWidget;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `layer-${widget.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
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
        <button
          type="button"
          className="structure-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(widget.id);
          }}
        >
          ×
        </button>
      </div>

      {widget.children && widget.children.length > 0 && (
        <SortableContext
          items={widget.children.map((c) => `layer-${c.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {widget.children.map((child) => (
            <SortableLayerItem
              key={child.id}
              widget={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              onDelete={onDelete}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
};

// ============ MAIN PAGE BUILDER ============
const PageBuilder = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const pageId = searchParams.get("id");
  const contentId = searchParams.get("contentId");
  const urlPostType = searchParams.get("postType");

  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
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

  // ✅ Left panel modes: "settings" | "widgets" | "globals"
  const [leftPanelMode, setLeftPanelMode] = useState<"settings" | "widgets" | "globals">("settings");
  const [showLeftPanel, setShowLeftPanel] = useState(true);

  // ✅ Structure popup state
  const [showStructurePopup, setShowStructurePopup] = useState(false);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [showTitle, setShowTitle] = useState(true);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [activeDragType, setActiveDragType] = useState<string | null>(null);
  const [history, setHistory] = useState<PageWidget[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layoutRef = useRef<PageWidget[]>(layout);

  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);

  // ✅ Switch left panel to settings when a widget is selected
  useEffect(() => {
    if (selectedId) {
      setLeftPanelMode("settings");
      setShowLeftPanel(true);
    }
  }, [selectedId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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
    if (pageId) {
      let active = true;
      const loadPage = async () => {
        setLoading(true);
        try {
          const page = await getPage(pageId);
          if (!active) return;
          setTitle(page.title || "");
          setSlug(page.slug || "");
          setLayout(page.layout || []);
          setStatus(page.status || "draft");
          setShowTitle(page.show_title !== false);
          if (page.globals) setGlobals((prev) => ({ ...prev, ...page.globals }));
          setHistory([page.layout || []]);
          setHistoryIndex(0);
        } catch {
          if (active) setMessage("Unable to load page.");
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
        try {
          const result = await convertContentToBuilder(contentId);
          const newPageId = result.id;

          if (!newPageId) {
            if (active) setMessage("Unable to convert content.");
            return;
          }

          const page = await getPage(newPageId);
          if (!active) return;

          setTitle(page.title || "");
          setSlug(page.slug || "");
          setLayout(page.layout || []);
          setStatus(page.status || "draft");
          setShowTitle(page.show_title !== false);
          if (page.globals) setGlobals((prev) => ({ ...prev, ...page.globals }));
          setHistory([page.layout || []]);
          setHistoryIndex(0);

          navigate(
            `/admin/appearance/page-builder?id=${newPageId}&contentId=${contentId}&postType=${
              urlPostType || ""
            }`,
            { replace: true }
          );

          setMessage(
            result.existing
              ? "Loaded existing builder page."
              : "Content converted to builder page. Start editing!"
          );
        } catch (err) {
          console.error("CONVERT ERROR:", err);
          if (active) setMessage("Unable to load content into builder.");
        } finally {
          if (active) setLoading(false);
        }
      };
      void loadFromContent();
      return () => {
        active = false;
      };
    }
  }, [pageId, contentId, urlPostType, navigate]);

  const pushHistory = useCallback(
    (newLayout: PageWidget[]) => {
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(JSON.parse(JSON.stringify(newLayout)));
        return newHistory.slice(-50);
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex]
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
  }, [layout, title, globals, pageId, loading]);

  const findWidget = useCallback(
    (widgets: PageWidget[], id: string): PageWidget | undefined => {
      for (const widget of widgets) {
        if (widget.id === id) return widget;
        const found = findWidget(widget.children || [], id);
        if (found) return found;
      }
      return undefined;
    },
    []
  );

  const updateWidget = useCallback(
    (widgets: PageWidget[], id: string, changes: Partial<PageWidget>): PageWidget[] => {
      return widgets.map((widget) => {
        if (widget.id === id) return { ...widget, ...changes };
        if (widget.children) {
          return {
            ...widget,
            children: updateWidget(widget.children, id, changes),
          };
        }
        return widget;
      });
    },
    []
  );

  const deleteWidgetById = useCallback(
    (widgets: PageWidget[], id: string): PageWidget[] => {
      return widgets
        .filter((w) => w.id !== id)
        .map((w) => ({
          ...w,
          children: w.children ? deleteWidgetById(w.children, id) : undefined,
        }));
    },
    []
  );

  const duplicateWidgetById = useCallback(
    (widgets: PageWidget[], id: string): PageWidget[] => {
      const result: PageWidget[] = [];
      for (const w of widgets) {
        if (w.id === id) {
          const clone = JSON.parse(JSON.stringify(w)) as PageWidget;
          clone.id = createId();
          if (clone.children) {
            clone.children = clone.children.map((c) => ({ ...c, id: createId() }));
          }
          result.push(w, clone);
        } else if (w.children) {
          result.push({ ...w, children: duplicateWidgetById(w.children, id) });
        } else {
          result.push(w);
        }
      }
      return result;
    },
    []
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
    [layout, findWidget, updateWidget, pushHistory]
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
    [layout, findWidget, updateWidget, pushHistory]
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
    []
  );

  const handleDelete = useCallback(
    (id: string) => {
      const newLayout = deleteWidgetById(layout, id);
      setLayout(newLayout);
      pushHistory(newLayout);
      if (selectedId === id) setSelectedId(null);
    },
    [layout, deleteWidgetById, selectedId, pushHistory]
  );

  const handleDuplicate = useCallback(
    (id: string) => {
      const newLayout = duplicateWidgetById(layout, id);
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [layout, duplicateWidgetById, pushHistory]
  );

  const handleResize = useCallback(
    (id: string, changes: Partial<WidgetStyle>) => {
      const current = findWidget(layout, id);
      if (!current) return;
      const newStyle = { ...current.style, ...changes };
      const newLayout = updateWidget(layout, id, { style: newStyle });
      setLayout(newLayout);
    },
    [layout, findWidget, updateWidget]
  );

  const handleUpdateWidget = useCallback(
    (id: string, changes: Partial<PageWidget>) => {
      const current = findWidget(layout, id);
      if (!current) return;
      const newLayout = updateWidget(layout, id, changes);
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [layout, findWidget, updateWidget, pushHistory]
  );

  const handleCanvasDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveDragId(null);
      setActiveDragType(null);

      if (!over) return;

      const activeId = String(active.id);
      const overId = String(over.id);
      const activeData = active.data.current;

      // ============ CASE 0: LAYER drag ============
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
          }));
        };

        const newLayout = reorderInTree(layout);
        if (JSON.stringify(newLayout) !== JSON.stringify(layout)) {
          setLayout(newLayout);
          pushHistory(newLayout);
        }
        return;
      }

      // ============ CASE 0.5: Drop on EMPTY canvas root ============
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

      // ============ CASE 1: NEW widget from library ============
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
            "container", "section", "column", "grid",
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

      // ============ CASE 2: Move into container drop zone ============
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
          JSON.stringify(deleteWidgetById(layout, activeId))
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

      // ============ CASE 3: Reorder widgets on canvas ============
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
    ]
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
      if (forDevice && forDevice !== "desktop") {
        const responsive: any = { ...(current.style.responsive || {}) };
        responsive[forDevice] = { ...(responsive[forDevice] || {}), ...changes };
        newStyle = { ...current.style, responsive };
      } else {
        newStyle = { ...current.style, ...changes };
      }

      const newLayout = updateWidget(layout, selectedId, { style: newStyle });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, findWidget, updateWidget, pushHistory]
  );

  const updateSelectedContent = useCallback(
    (content: string) => {
      if (!selectedId) return;
      const newLayout = updateWidget(layout, selectedId, { content });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, updateWidget, pushHistory]
  );

  const updateSelectedUrl = useCallback(
    (url: string) => {
      if (!selectedId) return;
      const newLayout = updateWidget(layout, selectedId, { url });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, updateWidget, pushHistory]
  );

  const updateSelectedSettings = useCallback(
    (settings: any) => {
      if (!selectedId) return;
      const current = findWidget(layout, selectedId);
      if (!current) return;
      const newSettings = { ...(current.settings || {}), ...settings };
      const newLayout = updateWidget(layout, selectedId, { settings: newSettings });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, findWidget, updateWidget, pushHistory]
  );

  const updateSelectedItems = useCallback(
    (items: any[]) => {
      if (!selectedId) return;
      const newLayout = updateWidget(layout, selectedId, { items });
      setLayout(newLayout);
      pushHistory(newLayout);
    },
    [selectedId, layout, updateWidget, pushHistory]
  );

  const handleSave = useCallback(
    async (publish: boolean) => {
      if (!title.trim() || !slug.trim()) {
        setMessage("Please enter both page title and slug.");
        return;
      }

      if (!layoutRef.current.length) {
        setMessage("Please add at least one element to the page.");
        return;
      }

      setSaving(true);
      setMessage("");

      const pageData = {
        title: title.trim(),
        slug: slug.trim().toLowerCase(),
        layout: layoutRef.current,
        status: (publish ? "published" : status) as PageStatus,
        globals,
        show_title: showTitle,
      };

      try {
        if (pageId) {
          await updatePage(pageId, pageData);
        } else {
          const result = await createPage({
            ...pageData,
            content_id: contentId || "",
            post_type: urlPostType || "",
          });
          if (result.id) {
            navigate(
              `/admin/appearance/page-builder?id=${result.id}${
                contentId ? `&contentId=${contentId}` : ""
              }${urlPostType ? `&postType=${urlPostType}` : ""}`,
              { replace: true }
            );
          }
        }
        setStatus(pageData.status);
        setMessage(
          publish
            ? "✅ Page published successfully."
            : "✅ Page saved successfully."
        );
      } catch (error: any) {
        console.error("SAVE ERROR:", error?.response?.data);
        setMessage(error?.response?.data?.detail || "Unable to save page.");
      } finally {
        setSaving(false);
      }
    },
    [title, slug, status, globals, showTitle, pageId, contentId, urlPostType, navigate]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === "Delete" && selectedId && !isPreview) {
        const target = e.target as HTMLElement;
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA") {
          handleDelete(selectedId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, undo, redo, selectedId, isPreview, handleDelete]);

  if (loading) {
    return (
      <div className="page-builder-loading">
        {contentId ? "Loading content into builder..." : "Loading page builder..."}
      </div>
    );
  }

  return (
    <div className="page-builder">
      {/* ============ TOP BAR ============ */}
      <header className="builder-topbar">
        <button
          type="button"
          className="builder-back"
          onClick={() => navigate(-1)}
          title="Back"
        >
          ← Back
        </button>

        <div className="builder-page-details">
          <input
            type="text"
            value={title}
            placeholder="Page Title"
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="text"
            value={slug}
            placeholder="page-slug"
            onChange={(e) =>
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))
            }
          />
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
            title="Redo (Ctrl+Shift+Z)"
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
            title="Toggle Preview"
          >
            {isPreview ? "✎" : "👁"}
          </button>

          <button
            type="button"
            className={showTitle ? "active" : ""}
            onClick={() => setShowTitle(!showTitle)}
            title={showTitle ? "Hide title" : "Show title"}
          >
            📄
          </button>

          <span className={`builder-status ${status}`}>{status}</span>

          <button
            type="button"
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

      {/* ============ WORKSPACE ============ */}
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
            </aside>
          )}

          <main
            className="builder-canvas-area"
            onClick={() => setSelectedId(null)}
          >
            <div className="canvas-toolbar">
              <span>Page Canvas</span>
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
                    {layout.map((widget) => (
                      <CanvasRenderer
                        key={widget.id}
                        widget={widget}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onAddInside={(parentId: string, type: WidgetType) =>
                          addWidget(type, parentId)
                        }
                        onResize={handleResize}
                        onUpdateWidget={handleUpdateWidget}
                        device={device}
                        isPreview={isPreview}
                        activeDragType={activeDragType}
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
    </div>
  );
};

export default PageBuilder;