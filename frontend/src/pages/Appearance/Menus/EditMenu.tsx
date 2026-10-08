import { useEffect, useState, type FormEvent } from "react";

import { useNavigate, useParams } from "react-router-dom";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import { getMenu, updateMenu, getMenuSources } from "../../../api/menus";

interface MenuItem {
  id: string;

  label: string;

  url: string;

  source_id?: string;

  source_type?: string;

  parent_id?: string | null;
}

interface MenuSourceItem {
  id: string;

  label: string;

  url: string;

  source_id?: string;

  source_type?: string;

  post_type_slug?: string;

  post_type_name?: string;
}

interface MenuSources {
  pages: MenuSourceItem[];

  posts: MenuSourceItem[];

  categories: MenuSourceItem[];

  tags: MenuSourceItem[];

  products: MenuSourceItem[];

  product_categories: MenuSourceItem[];

  custom_post_types: MenuSourceItem[];

  custom_post_type_items: MenuSourceItem[];
}

interface SortableMenuItemProps {
  item: MenuItem;

  level: number;

  expanded: boolean;

  onToggle: (id: string) => void;

  onDelete: (id: string) => void;

  onLabelChange: (id: string, label: string) => void;

  onUrlChange: (id: string, url: string) => void;
}

const SortableMenuItem = ({
  item,
  level,
  expanded,
  onToggle,
  onDelete,
  onLabelChange,
  onUrlChange,
}: SortableMenuItemProps) => {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({
      id: item.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),

    transition,

    marginLeft: `${level * 35}px`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        level > 0
          ? "menu-builder-item menu-builder-sub-item"
          : "menu-builder-item"
      }
    >
      <div className="menu-builder-item-header">
        <div className="menu-builder-drag" {...attributes} {...listeners}>
          ☰
        </div>

        <div className="menu-builder-item-title">
          <strong>{item.label}</strong>

          {level > 0 && <span>sub item</span>}
        </div>

        <div className="menu-builder-item-type">
          {item.source_type || "Custom Link"}
        </div>

        <button
          type="button"
          className="menu-builder-toggle"
          onClick={() => onToggle(item.id)}
        >
          {expanded ? "▲" : "▼"}
        </button>
      </div>

      {expanded && (
        <div className="menu-builder-item-settings">
          <div className="menu-item-field">
            <label>Navigation Label</label>

            <input
              type="text"
              value={item.label}
              onChange={(event) => onLabelChange(item.id, event.target.value)}
            />
          </div>

          <div className="menu-item-field">
            <label>URL</label>

            <input
              type="text"
              value={item.url}
              onChange={(event) => onUrlChange(item.id, event.target.value)}
            />
          </div>

          <div className="menu-builder-item-actions">
            <button type="button" onClick={() => onDelete(item.id)}>
              Remove
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

const EditMenu = () => {
  const navigate = useNavigate();

  const { menuId } = useParams();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
  );

  const [name, setName] = useState("");

  const [sources, setSources] = useState<MenuSources>({
    pages: [],
    posts: [],
    categories: [],
    tags: [],
    products: [],
    product_categories: [],
    custom_post_types: [],
    custom_post_type_items: [],
  });

  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  const [items, setItems] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);

  const [loadingSources, setLoadingSources] = useState(true);

  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);

  const [openSections, setOpenSections] = useState<string[]>(["pages"]);

  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  const [customLinkUrl, setCustomLinkUrl] = useState("");

  const [customLinkLabel, setCustomLinkLabel] = useState("");

  const [autoAddPages, setAutoAddPages] = useState(false);

  const [locations, setLocations] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!menuId) {
          return;
        }

        const menu = await getMenu(menuId);

        const menuSources = await getMenuSources();

        setName(menu.name || "");

        setItems(menu.items || []);

        setSources(menuSources);

        setAutoAddPages(menu.auto_add_pages || false);

        setLocations(menu.locations || []);
      } catch (error) {
        console.error(error);

        setError("Failed to load menu.");
      } finally {
        setLoading(false);

        setLoadingSources(false);
      }
    };

    loadData();
  }, [menuId]);

  const toggleSection = (section: string) => {
    setOpenSections((current) => {
      if (current.includes(section)) {
        return current.filter((item) => item !== section);
      }

      return [...current, section];
    });
  };

  const toggleItem = (id: string) => {
    setExpandedItems((current) => {
      if (current.includes(id)) {
        return current.filter((item) => item !== id);
      }

      return [...current, id];
    });
  };

  const handleCheckboxChange = (sourceId: string) => {
    setSelectedItems((current) => {
      if (current.includes(sourceId)) {
        return current.filter((id) => id !== sourceId);
      }

      return [...current, sourceId];
    });
  };

  const isAlreadyAdded = (sourceId: string) => {
    return items.some((item) => item.source_id === sourceId);
  };

  const handleAddToMenu = () => {
    setError("");

    const allSources = [
      ...sources.pages,

      ...sources.posts,

      ...sources.categories,

      ...sources.tags,

      ...sources.products,

      ...sources.product_categories,

      ...sources.custom_post_types,

      ...sources.custom_post_type_items,
    ];

    const selectedSources = allSources.filter((source) =>
      selectedItems.includes(source.id),
    );

    const newItems = selectedSources

      .filter(
        (source) =>
          !items.some(
            (item) => item.source_id === (source.source_id || source.id),
          ),
      )

      .map((source) => ({
        id: crypto.randomUUID(),

        label: source.label,

        url: source.url,

        source_id: source.source_id || source.id,

        source_type: source.source_type,

        parent_id: null,
      }));

    if (newItems.length === 0) {
      setError("Please select menu items.");

      return;
    }

    setItems((current) => [...current, ...newItems]);

    setSelectedItems([]);
  };

  const handleAddCustomLink = () => {
    setError("");

    if (!customLinkLabel.trim()) {
      setError("Please enter Link Text.");

      return;
    }

    if (!customLinkUrl.trim()) {
      setError("Please enter URL.");

      return;
    }

    const newItem: MenuItem = {
      id: crypto.randomUUID(),

      label: customLinkLabel.trim(),

      url: customLinkUrl.trim(),

      source_type: "custom",

      parent_id: null,
    };

    setItems((current) => [...current, newItem]);

    setCustomLinkLabel("");

    setCustomLinkUrl("");
  };

  const getLevel = (item: MenuItem, allItems: MenuItem[]): number => {
    let level = 0;

    let parentId = item.parent_id;

    const visited = new Set<string>();

    while (parentId && !visited.has(parentId)) {
      visited.add(parentId);

      const parent = allItems.find((current) => current.id === parentId);

      if (!parent) {
        break;
      }

      level++;

      parentId = parent.parent_id;
    }

    return level;
  };

  const getVisibleItems = (allItems: MenuItem[]) => {
    const result: MenuItem[] = [];

    const addChildren = (parentId: string | null) => {
      allItems.forEach((item) => {
        if ((item.parent_id || null) === parentId) {
          result.push(item);

          addChildren(item.id);
        }
      });
    };

    addChildren(null);

    return result;
  };

  const getSubtree = (id: string, allItems: MenuItem[]) => {
    const result: MenuItem[] = [];

    const addChildren = (parentId: string) => {
      allItems.forEach((item) => {
        if (item.parent_id === parentId) {
          result.push(item);

          addChildren(item.id);
        }
      });
    };

    const item = allItems.find((current) => current.id === id);

    if (item) {
      result.push(item);

      addChildren(item.id);
    }

    return result;
  };

  const wouldCreateCycle = (
    itemId: string,
    parentId: string | null,
    allItems: MenuItem[],
  ) => {
    if (!parentId) {
      return false;
    }

    if (itemId === parentId) {
      return true;
    }

    let currentParent =
      allItems.find((item) => item.id === parentId)?.parent_id || null;

    const visited = new Set<string>();

    while (currentParent && !visited.has(currentParent)) {
      if (currentParent === itemId) {
        return true;
      }

      visited.add(currentParent);

      currentParent =
        allItems.find((item) => item.id === currentParent)?.parent_id || null;
    }

    return false;
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over, delta } = event;

    if (!over) {
      return;
    }

    const visibleItems = getVisibleItems(items);

    const oldIndex = visibleItems.findIndex((item) => item.id === active.id);

    const overIndex = visibleItems.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || overIndex === -1) {
      return;
    }

    const activeItem = visibleItems[oldIndex];

    const subtree = getSubtree(activeItem.id, items);

    const subtreeIds = new Set(subtree.map((item) => item.id));

    if (subtreeIds.has(String(over.id))) {
      return;
    }

    const remaining = visibleItems.filter((item) => !subtreeIds.has(item.id));

    let targetIndex = remaining.findIndex((item) => item.id === over.id);

    if (targetIndex === -1) {
      return;
    }

    if (oldIndex < overIndex) {
      targetIndex++;
    }

    remaining.splice(targetIndex, 0, ...subtree);

    const oldLevel = getLevel(activeItem, items);

    const indentSize = 35;

    const horizontalMove = Math.round(delta.x / indentSize);

    let newLevel = oldLevel + horizontalMove;

    if (newLevel < 0) {
      newLevel = 0;
    }

    if (newLevel > 5) {
      newLevel = 5;
    }

    const activeIndex = remaining.findIndex(
      (item) => item.id === activeItem.id,
    );

    let newParentId: string | null = null;

    if (newLevel > 0) {
      const withoutSubtree = remaining.filter(
        (item) => !subtreeIds.has(item.id),
      );

      for (let index = activeIndex - 1; index >= 0; index--) {
        const possibleParent = remaining[index];

        if (subtreeIds.has(possibleParent.id)) {
          continue;
        }

        const possibleLevel = getLevel(possibleParent, withoutSubtree);

        if (possibleLevel === newLevel - 1) {
          newParentId = possibleParent.id;

          break;
        }
      }
    }

    if (wouldCreateCycle(activeItem.id, newParentId, remaining)) {
      return;
    }

    const updatedItems = remaining.map((item) => {
      if (item.id === activeItem.id) {
        return {
          ...item,

          parent_id: newParentId,
        };
      }

      return item;
    });

    setItems(updatedItems);
  };

  const handleDeleteItem = (id: string) => {
    const subtree = getSubtree(id, items);

    const ids = new Set(subtree.map((item) => item.id));

    setItems((current) => current.filter((item) => !ids.has(item.id)));
  };

  const handleLabelChange = (id: string, label: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              label,
            }
          : item,
      ),
    );
  };

  const handleUrlChange = (id: string, url: string) => {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              url,
            }
          : item,
      ),
    );
  };

  const handleLocationChange = (location: string) => {
    setLocations((current) => {
      if (current.includes(location)) {
        return current.filter((item) => item !== location);
      }

      return [...current, location];
    });
  };

  const renderSource = (
    title: string,
    section: string,
    sourceItems: MenuSourceItem[],
  ) => {
    return (
      <div className="menu-source-accordion">
        <button
          type="button"
          className="menu-source-accordion-header"
          onClick={() => toggleSection(section)}
        >
          <span>{title}</span>

          <span>{openSections.includes(section) ? "▲" : "▼"}</span>
        </button>

        {openSections.includes(section) && (
          <div className="menu-source-accordion-content">
            {sourceItems.length === 0 ? (
              <p>No items found.</p>
            ) : (
              sourceItems.map((source) => {
                const sourceId = source.source_id || source.id;

                const added = isAlreadyAdded(sourceId);

                return (
                  <label key={source.id} className="menu-source-item">
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(source.id)}
                      disabled={added}
                      onChange={() => handleCheckboxChange(source.id)}
                    />

                    <span>
                      {source.label}

                      {added && " (Added)"}
                    </span>
                  </label>
                );
              })
            )}

            {sourceItems.length > 0 && (
              <button
                type="button"
                className="menu-add-items-button"
                onClick={handleAddToMenu}
              >
                Add to Menu
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const visibleItems = getVisibleItems(items);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!menuId) {
      return;
    }

    setError("");

    if (!name.trim()) {
      setError("Menu name is required.");

      return;
    }

    try {
      setSaving(true);

      await updateMenu(menuId, {
        name: name.trim(),

        items,

        auto_add_pages: autoAddPages,

        locations,
      });

      navigate("/admin/appearance/menus");
    } catch (error: any) {
      console.error(error);

      setError(error?.response?.data?.detail || "Failed to update menu.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="content-page">
        <p>Loading menu...</p>
      </div>
    );
  }

  return (
    <div className="content-page">
      <div className="content-page-header">
        <div>
          <h1>Edit Menu</h1>

          <p>Edit and manage your navigation menu.</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="wordpress-menu-top">
          <label>Menu Name</label>

          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Menu Name"
          />
        </div>

        <div className="wordpress-menu-builder">
          <div className="wordpress-menu-left">
            <h2>Add menu items</h2>

            {loadingSources ? (
              <div>Loading menu items...</div>
            ) : (
              <>
                {renderSource("Pages", "pages", sources.pages)}

                {renderSource("Posts", "posts", sources.posts)}

                {renderSource("Categories", "categories", sources.categories)}

                {renderSource("Tags", "tags", sources.tags)}

                {renderSource("Products", "products", sources.products)}

                {renderSource(
                  "Product Categories",
                  "product_categories",
                  sources.product_categories,
                )}

                {renderSource(
                  "Custom Post Types",
                  "custom_post_types",
                  sources.custom_post_types,
                )}

                {renderSource(
                  "Custom Post Type Items",
                  "custom_post_type_items",
                  sources.custom_post_type_items,
                )}

                <div className="menu-source-accordion">
                  <button
                    type="button"
                    className="menu-source-accordion-header"
                    onClick={() => toggleSection("custom-links")}
                  >
                    <span>Custom Links</span>

                    <span>
                      {openSections.includes("custom-links") ? "▲" : "▼"}
                    </span>
                  </button>

                  {openSections.includes("custom-links") && (
                    <div className="menu-source-accordion-content">
                      <div className="menu-custom-link-field">
                        <label>URL</label>

                        <input
                          type="text"
                          value={customLinkUrl}
                          onChange={(event) =>
                            setCustomLinkUrl(event.target.value)
                          }
                          placeholder="https://"
                        />
                      </div>

                      <div className="menu-custom-link-field">
                        <label>Link Text</label>

                        <input
                          type="text"
                          value={customLinkLabel}
                          onChange={(event) =>
                            setCustomLinkLabel(event.target.value)
                          }
                          placeholder="Customer Care"
                        />
                      </div>

                      <button
                        type="button"
                        className="menu-add-items-button"
                        onClick={handleAddCustomLink}
                      >
                        Add to Menu
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="wordpress-menu-right">
            <h2>Menu structure</h2>

            <p className="menu-helper-text">
              Drag the items into the order you prefer. Drag right to make a
              submenu.
            </p>

            <div className="menu-structure-list">
              {visibleItems.length === 0 ? (
                <div className="menu-empty">No menu items added yet.</div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={visibleItems.map((item) => item.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {visibleItems.map((item) => (
                      <SortableMenuItem
                        key={item.id}
                        item={item}
                        level={getLevel(item, items)}
                        expanded={expandedItems.includes(item.id)}
                        onToggle={toggleItem}
                        onDelete={handleDeleteItem}
                        onLabelChange={handleLabelChange}
                        onUrlChange={handleUrlChange}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              )}
            </div>

            <div className="menu-settings">
              <h2>Menu Settings</h2>

              <div className="menu-setting-row">
                <strong>Auto add pages</strong>

                <label>
                  <input
                    type="checkbox"
                    checked={autoAddPages}
                    onChange={(event) => setAutoAddPages(event.target.checked)}
                  />

                  <span>
                    Automatically add new top-level pages to this menu
                  </span>
                </label>
              </div>

              <div className="menu-setting-row">
                <strong>Menu location</strong>

                <label>
                  <input
                    type="checkbox"
                    checked={locations.includes("header")}
                    onChange={() => handleLocationChange("header")}
                  />

                  <span>Header</span>
                </label>

                <label>
                  <input
                    type="checkbox"
                    checked={locations.includes("footer")}
                    onChange={() => handleLocationChange("footer")}
                  />

                  <span>Footer</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        <div className="wordpress-menu-actions">
          <button
            type="button"
            onClick={() => navigate("/admin/appearance/menus")}
          >
            Cancel
          </button>

          <button type="submit" disabled={saving}>
            {saving ? "Updating..." : "Update Menu"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditMenu;
